"use server";

import { cleanCrop, detectProductBox, type CropBox } from "@/lib/crop";
import { PAGE_SECTIONS } from "@/lib/page-names";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, hardware, packAnswers, packFiles, packs, users, type FileMarks } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { loadPack, rebuildLibraryUsage } from "@/lib/data";
import { confirmAnswers as confirmMany, currentAnswer, keepCurrent, switchToConflict, writeAnswer } from "@/lib/answer-write";
import { readStoredFile } from "@/lib/storage";
import { CATEGORIES, findQuestion, optionalToggleId, sectionsFor, type Category } from "@/lib/questions";
import type { ActionResult } from "./admin";
import { prefillPack, type PrefillResult } from "@/lib/prefill";
import { startJob } from "@/lib/jobs";
import { suffixesFor } from "@/lib/codes";
import { remapAnswers, remapTag, removeColorway } from "@/lib/colorways";

export type CreatePackState = { error?: string } | undefined;

const ARCHIVED = "This pack is archived and read-only. An admin can restore it.";
async function isArchived(packId: string) {
  const [row] = await db.select({ archivedAt: packs.archivedAt }).from(packs).where(eq(packs.id, packId));
  return !!row?.archivedAt;
}

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

/**
 * Brand, category, style #, style name and colourways stay editable after creation (V2 §3 step 2).
 * Removing a colourway re-letters the ones after it (-A, -B …) and moves their data with them.
 */
export async function updatePackSetup(
  packId: string,
  patch: { styleNo?: string; styleName?: string; colorways?: string[]; removeColorway?: string; brandId?: string; category?: string; chineseOn?: boolean; stage?: "PROTO" | "PRODUCTION" },
): Promise<ActionResult & { colorways?: string[] }> {
  const user = await requireRole("designer");
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
  const [before] = await db.select().from(packs).where(eq(packs.id, packId));
  if (!before) return { ok: false, error: "Pack not found." };
  const set: Partial<typeof packs.$inferInsert> = { updatedBy: user.id, updatedAt: new Date() };
  if (patch.styleNo !== undefined) {
    const styleNo = patch.styleNo.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(styleNo)) return { ok: false, error: "Style # — letters, digits, _ or -, e.g. PINK013 or TB25_ACC0023." };
    if (styleNo !== before.styleNo) {
      const dup = await db.select({ id: packs.id }).from(packs).where(and(eq(packs.styleNo, styleNo), ne(packs.id, packId)));
      if (dup.length) return { ok: false, error: `${styleNo} already exists.` };
      const clash = await db.select({ id: hardware.id }).from(hardware).where(eq(hardware.code, styleNo));
      if (clash.length) return { ok: false, error: `${styleNo} is already a component code — styles and components can't share a number.` };
      set.styleNo = styleNo;
    }
  }
  if (patch.styleName !== undefined) {
    if (!patch.styleName.trim()) return { ok: false, error: "Style name is required." };
    set.styleName = patch.styleName.trim().toUpperCase();
  }
  if (patch.category !== undefined) {
    if (!CATEGORIES.includes(patch.category as Category)) return { ok: false, error: "Pick a category." };
    // Answers that don't apply to the new category are kept (hidden), so switching back loses nothing.
    set.category = patch.category;
  }
  if (patch.colorways) {
    const cws = [...new Set(patch.colorways.map((c) => c.trim().toUpperCase()).filter(Boolean))];
    if (!cws.length) return { ok: false, error: "At least one colorway." };
    if (cws.some((c) => !/^-[A-Z0-9]{1,3}$/.test(c))) return { ok: false, error: "Suffixes look like -A, -B …" };
    set.colorways = cws;
  }
  if (patch.removeColorway) {
    if (before.colorways.length <= 1) return { ok: false, error: "At least one colorway." };
    if (!before.colorways.includes(patch.removeColorway)) return { ok: false, error: "No such colorway." };
    const { next, map } = removeColorway(before.colorways, patch.removeColorway);
    set.colorways = next;
    const rows = await db.select({ q: packAnswers.questionId, v: packAnswers.value }).from(packAnswers).where(eq(packAnswers.packId, packId));
    const moved = remapAnswers(Object.fromEntries(rows.map((r) => [r.q, r.v])), map);
    for (const [q, v] of Object.entries(moved)) await db.update(packAnswers).set({ value: v }).where(and(eq(packAnswers.packId, packId), eq(packAnswers.questionId, q)));
    const files = await db.select().from(packFiles).where(eq(packFiles.packId, packId));
    for (const f of files) {
      const tag = remapTag(f.tag, map);
      if (tag === f.tag) continue;
      if (tag === null && f.kind === "colorway_render") await db.delete(packFiles).where(eq(packFiles.id, f.id));
      else await db.update(packFiles).set({ tag: tag ?? f.tag.split("|")[0] }).where(eq(packFiles.id, f.id));
    }
  }
  if (patch.brandId) {
    const [b] = await db.select({ id: brands.id }).from(brands).where(eq(brands.id, patch.brandId));
    if (!b) return { ok: false, error: "Unknown brand." };
    set.brandId = patch.brandId;
  }
  if (typeof patch.chineseOn === "boolean") set.chineseOn = patch.chineseOn;
  if (patch.stage === "PROTO" || patch.stage === "PRODUCTION") set.stage = patch.stage;
  await db.update(packs).set(set).where(eq(packs.id, packId));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", before, after: { ...set, removeColorway: patch.removeColorway } });
  revalidatePath(`/packs/${packId}`);
  return { ok: true, colorways: set.colorways ?? before.colorways };
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

const hasLibraryRef = (v: unknown) => /"id":"[0-9a-f-]{36}"/i.test(JSON.stringify(v ?? null));
async function rebuildUsage(packId: string) {
  const rows = await db.select({ q: packAnswers.questionId, v: packAnswers.value }).from(packAnswers).where(eq(packAnswers.packId, packId));
  await rebuildLibraryUsage(packId, Object.fromEntries(rows.map((r) => [r.q, r.v])));
}

/** Values the client may write besides a designer's own: one-click fills computed from other answers. */
export type ClientOrigin = "DESIGNER" | "DERIVED";

export type SaveResult = (ActionResult & { updatedAt?: string }) | { ok: false; error: string; stale: { by: string; at: string } };

/**
 * Saves a designer's answer (or a derived fill the designer clicked). Both are settled.
 * `base` is the answer's updatedAt the client last saw: if someone else changed it since, nothing is
 * overwritten — the client asks "<name> changed this — reload / keep mine" (keep mine = force).
 */
export async function saveAnswer(
  packId: string,
  questionId: string,
  value: unknown,
  origin: ClientOrigin = "DESIGNER",
  opts: { base?: string | null; force?: boolean } = {},
): Promise<SaveResult> {
  const user = await requireRole("designer");
  // One query for the pack (archived, category, status) and the current answer together.
  const [[p], prev] = await Promise.all([
    db.select({ category: packs.category, status: packs.status, archivedAt: packs.archivedAt }).from(packs).where(eq(packs.id, packId)),
    currentAnswer(packId, questionId),
  ]);
  if (!p) return { ok: false, error: "Pack not found." };
  if (p.archivedAt) return { ok: false, error: ARCHIVED };
  if (!knownQuestion(p.category as Category, questionId)) return { ok: false, error: `Unknown question ${questionId}.` };
  if (!opts.force && opts.base !== undefined && prev?.updatedAt && prev.updatedBy && prev.updatedBy !== user.id && (!opts.base || prev.updatedAt.getTime() > new Date(opts.base).getTime() + 1)) {
    const [who] = await db.select({ name: users.name }).from(users).where(eq(users.id, prev.updatedBy));
    return { ok: false, error: `${who?.name ?? "Someone"} changed this.`, stale: { by: who?.name ?? "Someone", at: prev.updatedAt.toISOString() } };
  }
  const v = upperDeep(value);
  const now = new Date();
  // Any change after review / sign-off sends the pack back to draft — the approval no longer covers it.
  const reopen = p.status === "IN_REVIEW" || p.status === "APPROVED";
  await Promise.all([
    writeAnswer({ packId, questionId, value: v, origin: origin === "DERIVED" ? "DERIVED" : "DESIGNER", userId: user.id }, prev),
    db
      .update(packs)
      .set({ updatedBy: user.id, updatedAt: now, ...(reopen ? { status: "DRAFT" as const, reviewedBy: null, reviewedAt: null } : {}) })
      .where(eq(packs.id, packId)),
  ]);
  await Promise.all([
    audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: questionId, before: prev?.value ?? null, after: v }),
    // "Styles it is used in" only changes when a library link was added or removed.
    hasLibraryRef(v) || hasLibraryRef(prev?.value) ? rebuildUsage(packId) : null,
  ]);
  return { ok: true, updatedAt: now.toISOString() };
}

/** One-click confirm of AI-suggested / EST / INFERRED answers — one, a review group, or "all visible". */
export async function confirmAnswers(packId: string, questionIds: string[]): Promise<ActionResult & { confirmed?: string[] }> {
  const user = await requireRole("designer");
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
  const done = await confirmMany(packId, questionIds, user.id);
  if (!done.length && questionIds.length === 1) return { ok: false, error: "Nothing to confirm." };
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: questionIds.length === 1 ? questionIds[0] : "confirm-group", after: { status: "confirmed", questions: done } });
  return { ok: true, confirmed: done };
}

export async function confirmAnswer(packId: string, questionId: string): Promise<ActionResult> {
  return confirmAnswers(packId, [questionId]);
}

/** "Confirm all from <source>": settles every unconfirmed answer read from one upload in one go. */
export async function confirmFromSource(packId: string, source: string): Promise<ActionResult & { confirmed?: number }> {
  const user = await requireRole("designer");
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
  if (!source.trim()) return { ok: false, error: "Pick an upload." };
  const ids = await db
    .select({ q: packAnswers.questionId })
    .from(packAnswers)
    .where(and(eq(packAnswers.packId, packId), eq(packAnswers.source, source), ne(packAnswers.status, "confirmed")));
  const done = await confirmMany(packId, ids.map((r) => r.q), user.id);
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: `confirm-all:${source}`, after: { questions: done } });
  revalidatePath(`/packs/${packId}`);
  return { ok: true, confirmed: done.length };
}

/** Conflict chip: keep the current value, or switch to the value the other source read. */
export async function resolveConflict(packId: string, questionId: string, choice: "keep" | "switch"): Promise<ActionResult> {
  const user = await requireRole("designer");
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
  if (choice === "keep") await keepCurrent(packId, questionId, user.id);
  else if (!(await switchToConflict(packId, questionId, user.id))) return { ok: false, error: "That conflict was already resolved." };
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: questionId, after: { conflict: choice } });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

export type { PrefillResult } from "@/lib/prefill";

/** analyse_render in one request (kept for scripts; the studio runs it as a background job). */
export async function runPrefill(packId: string): Promise<PrefillResult> {
  const user = await requireRole("designer");
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
  const res = await prefillPack(packId, user);
  revalidatePath(`/packs/${packId}`);
  return res;
}

export async function addPackFile(
  packId: string,
  file: { kind: (typeof packFiles.$inferInsert)["kind"]; url: string; name: string; tag?: string; note?: string },
): Promise<ActionResult & { id?: string; crop?: CropBox | null }> {
  const user = await requireRole("designer");
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
  if (file.kind === "render") {
    // A single render is the expected input; replacing it keeps the pack to one.
    await db.delete(packFiles).where(and(eq(packFiles.packId, packId), eq(packFiles.kind, "render")));
  }
  let tag = file.tag ?? "";
  if (!tag && (file.kind === "reference" || file.kind === "construction")) tag = await nextLetter(packId);
  // Renders and design boards: find the product so board text ("REFER TO SPEC", arrows) is cropped off.
  let crop: CropBox | null = null;
  if (file.kind === "render" || file.kind === "colorway_render") crop = await detectProductBox((await readStoredFile(file.url)).data).catch(() => null);
  const [f] = await db
    .insert(packFiles)
    .values({ packId, kind: file.kind, url: file.url, name: file.name, tag: tag.toUpperCase(), note: (file.note ?? "").toUpperCase(), marks: crop ? { crop } : {}, createdBy: user.id })
    .returning({ id: packFiles.id });
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "create", field: `file:${file.kind}`, after: { id: f.id, name: file.name, tag } });
  // Read the board's own notes ("REFER TO SPEC" …) straight away, in the background.
  if (file.kind === "render") await startJob(packId, "BOARD", { fileId: f.id }, user.id);
  revalidatePath(`/packs/${packId}`);
  return { ok: true, id: f.id, crop };
}

export async function updatePackFile(
  packId: string,
  fileId: string,
  patch: { tag?: string; note?: string; page?: string | null; marks?: FileMarks },
): Promise<ActionResult> {
  const user = await requireRole("designer");
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
  const set: Partial<typeof packFiles.$inferInsert> = {};
  if (patch.tag !== undefined) set.tag = patch.tag.toUpperCase();
  if (patch.note !== undefined) set.note = patch.note.toUpperCase();
  if (patch.page !== undefined) set.page = patch.page && (PAGE_SECTIONS as readonly string[]).includes(patch.page) ? patch.page : null;
  if (patch.marks !== undefined) {
    const f = (n: unknown) => Math.min(1, Math.max(0, Number(n) || 0));
    const m = patch.marks;
    const [cur] = await db.select({ marks: packFiles.marks }).from(packFiles).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, packId)));
    set.marks = {
      // The crop is kept unless this patch sets it (null = whole image).
      crop: "crop" in m ? cleanCrop(m.crop) : (cur?.marks?.crop ?? null),
      board: cur?.marks?.board ?? null, // set only by the board reader
      zoom: m.zoom ? { x: f(m.zoom.x), y: f(m.zoom.y), r: Math.min(0.5, Math.max(0.03, Number(m.zoom.r) || 0.2)) } : null,
      dot: m.dot ? { x: f(m.dot.x), y: f(m.dot.y) } : null,
      role: m.role === "SIDE_VIEW" || m.role === "APPLICATION" ? m.role : null,
    };
  }
  await db.update(packFiles).set(set).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, packId)));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: `file:${fileId}`, after: set });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

export async function removePackFile(packId: string, fileId: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
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
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
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
  if (changed && (loaded.pack.status === "IN_REVIEW" || loaded.pack.status === "APPROVED"))
    await db.update(packs).set({ status: "DRAFT", reviewedBy: null, reviewedAt: null }).where(eq(packs.id, packId));
  revalidatePath(`/packs/${packId}`);
  return { ok: true, changed };
}

/** Runs product detection again on a render (the crop editor's "Auto-detect"). Does not save. */
export async function detectCrop(packId: string, fileId: string): Promise<{ ok: true; crop: CropBox | null } | { ok: false; error: string }> {
  await requireRole("designer");
  const [f] = await db.select().from(packFiles).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, packId)));
  if (!f) return { ok: false, error: "File not found." };
  return { ok: true, crop: await detectProductBox((await readStoredFile(f.url)).data).catch(() => null) };
}
