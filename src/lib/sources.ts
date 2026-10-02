import "server-only";
import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hardware, materials, packAnswers, packFiles, type AnswerStatus, type PackFile } from "@/db/schema";
import { audit } from "@/lib/audit";
import { callTechnicalDesigner } from "@/lib/ai/client";
import { buildSourceInstructions, normaliseSource, READ_SOURCE_SCHEMA, sourceLabel, type ReadSourceOutput, type SourceKind } from "@/lib/ai/read-source";
import { buildSwatchInstructions, normaliseChipBox, READ_SWATCH_SCHEMA, SWATCH_FIELDS, type ReadSwatchOutput } from "@/lib/ai/read-swatch";
import { checkComponentCode, hardwareByCode, loadPack, materialLabel, rebuildLibraryUsage, type LoadedPack } from "@/lib/data";
import { normaliseField, normaliseType } from "@/lib/library-import";
import type { LibValue, MatrixValue } from "@/lib/questions";
import { readStoredFile } from "@/lib/storage";

export type SourceResult = { answered: number; skippedConfirmed: number; created: string[]; linked: string[]; boardNotes: string[]; dropped: string[] };

/** Everything the AI reads for a pack besides the render. */
export const SOURCE_KINDS = ["spec_sheet", "view_photo", "scale_photo", "swatch_photo", "hardware_sheet"] as const;

/** A spreadsheet as tab-separated text (every sheet), for the model to read. */
async function sheetText(data: Buffer, name: string): Promise<string> {
  if (/\.csv$/i.test(name)) return data.toString("utf8");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  const out: string[] = [];
  for (const ws of wb.worksheets) {
    out.push(`# SHEET ${ws.name}`);
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells = (row.values as unknown[]).slice(1).map((v) => {
        if (v == null) return "";
        if (typeof v === "object") {
          const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
          return o.richText ? o.richText.map((t) => t.text).join("") : String(o.text ?? o.result ?? "");
        }
        return String(v);
      });
      out.push(cells.join("\t"));
    });
  }
  return out.join("\n");
}

/**
 * Reads one uploaded source with the AI and writes what it finds into the pack. Answers a designer
 * already confirmed are never touched. Every answer is marked "From <source> — confirm" (EST for
 * measurements read off a ruler).
 */
export async function readSource(packId: string, fileId: string, user: { id: string }, progress: (s: string) => Promise<void>): Promise<SourceResult> {
  const p = await loadPack(packId);
  if (!p) throw new Error("Pack not found.");
  const [file] = await db.select().from(packFiles).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, packId)));
  if (!file) throw new Error("That upload was removed.");
  const result: SourceResult = { answered: 0, skippedConfirmed: 0, created: [], linked: [], boardNotes: [], dropped: [] };
  await progress("Reading the upload");
  const f = await readStoredFile(file.url);

  if (file.kind === "swatch_photo") await readSwatch(p, file, f, user, result);
  else await readGeneric(p, file, f, user, result, progress);

  const summary = [
    result.answered && `${result.answered} ANSWER(S)`,
    result.created.length && `NEW IN LIBRARY: ${result.created.join(", ")}`,
    result.linked.length && `LINKED: ${result.linked.join(", ")}`,
  ]
    .filter(Boolean)
    .join(" · ");
  await db.update(packFiles).set({ note: (summary || "NOTHING NEW FOUND").slice(0, 300) }).where(eq(packFiles.id, file.id));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "ai", field: `source:${file.kind}`, after: { file: file.name, ...result } });
  const after = await loadPack(packId);
  if (after) await rebuildLibraryUsage(packId, after.answers);
  return result;
}

/** Writes one answer unless it was confirmed; status sourced (or est), with where it came from. */
function writer(p: LoadedPack, user: { id: string }, result: SourceResult) {
  return async (questionId: string, value: unknown, status: Exclude<AnswerStatus, "confirmed">, source: string, note: string) => {
    if (p.statuses[questionId] === "confirmed") {
      result.skippedConfirmed++;
      return;
    }
    const now = new Date();
    await db
      .insert(packAnswers)
      .values({ packId: p.pack.id, questionId, value, status, source, aiNote: note, aiValue: value, updatedBy: user.id, updatedAt: now })
      .onConflictDoUpdate({ target: [packAnswers.packId, packAnswers.questionId], set: { value, status, source, aiNote: note, aiValue: value, updatedBy: user.id, updatedAt: now } });
    p.answers[questionId] = value;
    result.answered++;
  };
}

async function readGeneric(p: LoadedPack, file: PackFile, f: { data: Buffer; contentType: string }, user: { id: string }, result: SourceResult, progress: (s: string) => Promise<void>) {
  const kind = file.kind as SourceKind;
  const unit = p.answers["dims.unit"] === "INCHES" ? "in" : "cm";
  const isPdf = f.contentType.includes("pdf") || /\.pdf$/i.test(file.name);
  const isSheet = /\.(xlsx|csv)$/i.test(file.name) || /spreadsheet|csv/.test(f.contentType);
  if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files can't be read — save it as .xlsx or export CSV, then upload again.");
  const res = await callTechnicalDesigner<ReadSourceOutput>({
    task: "read_source",
    instructions: buildSourceInstructions({ kind, view: file.tag, category: p.pack.category, styleNo: p.pack.styleNo, unit, answers: p.answers, sheetText: isSheet ? await sheetText(f.data, file.name) : undefined }),
    images: isPdf || isSheet ? [] : [f],
    pdfs: isPdf ? [f.data] : [],
    schema: READ_SOURCE_SCHEMA,
    fixtureName: [`read_source.${kind}.${p.pack.styleNo}`, `read_source.${kind}`],
  });
  await progress("Filling in the answers");
  const out = res.output;
  result.boardNotes = (out.board_notes ?? []).map((n) => n.toUpperCase());
  const hw = await hardwareByCode();
  const { values, notes, dropped } = normaliseSource(p.pack.category, out, p.answers, unit, hw);
  result.dropped = dropped;
  const source = sourceLabel(kind, file.tag);
  const write = writer(p, user, result);
  for (const [qid, v] of Object.entries(values)) {
    // A ruler gives estimates; everything read off a sheet or seen on a photo is "from <source>".
    const status = kind === "scale_photo" && isMeasure(qid) ? "est" : "sourced";
    await write(qid, v, status, source, (notes[qid] ?? []).join("; ").slice(0, 400) || `FROM ${source}`);
  }
  if (out.hardware?.length) await linkHardware(p, out.hardware, source, write, result);
}

const isMeasure = (qid: string) => /^dims\.|\.width$|\.length$|\.drop$|\.height$|_height$|pom\.list|adjust_m(in|ax)/.test(qid);

/** Hardware from a photo / supplier sheet: match the brand's library (type + size) or add it with the next free code, then link it on the pack. */
async function linkHardware(p: LoadedPack, parts: NonNullable<ReadSourceOutput["hardware"]>, source: string, write: ReturnType<typeof writer>, result: SourceResult) {
  const lib = await db.select().from(hardware).where(eq(hardware.brandId, p.brand.id));
  const rows = ((p.answers["hardware.items"] as Record<string, unknown>[] | undefined) ?? []).map((r) => ({ ...r }));
  const norm = (s: string) => s.toUpperCase().replace(/[^0-9A-Z.]+/g, " ").trim();
  for (const part of parts) {
    const type = normaliseType(part.type || part.description);
    const dims = norm(part.dims_mm || "");
    let item = lib.find((h) => h.type === type && dims && norm(h.dimsMm) === dims) ?? lib.find((h) => part.supplier_code && h.notes.toUpperCase().includes(part.supplier_code.toUpperCase()));
    if (!item) {
      const code = (await checkComponentCode(p.brand.id, "")).suggestion;
      if (!code) continue;
      [item] = await db
        .insert(hardware)
        .values({
          brandId: p.brand.id,
          code,
          type,
          name: (part.description || type).toUpperCase(),
          dimsMm: (part.dims_mm || "").toUpperCase(),
          material: normaliseField("hardware", "material", part.material),
          finish: normaliseField("hardware", "finish", part.finish),
          notes: [`FROM ${source}`, part.supplier_code && `SUPPLIER CODE ${part.supplier_code.toUpperCase()}`].filter(Boolean).join(" · "),
        })
        .returning();
      lib.push(item);
      result.created.push(code);
    }
    const value: LibValue = { id: item.id, label: item.code };
    // The first pack row of this type still waiting for its part gets it; otherwise add a row.
    const words = norm(`${type} ${part.description}`).split(" ").filter((w) => w.length > 3);
    const i = rows.findIndex((r) => !r.item && words.some((w) => norm(String(r.seen ?? "")).includes(w)));
    const size = part.dims_mm ? `${part.dims_mm.toUpperCase()} MM`.replace(/MM MM$/, "MM") : undefined;
    if (i >= 0) rows[i] = { ...rows[i], item: value, ...(size && !rows[i].size ? { size } : {}) };
    else if (!rows.some((r) => (r.item as LibValue | undefined)?.id === item.id)) rows.push({ item: value, qty: 1, seen: (part.description || type).toUpperCase(), ...(size ? { size } : {}) });
    result.linked.push(item.code);
  }
  await write("hardware.items", rows, "sourced", source, `PARTS FROM ${source}: ${result.linked.join(", ")}`);
}

/** Swatch card: read it, match a library material (supplier + colour no. + article) or add one, and put it in the breakdown cell. */
async function readSwatch(p: LoadedPack, file: PackFile, f: { data: Buffer; contentType: string }, user: { id: string }, result: SourceResult) {
  const [callout, colorway] = file.tag.split("|");
  const res = await callTechnicalDesigner<ReadSwatchOutput>({
    task: "read_swatch_card",
    instructions: buildSwatchInstructions({}),
    images: [f],
    schema: READ_SWATCH_SCHEMA,
    fixtureName: [`read_swatch_card.${p.pack.styleNo}${colorway ?? ""}`, "read_swatch_card"],
  });
  const fields: Record<string, string> = {};
  for (const k of SWATCH_FIELDS) fields[k] = normaliseField("material", k, res.output[k]);
  const all = await db.select().from(materials);
  const key = (m: { supplier: string; colourNo: string; articleName: string }) => [m.supplier, m.colourNo.replace(/^#/, ""), m.articleName].map((x) => x.trim().toUpperCase()).join("|");
  const wanted = key({ supplier: fields.supplier, colourNo: fields.colourNo, articleName: fields.articleName });
  let mat = all.find((m) => key(m) === wanted);
  if (!mat) {
    [mat] = await db
      .insert(materials)
      .values({
        ...(fields as Record<(typeof SWATCH_FIELDS)[number], string>),
        cardPhotoUrl: file.url,
        chipBox: normaliseChipBox(res.output.chip_box),
        fieldStatus: Object.fromEntries(SWATCH_FIELDS.filter((k) => fields[k]).map((k) => [k, "ai" as const])),
        aiNotes: res.output.agent_notes ?? "",
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();
    result.created.push(materialLabel(mat));
  } else result.linked.push(materialLabel(mat));
  if (!callout || !colorway) return;
  const matrix = structuredClone((p.answers["materials.matrix"] as MatrixValue | undefined) ?? {});
  matrix[colorway] = { ...(matrix[colorway] ?? {}), [`mat_${callout}`]: { lib: { id: mat.id, label: materialLabel(mat) } } };
  await writer(p, user, result)("materials.matrix", matrix, "sourced", "SWATCH CARD", `SWATCH CARD FOR MATERIAL ${callout} ${colorway}: ${materialLabel(mat)}`);
}
