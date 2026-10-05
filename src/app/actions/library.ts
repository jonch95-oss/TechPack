"use server";

import { friendlyAIError } from "@/lib/ai/errors";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { hardware, materials, prints, type Approval, type ChipBox, type FieldStatusMap, type FinishSpec, type HardwareRecord, type HardwareViewCrops, type PantoneColour } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { checkComponentCode } from "@/lib/data";
import { readStoredFile } from "@/lib/storage";
import { callTechnicalDesigner } from "@/lib/ai/client";
import {
  READ_SWATCH_SCHEMA,
  SWATCH_FIELDS,
  buildSwatchInstructions,
  normaliseChipBox,
  type ReadSwatchOutput,
} from "@/lib/ai/read-swatch";
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
  approval?: Approval;
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
    ...(input.approval ? { approval: cleanApproval(input.approval) } : {}),
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
    return { ok: false, error: friendlyAIError(e, "claude", "Reading the swatch card") };
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
  /** Each view cropped to the part (fractions of the image). */
  viewCrops?: HardwareViewCrops;
  material: string;
  finish: string;
  logoTreatment: string;
  enamelPantone: string;
  construction: string;
  photoUrl: string | null;
  notes: string;
  finishSpec?: FinishSpec;
  approval?: Approval;
  detailDims?: { label: string; mm?: number | null }[];
  record?: HardwareRecord;
  /** AI-suggested fields the designer accepted. */
  confirmFields?: string[];
};

/** Crops kept only for views that exist, clamped to the image. */
function cleanCrops(c: HardwareViewCrops, views: HardwareInput["views"]): HardwareViewCrops {
  const f = (n: unknown) => Math.min(1, Math.max(0, Number(n) || 0));
  const out: HardwareViewCrops = {};
  for (const k of ["front", "side", "rear", "top"] as const) {
    const b = c[k];
    if (views[k] && b) out[k] = { x: f(b.x), y: f(b.y), w: Math.max(0.02, f(b.w)), h: Math.max(0.02, f(b.h)) };
  }
  return out;
}

/** A component record as stored: capitals, empty rows dropped, numbers finite or null. */
function cleanRecord(r: HardwareRecord): HardwareRecord {
  const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : null);
  return {
    colour: up(r.colour ?? ""),
    mounting: up(r.mounting ?? ""),
    orientation: up(r.orientation ?? ""),
    parent: up(r.parent ?? ""),
    finishStandardId: r.finishStandardId || null,
    relief: (r.relief ?? []).map((x) => ({ treatment: up(x.treatment), mm: num(x.mm), location: up(x.location) })).filter((x) => x.treatment),
    usage: (r.usage ?? []).map((x) => ({ style: up(x.style), qty: num(x.qty), location: up(x.location) })).filter((x) => x.style),
  };
}

/** Live check while a designer types a code: errors block saving, warnings are called out. */
export async function checkHardwareCode(brandId: string | null, code: string, excludeId?: string) {
  await requireRole("viewer");
  return checkComponentCode(brandId, code, excludeId);
}

export async function saveHardware(input: HardwareInput): Promise<ActionResult & { id?: string; code?: string }> {
  const user = await requireRole("designer");
  if (!input.type.trim()) return { ok: false, error: "Type is required." };
  if (!input.brandId) return { ok: false, error: "Pick a brand." };
  const code = up(input.code);
  const check = await checkComponentCode(input.brandId, code, input.id);
  if (check.errors.length) return { ok: false, error: check.errors[0] };
  const values = {
    code,
    brandId: input.brandId,
    name: up(input.name),
    type: up(input.type),
    dimsMm: up(input.dimsMm),
    views: input.views,
    ...(input.viewCrops ? { viewCrops: cleanCrops(input.viewCrops, input.views) } : {}),
    material: up(input.material),
    finish: up(input.finish),
    logoTreatment: up(input.logoTreatment),
    enamelPantone: up(input.enamelPantone),
    construction: up(input.construction),
    photoUrl: input.photoUrl,
    notes: up(input.notes),
    ...(input.finishSpec ? { finishSpec: { ...input.finishSpec, plating: up(input.finishSpec.plating), coating: up(input.finishSpec.coating), mouldNo: up(input.finishSpec.mouldNo), platingThickness: up(input.finishSpec.platingThickness) } } : {}),
    ...(input.approval ? { approval: cleanApproval(input.approval) } : {}),
    ...(input.record ? { record: cleanRecord(input.record) } : {}),
    ...(input.detailDims ? { detailDims: input.detailDims.map((d) => ({ label: up(d.label), mm: typeof d.mm === "number" && Number.isFinite(d.mm) ? d.mm : null })).filter((d) => d.label) } : {}),
    updatedBy: user.id,
    updatedAt: new Date(),
  };
  if (input.id) {
    const [before] = await db.select().from(hardware).where(eq(hardware.id, input.id));
    if (!before) return { ok: false, error: "Hardware not found." };
    const fieldStatus: FieldStatusMap = { ...before.fieldStatus };
    // A field the designer edited or confirmed is no longer AI-suggested.
    for (const [f, st] of Object.entries(fieldStatus))
      if (st === "ai" && ((before as Record<string, unknown>)[f] !== (values as Record<string, unknown>)[f] || input.confirmFields?.includes(f))) fieldStatus[f] = "confirmed";
    await db.update(hardware).set({ ...values, fieldStatus }).where(eq(hardware.id, input.id));
    await audit({ userId: user.id, entity: "hardware", entityId: input.id, action: "update", before, after: values });
    revalidatePath("/library/hardware");
    return { ok: true, id: input.id, code, message: "Saved." };
  }
  const [h] = await db.insert(hardware).values({ ...values, createdBy: user.id }).returning({ id: hardware.id });
  await audit({ userId: user.id, entity: "hardware", entityId: h.id, action: "create", after: values });
  revalidatePath("/library/hardware");
  return { ok: true, id: h.id, code, message: `${code} created.` };
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

function cleanApproval(a: Approval): Approval {
  const status = (["PENDING", "APPROVED", "REJECTED"] as const).includes(a.status) ? a.status : "PENDING";
  return { status, type: up(a.type), date: a.date ?? "", note: up(a.note) };
}
