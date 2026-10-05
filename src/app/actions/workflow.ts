"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { factoryQuestions, hardware, packAnswers, packFiles, packs, type PackStatus } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { loadPack, rebuildLibraryUsage } from "@/lib/data";
import { buildPackDoc } from "@/lib/pdf/doc";
import { gatePasses } from "@/lib/validation";
import { allQuestions } from "@/lib/questions";
import { CATEGORIES, type Category } from "@/lib/questions/types";
import { DEFAULT_GROUPS, inherits, reseedColourways } from "@/lib/inherit";
import { rankSimilar, SILHOUETTE_IDS } from "@/lib/similar-score";
import { writeAnswer } from "@/lib/answer-write";
import type { ActionResult } from "./admin";

/* ------------------------------ status & sign-off ------------------------------ */

export async function requestReview(packId: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  await db.update(packs).set({ status: "IN_REVIEW", reviewRequestedBy: user.id, reviewedBy: null, reviewedAt: null, updatedAt: new Date(), updatedBy: user.id }).where(eq(packs.id, packId));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: "status", after: "IN_REVIEW" });
  revalidatePath(`/packs/${packId}`);
  return { ok: true, message: "Sent for review." };
}

/** A second designer signs the pack off. The gate must pass and it can't be the person who asked. */
export async function approvePack(packId: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  const p = await loadPack(packId);
  if (!p) return { ok: false, error: "Pack not found." };
  if (p.pack.status !== "IN_REVIEW") return { ok: false, error: "Ask for review first." };
  if (p.pack.reviewRequestedBy === user.id) return { ok: false, error: "A different designer has to sign off — ask a colleague." };
  const doc = await buildPackDoc(p, { images: false });
  if (!gatePasses(doc.validation)) return { ok: false, error: "The validation gate still has items to fix." };
  await db.update(packs).set({ status: "APPROVED", reviewedBy: user.id, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(packs.id, packId));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: "status", after: "APPROVED" });
  revalidatePath(`/packs/${packId}`);
  return { ok: true, message: "Signed off — the PDF is unlocked." };
}

export async function sendBack(packId: string, note: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  await db.update(packs).set({ status: "DRAFT", reviewedBy: null, reviewedAt: null, updatedAt: new Date(), updatedBy: user.id }).where(eq(packs.id, packId));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: "status", after: { status: "DRAFT", note: note.toUpperCase() } });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

const AFTER_APPROVAL: PackStatus[] = ["APPROVED", "SENT", "PROTO_RECEIVED", "CLOSED"];

export async function setPackStatus(packId: string, status: PackStatus): Promise<ActionResult> {
  const user = await requireRole("designer");
  const [p] = await db.select().from(packs).where(eq(packs.id, packId));
  if (!p) return { ok: false, error: "Pack not found." };
  if (!AFTER_APPROVAL.includes(status) || !AFTER_APPROVAL.includes(p.status)) return { ok: false, error: "Only signed-off packs move on to SENT / PROTO RECEIVED / CLOSED." };
  await db.update(packs).set({ status, updatedAt: new Date(), updatedBy: user.id }).where(eq(packs.id, packId));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: "status", before: p.status, after: status });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

/* ------------------------------ factory ------------------------------ */

export async function setFactory(packId: string, factory: string, factoryStyleNo: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  await db.update(packs).set({ factory: factory.trim().toUpperCase(), factoryStyleNo: factoryStyleNo.trim().toUpperCase(), updatedAt: new Date(), updatedBy: user.id }).where(eq(packs.id, packId));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: "factory", after: { factory, factoryStyleNo } });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

export async function listFactoryQuestions(packId: string) {
  await requireRole("viewer");
  return db.select().from(factoryQuestions).where(eq(factoryQuestions.packId, packId)).orderBy(asc(factoryQuestions.createdAt));
}

export async function addFactoryQuestion(packId: string, askedBy: string, question: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  if (!question.trim()) return { ok: false, error: "Type the factory's question." };
  await db.insert(factoryQuestions).values({ packId, askedBy: askedBy.trim().toUpperCase(), question: question.trim().toUpperCase(), createdBy: user.id });
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "create", field: "factory_question", after: question });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

export async function answerFactoryQuestion(packId: string, id: string, answer: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  await db
    .update(factoryQuestions)
    .set({ answer: answer.trim().toUpperCase(), answeredBy: user.id, answeredAt: new Date() })
    .where(and(eq(factoryQuestions.id, id), eq(factoryQuestions.packId, packId)));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: "factory_answer", after: answer });
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

/* ------------------------------ duplicate (carry-over) ------------------------------ */

export type DuplicateState = { error?: string } | undefined;

export async function duplicatePack(_prev: DuplicateState, form: FormData): Promise<DuplicateState> {
  const user = await requireRole("designer");
  const sourceId = String(form.get("sourceId") ?? "");
  const styleNo = String(form.get("styleNo") ?? "").trim().toUpperCase();
  const styleName = String(form.get("styleName") ?? "").trim().toUpperCase();
  const keepFiles = form.get("keepFiles") === "on";
  const keepComments = form.get("keepComments") === "on";
  // "New from…" (V2 §8): which groups to inherit; brand, category and colourways can change here.
  const picked = form.getAll("group").map(String);
  const groups = picked.length ? picked : [...DEFAULT_GROUPS, ...(keepComments ? ["COMMENTS"] : [])];
  const mode = form.get("mode") === "colourway" ? "colourway" : "style";
  const src = await loadPack(sourceId);
  if (!src) return { error: "Source pack not found." };
  const brandId = String(form.get("brandId") ?? "") || src.pack.brandId;
  const category = (CATEGORIES as readonly string[]).includes(String(form.get("category") ?? "")) ? (String(form.get("category")) as Category) : src.pack.category;
  // A new colourway of this style: its colourways are typed ("-C RED, -D NAVY"), seeded from one of the style's.
  const typed = String(form.get("colorways") ?? "").split(/[,\n]+/).map((x) => x.trim().toUpperCase()).filter(Boolean).map((x, i) => {
    const m = x.match(/^(-[A-Z0-9]+)\s*(.*)$/);
    return m ? { code: m[1], name: m[2] || undefined } : { code: `-${String.fromCharCode(65 + i)}`, name: x };
  });
  if (mode === "colourway" && !typed.length) return { error: "Name the new colourway(s)." };
  const fromCw = src.pack.colorways.includes(String(form.get("fromColorway") ?? "")) ? String(form.get("fromColorway")) : src.pack.colorways[0];
  const colorways = typed.length ? typed.map((c) => c.code) : src.pack.colorways;
  if (!/^[A-Z0-9_-]{3,30}$/.test(styleNo)) return { error: "Style # — letters, digits, _ or -." };
  if (!styleName) return { error: "Style name is required." };
  if ((await db.select({ id: packs.id }).from(packs).where(eq(packs.styleNo, styleNo))).length) return { error: `${styleNo} already exists.` };
  if ((await db.select({ id: hardware.id }).from(hardware).where(eq(hardware.code, styleNo))).length) return { error: `${styleNo} is a component code.` };
  const [np] = await db
    .insert(packs)
    .values({
      brandId,
      category,
      styleNo,
      styleName,
      colorways,
      chineseOn: src.pack.chineseOn,
      factory: src.pack.factory,
      copiedFrom: src.pack.id,
      sentBy: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: packs.id });
  const rows = await db.select().from(packAnswers).where(eq(packAnswers.packId, sourceId));
  // Only questions the (possibly new) category asks, in the groups chosen.
  const known = new Set(allQuestions(category).map((q) => q.id));
  let copy = rows.filter((r) => inherits(r.questionId, groups) && (known.has(r.questionId) || r.questionId.startsWith("optional.")));
  if (typed.length) {
    const seeded = reseedColourways(Object.fromEntries(copy.map((r) => [r.questionId, r.value])), fromCw, typed);
    copy = copy.filter((r) => r.questionId in seeded).map((r) => ({ ...r, value: seeded[r.questionId] }));
    if (seeded["colorways.names"] && !copy.some((r) => r.questionId === "colorways.names"))
      copy.push({ ...rows[0], questionId: "colorways.names", value: seeded["colorways.names"], status: "confirmed", origin: "DESIGNER", source: "", aiNote: "", aiValue: null, confidence: "" } as (typeof rows)[number]);
  }
  if (copy.length)
    // Settled values are inherited as BASE STYLE (trusted, §3 step 2); unconfirmed ones keep their origin and still need confirming.
    await db.insert(packAnswers).values(
      copy.map((r) => ({
        packId: np.id,
        questionId: r.questionId,
        value: r.value,
        status: r.status,
        origin: r.status === "confirmed" ? ("BASE_STYLE" as const) : r.origin,
        source: r.status === "confirmed" ? src.pack.styleNo : r.source,
        aiNote: r.aiNote,
        aiValue: r.aiValue,
        confidence: r.confidence,
        updatedBy: user.id,
      })),
    );
  if (keepFiles) {
    const files = await db.select().from(packFiles).where(eq(packFiles.packId, sourceId));
    if (files.length) await db.insert(packFiles).values(files.map((f) => ({ packId: np.id, kind: f.kind, url: f.url, name: f.name, tag: f.tag, note: f.note, createdBy: user.id })));
  }
  const loaded = await loadPack(np.id);
  if (loaded) await rebuildLibraryUsage(np.id, loaded.answers);
  await audit({ userId: user.id, entity: "pack", entityId: np.id, action: "create", after: { duplicatedFrom: src.pack.styleNo, styleNo, keepFiles, groups, mode, colorways } });
  redirect(`/packs/${np.id}`);
}

/* ------------------------------ "Start from…" (V2 §3 step 2) ------------------------------ */

/**
 * The packs most like this one (same brand / category / silhouette, similar name), for "Start from…".
 */
export async function similarPacks(packId: string, n = 3) {
  await requireRole("viewer");
  const p = await loadPack(packId);
  if (!p) return [];
  const sil = (a: Record<string, unknown>) => String(SILHOUETTE_IDS.map((k) => a[k]).find((v) => typeof v === "string") ?? "");
  const rows = await db.select({ id: packs.id, styleNo: packs.styleNo, styleName: packs.styleName, brandId: packs.brandId, category: packs.category, updatedAt: packs.updatedAt, archivedAt: packs.archivedAt }).from(packs);
  const answers = await db.select({ packId: packAnswers.packId, questionId: packAnswers.questionId, value: packAnswers.value }).from(packAnswers).where(inArray(packAnswers.questionId, SILHOUETTE_IDS));
  const silOf = new Map(answers.map((r) => [r.packId, String(r.value ?? "")]));
  const candidates = rows.filter((r) => r.id !== packId && !r.archivedAt).map((r) => ({ ...r, silhouette: silOf.get(r.id) ?? "" }));
  return rankSimilar({ styleName: p.pack.styleName, brandId: p.pack.brandId, category: p.pack.category, silhouette: sil(p.answers) }, candidates, n).map((c) => ({ id: c.id, styleNo: c.styleNo, styleName: c.styleName, category: c.category }));
}

/**
 * Inherit a base style's settled answers into this pack, by group, as BASE STYLE: blanks are filled
 * and AI reads are replaced; where a designer already answered differently a conflict chip shows.
 */
export async function startFromBase(packId: string, baseId: string, groups: string[] = [...DEFAULT_GROUPS]): Promise<ActionResult & { filled?: number }> {
  const user = await requireRole("designer");
  const [p, base] = await Promise.all([loadPack(packId), loadPack(baseId)]);
  if (!p || !base) return { ok: false, error: "Pack not found." };
  if (p.pack.archivedAt) return { ok: false, error: "This pack is archived." };
  const known = new Set(allQuestions(p.pack.category).map((q) => q.id));
  let filled = 0;
  for (const [qid, value] of Object.entries(base.answers)) {
    if (base.statuses[qid] !== "confirmed" || !inherits(qid, groups) || !(known.has(qid) || qid.startsWith("optional."))) continue;
    const m = p.meta[qid];
    const current = m ? { value: p.answers[qid], origin: m.origin, status: p.statuses[qid], aiValue: m.aiValue } : null;
    const done = await writeAnswer({ packId, questionId: qid, value, origin: "BASE_STYLE", source: base.pack.styleNo, note: `FROM ${base.pack.styleNo}`, userId: user.id }, current);
    if (done === "write" || done === "upgrade") filled++;
  }
  if (!p.pack.copiedFrom) await db.update(packs).set({ copiedFrom: base.pack.id, updatedBy: user.id, updatedAt: new Date() }).where(eq(packs.id, packId));
  const loaded = await loadPack(packId);
  if (loaded) await rebuildLibraryUsage(packId, loaded.answers);
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: "start_from", after: { base: base.pack.styleNo, groups, filled } });
  revalidatePath(`/packs/${packId}`);
  return { ok: true, filled, message: `${filled} answer(s) from ${base.pack.styleNo}.` };
}

/* ------------------------------ archive / delete (admin only) ------------------------------ */

/** Archive hides a pack from the dashboard and makes it read-only; its style # stays reserved. */
export async function setPackArchived(packId: string, archived: boolean): Promise<ActionResult> {
  const admin = await requireRole("admin");
  const [row] = await db.update(packs).set({ archivedAt: archived ? new Date() : null, updatedBy: admin.id, updatedAt: new Date() }).where(eq(packs.id, packId)).returning({ styleNo: packs.styleNo });
  if (!row) return { ok: false, error: "Pack not found." };
  await audit({ userId: admin.id, entity: "pack", entityId: packId, action: "update", field: "archived", after: archived });
  revalidatePath("/");
  revalidatePath(`/packs/${packId}`);
  return { ok: true };
}

/**
 * Deletes a pack and everything under it (answers, files, flats, revisions, samples, Q&A). The admin
 * must type the style # to confirm. Uploaded files stay in storage — duplicated packs can share them.
 */
export async function deletePack(packId: string, confirmStyleNo: string): Promise<ActionResult> {
  const admin = await requireRole("admin");
  const [p] = await db.select({ styleNo: packs.styleNo, styleName: packs.styleName }).from(packs).where(eq(packs.id, packId));
  if (!p) return { ok: false, error: "Pack not found." };
  if (confirmStyleNo.trim().toUpperCase() !== p.styleNo) return { ok: false, error: `Type ${p.styleNo} to confirm.` };
  await db.delete(packs).where(eq(packs.id, packId));
  await audit({ userId: admin.id, entity: "pack", entityId: packId, action: "delete", before: p });
  revalidatePath("/");
  redirect("/?deleted=" + encodeURIComponent(p.styleNo));
}
