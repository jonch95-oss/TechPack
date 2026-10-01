import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  brands,
  hardware,
  libraryUsage,
  materials,
  packAnswers,
  packFiles,
  packs,
  prints,
  users,
  type AnswerStatus,
} from "@/db/schema";
import { nextCode } from "@/lib/codes";
import type { AnswerMap, Category, LibValue, MatrixValue } from "@/lib/questions";

export async function loadPack(id: string) {
  const [row] = await db
    .select({ pack: packs, brand: brands })
    .from(packs)
    .innerJoin(brands, eq(brands.id, packs.brandId))
    .where(eq(packs.id, id))
    .limit(1);
  if (!row) return null;
  const answerRows = await db.select().from(packAnswers).where(eq(packAnswers.packId, id));
  const files = await db.select().from(packFiles).where(eq(packFiles.packId, id)).orderBy(asc(packFiles.createdAt));
  const answers: AnswerMap = {};
  const statuses: Record<string, AnswerStatus> = {};
  const meta: Record<string, { aiNote: string; aiValue: unknown; updatedAt: string; updatedBy: string | null }> = {};
  for (const a of answerRows) {
    answers[a.questionId] = a.value;
    statuses[a.questionId] = a.status;
    meta[a.questionId] = { aiNote: a.aiNote, aiValue: a.aiValue, updatedAt: a.updatedAt.toISOString(), updatedBy: a.updatedBy };
  }
  const sentBy = row.pack.sentBy
    ? (await db.select({ name: users.name }).from(users).where(eq(users.id, row.pack.sentBy)))[0]?.name ?? ""
    : "";
  return {
    pack: { ...row.pack, category: row.pack.category as Category },
    brand: row.brand,
    answers,
    statuses,
    meta,
    files,
    sentBy,
  };
}

export type LoadedPack = NonNullable<Awaited<ReturnType<typeof loadPack>>>;

/** Next free component code for a brand, checked against components AND style numbers. */
export async function nextCodeForBrand(brandId: string) {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
  if (!brand) throw new Error("Unknown brand");
  const hw = await db.select({ code: hardware.code }).from(hardware);
  const styles = await db.select({ styleNo: packs.styleNo }).from(packs).where(eq(packs.brandId, brandId));
  // All hardware codes are checked (not only this brand's) so a mis-tagged component still can't collide.
  return nextCode(brand.codeFormat, [...hw.map((h) => h.code), ...styles.map((s) => s.styleNo)]);
}

/** Collects library references from a pack's answers ("styles it is used in"). */
export function libraryRefs(answers: AnswerMap): { lib: "material" | "hardware" | "print"; id: string }[] {
  const refs: { lib: "material" | "hardware" | "print"; id: string }[] = [];
  const add = (lib: "material" | "hardware" | "print", v: unknown) => {
    const id = (v as LibValue | undefined)?.id;
    if (id && /^[0-9a-f-]{36}$/i.test(id)) refs.push({ lib, id });
  };
  for (const [k, v] of Object.entries(answers)) {
    if (!v || typeof v !== "object") continue;
    if (k === "materials.matrix") {
      for (const row of Object.values(v as MatrixValue))
        for (const [col, cell] of Object.entries(row ?? {})) {
          if (!cell?.lib) continue;
          add(col === "lining" ? (cell.lib.label.startsWith("PRINT:") ? "print" : "material") : "material", cell.lib);
        }
      continue;
    }
    if (Array.isArray(v)) {
      for (const r of v) if (r && typeof r === "object") for (const c of Object.values(r)) if (c && typeof c === "object" && "id" in c) add(libOf(k), c);
      continue;
    }
    if ("id" in (v as object)) add(libOf(k), v);
  }
  return refs;
}

function libOf(questionId: string): "material" | "hardware" | "print" {
  if (/lining_material|body_fabric|cube\.body_fabric/.test(questionId)) return "material";
  if (/lining_print|art\.print/.test(questionId)) return "print";
  return "hardware";
}

export async function rebuildLibraryUsage(packId: string, answers: AnswerMap) {
  const refs = libraryRefs(answers);
  await db.delete(libraryUsage).where(eq(libraryUsage.packId, packId));
  const unique = new Map(refs.map((r) => [`${r.lib}:${r.id}`, r]));
  if (unique.size)
    await db
      .insert(libraryUsage)
      .values([...unique.values()].map((r) => ({ packId, lib: r.lib, itemId: r.id })))
      .onConflictDoNothing();
}

/** Styles a library item is used in. */
export async function usedIn(itemIds: string[]) {
  if (!itemIds.length) return new Map<string, string[]>();
  const rows = await db
    .select({ itemId: libraryUsage.itemId, styleNo: packs.styleNo })
    .from(libraryUsage)
    .innerJoin(packs, eq(packs.id, libraryUsage.packId))
    .where(inArray(libraryUsage.itemId, itemIds));
  const m = new Map<string, string[]>();
  for (const r of rows) m.set(r.itemId, [...(m.get(r.itemId) ?? []), r.styleNo]);
  return m;
}

export async function libraryOptions() {
  const [mats, hws, prs, brs] = await Promise.all([
    db.select().from(materials).orderBy(asc(materials.supplier), asc(materials.colourNo)),
    db.select().from(hardware).orderBy(asc(hardware.code)),
    db.select().from(prints).orderBy(asc(prints.name)),
    db.select().from(brands).orderBy(asc(brands.name)),
  ]);
  return {
    materials: mats.map((m) => ({
      id: m.id,
      label: materialLabel(m),
      sub: [m.composition, m.thickness].filter(Boolean).join(" · "),
      photo: m.cardPhotoUrl,
      chipBox: m.chipBox,
    })),
    hardware: hws.map((h) => ({
      id: h.id,
      label: h.code,
      sub: [h.type, h.name, h.dimsMm && `${h.dimsMm} MM`, h.finish].filter(Boolean).join(" · "),
      type: h.type,
      brandId: h.brandId,
      photo: h.photoUrl,
    })),
    prints: prs.map((p) => ({
      id: p.id,
      label: `PRINT: ${p.name}`,
      sub: [p.application, p.tileW && `${p.tileW} × ${p.tileH} ${p.tileUnit.toUpperCase()}`, p.colours.map((c) => c.code).join(", ")]
        .filter(Boolean)
        .join(" · "),
      photo: p.motifUrl,
    })),
    brands: brs,
  };
}

export type LibraryOptions = Awaited<ReturnType<typeof libraryOptions>>;

export function materialLabel(m: { supplier: string; articleName: string; colourNo: string; colourName: string }) {
  const art = m.articleName ? ` ${m.articleName}` : "";
  const col = [m.colourNo && (m.colourNo.startsWith("#") ? m.colourNo : `#${m.colourNo}`), m.colourName].filter(Boolean).join(" ");
  return `${m.supplier}${art}${col ? ` / ${col}` : ""}`.trim().toUpperCase();
}

export async function hardwareByCode() {
  const rows = await db.select({ id: hardware.id, code: hardware.code }).from(hardware);
  return new Map(rows.map((r) => [r.code.toUpperCase(), { id: r.id, label: r.code }]));
}

export async function brandHardware(brandId: string) {
  return db
    .select({ code: hardware.code, type: hardware.type, name: hardware.name })
    .from(hardware)
    .where(and(eq(hardware.brandId, brandId)));
}

/** Checks a designer-entered component code against the brand format, other components and style numbers. */
export async function checkComponentCode(brandId: string | null, code: string, excludeId?: string) {
  const { checkCode } = await import("@/lib/codes");
  const [brand] = brandId ? await db.select().from(brands).where(eq(brands.id, brandId)) : [];
  const hw = await db.select({ id: hardware.id, code: hardware.code }).from(hardware);
  const styles = await db.select({ styleNo: packs.styleNo }).from(packs);
  return checkCode({
    code,
    format: brand?.codeFormat ?? "###",
    brandName: brand?.name ?? "this brand",
    componentCodes: hw.filter((h) => h.id !== excludeId).map((h) => h.code),
    styleNos: styles.map((s) => s.styleNo),
  });
}
