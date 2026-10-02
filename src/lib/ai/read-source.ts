import { allQuestions, isEmpty, type AnswerMap, type Category, type Column, type PomRow, type Question, type RowsQ } from "@/lib/questions";
import { POM_POINTS } from "@/lib/questions/common";
import { coerce, prefillableQuestions } from "./analyse-render";

/**
 * read_source: the AI reads an extra upload — a spec sheet / measurement chart, a back / side / top /
 * interior photo, a sample photo with a ruler, or a hardware supplier sheet — and pre-fills the pack.
 * One output schema for all of them; each kind gets its own instructions. Answers are marked
 * "From <source> — confirm" (measurements read off a ruler stay EST).
 */

export type SourceKind = "spec_sheet" | "view_photo" | "scale_photo" | "hardware_sheet";

export const READ_SOURCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answers", "row_values", "new_rows", "measurements", "hardware", "board_notes", "notes"],
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question_id", "value_json", "unit", "note"],
        properties: {
          question_id: { type: "string" },
          value_json: { type: "string", description: "The value as JSON (string, number, boolean, array or {w,h})." },
          unit: { type: "string", enum: ["CM", "MM", "IN", ""], description: "Unit of a measurement value; empty for anything else." },
          note: { type: "string", description: "Where it was read, CAPITALS, e.g. \"SPEC SHEET ROW 4: STRAP WIDTH 3.8CM\"." },
        },
      },
    },
    row_values: {
      type: "array",
      description: "Values for cells of the CURRENT rows listed in the instructions (row = index shown there).",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question_id", "row", "column", "value_json", "unit", "note"],
        properties: {
          question_id: { type: "string" },
          row: { type: "integer" },
          column: { type: "string" },
          value_json: { type: "string" },
          unit: { type: "string", enum: ["CM", "MM", "IN", ""] },
          note: { type: "string" },
        },
      },
    },
    new_rows: {
      type: "array",
      description: "Rows to add (e.g. an interior pocket seen on the interior photo). row_json is a JSON object keyed by column.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question_id", "row_json", "unit", "note"],
        properties: { question_id: { type: "string" }, row_json: { type: "string" }, unit: { type: "string", enum: ["CM", "MM", "IN", ""] }, note: { type: "string" } },
      },
    },
    measurements: {
      type: "array",
      description: "Every point of measure: overall and detail measurements, with tolerance and how to measure when given.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["point", "value", "unit", "tolerance", "how"],
        properties: {
          point: { type: "string", description: "Use a POINTS OF MEASURE name from the list when one fits." },
          value: { type: "number" },
          unit: { type: "string", enum: ["CM", "MM", "IN"] },
          tolerance: { type: ["number", "null"] },
          how: { type: "string" },
        },
      },
    },
    hardware: {
      type: "array",
      description: "Hardware parts with their sizes (hardware photos / supplier sheets).",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "description", "supplier_code", "dims_mm", "material", "finish"],
        properties: {
          type: { type: "string", description: "A hardware library type, e.g. BUCKLE, SQUARE RING, EYELET, LOGO PLATE, ZIPPER PULL." },
          description: { type: "string" },
          supplier_code: { type: "string" },
          dims_mm: { type: "string", description: 'Main size in mm, e.g. "25 X 18" or "INNER 25" or "DIA 8".' },
          material: { type: "string" },
          finish: { type: "string" },
        },
      },
    },
    board_notes: { type: "array", items: { type: "string" }, description: "Text written on the sheet/board that the designer should act on." },
    notes: { type: "string" },
  },
} as const;

export type ReadSourceOutput = {
  answers?: { question_id: string; value_json: string; unit: string; note: string }[];
  row_values?: { question_id: string; row: number; column: string; value_json: string; unit: string; note: string }[];
  new_rows?: { question_id: string; row_json: string; unit: string; note: string }[];
  measurements?: { point: string; value: number; unit: string; tolerance: number | null; how: string }[];
  hardware?: { type: string; description: string; supplier_code: string; dims_mm: string; material: string; finish: string }[];
  board_notes?: string[];
  notes?: string;
};

/** What each upload is called on its answers ("From spec sheet — confirm"). */
export function sourceLabel(kind: SourceKind, view?: string) {
  if (kind === "spec_sheet") return "SPEC SHEET";
  if (kind === "view_photo") return `${(view || "VIEW").toUpperCase()} PHOTO`;
  if (kind === "scale_photo") return "SAMPLE PHOTO";
  return "HARDWARE SHEET";
}

const GUIDE: Record<SourceKind, (view?: string) => string[]> = {
  spec_sheet: () => [
    "This is the style's SPEC SHEET / MEASUREMENT CHART. Read EVERY measurement on it.",
    "- Overall height, width and depth → answers dims.h, dims.w, dims.d (and dims.unit).",
    "- Every measurement (overall and detail) → measurements[], naming the point with a POINTS OF MEASURE name where one fits; include tolerance and how to measure when given.",
    "- Measurements that belong to a current row (pocket W × H, zip opening length, strap width / length / adjustment range, hardware sizes) → row_values on that row, or answers for single fields such as the strap.",
    "- Hardware sizes (buckle inner width, ring inner size, plate W × H, eyelet diameter) → row_values for hardware.items column \"size\", e.g. \"INNER 25 MM\".",
    "- Read only what is written; never estimate. Give each measurement's unit as written.",
  ],
  view_photo: (view) => [
    `This is a ${(view || "VIEW").toUpperCase()} photo of the product. Answer what it shows — especially questions a front render can't (they are marked inferred): back pockets, base, feet, lining, interior pockets, closures from behind.`,
    "- Interior pockets you can see → new_rows for interior.pockets (one row per pocket).",
    "- Exterior pockets on this side → new_rows for the exterior pockets question.",
    "- Do not give measurements from a photo without a scale.",
  ],
  scale_photo: () => [
    "This photo shows the SAMPLE next to a RULER or TAPE MEASURE. Use the ruler as the scale and estimate the measurements you can read.",
    "- Overall height / width / depth → answers dims.*; other sizes → measurements[] or row_values.",
    "- Every number you give is an ESTIMATE from the scale — say in note how you measured (e.g. \"RULER: 0–20 CM ACROSS BODY\"). Skip anything the scale can't reach.",
  ],
  hardware_sheet: () => [
    "This is a HARDWARE photo or SUPPLIER SHEET. List every part in hardware[] with its type, description, supplier code, size in mm, material and finish.",
    "- When a part matches a current hardware.items row, also give row_values for that row's \"size\" column.",
  ],
};

/** The current rows a source can fill, with their index — the AI writes row_values against them. */
function currentRows(category: Category, answers: AnswerMap) {
  const out: Record<string, { columns: string[]; rows: unknown[] }> = {};
  for (const q of allQuestions(category)) {
    if (q.kind !== "rows") continue;
    const rows = (answers[q.id] as unknown[] | undefined) ?? [];
    if (!rows.length && !["interior.pockets", "pom.list"].includes(q.id) && !q.id.endsWith(".ext_pockets")) continue;
    out[q.id] = { columns: q.columns.map((c) => `${c.key} (${c.kind}${"options" in c ? `: ${c.options.join(" / ")}` : ""})`), rows: rows.map((r, i) => ({ row: i, ...(r as object) })) };
  }
  return out;
}

export function buildSourceInstructions(opts: { kind: SourceKind; view?: string; category: Category; styleNo: string; unit: "cm" | "in"; answers: AnswerMap; sheetText?: string }) {
  const qs = prefillableQuestions(opts.category).map((q) => {
    const b: Record<string, unknown> = { id: q.id, label: q.label, kind: q.kind };
    if ("options" in q) b.options = q.options;
    if ("unit" in q && q.unit === "dim") b.unit = "measurement";
    if (q.visibility === "inferred") b.inferred = true;
    return b;
  });
  return [
    ...GUIDE[opts.kind](opts.view),
    "",
    `Style ${opts.styleNo}, ${opts.category}. Pack unit: ${opts.unit === "in" ? "INCHES" : "CM"} (give each measurement in the unit you read; it is converted).`,
    "Skip anything the upload doesn't show. Text on the sheet the designer should act on (e.g. \"REFER TO SPEC\", \"SEE TECH PACK\") → board_notes.",
    "",
    "QUESTIONS:",
    JSON.stringify(qs),
    "",
    "CURRENT ROWS (row_values refer to these indexes):",
    JSON.stringify(currentRows(opts.category, opts.answers)),
    "",
    `POINTS OF MEASURE: ${JSON.stringify(POM_POINTS)}`,
    ...(opts.sheetText ? ["", "SPREADSHEET (tab-separated, as uploaded):", opts.sheetText.slice(0, 60_000)] : []),
  ].join("\n");
}

/** A value in `from` units, in the pack unit (cm or in), rounded to 0.1 (cm) / 0.125 (in). */
export function toPackUnit(v: number, from: string, unit: "cm" | "in") {
  const f = (from || "").toUpperCase();
  const cm = f === "MM" ? v / 10 : f === "IN" ? v * 2.54 : v;
  if (unit === "in") return Math.round((f === "IN" ? v : cm / 2.54) * 8) / 8;
  return Math.round(cm * 10) / 10;
}

const isDim = (c: { kind: string; unit?: string }) => c.kind === "stepper" && c.unit === "dim";

function coerceCell(c: Column, raw: unknown, from: string, unit: "cm" | "in"): unknown {
  if (c.kind === "lib") return undefined; // library parts are linked by the hardware step
  if (c.kind === "stepper") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return isDim(c) ? toPackUnit(n, from, unit) : n;
  }
  if (c.kind === "toggle") return typeof raw === "boolean" ? raw : raw === "true" ? true : raw === "false" ? false : undefined;
  if (c.kind === "multi") {
    const arr = Array.isArray(raw) ? raw : [raw];
    const v = arr.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().toUpperCase());
    return v.length ? v : undefined;
  }
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : typeof raw === "number" ? String(raw) : "";
  return s || undefined;
}

const parse = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

export type SourceWrites = { values: Record<string, unknown>; notes: Record<string, string[]>; dropped: string[] };

/**
 * Turns a read_source output into answer values (whole-question writes). Rows are updated in place
 * (row_values) or appended (new_rows); measurements become points of measure, merged by point, and
 * fill H × W × D when the sheet didn't answer them directly. Pure — the caller skips confirmed answers.
 */
export function normaliseSource(category: Category, out: ReadSourceOutput, answers: AnswerMap, unit: "cm" | "in", hw: Map<string, { id: string; label: string }>): SourceWrites {
  const byId = new Map<string, Question>(allQuestions(category).map((q) => [q.id, q]));
  const prefillable = new Set(prefillableQuestions(category).map((q) => q.id));
  const values: Record<string, unknown> = {};
  const notes: Record<string, string[]> = {};
  const dropped: string[] = [];
  const note = (id: string, n: string) => n && (notes[id] ??= []).push(n.toUpperCase());

  for (const a of out.answers ?? []) {
    const q = byId.get(a.question_id);
    if (!q || !prefillable.has(q.id)) {
      dropped.push(`${a.question_id}: not a question this upload can answer`);
      continue;
    }
    let v = coerce(q, parse(a.value_json), hw);
    if (v === undefined) {
      dropped.push(`${a.question_id}: ${a.value_json} doesn't fit`);
      continue;
    }
    if (q.kind === "stepper" && q.unit === "dim" && typeof v === "number") v = toPackUnit(v, a.unit, unit);
    if (q.kind === "dims2" && v && typeof v === "object" && a.unit) {
      const d = v as { w: number; h: number };
      const conv = (x: number) => (q.unit === "mm" ? Math.round(toPackUnit(x, a.unit, "cm") * 100) / 10 : toPackUnit(x, a.unit, unit));
      v = { w: conv(d.w), h: conv(d.h) };
    }
    values[q.id] = v;
    note(q.id, a.note);
  }

  const rowsOf = (id: string) => (values[id] as Record<string, unknown>[] | undefined) ?? ((answers[id] as Record<string, unknown>[] | undefined) ?? []).map((r) => ({ ...r }));
  for (const r of out.row_values ?? []) {
    const q = byId.get(r.question_id) as RowsQ | undefined;
    const col = q?.kind === "rows" ? q.columns.find((c) => c.key === r.column) : undefined;
    const rows = q ? rowsOf(q.id) : [];
    if (!q || !col || r.row < 0 || r.row >= rows.length) {
      dropped.push(`${r.question_id}[${r.row}].${r.column}: no such row / column`);
      continue;
    }
    const v = coerceCell(col, parse(r.value_json), r.unit, unit);
    if (v === undefined) continue;
    rows[r.row] = { ...rows[r.row], [col.key]: v };
    values[q.id] = rows;
    note(q.id, r.note);
  }
  for (const n of out.new_rows ?? []) {
    const q = byId.get(n.question_id) as RowsQ | undefined;
    const obj = parse(n.row_json);
    if (q?.kind !== "rows" || !obj || typeof obj !== "object") {
      dropped.push(`${n.question_id}: new row doesn't fit`);
      continue;
    }
    const row: Record<string, unknown> = {};
    for (const c of q.columns) {
      const v = (obj as Record<string, unknown>)[c.key];
      if (v === undefined || v === null || v === "") continue;
      const cv = coerceCell(c, v, n.unit, unit);
      if (cv !== undefined) row[c.key] = cv;
    }
    if (!Object.keys(row).length) continue;
    values[q.id] = [...rowsOf(q.id), row];
    note(q.id, n.note);
  }

  if (out.measurements?.length && byId.has("pom.list")) {
    const pom = rowsOf("pom.list") as PomRow[];
    for (const m of out.measurements) {
      if (!Number.isFinite(m.value)) continue;
      const point = String(m.point ?? "").trim().toUpperCase();
      if (!point) continue;
      const row = { point, value: toPackUnit(m.value, m.unit, unit), tol: m.tolerance != null && Number.isFinite(m.tolerance) ? toPackUnit(m.tolerance, m.unit, unit) : undefined, how: (m.how ?? "").toUpperCase() } as PomRow;
      const i = pom.findIndex((p) => String(p.point ?? "").toUpperCase() === point);
      if (i >= 0) pom[i] = { ...pom[i], ...Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)) };
      else pom.push(Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)) as PomRow);
      // Overall sizes also answer H × W × D when the sheet didn't give them as answers.
      const dim = { "TOTAL HEIGHT": "dims.h", "TOTAL WIDTH": "dims.w", "TOTAL DEPTH": "dims.d" }[point];
      if (dim && values[dim] === undefined) values[dim] = row.value;
    }
    values["pom.list"] = pom;
    note("pom.list", `${out.measurements.length} MEASUREMENT(S) READ`);
  }
  if ((values["dims.h"] ?? values["dims.w"] ?? values["dims.d"]) !== undefined && isEmpty(answers["dims.unit"]) && values["dims.unit"] === undefined)
    values["dims.unit"] = unit === "in" ? "INCHES" : "CM";
  return { values, notes, dropped };
}
