"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { factoryQuestions, hardware, packAnswers, packFiles, packs, type PackStatus } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { loadPack, rebuildLibraryUsage } from "@/lib/data";
import { buildPackDoc } from "@/lib/pdf/doc";
import { gatePasses } from "@/lib/validation";
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
  const src = await loadPack(sourceId);
  if (!src) return { error: "Source pack not found." };
  if (!/^[A-Z0-9_-]{3,30}$/.test(styleNo)) return { error: "Style # — letters, digits, _ or -." };
  if (!styleName) return { error: "Style name is required." };
  if ((await db.select({ id: packs.id }).from(packs).where(eq(packs.styleNo, styleNo))).length) return { error: `${styleNo} already exists.` };
  if ((await db.select({ id: hardware.id }).from(hardware).where(eq(hardware.code, styleNo))).length) return { error: `${styleNo} is a component code.` };
  const [np] = await db
    .insert(packs)
    .values({
      brandId: src.pack.brandId,
      category: src.pack.category,
      styleNo,
      styleName,
      colorways: src.pack.colorways,
      chineseOn: src.pack.chineseOn,
      factory: src.pack.factory,
      copiedFrom: src.pack.id,
      sentBy: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: packs.id });
  const rows = await db.select().from(packAnswers).where(eq(packAnswers.packId, sourceId));
  const skip = new Set(["header.due_date", ...(keepComments ? [] : ["comments.list"])]);
  const copy = rows.filter((r) => !skip.has(r.questionId));
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
  await audit({ userId: user.id, entity: "pack", entityId: np.id, action: "create", after: { duplicatedFrom: src.pack.styleNo, styleNo, keepFiles, keepComments } });
  redirect(`/packs/${np.id}`);
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
