"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, hardware, packAnswers, packFiles, packs, type AnswerStatus } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { brandHardware, hardwareByCode, loadPack, rebuildLibraryUsage } from "@/lib/data";
import { readStoredFile } from "@/lib/storage";
import { AIUnavailableError, callTechnicalDesigner } from "@/lib/ai/client";
import {
  ANALYSE_RENDER_SCHEMA,
  buildAnalyseInstructions,
  normaliseAiAnswers,
  type AnalyseRenderOutput,
} from "@/lib/ai/analyse-render";
import { CATEGORIES, draftDescription, findQuestion, isEmpty, optionalToggleId, sectionsFor, type Category } from "@/lib/questions";
import type { ActionResult } from "./admin";
import { suffixesFor } from "@/lib/codes";

export type CreatePackState = { error?: string } | undefined;

export async function createPack(_prev: CreatePackState, form: FormData): Promise<CreatePackState> {
  const user = await requireRole("designer");
  const brandId = String(form.get("brandId") ?? "");
  const category = String(form.get("category") ?? "") as Category;
  const styleNo = String(form.get("styleNo") ?? "").trim().toUpperCase();
  const styleName = String(form.get("styleName") ?? "").trim().toUpperCase();
  const count = Number(form.get("colorways") ?? 1);
  if (!brandId) return { error: "Pick a brand." };
  if (!CATEGORIES.includes(category)) return { error: "Pick a category." };
  if (!/^[A-Z0-9_-]{3,30}$/.test(styleNo)) return { error: "Style # — letters, digits, _ or -, e.g. PINK013 or TB25_ACC0023." };
  if (!styleName) return { error: "Style name is required." };
  if (!Number.isInteger(count) || count < 1 || count > 26) return { error: "Colorways: 1–26." };
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
  if (!brand) return { error: "Unknown brand." };
  const dup = await db.select({ id: packs.id }).from(packs).where(eq(packs.styleNo, styleNo));
  if (dup.length) return { error: `${styleNo} already exists.` };
  const clash = await db.select({ id: hardware.id }).from(hardware).where(eq(hardware.code, styleNo));
  if (clash.length) return { error: `${styleNo} is already a component code — styles and components can't share a number.` };
  const [p] = await db
    .insert(packs)
    .values({
      brandId,
      category,
      styleNo,
      styleName,
      colorways: suffixesFor(count),
      sentBy: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: packs.id });
  await audit({ userId: user.id, entity: "pack", entityId: p.id, action: "create", after: { brand: brand.name, category, styleNo, styleName, count } });
  redirect(`/packs/${p.id}`);
}

export async function updatePackSetup(
  packId: string,
  patch: { styleName?: string; colorways?: string[]; brandId?: string; chineseOn?: boolean },
): Promise<ActionResult> {
  const user = await requireRole("designer");
  const [before] = await db.select().from(packs).where(eq(packs.id, packId));
  if (!before) return { ok: false, error: "Pack not found." };
  const set: Partial<typeof packs.$inferInsert> = { updatedBy: user.id, updatedAt: new Date() };
  if (patch.styleName !== undefined) {
    if (!patch.styleName.trim()) return { ok: false, error: "Style name is required." };
    set.styleName = patch.styleName.trim().toUpperCase();
  }
  if (patch.colorways) {
    const cws = [...new Set(patch.colorways.map((c) => c.trim().toUpperCase()).filter(Boolean))];
    if (!cws.length) return { ok: false, error: "At least one colorway." };
    if (cws.some((c) => !/^-[A-Z0-9]{1,3}$/.test(c))) return { ok: false, error: "Suffixes look like -A, -B …" };
    set.colorways = cws;
  }
  if (patch.brandId) set.brandId = patch.brandId;
  if (typeof patch.chineseOn === "boolean") set.chineseOn = patch.chineseOn;
  await db.update(packs).set(set).where(eq(packs.id, packId));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", before, after: set });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

/** Free text in answers is printed in CAPITALS (house style). */
function upperDeep(v: unknown): unknown {
  if (typeof v === "string") return v.toUpperCase();
  if (Array.isArray(v)) return v.map(upperDeep);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = k === "id" ? x : upperDeep(x);
    return out;
  }
  return v;
}

function knownQuestion(category: Category, qid: string) {
  if (qid.startsWith("optional.")) return sectionsFor(category).some((s) => s.optional && optionalToggleId(s.id) === qid);
  return Boolean(findQuestion(category, qid));
}

/** Saves a designer's answer. Anything a designer sets is CONFIRMED. */
export async function saveAnswer(packId: string, questionId: string, value: unknown): Promise<ActionResult & { updatedAt?: string }> {
  const user = await requireRole("designer");
  const [p] = await db.select().from(packs).where(eq(packs.id, packId));
  if (!p) return { ok: false, error: "Pack not found." };
  if (!knownQuestion(p.category as Category, questionId)) return { ok: false, error: `Unknown question ${questionId}.` };
  const [prev] = await db
    .select()
    .from(packAnswers)
    .where(and(eq(packAnswers.packId, packId), eq(packAnswers.questionId, questionId)));
  const v = upperDeep(value);
  const now = new Date();
  if (isEmpty(v) && v !== false) {
    await db.delete(packAnswers).where(and(eq(packAnswers.packId, packId), eq(packAnswers.questionId, questionId)));
  } else {
    await db
      .insert(packAnswers)
      .values({ packId, questionId, value: v, status: "confirmed", updatedBy: user.id, updatedAt: now })
      .onConflictDoUpdate({
        target: [packAnswers.packId, packAnswers.questionId],
        set: {
          value: v,
          status: "confirmed",
          // keep what the AI first suggested when a designer overrides it
          aiValue: prev && prev.status !== "confirmed" ? prev.value : prev?.aiValue ?? null,
          updatedBy: user.id,
          updatedAt: now,
        },
      });
  }
  await db.update(packs).set({ updatedBy: user.id, updatedAt: now }).where(eq(packs.id, packId));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: questionId, before: prev?.value ?? null, after: v });
  const loaded = await loadPack(packId);
  if (loaded) await rebuildLibraryUsage(packId, loaded.answers);
  return { ok: true, updatedAt: now.toISOString() };
}

/** One-click confirm of an AI-suggested / EST / INFERRED answer. */
export async function confirmAnswer(packId: string, questionId: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  const [prev] = await db
    .select()
    .from(packAnswers)
    .where(and(eq(packAnswers.packId, packId), eq(packAnswers.questionId, questionId)));
  if (!prev) return { ok: false, error: "Nothing to confirm." };
  await db
    .update(packAnswers)
    .set({ status: "confirmed", updatedBy: user.id, updatedAt: new Date() })
    .where(and(eq(packAnswers.packId, packId), eq(packAnswers.questionId, questionId)));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: questionId, before: { status: prev.status }, after: { status: "confirmed" } });
  return { ok: true };
}

export type PrefillResult =
  | { ok: true; filled: number; skippedConfirmed: number; dropped: string[]; fixture: boolean }
  | { ok: false; error: string };

/** analyse_render: pre-answers every question it can see; each is marked AI-suggested — confirm. */
export async function runPrefill(packId: string): Promise<PrefillResult> {
  const user = await requireRole("designer");
  const loaded = await loadPack(packId);
  if (!loaded) return { ok: false, error: "Pack not found." };
  const render = loaded.files.find((f) => f.kind === "render");
  if (!render) return { ok: false, error: "Upload the render first." };
  let output: AnalyseRenderOutput;
  let model = "";
  let fixture = false;
  try {
    const img = await readStoredFile(render.url);
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
    model = res.model;
    fixture = res.fixture;
  } catch (e) {
    if (e instanceof AIUnavailableError) return { ok: false, error: "AI pre-fill is not configured (ANTHROPIC_API_KEY). Answer the questions directly." };
    return { ok: false, error: `AI pre-fill failed: ${(e as Error).message}` };
  }

  const { answers, materials, dropped } = normaliseAiAnswers(loaded.pack.category, output, await hardwareByCode());
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
  revalidatePath(`/packs/${packId}`);
  return { ok: true, filled, skippedConfirmed, dropped, fixture };
}

export async function addPackFile(
  packId: string,
  file: { kind: "render" | "colorway_render" | "reference" | "construction" | "reference_sample" | "swatch_photo"; url: string; name: string; tag?: string; note?: string },
): Promise<ActionResult> {
  const user = await requireRole("designer");
  if (file.kind === "render") {
    // A single render is the expected input; replacing it keeps the pack to one.
    await db.delete(packFiles).where(and(eq(packFiles.packId, packId), eq(packFiles.kind, "render")));
  }
  let tag = file.tag ?? "";
  if (!tag && (file.kind === "reference" || file.kind === "construction")) tag = await nextLetter(packId);
  const [f] = await db
    .insert(packFiles)
    .values({ packId, kind: file.kind, url: file.url, name: file.name, tag: tag.toUpperCase(), note: (file.note ?? "").toUpperCase(), createdBy: user.id })
    .returning({ id: packFiles.id });
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "create", field: `file:${file.kind}`, after: { id: f.id, name: file.name, tag } });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

export async function updatePackFile(packId: string, fileId: string, patch: { tag?: string; note?: string }): Promise<ActionResult> {
  const user = await requireRole("designer");
  const set: Partial<typeof packFiles.$inferInsert> = {};
  if (patch.tag !== undefined) set.tag = patch.tag.toUpperCase();
  if (patch.note !== undefined) set.note = patch.note.toUpperCase();
  await db.update(packFiles).set(set).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, packId)));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: `file:${fileId}`, after: set });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

export async function removePackFile(packId: string, fileId: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  const [before] = await db.select().from(packFiles).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, packId)));
  await db.delete(packFiles).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, packId)));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "delete", field: "file", before });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

/** Comment letters are shared between written comments and reference photos (A, B, C …). */
async function nextLetter(packId: string) {
  const files = await db.select({ tag: packFiles.tag }).from(packFiles).where(eq(packFiles.packId, packId));
  const [c] = await db
    .select({ value: packAnswers.value })
    .from(packAnswers)
    .where(and(eq(packAnswers.packId, packId), eq(packAnswers.questionId, "comments.list")));
  const n = Array.isArray(c?.value) ? c.value.length : 0;
  const used = new Set(files.map((f) => f.tag).filter(Boolean));
  for (let i = 0; i < n; i++) used.add(String.fromCharCode(65 + i));
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(65 + i);
    if (!used.has(l)) return l;
  }
  return "";
}

/** One-click spelling correction: replaces the whole word everywhere it appears in the pack's answers. */
export async function applySpelling(packId: string, word: string, replacement: string): Promise<ActionResult & { changed?: number }> {
  const user = await requireRole("designer");
  const loaded = await loadPack(packId);
  if (!loaded) return { ok: false, error: "Pack not found." };
  const re = new RegExp(`(^|[^A-Z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^A-Z0-9])`, "gi");
  let changed = 0;
  const fix = (v: unknown, key = ""): unknown => {
    if (typeof v === "string") {
      if (key === "id" || key === "label") return v;
      const next = v.replace(re, (_m, pre) => `${pre}${replacement.toUpperCase()}`);
      if (next !== v) changed++;
      return next;
    }
    if (Array.isArray(v)) return v.map((x) => fix(x));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x, k)]));
    return v;
  };
  const now = new Date();
  for (const [qid, value] of Object.entries(loaded.answers)) {
    const before = changed;
    const next = fix(value);
    if (changed === before) continue;
    await db
      .update(packAnswers)
      .set({ value: next, updatedBy: user.id, updatedAt: now })
      .where(and(eq(packAnswers.packId, packId), eq(packAnswers.questionId, qid)));
    await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: qid, before: value, after: next });
  }
  revalidatePath(`/packs/${packId}`);
  return { ok: true, changed };
}
