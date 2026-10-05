"use server";

import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { packs } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import type { ActionResult } from "./admin";

/** What a bulk action changed, so it can be undone (V2 §8: undo for every bulk action). */
export type BulkUndo = { field: "stage" | "assignedTo" | "archivedAt"; before: { id: string; value: string | null }[] };

const ok = (ids: string[], what: string, undo: BulkUndo): ActionResult & { undo?: BulkUndo } => ({ ok: true, message: `${ids.length} pack(s) ${what}.`, undo });

export async function bulkSetStage(ids: string[], stage: "PROTO" | "PRODUCTION"): Promise<ActionResult & { undo?: BulkUndo }> {
  const user = await requireRole("designer");
  if (!ids.length) return { ok: false, error: "Select packs first." };
  const before = await db.select({ id: packs.id, value: packs.stage }).from(packs).where(inArray(packs.id, ids));
  await db.update(packs).set({ stage, updatedBy: user.id, updatedAt: new Date() }).where(inArray(packs.id, ids));
  for (const id of ids) await audit({ userId: user.id, entity: "pack", entityId: id, action: "update", field: "stage", after: stage });
  revalidatePath("/");
  return ok(ids, `moved to ${stage}`, { field: "stage", before });
}

export async function bulkAssign(ids: string[], userId: string | null): Promise<ActionResult & { undo?: BulkUndo }> {
  const user = await requireRole("designer");
  if (!ids.length) return { ok: false, error: "Select packs first." };
  const before = await db.select({ id: packs.id, value: packs.assignedTo }).from(packs).where(inArray(packs.id, ids));
  await db.update(packs).set({ assignedTo: userId, updatedBy: user.id, updatedAt: new Date() }).where(inArray(packs.id, ids));
  for (const id of ids) await audit({ userId: user.id, entity: "pack", entityId: id, action: "update", field: "assigned_to", after: userId });
  revalidatePath("/");
  return ok(ids, userId ? "assigned" : "unassigned", { field: "assignedTo", before });
}

export async function bulkArchive(ids: string[], archived: boolean): Promise<ActionResult & { undo?: BulkUndo }> {
  const user = await requireRole("admin");
  if (!ids.length) return { ok: false, error: "Select packs first." };
  const before = (await db.select({ id: packs.id, value: packs.archivedAt }).from(packs).where(inArray(packs.id, ids))).map((r) => ({ id: r.id, value: r.value?.toISOString() ?? null }));
  await db.update(packs).set({ archivedAt: archived ? new Date() : null, updatedBy: user.id, updatedAt: new Date() }).where(inArray(packs.id, ids));
  for (const id of ids) await audit({ userId: user.id, entity: "pack", entityId: id, action: "update", field: "archived", after: archived });
  revalidatePath("/");
  return ok(ids, archived ? "archived" : "restored", { field: "archivedAt", before });
}

/** Puts every pack back as it was before a bulk action. */
export async function bulkUndo(undo: BulkUndo): Promise<ActionResult> {
  const user = await requireRole(undo.field === "archivedAt" ? "admin" : "designer");
  for (const b of undo.before) {
    const set =
      undo.field === "stage"
        ? { stage: (b.value === "PRODUCTION" ? "PRODUCTION" : "PROTO") as "PROTO" | "PRODUCTION" }
        : undo.field === "assignedTo"
          ? { assignedTo: b.value }
          : { archivedAt: b.value ? new Date(b.value) : null };
    await db.update(packs).set({ ...set, updatedBy: user.id, updatedAt: new Date() }).where(inArray(packs.id, [b.id]));
  }
  revalidatePath("/");
  return { ok: true, message: "Undone." };
}
