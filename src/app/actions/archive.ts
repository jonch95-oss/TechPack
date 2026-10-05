"use server";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { archiveImports, brands, hardware, materials, packAnswers, packs } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { callTechnicalDesigner } from "@/lib/ai/client";
import { readStoredFile } from "@/lib/storage";
import { ARCHIVE_PAGE_CAP, COST_PER_PAGE_USD, buildArchiveInstructions, normaliseArchive, pdfPageCount, READ_ARCHIVE_SCHEMA, type ReadArchiveOutput } from "@/lib/archive-read";
import type { ActionResult } from "./admin";

export type ArchiveRow = { id: string; name: string; pages: number; status: string; packId: string | null; styleNo: string | null; error: string | null; costUsd: number };

/** The import list, newest first. */
export async function listArchiveImports(): Promise<ArchiveRow[]> {
  await requireRole("admin");
  const rows = await db.select({ i: archiveImports, styleNo: packs.styleNo }).from(archiveImports).leftJoin(packs, eq(packs.id, archiveImports.packId)).orderBy(desc(archiveImports.createdAt));
  return rows.map(({ i, styleNo }) => ({ id: i.id, name: i.name, pages: i.pages, status: i.status, packId: i.packId, styleNo, error: i.error, costUsd: Math.round(i.pages * COST_PER_PAGE_USD * 100) / 100 }));
}

/**
 * Registers uploaded PDFs: counts their pages and hashes them. A file already imported (same hash) is
 * skipped; one over the page cap is refused. Nothing is read yet — the list shows pages and cost first.
 */
export async function registerArchiveFiles(files: { name: string; url: string }[]): Promise<ActionResult & { rows?: ArchiveRow[] }> {
  const user = await requireRole("admin");
  for (const f of files) {
    if (!/\.pdf$/i.test(f.name)) continue;
    const { data } = await readStoredFile(f.url);
    const hash = createHash("sha256").update(data).digest("hex");
    const [dup] = await db.select({ id: archiveImports.id }).from(archiveImports).where(eq(archiveImports.hash, hash));
    if (dup) continue;
    const pages = pdfPageCount(data);
    await db.insert(archiveImports).values({ name: f.name, url: f.url, hash, pages, status: pages > ARCHIVE_PAGE_CAP ? "ERROR" : "READY", error: pages > ARCHIVE_PAGE_CAP ? `Over the ${ARCHIVE_PAGE_CAP}-page cap — split the file.` : null, createdBy: user.id });
  }
  revalidatePath("/admin/archive");
  return { ok: true, rows: await listArchiveImports() };
}

/** Reads the chosen files in the background, one after another. */
export async function runArchiveImports(ids: string[]): Promise<ActionResult> {
  const user = await requireRole("admin");
  const ready = await db.select({ id: archiveImports.id }).from(archiveImports).where(and(inArray(archiveImports.id, ids), inArray(archiveImports.status, ["READY", "ERROR"])));
  const runIds = ready.map((r) => r.id);
  if (!runIds.length) return { ok: false, error: "Nothing to read." };
  await db.update(archiveImports).set({ status: "QUEUED", error: null, updatedAt: new Date() }).where(inArray(archiveImports.id, runIds));
  after(async () => {
    for (const id of runIds) await readArchive(id, user.id);
  });
  return { ok: true, message: `${runIds.length} file(s) queued.` };
}

async function readArchive(id: string, userId: string) {
  const [row] = await db.select().from(archiveImports).where(eq(archiveImports.id, id));
  if (!row || row.status !== "QUEUED") return;
  if (row.pages > ARCHIVE_PAGE_CAP) return;
  await db.update(archiveImports).set({ status: "RUNNING", updatedAt: new Date() }).where(eq(archiveImports.id, id));
  try {
    const brandRows = await db.select().from(brands);
    const { data } = await readStoredFile(row.url);
    const res = await callTechnicalDesigner<ReadArchiveOutput>({
      task: "read_archive",
      instructions: buildArchiveInstructions(brandRows.map((b) => b.name)),
      images: [],
      pdfs: [data],
      schema: READ_ARCHIVE_SCHEMA,
      fixtureName: [`read_archive.${row.hash.slice(0, 12)}`, "read_archive"],
    });
    const r = normaliseArchive(res.output);
    const brand = brandRows.find((b) => b.name.toUpperCase() === r.brand) ?? brandRows.find((b) => r.styleNo.startsWith(b.codePrefix.toUpperCase()));
    if (!brand) throw new Error(`Brand ${r.brand || "(none)"} is not in the studio.`);
    if (!r.category) throw new Error("Category not recognised.");
    if (!/^[A-Z0-9_-]{3,30}$/.test(r.styleNo)) throw new Error("No style # found.");
    const [taken] = await db.select({ id: packs.id }).from(packs).where(eq(packs.styleNo, r.styleNo));
    if (taken) throw new Error(`${r.styleNo} is already in the studio.`);
    // The proposed base style: every answer arrives as a read to confirm; nothing is settled unreviewed.
    const [p] = await db
      .insert(packs)
      .values({ brandId: brand.id, category: r.category, styleNo: r.styleNo, styleName: r.styleName || r.styleNo, colorways: r.colorways.map((c) => c.code), importStatus: "PROPOSED", createdBy: userId, updatedBy: userId })
      .returning({ id: packs.id });
    const names = Object.fromEntries(r.colorways.filter((c) => c.name).map((c) => [c.code, c.name]));
    const rows = [
      ...r.answers.map((a) => ({ questionId: a.questionId, value: a.value, note: a.note })),
      ...(Object.keys(names).length && !r.answers.some((a) => a.questionId === "colorways.names") ? [{ questionId: "colorways.names", value: names as unknown, note: "" }] : []),
    ];
    if (rows.length)
      await db.insert(packAnswers).values(rows.map((a) => ({ packId: p.id, questionId: a.questionId, value: a.value, status: "ai" as const, origin: "AI" as const, source: `ARCHIVE ${row.name}`.slice(0, 120), aiNote: a.note, updatedBy: userId })));
    await db.update(archiveImports).set({ status: "PROPOSED", packId: p.id, result: { hardware: r.hardware, materials: r.materials, dropped: r.dropped }, updatedAt: new Date() }).where(eq(archiveImports.id, id));
    await audit({ userId, entity: "pack", entityId: p.id, action: "ai", field: "archive_import", after: { file: row.name, styleNo: r.styleNo, answers: rows.length } });
  } catch (e) {
    await db.update(archiveImports).set({ status: "ERROR", error: (e as Error).message.slice(0, 300), updatedAt: new Date() }).where(eq(archiveImports.id, id));
  }
}

/**
 * Approves a proposed import: the pack becomes a base style (its answers settled from the document),
 * and the parts and swatches it names are added to the library where the code / card isn't there yet.
 */
export async function approveArchiveImport(id: string): Promise<ActionResult> {
  const user = await requireRole("admin");
  const [row] = await db.select().from(archiveImports).where(eq(archiveImports.id, id));
  if (!row?.packId || row.status !== "PROPOSED") return { ok: false, error: "Nothing to approve." };
  const [p] = await db.select().from(packs).where(eq(packs.id, row.packId));
  if (!p) return { ok: false, error: "Pack not found." };
  await db.update(packAnswers).set({ status: "confirmed", origin: "SPEC", updatedBy: user.id, updatedAt: new Date() }).where(eq(packAnswers.packId, p.id));
  await db.update(packs).set({ importStatus: "APPROVED", updatedBy: user.id, updatedAt: new Date() }).where(eq(packs.id, p.id));
  const result = (row.result ?? {}) as { hardware?: { code: string; type: string; name: string; dims_mm: string; material: string; finish: string }[]; materials?: { supplier: string; article: string; colour_no: string; colour_name: string; composition: string }[] };
  let parts = 0,
    cards = 0;
  for (const h of result.hardware ?? []) {
    const [have] = await db.select({ id: hardware.id }).from(hardware).where(eq(hardware.code, h.code));
    if (have) continue;
    await db.insert(hardware).values({ code: h.code, brandId: p.brandId, name: h.name, type: h.type || "COMPONENT", dimsMm: h.dims_mm, material: h.material, finish: h.finish, createdBy: user.id, updatedBy: user.id });
    parts++;
  }
  for (const m of result.materials ?? []) {
    const [have] = await db.select({ id: materials.id }).from(materials).where(and(eq(materials.supplier, m.supplier), eq(materials.articleName, m.article), eq(materials.colourNo, m.colour_no)));
    if (have) continue;
    await db.insert(materials).values({ supplier: m.supplier, articleName: m.article, colourNo: m.colour_no, colourName: m.colour_name, composition: m.composition, createdBy: user.id, updatedBy: user.id });
    cards++;
  }
  await db.update(archiveImports).set({ status: "APPROVED", updatedAt: new Date() }).where(eq(archiveImports.id, id));
  await audit({ userId: user.id, entity: "pack", entityId: p.id, action: "update", field: "archive_approved", after: { parts, cards } });
  revalidatePath("/admin/archive");
  revalidatePath("/");
  return { ok: true, message: `${p.styleNo} is a base style; ${parts} part(s) and ${cards} card(s) added to the library.` };
}

/** Rejects a proposed import: its pack is deleted; the file stays listed so it isn't re-imported. */
export async function rejectArchiveImport(id: string): Promise<ActionResult> {
  const user = await requireRole("admin");
  const [row] = await db.select().from(archiveImports).where(eq(archiveImports.id, id));
  if (!row) return { ok: false, error: "Not found." };
  if (row.packId) {
    const [p] = await db.select({ importStatus: packs.importStatus }).from(packs).where(eq(packs.id, row.packId));
    if (p?.importStatus === "PROPOSED") await db.delete(packs).where(eq(packs.id, row.packId));
  }
  await db.update(archiveImports).set({ status: "REJECTED", packId: null, updatedAt: new Date() }).where(eq(archiveImports.id, id));
  await audit({ userId: user.id, entity: "pack", entityId: row.packId ?? id, action: "delete", field: "archive_rejected", after: { file: row.name } });
  revalidatePath("/admin/archive");
  return { ok: true };
}
