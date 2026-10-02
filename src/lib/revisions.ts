import "server-only";
import crypto from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { flats, revisions, users, type Revision } from "@/db/schema";
import type { LoadedPack } from "@/lib/data";
import { changeLine, diffSnapshots, type Snapshot } from "@/lib/revision-diff";

const hash = (s: string) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);

export async function currentSnapshot(p: LoadedPack): Promise<Snapshot> {
  const rows = await db.select({ view: flats.view, svg: flats.svg }).from(flats).where(eq(flats.packId, p.pack.id));
  return { answers: p.answers, flats: Object.fromEntries(rows.map((f) => [f.view, hash(f.svg)])) };
}

export const revLabel = (n: number) => (n === 0 ? "ORIGINAL" : `R${n}`);

export type RevisionState = Awaited<ReturnType<typeof revisionState>>;

/**
 * The pack's revisions and what has changed since the last one sent. `flags` are the changes the
 * PDF marks *UPDATED*: the pending ones (draft preview of the next revision) or, when nothing is
 * pending, those of the latest revision.
 */
export async function revisionState(p: LoadedPack, snap?: Snapshot) {
  const rows = await db
    .select({ r: revisions, by: users.name })
    .from(revisions)
    .leftJoin(users, eq(users.id, revisions.createdBy))
    .where(eq(revisions.packId, p.pack.id))
    .orderBy(asc(revisions.number));
  const list = rows.map(({ r, by }) => ({ id: r.id, number: r.number, label: revLabel(r.number), date: r.createdAt.toISOString().slice(0, 10), by: by ?? "", changes: r.changes, pdfUrl: r.pdfUrl, pages: r.pages }));
  const latest = rows.at(-1)?.r ?? null;
  const now = snap ?? (await currentSnapshot(p));
  const pending = latest ? diffSnapshots(latest.snapshot as Snapshot, now, p.pack.category) : [];
  const flags = pending.length ? pending : latest && latest.number > 0 ? latest.changes : [];
  const flagLabel = pending.length ? `${revLabel((latest?.number ?? -1) + 1)} (NOT SENT)` : latest ? revLabel(latest.number) : "";
  return { list, latest, pending, flags, flagLabel, snapshot: now };
}

/**
 * Called on final export. The first export is the original (its date is ORIGINAL DATE SENT);
 * after that, an export with changes issues the next revision with its automatic change log.
 * Exporting again with nothing changed re-uses the latest revision.
 */
export async function issueRevision(p: LoadedPack, userId: string): Promise<{ revision: Revision; created: boolean }> {
  const st = await revisionState(p);
  if (st.latest && !st.pending.length) return { revision: st.latest, created: false };
  const number = st.latest ? st.latest.number + 1 : 0;
  const [revision] = await db
    .insert(revisions)
    .values({ packId: p.pack.id, number, snapshot: st.snapshot as { answers: Record<string, unknown>; flats: Record<string, string> }, changes: st.latest ? st.pending : [], createdBy: userId })
    .returning();
  return { revision, created: true };
}

/** Undo an issue that didn't produce a PDF (e.g. a Chinese line was missing). */
export async function withdrawRevision(id: string) {
  await db.delete(revisions).where(eq(revisions.id, id));
}

export async function attachRevisionPdf(id: string, pdfUrl: string, pages: number) {
  await db.update(revisions).set({ pdfUrl, pages }).where(eq(revisions.id, id));
}

export { changeLine };
