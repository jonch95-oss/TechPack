/**
 * Archive importer (V2 §7): a finished tech pack PDF read into a proposed base style plus proposed
 * library parts. Pure: the read's schema, the instructions, page counting and the clean-up.
 */
import { allQuestions, findQuestion } from "@/lib/questions";
import { CATEGORIES, type Category } from "@/lib/questions/types";

export const ARCHIVE_PAGE_CAP = 40;
/** Rough AI cost per page read (image + output tokens), shown before a run. */
export const COST_PER_PAGE_USD = 0.03;

export const READ_ARCHIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["brand", "category", "style_no", "style_name", "colorways", "answers", "hardware", "materials", "agent_notes"],
  properties: {
    brand: { type: "string" },
    category: { type: "string", description: `One of: ${CATEGORIES.join(", ")}.` },
    style_no: { type: "string" },
    style_name: { type: "string" },
    colorways: { type: "array", items: { type: "object", additionalProperties: false, required: ["code", "name"], properties: { code: { type: "string" }, name: { type: "string" } } } },
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question_id", "value_json", "note"],
        properties: { question_id: { type: "string" }, value_json: { type: "string" }, note: { type: "string", description: "Where on the pack it is stated, CAPITALS." } },
      },
    },
    hardware: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "type", "name", "dims_mm", "material", "finish"],
        properties: { code: { type: "string" }, type: { type: "string" }, name: { type: "string" }, dims_mm: { type: "string" }, material: { type: "string" }, finish: { type: "string" } },
      },
    },
    materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["supplier", "article", "colour_no", "colour_name", "composition"],
        properties: { supplier: { type: "string" }, article: { type: "string" }, colour_no: { type: "string" }, colour_name: { type: "string" }, composition: { type: "string" } },
      },
    },
    agent_notes: { type: "string" },
  },
} as const;

export type ReadArchiveOutput = {
  brand: string;
  category: string;
  style_no: string;
  style_name: string;
  colorways: { code: string; name: string }[];
  answers: { question_id: string; value_json: string; note: string }[];
  hardware: { code: string; type: string; name: string; dims_mm: string; material: string; finish: string }[];
  materials: { supplier: string; article: string; colour_no: string; colour_name: string; composition: string }[];
  agent_notes: string;
};

export function buildArchiveInstructions(brands: string[]): string {
  const ids = [...new Set(CATEGORIES.flatMap((c) => allQuestions(c).map((q) => `${q.id} — ${q.label}`)))];
  return [
    "This is a FINISHED tech pack from the studio's archive. Extract it as data — only what the pack states. Never guess, never measure off a drawing.",
    `Brand: one of ${brands.join(", ")} (as printed on the pack). Category: one of ${CATEGORIES.join(", ")}.`,
    "Colourways: each suffix (-A, -B …) with its colour name.",
    "answers: one entry per question below that the pack states; value_json is the JSON value (chips → string, multi → array, toggle → true/false, stepper → number in the pack's unit, dims2 → {\"w\":n,\"h\":n}, rows → array of objects).",
    "hardware: every component with a code (code, type, name, size in mm as printed, material, finish). materials: every swatch named (supplier, article, colour no., colour name, composition).",
    "Never return supplier bank, phone, e-mail or address details.",
    "Questions:",
    ...ids,
  ].join("\n");
}

/** Pages in a PDF, counted from its page objects (no renderer needed). */
export function pdfPageCount(data: Buffer): number {
  const text = data.toString("latin1");
  return (text.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
}

const up = (s: unknown) => String(s ?? "").trim().toUpperCase();

/** The read cleaned: category resolved, answers kept only for questions that category asks, values parsed. */
export function normaliseArchive(out: ReadArchiveOutput): {
  brand: string;
  category: Category | null;
  styleNo: string;
  styleName: string;
  colorways: { code: string; name: string }[];
  answers: { questionId: string; value: unknown; note: string }[];
  hardware: ReadArchiveOutput["hardware"];
  materials: ReadArchiveOutput["materials"];
  dropped: string[];
} {
  const category = (CATEGORIES as readonly string[]).find((c) => c.toLowerCase() === String(out.category ?? "").trim().toLowerCase()) as Category | undefined;
  const dropped: string[] = [];
  const answers: { questionId: string; value: unknown; note: string }[] = [];
  for (const a of out.answers ?? []) {
    if (!category || !findQuestion(category, a.question_id)) {
      dropped.push(a.question_id);
      continue;
    }
    try {
      const value = JSON.parse(a.value_json);
      if (value == null || value === "") continue;
      answers.push({ questionId: a.question_id, value: typeof value === "string" ? value.toUpperCase() : value, note: up(a.note) });
    } catch {
      dropped.push(a.question_id);
    }
  }
  const colorways = (out.colorways ?? []).map((c) => ({ code: up(c.code).replace(/^([A-Z])$/, "-$1"), name: up(c.name) })).filter((c) => /^-[A-Z0-9]{1,3}$/.test(c.code));
  return {
    brand: up(out.brand),
    category: category ?? null,
    styleNo: up(out.style_no).replace(/\s+/g, ""),
    styleName: up(out.style_name),
    colorways: colorways.length ? colorways : [{ code: "-A", name: "" }],
    answers,
    hardware: (out.hardware ?? []).filter((h) => h.code).map((h) => ({ ...h, code: up(h.code), type: up(h.type), name: up(h.name), dims_mm: up(h.dims_mm), material: up(h.material), finish: up(h.finish) })),
    materials: (out.materials ?? []).filter((m) => m.supplier).map((m) => ({ supplier: up(m.supplier), article: up(m.article), colour_no: up(m.colour_no), colour_name: up(m.colour_name), composition: up(m.composition) })),
    dropped,
  };
}
