"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { brands, hardware, materials, packs, prints, type ChipBox, type FieldStatusMap, type PantoneColour } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { nextCodeForBrand } from "@/lib/data";
import { readStoredFile } from "@/lib/storage";
import { callTechnicalDesigner, AIUnavailableError } from "@/lib/ai/client";
import {
  READ_SWATCH_SCHEMA,
  SWATCH_FIELDS,
  buildSwatchInstructions,
  normaliseChipBox,
  type ReadSwatchOutput,
} from "@/lib/ai/read-swatch";
import { matchImage, parseCsv, parseXlsx, type ImportRow } from "@/lib/hardware-import";
import { codeNumber, nextCode } from "@/lib/codes";
import type { ActionResult } from "./admin";

const up = (s: unknown) => String(s ?? "").trim().toUpperCase();

/* ---------------------------------- materials ---------------------------------- */

export type MaterialInput = {
  id?: string;
  supplier: string;
  articleName: string;
  articleNo: string;
  colourNo: string;
  colourName: string;
  composition: string;
  thickness: string;
  width: string;
  finish: string;
  cardPhotoUrl: string | null;
  chipBox: ChipBox | null;
  /** Fields the designer has confirmed (removes "AI-read — confirm"). */
  confirmFields?: string[];
};

export async function saveMaterial(input: MaterialInput): Promise<ActionResult & { id?: string }> {
  const user = await requireRole("designer");
  if (!input.supplier.trim()) return { ok: false, error: "Supplier is required." };
  if (!input.colourNo.trim() && !input.colourName.trim()) return { ok: false, error: "Enter a colour number or name." };
  const values = {
    supplier: up(input.supplier),
    articleName: up(input.articleName),
    articleNo: up(input.articleNo),
    colourNo: up(input.colourNo),
    colourName: up(input.colourName),
    composition: up(input.composition),
    thickness: up(input.thickness),
    width: up(input.width),
    finish: up(input.finish),
    cardPhotoUrl: input.cardPhotoUrl,
    chipBox: input.chipBox,
    updatedBy: user.id,
    updatedAt: new Date(),
  };
  if (input.id) {
    const [before] = await db.select().from(materials).where(eq(materials.id, input.id));
    if (!before) return { ok: false, error: "Material not found." };
    const fieldStatus: FieldStatusMap = { ...before.fieldStatus };
    // A field the designer edited or explicitly confirmed is no longer "AI-read".
    for (const f of SWATCH_FIELDS) {
      if (fieldStatus[f] !== "ai") continue;
      const changed = (before as Record<string, unknown>)[f] !== (values as Record<string, unknown>)[f];
      if (changed || input.confirmFields?.includes(f)) fieldStatus[f] = "confirmed";
    }
    if (fieldStatus.chipBox === "ai" && (input.confirmFields?.includes("chipBox") || JSON.stringify(before.chipBox) !== JSON.stringify(values.chipBox)))
      fieldStatus.chipBox = "confirmed";
    await db.update(materials).set({ ...values, fieldStatus }).where(eq(materials.id, input.id));
    await audit({ userId: user.id, entity: "material", entityId: input.id, action: "update", before, after: values });
    revalidatePath("/library/materials");
    return { ok: true, id: input.id, message: "Saved." };
  }
  const [m] = await db.insert(materials).values({ ...values, createdBy: user.id }).returning({ id: materials.id });
  await audit({ userId: user.id, entity: "material", entityId: m.id, action: "create", after: values });
  revalidatePath("/library/materials");
  return { ok: true, id: m.id, message: "Material added." };
}

/** read_swatch_card: pre-fills the card fields + chip box, each marked "AI-read — confirm". */
export async function readSwatchCard(materialId: string): Promise<ActionResult> {
  const user = await requireRole("designer");
  const [m] = await db.select().from(materials).where(eq(materials.id, materialId));
  if (!m?.cardPhotoUrl) return { ok: false, error: "Upload the card photo first." };
  let out: ReadSwatchOutput;
  try {
    const img = await readStoredFile(m.cardPhotoUrl);
    const res = await callTechnicalDesigner<ReadSwatchOutput>({
      task: "read_swatch_card",
      instructions: buildSwatchInstructions({ supplier: m.supplier, colourNo: m.colourNo, colourName: m.colourName }),
      images: [img],
      schema: READ_SWATCH_SCHEMA,
      fixtureName: `read_swatch_card${m.colourNo ? `.${m.colourNo.replace(/[^0-9A-Z]/gi, "")}` : ""}`,
    });
    out = res.output;
  } catch (e) {
    if (e instanceof AIUnavailableError) return { ok: false, error: "AI is not configured (ANTHROPIC_API_KEY). Enter the card fields by hand." };
    return { ok: false, error: `Couldn't read the card: ${(e as Error).message}` };
  }
  const set: Record<string, unknown> = {};
  const fieldStatus: FieldStatusMap = { ...m.fieldStatus };
  for (const f of SWATCH_FIELDS) {
    const v = up(out[f]);
    const current = (m as Record<string, unknown>)[f] as string;
    // Never overwrite a value the designer already confirmed.
    if (!v || (current && m.fieldStatus[f] !== "ai")) continue;
    set[f] = v;
    fieldStatus[f] = "ai";
  }
  const box = normaliseChipBox(out.chip_box);
  if (box && (!m.chipBox || m.fieldStatus.chipBox === "ai")) {
    set.chipBox = box;
    fieldStatus.chipBox = "ai";
  }
  await db
    .update(materials)
    .set({ ...set, fieldStatus, aiNotes: [out.raw_text, out.agent_notes].filter(Boolean).join("\n"), updatedBy: user.id, updatedAt: new Date() })
    .where(eq(materials.id, materialId));
  await audit({ userId: user.id, entity: "material", entityId: materialId, action: "ai", field: "read_swatch_card", after: set });
  revalidatePath(`/library/materials/${materialId}`);
  return { ok: true, message: `Read ${Object.keys(set).length} field(s) — confirm each.` };
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  const user = await requireRole("admin");
  const [before] = await db.select().from(materials).where(eq(materials.id, id));
  await db.delete(materials).where(eq(materials.id, id));
  await audit({ userId: user.id, entity: "material", entityId: id, action: "delete", before });
  revalidatePath("/library/materials");
  return { ok: true };
}

/* ---------------------------------- hardware ---------------------------------- */

export type HardwareInput = {
  id?: string;
  code?: string;
  brandId: string | null;
  name: string;
  type: string;
  dimsMm: string;
  views: { front?: string; side?: string; rear?: string; top?: string };
  material: string;
  finish: string;
  logoTreatment: string;
  enamelPantone: string;
  construction: string;
  photoUrl: string | null;
  notes: string;
};

export async function getNextCode(brandId: string): Promise<string> {
  await requireRole("viewer");
  return nextCodeForBrand(brandId);
}

export async function saveHardware(input: HardwareInput): Promise<ActionResult & { id?: string; code?: string }> {
  const user = await requireRole("designer");
  if (!input.type.trim()) return { ok: false, error: "Type is required." };
  let code = up(input.code);
  if (!input.id && !code) {
    if (!input.brandId) return { ok: false, error: "Pick a brand so a code can be assigned." };
    code = await nextCodeForBrand(input.brandId);
  }
  if (!code) return { ok: false, error: "Code is required." };
  const clash = await db.select({ id: hardware.id }).from(hardware).where(eq(hardware.code, code));
  if (clash.length && clash[0].id !== input.id) return { ok: false, error: `${code} is already used by another component.` };
  const values = {
    code,
    brandId: input.brandId,
    name: up(input.name),
    type: up(input.type),
    dimsMm: up(input.dimsMm),
    views: input.views,
    material: up(input.material),
    finish: up(input.finish),
    logoTreatment: up(input.logoTreatment),
    enamelPantone: up(input.enamelPantone),
    construction: up(input.construction),
    photoUrl: input.photoUrl,
    notes: up(input.notes),
    updatedBy: user.id,
    updatedAt: new Date(),
  };
  if (input.id) {
    const [before] = await db.select().from(hardware).where(eq(hardware.id, input.id));
    await db.update(hardware).set(values).where(eq(hardware.id, input.id));
    await audit({ userId: user.id, entity: "hardware", entityId: input.id, action: "update", before, after: values });
    revalidatePath("/library/hardware");
    return { ok: true, id: input.id, code, message: "Saved." };
  }
  const [h] = await db.insert(hardware).values({ ...values, createdBy: user.id }).returning({ id: hardware.id });
  await audit({ userId: user.id, entity: "hardware", entityId: h.id, action: "create", after: values });
  revalidatePath("/library/hardware");
  return { ok: true, id: h.id, code, message: `${code} created.` };
}

export type ImportReport = {
  ok: boolean;
  created: string[];
  updated: string[];
  assigned: string[];
  images: number;
  errors: string[];
};

/**
 * Bulk import from CSV/XLSX + an images folder. Existing codes are updated; rows without a
 * code get the next free code in their brand's format (checked against styles too).
 */
export async function importHardware(form: FormData): Promise<ImportReport> {
  const user = await requireRole("designer");
  const report: ImportReport = { ok: false, created: [], updated: [], assigned: [], images: 0, errors: [] };
  const file = form.get("sheet");
  const defaultBrandId = String(form.get("brandId") ?? "") || null;
  if (!(file instanceof File) || !file.size) {
    report.errors.push("Choose a CSV or XLSX file.");
    return report;
  }
  // Images are uploaded by the browser first (keeps each request small); we get { relativePath: url }.
  let imageMap: Record<string, string> = {};
  try {
    imageMap = JSON.parse(String(form.get("imageMap") ?? "{}"));
  } catch {
    report.errors.push("Image list was unreadable; importing without images.");
  }
  const name = file.name.toLowerCase();
  const parsed = name.endsWith(".xlsx") ? await parseXlsx(await file.arrayBuffer()) : parseCsv(await file.text());
  report.errors.push(...parsed.errors);
  if (!parsed.rows.length) return report;

  const allBrands = await db.select().from(brands);
  const brandFor = (r: ImportRow) => {
    if (r.brand) {
      const b = allBrands.find((x) => x.name.toUpperCase() === r.brand.toUpperCase() || x.codePrefix === r.brand.toUpperCase());
      if (b) return b;
    }
    const byPrefix = allBrands
      .filter((b) => r.code && codeNumber(b.codeFormat, r.code) !== null)
      .sort((a, b) => b.codePrefix.length - a.codePrefix.length)[0];
    return byPrefix ?? allBrands.find((b) => b.id === defaultBrandId) ?? null;
  };

  const imageNames = Object.keys(imageMap);
  const linked = new Set<string>();
  const imageUrl = async (wanted: string, code: string) => {
    const hit = matchImage(imageNames, wanted, code);
    if (!hit) return null;
    if (!linked.has(hit)) {
      linked.add(hit);
      report.images++;
    }
    return imageMap[hit];
  };

  // Codes used so far, including ones assigned earlier in this same import.
  const used = new Set((await db.select({ code: hardware.code }).from(hardware)).map((h) => h.code));
  const styleRows = await db.select({ styleNo: packs.styleNo }).from(packs);
  for (const s of styleRows) used.add(s.styleNo);

  for (const r of parsed.rows) {
    if (!r.type) continue;
    const brand = brandFor(r);
    let code = r.code;
    if (!code) {
      if (!brand) {
        report.errors.push(`Line ${r.line}: no code and no brand — can't assign a code.`);
        continue;
      }
      code = nextCode(brand.codeFormat, [...used]);
      report.assigned.push(code);
    }
    used.add(code);
    const photoUrl = await imageUrl(r.photo, code);
    const views: Record<string, string> = {};
    for (const v of ["front", "side", "rear"] as const) {
      if (!r[v]) continue;
      const u = await imageUrl(r[v], "");
      if (u) views[v] = u;
      else report.errors.push(`Line ${r.line}: ${v} image "${r[v]}" not found in the images folder.`);
    }
    if (r.photo && !photoUrl) report.errors.push(`Line ${r.line}: photo "${r.photo}" not found in the images folder.`);
    const values = {
      code,
      brandId: brand?.id ?? null,
      name: r.name,
      type: r.type,
      dimsMm: r.dimsMm,
      views,
      material: r.material,
      finish: r.finish,
      logoTreatment: r.logoTreatment,
      enamelPantone: r.enamelPantone,
      construction: r.construction,
      notes: r.notes,
      updatedBy: user.id,
      updatedAt: new Date(),
      ...(photoUrl ? { photoUrl } : {}),
    };
    const [existing] = await db.select({ id: hardware.id }).from(hardware).where(eq(hardware.code, code));
    if (existing) {
      await db.update(hardware).set(values).where(eq(hardware.id, existing.id));
      report.updated.push(code);
    } else {
      await db.insert(hardware).values({ ...values, createdBy: user.id });
      report.created.push(code);
    }
  }
  await audit({
    userId: user.id,
    entity: "hardware",
    entityId: "import",
    action: "create",
    after: { file: file.name, created: report.created, updated: report.updated, assigned: report.assigned },
  });
  report.ok = true;
  revalidatePath("/library/hardware");
  return report;
}

export async function deleteHardware(id: string): Promise<ActionResult> {
  const user = await requireRole("admin");
  const [before] = await db.select().from(hardware).where(eq(hardware.id, id));
  await db.delete(hardware).where(eq(hardware.id, id));
  await audit({ userId: user.id, entity: "hardware", entityId: id, action: "delete", before });
  revalidatePath("/library/hardware");
  return { ok: true };
}

/* ---------------------------------- prints ---------------------------------- */

export type PrintInput = {
  id?: string;
  name: string;
  brandId: string | null;
  motif: string;
  motifUrl: string | null;
  repeatType: string;
  tileW: string;
  tileH: string;
  tileUnit: string;
  colours: PantoneColour[];
  application: string;
  baseFabricId: string | null;
  baseFabricText: string;
  sourceFiles: { name: string; url: string }[];
};

export async function savePrint(input: PrintInput): Promise<ActionResult & { id?: string }> {
  const user = await requireRole("designer");
  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  const values = {
    name: up(input.name),
    brandId: input.brandId,
    motif: up(input.motif),
    motifUrl: input.motifUrl,
    repeatType: up(input.repeatType),
    tileW: input.tileW.trim(),
    tileH: input.tileH.trim(),
    tileUnit: input.tileUnit === "in" ? "in" : input.tileUnit === "mm" ? "mm" : "cm",
    colours: input.colours.filter((c) => c.code.trim()).map((c) => ({ ...c, code: up(c.code) })),
    application: up(input.application),
    baseFabricId: input.baseFabricId,
    baseFabricText: up(input.baseFabricText),
    sourceFiles: input.sourceFiles,
    updatedBy: user.id,
    updatedAt: new Date(),
  };
  if (input.id) {
    const [before] = await db.select().from(prints).where(eq(prints.id, input.id));
    await db.update(prints).set(values).where(eq(prints.id, input.id));
    await audit({ userId: user.id, entity: "print", entityId: input.id, action: "update", before, after: values });
    revalidatePath("/library/prints");
    return { ok: true, id: input.id, message: "Saved." };
  }
  const [p] = await db.insert(prints).values({ ...values, createdBy: user.id }).returning({ id: prints.id });
  await audit({ userId: user.id, entity: "print", entityId: p.id, action: "create", after: values });
  revalidatePath("/library/prints");
  return { ok: true, id: p.id, message: "Artwork added." };
}

/* ---------------------------------- reads (for drawers) ---------------------------------- */

export async function getMaterial(id: string) {
  await requireRole("viewer");
  const [m] = await db.select().from(materials).where(eq(materials.id, id));
  return m ?? null;
}
