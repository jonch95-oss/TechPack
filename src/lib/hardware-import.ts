import Papa from "papaparse";
import { HARDWARE_TYPES } from "@/lib/questions/common";

/** One normalised row from a hardware CSV / XLSX import. */
export type ImportRow = {
  line: number;
  code: string;
  brand: string;
  name: string;
  type: string;
  dimsMm: string;
  material: string;
  finish: string;
  logoTreatment: string;
  enamelPantone: string;
  construction: string;
  photo: string;
  front: string;
  side: string;
  rear: string;
  notes: string;
};

const ALIASES: Record<keyof Omit<ImportRow, "line">, string[]> = {
  code: ["code", "item code", "component code", "hardware code", "ref", "reference"],
  brand: ["brand"],
  name: ["name", "description", "item", "item name"],
  type: ["type", "category", "component type"],
  dimsMm: ["dims", "dims mm", "dimensions", "dimensions mm", "size", "size mm", "dims_mm"],
  material: ["material"],
  finish: ["finish", "plating", "colour", "color"],
  logoTreatment: ["logo", "logo treatment", "logo_treatment"],
  enamelPantone: ["enamel", "enamel colour", "enamel color", "pantone", "enamel pantone", "enamel_pantone"],
  construction: ["hollow", "hollow/solid", "hollow or solid", "construction", "solid"],
  photo: ["photo", "image", "picture", "photo file", "image file"],
  front: ["front", "front view"],
  side: ["side", "side view"],
  rear: ["rear", "rear view", "back", "back view"],
  notes: ["notes", "comment", "comments"],
};

function normHeader(h: string) {
  return h.toLowerCase().replace(/[()]/g, "").replace(/[_\s]+/g, " ").trim();
}

export function mapHeaders(headers: string[]): Partial<Record<keyof Omit<ImportRow, "line">, number>> {
  const out: Partial<Record<keyof Omit<ImportRow, "line">, number>> = {};
  headers.forEach((h, i) => {
    const n = normHeader(h);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(n) && out[field as keyof typeof out] === undefined) out[field as keyof typeof out] = i;
    }
  });
  return out;
}

/** Maps free text to one of the library hardware types where it clearly matches. */
export function normaliseType(t: string): string {
  const up = t.trim().toUpperCase();
  if (!up) return "";
  if (HARDWARE_TYPES.includes(up)) return up;
  const rules: [RegExp, string][] = [
    [/KEY ?CHAIN|CHARM|KEYRING/, "KEYCHAIN/CHARM"],
    [/PULL|PULLER/, "ZIPPER PULL"],
    [/ZIP/, "ZIPPER"],
    [/MAGNET/, "MAGNETIC SNAP"],
    [/PRESS|SNAP/, "PRESS SNAP"],
    [/TURN ?LOCK/, "TURNLOCK"],
    [/\bD[- ]?RING/, "D-RING"],
    [/\bO[- ]?RING/, "O-RING"],
    [/SQUARE RING/, "SQUARE RING"],
    [/SWIVEL/, "SWIVEL HOOK"],
    [/LOBSTER/, "LOBSTER CLASP"],
    [/CHAIN/, "CHAIN"],
    [/BUCKLE/, "BUCKLE"],
    [/RIVET/, "RIVET"],
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

export function rowsFromTable(table: string[][]): { rows: ImportRow[]; errors: string[] } {
  const errors: string[] = [];
  const headerIdx = table.findIndex((r) => r.some((c) => String(c ?? "").trim()));
  if (headerIdx < 0) return { rows: [], errors: ["The file is empty."] };
  const map = mapHeaders(table[headerIdx].map((c) => String(c ?? "")));
  if (map.type === undefined && map.code === undefined) {
    errors.push('No "code" or "type" column found. Expected headers like: code, type, name, dims mm, material, finish, photo.');
    return { rows: [], errors };
  }
  const get = (r: string[], f: keyof typeof map) => (map[f] === undefined ? "" : String(r[map[f]!] ?? "").trim());
  const rows: ImportRow[] = [];
  table.slice(headerIdx + 1).forEach((r, i) => {
    if (!r.some((c) => String(c ?? "").trim())) return;
    const line = headerIdx + i + 2;
    const row: ImportRow = {
      line,
      code: get(r, "code").toUpperCase(),
      brand: get(r, "brand"),
      name: get(r, "name").toUpperCase(),
      type: normaliseType(get(r, "type")),
      dimsMm: get(r, "dimsMm").toUpperCase(),
      material: get(r, "material").toUpperCase(),
      finish: get(r, "finish").toUpperCase(),
      logoTreatment: get(r, "logoTreatment").toUpperCase(),
      enamelPantone: get(r, "enamelPantone").toUpperCase(),
      construction: normaliseConstruction(get(r, "construction")),
      photo: get(r, "photo"),
      front: get(r, "front"),
      side: get(r, "side"),
      rear: get(r, "rear"),
      notes: get(r, "notes").toUpperCase(),
    };
    if (!row.type) errors.push(`Line ${line}: type is missing.`);
    rows.push(row);
  });
  return { rows, errors };
}

export function parseCsv(text: string) {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false });
  return rowsFromTable(parsed.data);
}

export async function parseXlsx(buf: ArrayBuffer) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], errors: ["The workbook has no sheets."] };
  const table: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const vals = (row.values as unknown[]).slice(1).map((v) => {
      if (v == null) return "";
      if (typeof v === "object" && v !== null && "text" in v) return String((v as { text: unknown }).text);
      if (typeof v === "object" && v !== null && "result" in v) return String((v as { result: unknown }).result);
      return String(v);
    });
    table.push(vals);
  });
  return rowsFromTable(table);
}

/** Finds the image for a row: the named photo column, else a file whose stem equals the code. */
export function matchImage(fileNames: string[], wanted: string, code: string): string | null {
  const base = (n: string) => n.split(/[\\/]/).pop()!.toLowerCase();
  const stem = (n: string) => base(n).replace(/\.[^.]+$/, "");
  if (wanted) {
    const w = base(wanted);
    const hit = fileNames.find((f) => base(f) === w || stem(f) === w.replace(/\.[^.]+$/, ""));
    if (hit) return hit;
  }
  if (code) {
    const hit = fileNames.find((f) => stem(f) === code.toLowerCase());
    if (hit) return hit;
  }
  return null;
}
