/**
 * Bulk import for the hardware and materials libraries.
 *
 * Every source (Excel template, any CSV / XLSX, PDFs read by the AI, a batch of photos) becomes the
 * same list of ImportRows. The designer reviews them in a table with call-outs before anything is
 * saved; `rowIssues` computes those call-outs and runs in the browser as rows are edited.
 */
import Papa from "papaparse";
import { HARDWARE_FINISHES, HARDWARE_MATERIALS, HARDWARE_TYPES } from "@/lib/questions/common";
import { checkCode } from "@/lib/codes";

export type LibraryKind = "hardware" | "material";

export const HARDWARE_FIELDS = [
  "code",
  "brand",
  "type",
  "name",
  "dimsMm",
  "material",
  "finish",
  "logoTreatment",
  "enamelPantone",
  "construction",
  "notes",
] as const;
export const MATERIAL_FIELDS = [
  "supplier",
  "articleName",
  "articleNo",
  "colourNo",
  "colourName",
  "composition",
  "thickness",
  "width",
  "finish",
] as const;

export type ImportRow = {
  /** Stable id for the review table. */
  key: string;
  /** Where it came from, e.g. "hardware.xlsx line 4", "catalogue.pdf p.2", "IMG_2041.jpg". */
  source: string;
  fields: Record<string, string>;
  /** Image references named in the sheet (photo / front / side / rear) — resolved against uploaded images. */
  imageRefs: Record<string, string>;
  /** Resolved image URLs: photo (hardware photo / swatch-card photo), front, side, rear. */
  images: Record<string, string>;
  /** Fields filled by the AI (PDF or card photo) and not yet edited — saved as "AI-read — confirm". */
  aiFields: string[];
  chipBox?: { x: number; y: number; w: number; h: number } | null;
  include: boolean;
};

export const FIELD_LABELS: Record<string, string> = {
  code: "Code",
  brand: "Brand",
  type: "Type",
  name: "Name",
  dimsMm: "Dims (mm)",
  material: "Material",
  finish: "Finish",
  logoTreatment: "Logo treatment",
  enamelPantone: "Enamel (Pantone)",
  construction: "Hollow / solid",
  notes: "Notes",
  supplier: "Supplier",
  articleName: "Article name",
  articleNo: "Article no.",
  colourNo: "Colour no.",
  colourName: "Colour name",
  composition: "Composition",
  thickness: "Thickness",
  width: "Width",
};

const ALIASES: Record<string, string[]> = {
  code: ["code", "item code", "component code", "hardware code", "ref", "reference", "ref no", "item no", "item #", "code #"],
  brand: ["brand", "label"],
  name: ["name", "description", "item", "item name", "desc"],
  type: ["type", "category", "component type", "component"],
  dimsMm: ["dims", "dims mm", "dimensions", "dimensions mm", "size", "size mm", "dims_mm", "measurements"],
  material: ["material", "base material"],
  finish: ["finish", "plating", "hardware finish", "colour finish", "color finish"],
  logoTreatment: ["logo", "logo treatment", "logo_treatment", "logo finish"],
  enamelPantone: ["enamel", "enamel colour", "enamel color", "pantone", "enamel pantone", "enamel_pantone"],
  construction: ["hollow", "hollow/solid", "hollow or solid", "construction", "solid"],
  notes: ["notes", "comment", "comments", "remarks"],
  supplier: ["supplier", "vendor", "mill", "tannery", "factory"],
  articleName: ["article", "article name", "card", "card name", "quality", "品名", "material name"],
  articleNo: ["article no", "article number", "article #", "card no", "card number", "art no", "style no"],
  colourNo: ["colour no", "color no", "colour number", "color number", "colour #", "color #", "colour code", "color code"],
  colourName: ["colour", "color", "colour name", "color name", "colourway"],
  composition: ["composition", "content", "成分", "fibre", "fiber content"],
  thickness: ["thickness", "厚度", "gauge"],
  width: ["width", "幅宽", "usable width", "roll width"],
  photo: ["photo", "image", "picture", "photo file", "image file", "card photo", "swatch photo"],
  front: ["front", "front view"],
  side: ["side", "side view"],
  rear: ["rear", "rear view", "back", "back view"],
};
const IMAGE_FIELDS = new Set(["photo", "front", "side", "rear"]);

function normHeader(h: string) {
  return h.toLowerCase().replace(/[()*:.]/g, "").replace(/[_\s]+/g, " ").trim();
}

export function fieldsFor(kind: LibraryKind): readonly string[] {
  return kind === "hardware" ? HARDWARE_FIELDS : MATERIAL_FIELDS;
}

export function mapHeaders(kind: LibraryKind, headers: string[]): Record<string, number> {
  const wanted = new Set([...fieldsFor(kind), "photo", ...(kind === "hardware" ? ["front", "side", "rear"] : [])]);
  const out: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = normHeader(h);
    for (const field of wanted) {
      if (out[field] === undefined && ALIASES[field]?.includes(n)) out[field] = i;
    }
  });
  // Materials: "finish" also matches the shared hardware alias list.
  if (kind === "material" && out.finish === undefined) {
    const i = headers.findIndex((h) => ["finish", "texture", "finish / texture", "属性"].includes(normHeader(h)));
    if (i >= 0) out.finish = i;
  }
  return out;
}

/** Maps free text to one of the library hardware types where it clearly matches. */
export function normaliseType(t: string): string {
  const up = t.trim().toUpperCase();
  if (!up) return "";
  if (HARDWARE_TYPES.includes(up)) return up;
  const rules: [RegExp, string][] = [
    [/KEY ?CHAIN|CHARM|KEYRING/, "KEYCHAIN/CHARM"],
    [/SLIDER/, "ZIPPER SLIDER"],
    [/PULL|PULLER/, "ZIPPER PULL"],
    [/ZIP/, "ZIPPER"],
    [/MAGNET/, "MAGNETIC SNAP"],
    [/PRESS|SNAP/, "PRESS SNAP"],
    [/TURN ?LOCK/, "TURNLOCK"],
    [/\bD[- ]?RING/, "D-RING"],
    [/\bO[- ]?RING/, "O-RING"],
    [/(SQUARE|RECTANGULAR|RECT\.?)\b.*\bRING|\bRING\b.*\b(SQUARE|RECTANGULAR)/, "SQUARE RING"],
    [/SWIVEL/, "SWIVEL HOOK"],
    [/LOBSTER/, "LOBSTER CLASP"],
    [/CHAIN/, "CHAIN"],
    [/BUCKLE/, "BUCKLE"],
    [/RIVET/, "RIVET"],
    [/EYELET|GROMMET/, "EYELET"],
    [/FEET|FOOT/, "FEET"],
    [/WOVEN/, "WOVEN LABEL"],
    [/TPU|RUBBER/, "TPU/RUBBER PATCH"],
    [/DEBOSS|EMBOSS|PATCH/, "DEBOSS/EMBOSS PATCH"],
    [/PLATE|LOGO/, "LOGO PLATE"],
    [/WHEEL/, "WHEEL"],
    [/TROLLEY/, "TROLLEY HANDLE"],
    [/LOCK/, "LOCK"],
  ];
  for (const [re, v] of rules) if (re.test(up)) return v;
  return up;
}

function normaliseConstruction(v: string) {
  const up = v.trim().toUpperCase();
  if (!up) return "";
  if (/HOLLOW|^Y(ES)?$|TRUE/.test(up)) return "HOLLOW";
  if (/SOLID|^N(O)?$|FALSE/.test(up)) return "SOLID";
  return up;
}

let keySeq = 0;
export function newKey() {
  keySeq += 1;
  return `r${Date.now().toString(36)}${keySeq}`;
}

export function emptyRow(kind: LibraryKind, source: string): ImportRow {
  return {
    key: newKey(),
    source,
    fields: Object.fromEntries(fieldsFor(kind).map((f) => [f, ""])),
    imageRefs: {},
    images: {},
    aiFields: [],
    include: true,
  };
}

/** Normalises one field value the way the library stores it (CAPITALS, known types). */
export function normaliseField(kind: LibraryKind, field: string, value: unknown): string {
  const s = String(value ?? "").trim();
  if (kind === "hardware" && field === "type") return normaliseType(s);
  if (kind === "hardware" && field === "construction") return normaliseConstruction(s);
  if (field === "brand") return s;
  if (field === "colourNo" && /^\d+$/.test(s)) return `#${s}`;
  return s.toUpperCase();
}

/** A parsed spreadsheet (first sheet) → rows. `table[i]` is spreadsheet line i+1. */
export function rowsFromTable(kind: LibraryKind, table: string[][], fileName: string): { rows: (ImportRow & { line: number })[]; errors: string[] } {
  const errors: string[] = [];
  // The header is the first row that maps at least two known columns (templates may have a title row).
  let headerIdx = -1;
  let map: Record<string, number> = {};
  for (let i = 0; i < Math.min(table.length, 15); i++) {
    const m = mapHeaders(kind, (table[i] ?? []).map((c) => String(c ?? "")));
    if (Object.keys(m).length >= 2) {
      headerIdx = i;
      map = m;
      break;
    }
  }
  if (headerIdx < 0) {
    errors.push(
      kind === "hardware"
        ? `${fileName}: no recognisable columns. Expected headers like Code, Type, Name, Dims (mm), Finish, Photo — or use the Excel template.`
        : `${fileName}: no recognisable columns. Expected headers like Supplier, Article, Colour no., Colour name, Composition — or use the Excel template.`,
    );
    return { rows: [], errors };
  }
  const rows: (ImportRow & { line: number })[] = [];
  table.slice(headerIdx + 1).forEach((r, i) => {
    if (!r?.some((c) => String(c ?? "").trim())) return;
    const line = headerIdx + i + 2;
    const cell = (f: string) => (map[f] === undefined ? "" : String(r[map[f]] ?? "").trim());
    // Skip the template's example row.
    if (/^e\.?g\.?$|^example$/i.test(cell(kind === "hardware" ? "code" : "supplier"))) return;
    const row = { ...emptyRow(kind, `${fileName} line ${line}`), line };
    for (const f of fieldsFor(kind)) row.fields[f] = normaliseField(kind, f, cell(f));
    for (const f of IMAGE_FIELDS) if (cell(f)) row.imageRefs[f] = cell(f);
    rows.push(row);
  });
  if (!rows.length) errors.push(`${fileName}: no data rows found under the header.`);
  return { rows, errors };
}

export function parseCsv(kind: LibraryKind, text: string, fileName = "sheet.csv") {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false });
  return rowsFromTable(kind, parsed.data, fileName);
}

/** Finds an uploaded image for a row: the named photo column, else a file named after the code / colour no. */
export function matchImage(fileNames: string[], wanted: string, code: string): string | null {
  const base = (n: string) => n.split(/[\\/]/).pop()!.toLowerCase();
  const stem = (n: string) => base(n).replace(/\.[^.]+$/, "");
  if (wanted) {
    const w = base(wanted);
    const hit = fileNames.find((f) => base(f) === w || stem(f) === w.replace(/\.[^.]+$/, ""));
    if (hit) return hit;
  }
  if (code) {
    const c = code.toLowerCase().replace(/^#/, "");
    const hit = fileNames.find((f) => stem(f) === c || stem(f) === code.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Call-outs                                                           */
/* ------------------------------------------------------------------ */

export type RowIssue = { level: "error" | "warning" | "info"; message: string; field?: string };

export type ImportContext = {
  brands: { id: string; name: string; codePrefix: string; codeFormat: string }[];
  defaultBrandId: string | null;
  /** Existing component code → brand id (for "will update" call-outs). */
  existingCodes: Record<string, string | null>;
  styleNos: string[];
  /** Existing materials, as "SUPPLIER|COLOURNO|ARTICLE" keys. */
  existingMaterials: string[];
};

export function brandForRow(row: ImportRow, ctx: ImportContext) {
  const b = row.fields.brand?.trim().toUpperCase();
  if (b) {
    const hit = ctx.brands.find((x) => x.name.toUpperCase() === b || x.codePrefix === b || x.name.toUpperCase().replace(/[^A-Z]/g, "") === b.replace(/[^A-Z]/g, ""));
    if (hit) return hit;
  }
  const code = row.fields.code?.trim().toUpperCase();
  if (code) {
    const byPrefix = ctx.brands.filter((x) => code.startsWith(x.codePrefix)).sort((a, z) => z.codePrefix.length - a.codePrefix.length)[0];
    if (byPrefix) return byPrefix;
  }
  return ctx.brands.find((x) => x.id === ctx.defaultBrandId) ?? null;
}

export function materialKey(f: Record<string, string>) {
  return [f.supplier, f.colourNo, f.articleName].map((x) => (x ?? "").trim().toUpperCase()).join("|");
}

/** Call-outs for every row. Errors stop a row being saved; warnings and info are shown but allowed. */
export function rowIssues(kind: LibraryKind, rows: ImportRow[], ctx: ImportContext): Record<string, RowIssue[]> {
  const out: Record<string, RowIssue[]> = {};
  const included = rows.filter((r) => r.include);
  if (kind === "hardware") {
    const seen = new Map<string, number>();
    for (const r of included) {
      const c = r.fields.code.trim().toUpperCase();
      if (c) seen.set(c, (seen.get(c) ?? 0) + 1);
    }
    for (const r of rows) {
      const issues: RowIssue[] = [];
      const code = r.fields.code.trim().toUpperCase();
      const brand = brandForRow(r, ctx);
      if (!brand) issues.push({ level: "error", field: "brand", message: "No brand — enter one or pick a default brand." });
      if (!r.fields.type) issues.push({ level: "error", field: "type", message: "Type is missing." });
      else if (!HARDWARE_TYPES.includes(r.fields.type)) issues.push({ level: "warning", field: "type", message: `“${r.fields.type}” isn't a library type — check it.` });
      if (brand) {
        const others = Object.keys(ctx.existingCodes).filter((x) => x !== code);
        const chk = checkCode({ code, format: brand.codeFormat, brandName: brand.name, componentCodes: [...others, ...included.filter((x) => x !== r).map((x) => x.fields.code.trim().toUpperCase()).filter(Boolean)], styleNos: ctx.styleNos });
        for (const e of chk.errors) issues.push({ level: "error", field: "code", message: e.replace("already used by another component", (seen.get(code) ?? 0) > 1 ? "repeated in this upload" : "already used by another component") });
        for (const w of chk.warnings) issues.push({ level: "warning", field: "code", message: w });
      }
      if (code && code in ctx.existingCodes) issues.push({ level: "info", field: "code", message: `${code} exists — this row will update it.` });
      if (r.fields.finish && !HARDWARE_FINISHES.includes(r.fields.finish)) issues.push({ level: "warning", field: "finish", message: `Finish “${r.fields.finish}” isn't a standard finish — check spelling.` });
      if (r.fields.material && !HARDWARE_MATERIALS.includes(r.fields.material)) issues.push({ level: "info", field: "material", message: `Material “${r.fields.material}” will be kept as written.` });
      if (r.fields.dimsMm && !/\d/.test(r.fields.dimsMm)) issues.push({ level: "warning", field: "dimsMm", message: "Dimensions have no numbers — hardware is always in mm." });
      for (const [k, v] of Object.entries(r.imageRefs)) if (!r.images[k]) issues.push({ level: "warning", message: `Image “${v}” (${k}) wasn't found in the uploaded photos.` });
      if (r.aiFields.length) issues.push({ level: "info", message: `${r.aiFields.length} field(s) read by AI — confirm them.` });
      out[r.key] = issues;
    }
  } else {
    const seen = new Map<string, number>();
    for (const r of included) seen.set(materialKey(r.fields), (seen.get(materialKey(r.fields)) ?? 0) + 1);
    for (const r of rows) {
      const issues: RowIssue[] = [];
      if (!r.fields.supplier) issues.push({ level: "error", field: "supplier", message: "Supplier is missing." });
      if (!r.fields.colourNo && !r.fields.colourName) issues.push({ level: "error", field: "colourNo", message: "Enter a colour number or name." });
      const k = materialKey(r.fields);
      if (r.fields.supplier && (seen.get(k) ?? 0) > 1) issues.push({ level: "error", message: "Repeated in this upload." });
      if (r.fields.supplier && ctx.existingMaterials.includes(k)) issues.push({ level: "warning", message: "Already in the library — saving adds a duplicate. Untick to skip." });
      if (!r.images.photo) issues.push({ level: r.imageRefs.photo ? "warning" : "info", message: r.imageRefs.photo ? `Card photo “${r.imageRefs.photo}” wasn't found.` : "No card photo — add one later from the material page." });
      if (r.fields.composition && !/\d/.test(r.fields.composition)) issues.push({ level: "warning", field: "composition", message: "Composition has no percentages." });
      if (r.aiFields.length) issues.push({ level: "info", message: `${r.aiFields.length} field(s) read by AI — confirm them.` });
      out[r.key] = issues;
    }
  }
  return out;
}

export function hasErrors(issues: RowIssue[] | undefined) {
  return (issues ?? []).some((i) => i.level === "error");
}
