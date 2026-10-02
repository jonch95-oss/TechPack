import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { packAnswers, packs, type AnswerStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
import { brandHardware, hardwareByCode, loadPack, rebuildLibraryUsage } from "@/lib/data";
import { callTechnicalDesigner } from "@/lib/ai/client";
import { friendlyAIError } from "@/lib/ai/errors";
import { ANALYSE_RENDER_SCHEMA, buildAnalyseInstructions, normaliseAiAnswers, structuredPrefill, type AnalyseRenderOutput } from "@/lib/ai/analyse-render";
import { readCroppedFile } from "@/lib/crop";
import { allQuestions, draftDescription, isEmpty } from "@/lib/questions";

/**
 * AI pre-fill (analyse_render) for one pack, run as a background job: the caller has already checked
 * the user's role and that the pack isn't archived. Never overwrites a confirmed answer.
 */
export type PrefillResult =
  | { ok: true; filled: number; skippedConfirmed: number; dropped: string[]; fixture: boolean }
  | { ok: false; error: string };

/** analyse_render: pre-answers every question it can see; each is marked AI-suggested — confirm. */
export async function prefillPack(packId: string, user: { id: string }, progress: (step: string) => Promise<void> = async () => {}): Promise<PrefillResult> {
  const loaded = await loadPack(packId);
  if (!loaded) return { ok: false, error: "Pack not found." };
  const render = loaded.files.find((f) => f.kind === "render");
  if (!render) return { ok: false, error: "Upload the render first." };
  let output: AnalyseRenderOutput;
  let model = "";
  let fixture = false;
  try {
    await progress("Reading the render");
    const img = await readCroppedFile(render);
    const res = await callTechnicalDesigner<AnalyseRenderOutput>({
      task: "analyse_render",
      instructions: buildAnalyseInstructions({
        category: loaded.pack.category,
        brand: loaded.brand.name,
        styleNo: loaded.pack.styleNo,
        styleName: loaded.pack.styleName,
        colorways: loaded.pack.colorways,
        hardwareLibrary: await brandHardware(loaded.brand.id),
      }),
      images: [img],
      schema: ANALYSE_RENDER_SCHEMA,
      fixtureName: `analyse_render.${loaded.pack.styleNo}`,
    });
    output = res.output;
    await progress("Filling in the answers");
    model = res.model;
    fixture = res.fixture;
  } catch (e) {
    return { ok: false, error: friendlyAIError(e, "claude", "AI pre-fill") };
  }

  const hwByCode = await hardwareByCode();
  const { answers, materials, dropped } = normaliseAiAnswers(loaded.pack.category, output, hwByCode);
  const structured = structuredPrefill(output, hwByCode);
  let filled = 0;
  let skippedConfirmed = 0;
  const now = new Date();
  const write = async (questionId: string, value: unknown, status: Exclude<AnswerStatus, "confirmed">, note: string) => {
    // Never overwrite something a designer already confirmed.
    if (loaded.statuses[questionId] === "confirmed") {
      skippedConfirmed++;
      return;
    }
    await db
      .insert(packAnswers)
      .values({ packId, questionId, value, status, aiNote: note, aiValue: value, updatedBy: user.id, updatedAt: now })
      .onConflictDoUpdate({
        target: [packAnswers.packId, packAnswers.questionId],
        set: { value, status, aiNote: note, aiValue: value, updatedBy: user.id, updatedAt: now },
      });
    filled++;
  };
  for (const a of answers) await write(a.questionId, a.value, a.status, a.note);
  if (materials.length) await write("materials.list", materials, "ai", "MATERIALS SEEN ON RENDER");
  // Structured rows from what the render shows (AI-suggested — each row is confirmed by the designer).
  const has = (id: string) => allQuestions(loaded.pack.category).some((q) => q.id === id && q.kind === "rows");
  const pocketQ = allQuestions(loaded.pack.category).find((q) => q.id.endsWith(".ext_pockets") && q.kind === "rows")?.id;
  if (pocketQ && structured.pocketRows.length) await write(pocketQ, structured.pocketRows, "ai", `${structured.pocketRows.length} EXTERIOR POCKET(S) SEEN`);
  if (has("hardware.items") && structured.hardwareRows.length)
    await write("hardware.items", structured.hardwareRows, "ai", "HARDWARE SEEN ON RENDER — PICK EACH PART FROM THE LIBRARY");
  if (has("zippers.list") && structured.zipperRows.length) await write("zippers.list", structured.zipperRows, "ai", `${structured.zipperRows.length} ZIPPER(S) SEEN`);
  // Colourways: the count follows the render while no colourway renders are uploaded; names are AI-suggested.
  let colorways = loaded.pack.colorways;
  const names = structured.colorwayNames;
  if (names.length && names.length !== colorways.length && !loaded.files.some((f) => f.kind === "colorway_render")) {
    colorways = names.map((_, i) => `-${String.fromCharCode(65 + i)}`);
    await db.update(packs).set({ colorways }).where(eq(packs.id, packId));
  }
  if (names.length) await write("colorways.names", Object.fromEntries(colorways.map((c, i) => [c, names[i] ?? ""]).filter(([, v]) => v)), "ai", `COLOURWAY(S) SEEN: ${names.join(", ")}`);
  if (isEmpty(loaded.answers["header.description"])) {
    const merged = { ...loaded.answers, ...Object.fromEntries(answers.map((a) => [a.questionId, a.value])) };
    await write("header.description", draftDescription(loaded.pack.category, merged), "ai", "AUTO-DRAFTED FROM ANSWERS");
  }
  await db
    .update(packs)
    .set({
      aiAnalysis: {
        visible_features: output.visible_features ?? [],
        not_visible: output.not_visible ?? [],
        agent_notes: output.agent_notes ?? "",
        ran_at: now.toISOString(),
        model,
      },
      updatedBy: user.id,
      updatedAt: now,
    })
    .where(eq(packs.id, packId));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "ai", field: "analyse_render", after: { filled, dropped, model } });
  const after = await loadPack(packId);
  if (after) await rebuildLibraryUsage(packId, after.answers);
  return { ok: true, filled, skippedConfirmed, dropped, fixture };
}

