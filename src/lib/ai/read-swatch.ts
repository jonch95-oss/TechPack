/** read_swatch_card: extract the printed spec from a swatch-card photo (incl. Chinese) and locate the chip. */

export const SWATCH_FIELDS = [
  "supplier",
  "articleName",
  "articleNo",
  "colourNo",
  "colourName",
  "composition",
  "thickness",
  "width",
  "finish",
  "threadCount",
  "peelStrength",
  "rubFastness",
  "backing",
] as const;
export type SwatchField = (typeof SWATCH_FIELDS)[number];

export const READ_SWATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...SWATCH_FIELDS, "chip_box", "raw_text", "agent_notes"],
  properties: {
    supplier: { type: "string" },
    articleName: { type: "string", description: "Card / article name in English where possible; keep Chinese in raw_text." },
    articleNo: { type: "string" },
    colourNo: { type: "string" },
    colourName: { type: "string" },
    composition: { type: "string" },
    thickness: { type: "string" },
    width: { type: "string" },
    finish: { type: "string" },
    threadCount: { type: "string", description: "Thread count as printed, e.g. 210T (not denier)." },
    peelStrength: { type: "string" },
    rubFastness: { type: "string" },
    backing: { type: "string", description: "Backing / coating, e.g. PVC-BACKED, PU-COATED." },
    chip_box: {
      type: "object",
      additionalProperties: false,
      required: ["found", "x", "y", "w", "h"],
      description: "Bounding box of the requested colour chip as fractions (0..1) of image width/height.",
      properties: {
        found: { type: "boolean" },
        x: { type: "number" },
        y: { type: "number" },
        w: { type: "number" },
        h: { type: "number" },
      },
    },
    raw_text: { type: "string", description: "The printed spec text exactly as read, including Chinese — without any phone, fax, e-mail, address or bank details." },
    agent_notes: { type: "string" },
  },
} as const;

export type ReadSwatchOutput = Record<SwatchField, string> & {
  chip_box: { found: boolean; x: number; y: number; w: number; h: number };
  raw_text: string;
  agent_notes: string;
};

export function buildSwatchInstructions(hint: { supplier?: string; colourNo?: string; colourName?: string }) {
  return [
    "Read the printed spec on this swatch card, including any Chinese (e.g. 品名 = article name, 成分 = composition, 厚度 = thickness, 幅宽 = width, 属性 = property/finish).",
    "Translate the field values into trade English in CAPITALS (e.g. 50%TPU 50%棉 → 50% TPU 50% COTTON). Keep numbers and tolerances exactly as printed.",
    "Leave a field as an empty string when it is not printed on the card — never guess.",
    "PRIVACY: never return bank or account details, phone / fax numbers, e-mail or street addresses printed on the card — not in any field, not in raw_text, not in notes.",
    "Read thread count (e.g. 210T — not denier), peel strength, rub fastness and backing (e.g. PVC-BACKED) when printed.",
    "A hand-numbered card (shade numbers written by hand, no printed chip box): locate the chip by its hand-written number.",
    hint.colourNo
      ? `Locate the chip numbered ${hint.colourNo}${hint.colourName ? ` (${hint.colourName})` : ""} and return its box.`
      : "If a single colour chip is highlighted or obviously intended, return its box; otherwise found=false.",
    hint.supplier ? `The designer says the supplier is ${hint.supplier}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Clamp the box to the image and drop it if the agent did not find the chip. */
export function normaliseChipBox(b: ReadSwatchOutput["chip_box"] | undefined) {
  if (!b || !b.found) return null;
  const c = (n: number) => Math.min(1, Math.max(0, Number(n) || 0));
  const x = c(b.x),
    y = c(b.y);
  const w = Math.min(c(b.w), 1 - x),
    h = Math.min(c(b.h), 1 - y);
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}
