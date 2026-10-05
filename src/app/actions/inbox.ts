"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { changeProposals, packAnswers, packs } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { callTechnicalDesigner } from "@/lib/ai/client";
import { friendlyAIError } from "@/lib/ai/errors";
import { loadPack, rebuildLibraryUsage } from "@/lib/data";
import { writeAnswer } from "@/lib/answer-write";
import { findQuestion } from "@/lib/questions";
import { buildDraftInstructions, DRAFT_REVISION_SCHEMA, normaliseDraft, type DraftRevisionOutput } from "@/lib/revision-draft";
import type { ActionResult } from "./admin";

export type ProposalView = { id: string; comment: string; questionId: string; label: string; current: unknown; value: unknown; note: string; status: string };

export async function listProposals(packId: string): Promise<ProposalView[]> {
  await requireRole("viewer");
  const p = await loadPack(packId);
  if (!p) return [];
  const rows = await db.select().from(changeProposals).where(eq(changeProposals.packId, packId)).orderBy(changeProposals.createdAt);
  return rows.map((r) => ({ id: r.id, comment: r.comment, questionId: r.questionId, label: findQuestion(p.pack.category, r.questionId)?.label ?? r.questionId, current: p.answers[r.questionId] ?? null, value: r.value, note: r.note, status: r.status }));
}

/** Pasted factory comments / email → proposed changes, each linked to its comment (V2 §9). */
export async function draftChanges(packId: string, text: string): Promise<ActionResult & { unmapped?: string[]; count?: number }> {
  const user = await requireRole("designer");
  const p = await loadPack(packId);
  if (!p) return { ok: false, error: "Pack not found." };
  if (!text.trim()) return { ok: false, error: "Paste the factory's comments first." };
  let out: DraftRevisionOutput;
  try {
    const res = await callTechnicalDesigner<DraftRevisionOutput>({
      task: "diff_revision",
      instructions: buildDraftInstructions(p.pack.category, p.answers, text.slice(0, 20_000)),
      images: [],
      schema: DRAFT_REVISION_SCHEMA,
      fixtureName: [`draft_revision.${p.pack.styleNo}`, "draft_revision"],
    });
    out = res.output;
  } catch (e) {
    return { ok: false, error: friendlyAIError(e, "claude", "Drafting the changes") };
  }
  const { proposals, unmapped } = normaliseDraft(p.pack.category, p.answers, out);
  if (proposals.length) await db.insert(changeProposals).values(proposals.map((x) => ({ packId, comment: x.comment, questionId: x.questionId, value: x.value, note: x.note, createdBy: user.id })));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "ai", field: "draft_revision", after: { proposals: proposals.length, unmapped: unmapped.length } });
  revalidatePath(`/packs/${packId}`);
  return { ok: true, count: proposals.length, unmapped, message: `${proposals.length} change(s) proposed${unmapped.length ? `; ${unmapped.length} comment(s) change nothing in the pack` : ""}.` };
}

async function apply(packId: string, questionId: string, value: unknown, comment: string, userId: string) {
  const p = await loadPack(packId);
  if (!p) return false;
  const m = p.meta[questionId];
  const current = m ? { value: p.answers[questionId], origin: m.origin, status: p.statuses[questionId], aiValue: m.aiValue } : null;
  await writeAnswer({ packId, questionId, value, origin: "DESIGNER", status: "confirmed", source: "FACTORY COMMENT", note: comment ? `FACTORY: ${comment}`.slice(0, 300) : "", userId }, current);
  const loaded = await loadPack(packId);
  if (loaded) await rebuildLibraryUsage(packId, loaded.answers);
  return true;
}

/** Approve one change: it becomes the answer, and the next export issues the revision with *UPDATED*. */
export async function decideProposal(id: string, approve: boolean): Promise<ActionResult> {
  const user = await requireRole("designer");
  const [r] = await db.select().from(changeProposals).where(eq(changeProposals.id, id));
  if (!r || r.status !== "PROPOSED") return { ok: false, error: "Already decided." };
  if (approve) await apply(r.packId, r.questionId, r.value, r.comment, user.id);
  await db.update(changeProposals).set({ status: approve ? "APPROVED" : "REJECTED", decidedBy: user.id, decidedAt: new Date() }).where(eq(changeProposals.id, id));
  await audit({ userId: user.id, entity: "pack", entityId: r.packId, action: "update", field: `proposal:${r.questionId}`, after: approve ? "APPROVED" : "REJECTED" });
  revalidatePath(`/packs/${r.packId}`);
  return { ok: true };
}

/**
 * Packs the same fix could apply to (V2 §9 batch revision): those sharing this pack's base style
 * (or based on it), and — for a library pick — those using the same library item in that question.
 */
export async function relatedPacks(id: string): Promise<{ id: string; styleNo: string; reason: string }[]> {
  await requireRole("viewer");
  const [r] = await db.select().from(changeProposals).where(eq(changeProposals.id, id));
  if (!r) return [];
  const [p] = await db.select({ id: packs.id, copiedFrom: packs.copiedFrom }).from(packs).where(eq(packs.id, r.packId));
  const base = p?.copiedFrom ?? p?.id;
  const family = base
    ? await db.select({ id: packs.id, styleNo: packs.styleNo }).from(packs).where(and(ne(packs.id, r.packId), sql`(${packs.copiedFrom} = ${base} or ${packs.id} = ${base})`, sql`${packs.archivedAt} is null`))
    : [];
  const out = new Map(family.map((x) => [x.id, { ...x, reason: "SAME BASE STYLE" }]));
  const before = await db.select({ value: packAnswers.value }).from(packAnswers).where(and(eq(packAnswers.packId, r.packId), eq(packAnswers.questionId, r.questionId)));
  const libId = (before[0]?.value as { id?: string } | null)?.id;
  if (libId) {
    const users = await db
      .select({ id: packs.id, styleNo: packs.styleNo })
      .from(packAnswers)
      .innerJoin(packs, eq(packs.id, packAnswers.packId))
      .where(and(eq(packAnswers.questionId, r.questionId), ne(packAnswers.packId, r.packId), sql`${packAnswers.value} ->> 'id' = ${libId}`, sql`${packs.archivedAt} is null`));
    for (const u of users) if (!out.has(u.id)) out.set(u.id, { ...u, reason: "SAME LIBRARY ITEM" });
  }
  return [...out.values()];
}

/** Apply an approved change to other packs as well (batch revision); each pack logs it as its own change. */
export async function applyProposalTo(id: string, packIds: string[]): Promise<ActionResult> {
  const user = await requireRole("designer");
  const [r] = await db.select().from(changeProposals).where(eq(changeProposals.id, id));
  if (!r || r.status !== "APPROVED") return { ok: false, error: "Approve the change first." };
  const targets = packIds.length ? await db.select({ id: packs.id }).from(packs).where(inArray(packs.id, packIds)) : [];
  for (const t of targets) {
    await apply(t.id, r.questionId, r.value, r.comment, user.id);
    await db.insert(changeProposals).values({ packId: t.id, comment: r.comment, questionId: r.questionId, value: r.value, note: r.note, status: "APPROVED", fromProposal: r.id, createdBy: user.id, decidedBy: user.id, decidedAt: new Date() });
    revalidatePath(`/packs/${t.id}`);
  }
  return { ok: true, message: `Applied to ${targets.length} more pack(s).` };
}
