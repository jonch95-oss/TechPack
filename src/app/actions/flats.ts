"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { flats, packs } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { loadPack } from "@/lib/data";
import { readMeta, type Box } from "@/lib/lineart/geometry";
import { sanitizeSvg } from "@/lib/lineart/sanitize";
import { reannotate, retraceRegion } from "@/lib/lineart/service";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function flatAndPack(flatId: string) {
  const [flat] = await db.select().from(flats).where(eq(flats.id, flatId));
  if (!flat) return null;
  const p = await loadPack(flat.packId);
  return p ? { flat, p } : null;
}

/** An edited drawing sends a reviewed / signed-off pack back to draft, as any edit does. */
async function reopen(packId: string) {
  const [p] = await db.select({ status: packs.status }).from(packs).where(eq(packs.id, packId));
  if (p && (p.status === "IN_REVIEW" || p.status === "APPROVED")) await db.update(packs).set({ status: "DRAFT", reviewedBy: null, reviewedAt: null }).where(eq(packs.id, packId));
}

export async function saveFlat(flatId: string, svg: string): Promise<Result<{ updatedAt: string }>> {
  const user = await requireRole("designer");
  const clean = sanitizeSvg(svg);
  if (!clean.startsWith("<svg") || clean.length > 6_000_000) return { ok: false, error: "That drawing can't be saved." };
  const [row] = await db.update(flats).set({ svg: clean, updatedBy: user.id, updatedAt: new Date() }).where(eq(flats.id, flatId)).returning();
  if (!row) return { ok: false, error: "Flat not found." };
  await reopen(row.packId);
  await audit({ userId: user.id, entity: "flat", entityId: flatId, action: "update", field: row.view });
  return { ok: true, updatedAt: row.updatedAt.toISOString() };
}

/** The back (and side / top) views are INFERRED until a designer approves them. */
export async function approveFlat(flatId: string): Promise<Result> {
  const user = await requireRole("designer");
  const [row] = await db.update(flats).set({ status: "CONFIRMED", updatedBy: user.id, updatedAt: new Date() }).where(eq(flats.id, flatId)).returning();
  if (!row) return { ok: false, error: "Flat not found." };
  await audit({ userId: user.id, entity: "flat", entityId: flatId, action: "update", field: "status", after: "CONFIRMED" });
  revalidatePath(`/packs/${row.packId}`);
  return { ok: true };
}

/** Re-draws dimension lines and/or callouts on the given (possibly unsaved) drawing from the answers. */
export async function autoAnnotate(flatId: string, svg: string, what: { dimensions?: boolean; callouts?: boolean }): Promise<Result<{ svg: string; pxPerUnit: number | null }>> {
  await requireRole("designer");
  const fp = await flatAndPack(flatId);
  if (!fp) return { ok: false, error: "Flat not found." };
  const meta = readMeta(svg);
  if (!meta.bbox) return { ok: false, error: "Draw or trace an outline first." };
  const res = await reannotate(sanitizeSvg(svg), fp.p, what);
  if (!res.pxPerUnit) return { ok: false, error: "Enter the overall dimensions (H × W × D) first — nothing is scaled until they're entered." };
  return { ok: true, svg: res.svg, pxPerUnit: res.pxPerUnit };
}

export async function retrace(flatId: string, rect: Box, threshold: number): Promise<Result<{ outline: string[]; stitching: string[] }>> {
  await requireRole("designer");
  const [flat] = await db.select().from(flats).where(eq(flats.id, flatId));
  if (!flat) return { ok: false, error: "Flat not found." };
  try {
    return { ok: true, ...(await retraceRegion(flat, rect, Math.min(240, Math.max(40, threshold)))) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteFlat(flatId: string): Promise<Result> {
  const user = await requireRole("designer");
  const [row] = await db.delete(flats).where(eq(flats.id, flatId)).returning();
  if (!row) return { ok: false, error: "Flat not found." };
  await reopen(row.packId);
  await audit({ userId: user.id, entity: "flat", entityId: flatId, action: "delete", field: row.view });
  revalidatePath(`/packs/${row.packId}`);
  return { ok: true };
}
