"use server";

import { cleanCrop, detectProductBox, type CropBox } from "@/lib/crop";
import { PAGE_SECTIONS } from "@/lib/page-names";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, hardware, packAnswers, packFiles, packs, type FileMarks } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { loadPack, rebuildLibraryUsage } from "@/lib/data";
import { readStoredFile } from "@/lib/storage";
import { CATEGORIES, findQuestion, isEmpty, optionalToggleId, sectionsFor, type Category } from "@/lib/questions";
import type { ActionResult } from "./admin";
import { prefillPack, type PrefillResult } from "@/lib/prefill";
import { suffixesFor } from "@/lib/codes";

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

export async function updatePackSetup(
  packId: string,
  patch: { styleName?: string; colorways?: string[]; brandId?: string; chineseOn?: boolean },
): Promise<ActionResult> {
  const user = await requireRole("designer");
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
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
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
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
  // Any change after review / sign-off sends the pack back to draft — the approval no longer covers it.
  const reopen = p.status === "IN_REVIEW" || p.status === "APPROVED";
  await db
    .update(packs)
    .set({ updatedBy: user.id, updatedAt: now, ...(reopen ? { status: "DRAFT" as const, reviewedBy: null, reviewedAt: null } : {}) })
    .where(eq(packs.id, packId));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: questionId, before: prev?.value ?? null, after: v });
  const loaded = await loadPack(packId);
  if (loaded) await rebuildLibraryUsage(packId, loaded.answers);
  return { ok: true, updatedAt: now.toISOString() };
}

/** One-click confirm of an AI-suggested / EST / INFERRED answer. */
export async function confirmAnswer(packId: string, questionId: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  if (await isArchived(packId)) return { ok: false, error: ARCHIVED };
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
  file: { kind: "render" | "colorway_render" | "reference" | "construction" | "reference_sample" | "swatch_photo"; url: string; name: string; tag?: string; note?: string },
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
