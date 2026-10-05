/**
 * What a design board says, as structured facts (V2.1 §11): SKU blocks, colour-key chips, "PLEASE …"
 * instructions, "<SKU> ONLY" notes, ACTUAL SIZE panels and red-frame reference captions — and the
 * answers they suggest. Every suggestion arrives as an AI suggestion to confirm; nothing is measured
 * from a reference product.
 */
import type { AnswerMap } from "@/lib/questions";

export type BoardRead = {
  text: string[];
  refersToSpec: boolean;
  reference: string;
  /** Style # / colourway blocks: "PA_LUG_10001 BLACK". */
  skus?: { style: string; colour: string }[];
  /** Colour-key chips: chip label → component → value ("1 · BODY · PANTONE 19-4005 TCX"). */
  colourKey?: { chip: string; component: string; value: string }[];
  /** Instructions as written ("PLEASE …"). */
  instructions?: string[];
  /** "<SKU> ONLY" notes: a feature on one style / colourway. */
  only?: { style: string; feature: string }[];
  /** Panels marked ACTUAL SIZE, with what they show. */
  actualSize?: string[];
  /** Captions in red reference frames. */
  captions?: string[];
  /** The board shows another brand's product as a reference (shape / construction only). */
  referenceProduct?: boolean;
};

export const READ_BOARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["board_text", "refers_to_spec", "reference", "skus", "colour_key", "instructions", "only_notes", "actual_size", "captions", "reference_product"],
  properties: {
    board_text: { type: "array", items: { type: "string" }, description: "Every note written on the board around the product, CAPITALS, as written." },
    refers_to_spec: { type: "boolean", description: "True when a note sends the reader to another document: REFER TO SPEC, SEE SPEC SHEET, SEE TECH PACK, PER SPEC, MEASUREMENTS TO FOLLOW …" },
    reference: { type: "string", description: "That note exactly, e.g. \"(REFER TO SPEC)\"; empty when none." },
    skus: {
      type: "array",
      description: "SKU / style-number blocks, each with the colour written next to it.",
      items: { type: "object", additionalProperties: false, required: ["style", "colour"], properties: { style: { type: "string" }, colour: { type: "string" } } },
    },
    colour_key: {
      type: "array",
      description: "Colour-key chips and variant tables: the chip's label or number, the component it keys, and the value written (Pantone, swatch #, DTM …).",
      items: { type: "object", additionalProperties: false, required: ["chip", "component", "value"], properties: { chip: { type: "string" }, component: { type: "string" }, value: { type: "string" } } },
    },
    instructions: { type: "array", items: { type: "string" }, description: "Instructions to the factory as written, e.g. PLEASE …" },
    only_notes: {
      type: "array",
      description: "Notes saying a feature is on one style / colourway only (\"<SKU> ONLY\").",
      items: { type: "object", additionalProperties: false, required: ["style", "feature"], properties: { style: { type: "string" }, feature: { type: "string" } } },
    },
    actual_size: { type: "array", items: { type: "string" }, description: "What each panel marked ACTUAL SIZE / 1:1 shows." },
    captions: { type: "array", items: { type: "string" }, description: "Captions inside red reference frames." },
    reference_product: { type: "boolean", description: "True when the board shows another brand's product as a reference (for shape / construction)." },
  },
} as const;

export type ReadBoardOutput = {
  board_text: string[];
  refers_to_spec: boolean;
  reference: string;
  skus?: { style: string; colour: string }[];
  colour_key?: { chip: string; component: string; value: string }[];
  instructions?: string[];
  only_notes?: { style: string; feature: string }[];
  actual_size?: string[];
  captions?: string[];
  reference_product?: boolean;
};

export const BOARD_INSTRUCTIONS = [
  "Read only the TEXT written on this design board / render around the product (labels, notes, arrows' captions). Ignore the product itself and any logo on it.",
  "Sort what you read: SKU / style-number blocks with their colour, colour-key chips (chip → component → value), PLEASE … instructions, \"<SKU> ONLY\" notes, panels marked ACTUAL SIZE, and captions in red reference frames.",
  "Reference photos of other brands' products are normal: they are references for shape or construction only. Say so in reference_product; never read a spec off them.",
  "Write everything in CAPITALS as written. Leave a list empty when the board has none — never guess.",
].join("\n");

const up = (s: unknown) => String(s ?? "").trim().toUpperCase();

/** The model's output, cleaned: capitals, blanks dropped, at most 30 of each. */
export function normaliseBoard(out: ReadBoardOutput): BoardRead {
  const list = (xs: unknown[] | undefined) => (xs ?? []).map(up).filter(Boolean).slice(0, 30);
  const text = list(out.board_text);
  const reference = up(out.reference);
  const refersToSpec = !!out.refers_to_spec || text.some((t) => /REFER TO SPEC|SEE SPEC|PER SPEC|SEE TECH ?PACK|MEASUREMENTS? TO FOLLOW/.test(t));
  const instructions = [...new Set([...list(out.instructions), ...text.filter((t) => /^PLEASE\b/.test(t))])];
  return {
    text,
    refersToSpec,
    reference: reference || text.find((t) => /SPEC/.test(t)) || "",
    skus: (out.skus ?? []).map((s) => ({ style: up(s.style), colour: up(s.colour) })).filter((s) => s.style),
    colourKey: (out.colour_key ?? []).map((c) => ({ chip: up(c.chip), component: up(c.component), value: up(c.value) })).filter((c) => c.value),
    instructions,
    only: (out.only_notes ?? []).map((o) => ({ style: up(o.style), feature: up(o.feature) })).filter((o) => o.style && o.feature),
    actualSize: list(out.actual_size),
    captions: list(out.captions),
    referenceProduct: !!out.reference_product,
  };
}

/**
 * Answers a board suggests, for questions the pack hasn't answered: instructions become comments (on
 * page 1 until the designer places them), "<SKU> ONLY" notes become product features scoped to that
 * colourway, and SKU blocks name the colourways whose style # they match.
 */
export function boardAnswers(b: BoardRead, pack: { styleNo: string; colorways: string[]; colorwayStyles?: Record<string, string> }, answers: AnswerMap) {
  const out: { questionId: string; value: unknown; note: string }[] = [];
  const styleOf = (cw: string) => up(pack.colorwayStyles?.[cw] ?? `${pack.styleNo}${cw}`);
  const cwOf = (style: string) => pack.colorways.find((cw) => styleOf(cw) === style || up(cw) === style || style.endsWith(up(cw)));

  const comments = (answers["comments.list"] as { text?: string }[] | undefined) ?? [];
  const have = new Set(comments.map((c) => up(c.text)));
  const fresh = (b.instructions ?? []).filter((t) => !have.has(t));
  if (fresh.length) out.push({ questionId: "comments.list", value: [...comments, ...fresh.map((text) => ({ text, pages: ["OVERVIEW"] }))], note: "INSTRUCTIONS READ FROM THE BOARD — PLACE AND CONFIRM" });

  const features = (answers["pages.features"] as { text?: string; only?: string }[] | undefined) ?? [];
  const haveF = new Set(features.map((f) => up(f.text)));
  const scoped = (b.only ?? []).filter((o) => !haveF.has(o.feature)).map((o) => ({ text: o.feature, only: cwOf(o.style) ?? o.style }));
  if (scoped.length) out.push({ questionId: "pages.features", value: [...features, ...scoped], note: "\"ONLY\" NOTES READ FROM THE BOARD — CONFIRM" });

  if (answers["colorways.names"] === undefined) {
    const names: Record<string, string> = {};
    for (const s of b.skus ?? []) {
      const cw = cwOf(s.style);
      if (cw && s.colour && !names[cw]) names[cw] = s.colour;
    }
    if (Object.keys(names).length) out.push({ questionId: "colorways.names", value: names, note: "COLOURWAY NAMES READ FROM THE BOARD'S SKU BLOCKS — CONFIRM" });
  }
  return out;
}
