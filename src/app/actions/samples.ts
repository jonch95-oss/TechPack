"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { packs, sampleComments, sampleRounds, type Markup } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import type { ActionResult } from "./admin";

type Stage = "PROTO" | "SMS" | "PP" | "TOP";
const STAGES: Stage[] = ["PROTO", "SMS", "PP", "TOP"];

const path = (packId: string) => `/packs/${packId}/samples`;

function nextLetter(used: string[]) {
  for (let i = 0; i < 52; i++) {
    const l = i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`;
    if (!used.includes(l)) return l;
  }
  return "?";
}

/** New sample round. Comments still OPEN or REVISE in the previous round are carried over automatically. */
export async function createRound(packId: string, input: { stage: Stage; receivedAt: string; factory: string }): Promise<ActionResult & { id?: string }> {
  const user = await requireRole("designer");
  if (!STAGES.includes(input.stage)) return { ok: false, error: "Pick a stage." };
  const prior = await db.select().from(sampleRounds).where(eq(sampleRounds.packId, packId)).orderBy(desc(sampleRounds.createdAt));
  const number = prior.filter((r) => r.stage === input.stage).length + 1;
  const [round] = await db
    .insert(sampleRounds)
    .values({ packId, stage: input.stage, number, receivedAt: input.receivedAt, factory: input.factory.toUpperCase(), createdBy: user.id })
    .returning();
  let carried = 0;
  if (prior[0]) {
    const open = await db.select().from(sampleComments).where(and(eq(sampleComments.roundId, prior[0].id), inArray(sampleComments.status, ["OPEN", "REVISE"])));
    if (open.length) {
      await db.insert(sampleComments).values(open.map((c) => ({ roundId: round.id, letter: c.letter, text: c.text, photoUrl: c.photoUrl, markup: c.markup, status: "OPEN", carriedFrom: c.id, updatedBy: user.id })));
      carried = open.length;
    }
  }
  if (input.stage === "PROTO") await db.update(packs).set({ status: "PROTO_RECEIVED" }).where(and(eq(packs.id, packId), eq(packs.status, "SENT")));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "create", field: "sample_round", after: { stage: input.stage, number, carried } });
  revalidatePath(path(packId));
  return { ok: true, id: round.id, message: carried ? `${carried} open comment(s) carried over.` : "Round added." };
}

export async function updateRound(packId: string, roundId: string, patch: { verdict?: string; notes?: string; receivedAt?: string }): Promise<ActionResult> {
  const user = await requireRole("designer");
  const set: Partial<typeof sampleRounds.$inferInsert> = {};
  if (patch.verdict) set.verdict = patch.verdict.toUpperCase();
  if (patch.notes !== undefined) set.notes = patch.notes.toUpperCase();
  if (patch.receivedAt !== undefined) set.receivedAt = patch.receivedAt;
  await db.update(sampleRounds).set(set).where(and(eq(sampleRounds.id, roundId), eq(sampleRounds.packId, packId)));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: "sample_round", after: set });
  revalidatePath(path(packId));
  return { ok: true };
}

export async function addSampleComment(packId: string, roundId: string, input: { text: string; photoUrl: string | null }): Promise<ActionResult> {
  const user = await requireRole("designer");
  if (!input.text.trim()) return { ok: false, error: "Write the comment." };
  // Letters run across the whole sample history so a carried comment keeps its letter.
  const rounds = await db.select({ id: sampleRounds.id }).from(sampleRounds).where(eq(sampleRounds.packId, packId));
  const used = (await db.select({ letter: sampleComments.letter }).from(sampleComments).where(inArray(sampleComments.roundId, rounds.map((r) => r.id)))).map((c) => c.letter);
  await db.insert(sampleComments).values({ roundId, letter: nextLetter(used), text: input.text.trim().toUpperCase(), photoUrl: input.photoUrl, updatedBy: user.id });
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "create", field: "sample_comment", after: input.text });
  revalidatePath(path(packId));
  return { ok: true };
}

export async function updateSampleComment(packId: string, id: string, patch: { text?: string; status?: string; markup?: Markup; photoUrl?: string | null }): Promise<ActionResult> {
  const user = await requireRole("designer");
  const set: Partial<typeof sampleComments.$inferInsert> = { updatedBy: user.id, updatedAt: new Date() };
  if (patch.text !== undefined) set.text = patch.text.toUpperCase();
  if (patch.status && ["OPEN", "REVISE", "ACCEPTED"].includes(patch.status)) set.status = patch.status;
  if (patch.markup) set.markup = patch.markup;
  if (patch.photoUrl !== undefined) set.photoUrl = patch.photoUrl;
  await db.update(sampleComments).set(set).where(eq(sampleComments.id, id));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: "sample_comment", after: { id, ...patch } });
  revalidatePath(path(packId));
  return { ok: true };
}

export async function deleteSampleComment(packId: string, id: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  await db.delete(sampleComments).where(eq(sampleComments.id, id));
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "delete", field: "sample_comment", before: id });
  revalidatePath(path(packId));
  return { ok: true };
}

export async function loadSamples(packId: string) {
  await requireRole("viewer");
  const rounds = await db.select().from(sampleRounds).where(eq(sampleRounds.packId, packId)).orderBy(asc(sampleRounds.createdAt));
  const comments = rounds.length ? await db.select().from(sampleComments).where(inArray(sampleComments.roundId, rounds.map((r) => r.id))).orderBy(asc(sampleComments.createdAt)) : [];
  return rounds.map((r) => ({ ...r, comments: comments.filter((c) => c.roundId === r.id) }));
}
