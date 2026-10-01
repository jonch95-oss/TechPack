"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { brands, hardware, materials, packs, type FieldStatusMap } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { readStoredFile, storeFile, contentTypeFor } from "@/lib/storage";
import { AIUnavailableError, callTechnicalDesigner } from "@/lib/ai/client";
import { READ_SWATCH_SCHEMA, SWATCH_FIELDS, buildSwatchInstructions, normaliseChipBox, type ReadSwatchOutput } from "@/lib/ai/read-swatch";
import {
  brandForRow,
  emptyRow,
  fieldsFor,
  hasErrors,
  matchImage,
  materialKey,
  normaliseField,
  parseCsv,
  rowIssues,
  type ImportContext,
  type ImportRow,
  type LibraryKind,
} from "@/lib/library-import";
import { extractFromPdf, parseXlsx } from "@/lib/library-import-server";

export async function importContext(): Promise<ImportContext> {
  await requireRole("viewer");
  const [bs, hw, st, mats] = await Promise.all([
    db.select({ id: brands.id, name: brands.name, codePrefix: brands.codePrefix, codeFormat: brands.codeFormat }).from(brands).orderBy(asc(brands.name)),
    db.select({ code: hardware.code, brandId: hardware.brandId }).from(hardware),
    db.select({ styleNo: packs.styleNo }).from(packs),
    db.select({ supplier: materials.supplier, colourNo: materials.colourNo, articleName: materials.articleName }).from(materials),
  ]);
  return {
    brands: bs,
    defaultBrandId: null,
    existingCodes: Object.fromEntries(hw.map((h) => [h.code.toUpperCase(), h.brandId])),
    styleNos: st.map((s) => s.styleNo),
    existingMaterials: mats.map((m) => materialKey(m as unknown as Record<string, string>)),
  };
}

export type ParseResult = { rows: ImportRow[]; errors: string[]; notes: string[]; unusedImages: string[] };

/**
 * Turns everything the designer dropped in into review rows.
 * form: kind, sheets (CSV/XLSX files, small), pdfUrls (JSON, uploaded first), imageMap (JSON name → url, uploaded first).
 */
export async function parseUpload(form: FormData): Promise<ParseResult> {
  await requireRole("designer");
  const kind = (String(form.get("kind")) === "material" ? "material" : "hardware") as LibraryKind;
  const out: ParseResult = { rows: [], errors: [], notes: [], unusedImages: [] };
  const imageMap = safeJson<Record<string, string>>(form.get("imageMap"), {});
  const pdfs = safeJson<{ name: string; url: string }[]>(form.get("pdfUrls"), []);
  const used = new Set<string>();

  for (const f of form.getAll("sheets")) {
    if (!(f instanceof File) || !f.size) continue;
    const name = f.name;
    if (/\.xls$/i.test(name)) {
      out.errors.push(`${name}: old .xls files can't be read — open it in Excel and “Save As” .xlsx, or export CSV.`);
      continue;
    }
    if (/\.xlsx$/i.test(name)) {
      const parsed = await parseXlsx(kind, await f.arrayBuffer(), name);
      out.errors.push(...parsed.errors);
      // Pictures pasted into a row become that row's photo.
      for (const img of parsed.embedded) {
        const row = parsed.rows.find((r) => r.line === img.line);
        if (!row) continue;
        const slot = row.images.photo ? (["front", "side", "rear"].find((k) => !row.images[k]) ?? null) : "photo";
        if (!slot || (kind === "material" && slot !== "photo")) continue;
        row.images[slot] = await storeFile(kind === "hardware" ? "hardware" : "swatches", `${name.replace(/\.[^.]+$/, "")}-line${img.line}.${img.ext}`, img.data, contentTypeFor(`x.${img.ext}`));
      }
      out.rows.push(...parsed.rows.map(stripLine));
    } else if (/\.(csv|txt)$/i.test(name)) {
      const parsed = parseCsv(kind, await f.text(), name);
      out.errors.push(...parsed.errors);
      out.rows.push(...parsed.rows.map(stripLine));
    } else {
      out.errors.push(`${name}: not a spreadsheet (use .xlsx or .csv).`);
    }
  }

  for (const p of pdfs) {
    try {
      const file = await readStoredFile(p.url);
      const brandNames = (await db.select({ name: brands.name }).from(brands)).map((b) => b.name);
      const res = await extractFromPdf(kind, file.data, p.name, brandNames);
      out.rows.push(...res.rows);
      if (res.notes) out.notes.push(`${p.name}: ${res.notes}`);
      if (!res.rows.length) out.errors.push(`${p.name}: nothing to import was found in the PDF.`);
    } catch (e) {
      out.errors.push(
        e instanceof AIUnavailableError ? `${p.name}: PDFs are read by the AI, which isn't configured yet (ANTHROPIC_API_KEY).` : `${p.name}: couldn't be read — ${(e as Error).message}`,
      );
    }
  }

  // Resolve named images and code-named images.
  const names = Object.keys(imageMap);
  for (const r of out.rows) {
    for (const [slot, ref] of Object.entries(r.imageRefs)) {
      const hit = matchImage(names, ref, "");
      if (hit) {
        r.images[slot] = imageMap[hit];
        used.add(hit);
      }
    }
    if (!r.images.photo) {
      const key = kind === "hardware" ? r.fields.code : r.fields.colourNo;
      const hit = key ? matchImage(names, "", key) : null;
      if (hit) {
        r.images.photo = imageMap[hit];
        used.add(hit);
      }
    }
  }
  // Leftover photos: for materials each is a swatch card of its own; for hardware each starts a row to fill in.
  for (const n of names.filter((x) => !used.has(x))) {
    const row = emptyRow(kind, n.split("/").pop()!);
    row.images.photo = imageMap[n];
    if (kind === "hardware") {
      const stem = n.split("/").pop()!.replace(/\.[^.]+$/, "").toUpperCase();
      if (/^[A-Z]{1,6}[_-]?\d{2,}$/.test(stem)) row.fields.code = stem;
    }
    out.rows.push(row);
  }
  return out;
}

function stripLine<T extends ImportRow & { line: number }>(r: T): ImportRow {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { line, ...rest } = r;
  return rest;
}

function safeJson<T>(v: FormDataEntryValue | null, fallback: T): T {
  try {
    return v ? (JSON.parse(String(v)) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Reads one swatch-card photo for a review row (nothing is saved). */
export async function readCardImage(url: string, hint: { supplier?: string; colourNo?: string; colourName?: string }) {
  await requireRole("designer");
  try {
    const img = await readStoredFile(url);
    const res = await callTechnicalDesigner<ReadSwatchOutput>({
      task: "read_swatch_card",
      instructions: buildSwatchInstructions(hint),
      images: [img],
      schema: READ_SWATCH_SCHEMA,
      fixtureName: `read_swatch_card${hint.colourNo ? `.${hint.colourNo.replace(/[^0-9A-Z]/gi, "")}` : ""}`,
    });
    const fields: Record<string, string> = {};
    for (const f of SWATCH_FIELDS) fields[f] = normaliseField("material", f, res.output[f]);
    return { ok: true as const, fields, chipBox: normaliseChipBox(res.output.chip_box) };
  } catch (e) {
    return { ok: false as const, error: e instanceof AIUnavailableError ? "AI isn't configured yet (ANTHROPIC_API_KEY)." : (e as Error).message };
  }
}

export type CommitReport = { created: string[]; updated: string[]; skipped: { source: string; reason: string }[] };

/** Saves the reviewed rows. Rows with errors are re-checked here and never saved. */
export async function commitImport(kind: LibraryKind, rows: ImportRow[], defaultBrandId: string | null): Promise<CommitReport> {
  const user = await requireRole("designer");
  const ctx = { ...(await importContext()), defaultBrandId };
  const issues = rowIssues(kind, rows, ctx);
  const report: CommitReport = { created: [], updated: [], skipped: [] };
  const now = new Date();
  for (const r of rows) {
    if (!r.include) continue;
    if (hasErrors(issues[r.key])) {
      report.skipped.push({ source: r.source, reason: issues[r.key].filter((i) => i.level === "error").map((i) => i.message).join(" ") });
      continue;
    }
    const f = Object.fromEntries(fieldsFor(kind).map((k) => [k, normaliseField(kind, k, r.fields[k])]));
    if (kind === "hardware") {
      const brand = brandForRow(r, ctx)!;
      const code = f.code;
      const views = Object.fromEntries(["front", "side", "rear"].filter((k) => r.images[k]).map((k) => [k, r.images[k]]));
      const values = {
        code,
        brandId: brand.id,
        name: f.name,
        type: f.type,
        dimsMm: f.dimsMm,
        material: f.material,
        finish: f.finish,
        logoTreatment: f.logoTreatment,
        enamelPantone: f.enamelPantone,
        construction: f.construction,
        notes: f.notes,
        updatedBy: user.id,
        updatedAt: now,
        ...(r.images.photo ? { photoUrl: r.images.photo } : {}),
        ...(Object.keys(views).length ? { views } : {}),
      };
      const [existing] = await db.select({ id: hardware.id }).from(hardware).where(eq(hardware.code, code));
      if (existing) {
        await db.update(hardware).set(values).where(eq(hardware.id, existing.id));
        report.updated.push(code);
      } else {
        await db.insert(hardware).values({ ...values, createdBy: user.id });
        report.created.push(code);
      }
    } else {
      const fieldStatus: FieldStatusMap = Object.fromEntries(r.aiFields.map((k) => [k, "ai" as const]));
      if (r.chipBox && r.aiFields.length) fieldStatus.chipBox = "ai";
      await db.insert(materials).values({
        supplier: f.supplier,
        articleName: f.articleName,
        articleNo: f.articleNo,
        colourNo: f.colourNo,
        colourName: f.colourName,
        composition: f.composition,
        thickness: f.thickness,
        width: f.width,
        finish: f.finish,
        cardPhotoUrl: r.images.photo ?? null,
        chipBox: r.chipBox ?? null,
        fieldStatus,
        createdBy: user.id,
        updatedBy: user.id,
      });
      report.created.push([f.supplier, f.colourNo, f.colourName].filter(Boolean).join(" "));
    }
  }
  await audit({ userId: user.id, entity: kind, entityId: "import", action: "create", after: report });
  revalidatePath(kind === "hardware" ? "/library/hardware" : "/library/materials");
  return report;
}
