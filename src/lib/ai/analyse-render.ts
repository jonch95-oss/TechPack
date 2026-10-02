import { allQuestions, NOT_A_MATERIAL, type Category, type MaterialEntry, type Question } from "@/lib/questions";
import type { AnswerStatus } from "@/db/schema";

/** JSON schema for the analyse_render task (structured output). */
export const ANALYSE_RENDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answers", "materials", "exterior_pockets", "hardware", "zippers", "colorways", "visible_features", "not_visible", "agent_notes"],
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question_id", "value_json", "basis", "note"],
        properties: {
          question_id: { type: "string" },
          value_json: { type: "string", description: "The answer value encoded as JSON (string, number, boolean, array or {w,h})." },
          basis: { type: "string", enum: ["seen", "estimated", "inferred"] },
          note: { type: "string", description: 'What you saw, in CAPITALS, e.g. "2 SNAPS VISIBLE UNDER FLAP".' },
        },
      },
    },
    materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "locations"],
        properties: { name: { type: "string" }, locations: { type: "array", items: { type: "string" } } },
      },
    },
    exterior_pockets: {
      type: "array",
      description: "One entry per pocket type and position; qty = how many identical pockets.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "position", "qty", "detail"],
        properties: {
          type: { type: "string", enum: ["SLIP POCKET", "ZIP POCKET", "PHONE POCKET", "CARD SLOT"] },
          position: { type: "string", enum: ["FRONT", "BACK", "SIDE", "UNDER FLAP"] },
          qty: { type: "integer" },
          detail: { type: "string", description: 'Shape and trims, CAPITALS, e.g. "CURVED, RING PULL".' },
        },
      },
    },
    hardware: {
      type: "array",
      description: "Every metal / plastic part you can see EXCEPT zippers (those go in zippers). Zip pulls are hardware.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "description", "qty", "placement", "library_code"],
        properties: {
          type: { type: "string", description: "One of the hardware library types, e.g. LOGO PLATE, ZIPPER PULL, SQUARE RING, BUCKLE, EYELET." },
          description: { type: "string", description: 'What it looks like, CAPITALS, e.g. "SQUARE PRONG BUCKLE".' },
          qty: { type: "integer" },
          placement: { type: "string" },
          library_code: { type: "string", description: "Code from the hardware library ONLY if it clearly is that part; otherwise empty." },
        },
      },
    },
    zippers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["position", "size", "type", "qty"],
        properties: {
          position: { type: "string", enum: ["MAIN", "FRONT POCKET", "BACK POCKET", "INTERIOR POCKET", "EXPANSION", "SIDE"] },
          size: { type: "string", enum: ["#3", "#5", "#8", "#10", "UNKNOWN"] },
          type: { type: "string", enum: ["COIL", "METAL", "MOLDED", "PLASTIC W/ METAL FINISH", "UNKNOWN"] },
          qty: { type: "integer" },
        },
      },
    },
    colorways: {
      type: "array",
      description: "One entry per colourway shown on the render/board, in order.",
      items: { type: "object", additionalProperties: false, required: ["name"], properties: { name: { type: "string" } } },
    },
    visible_features: { type: "array", items: { type: "string" } },
    not_visible: { type: "array", items: { type: "string" } },
    agent_notes: { type: "string" },
  },
} as const;

export type AnalyseRenderOutput = {
  answers: { question_id: string; value_json: string; basis: "seen" | "estimated" | "inferred"; note: string }[];
  materials: { name: string; locations: string[] }[];
  exterior_pockets?: { type: string; position: string; qty: number; detail: string }[];
  hardware?: { type: string; description: string; qty: number; placement: string; library_code: string }[];
  zippers?: { position: string; size: string; type: string; qty: number }[];
  colorways?: { name: string }[];
  visible_features: string[];
  not_visible: string[];
  agent_notes: string;
};

/** Question kinds the agent may pre-fill from a render. Library pickers are matched by code. */
const PREFILLABLE = new Set(["chips", "multi", "toggle", "stepper", "dims2", "lib", "text"]);

export function prefillableQuestions(category: Category): Question[] {
  return allQuestions(category).filter(
    (q) => PREFILLABLE.has(q.kind) && !q.id.startsWith("opt.") && !q.id.startsWith("header.licensor") && q.id !== "header.due_date" && q.id !== "header.reference_sample",
  );
}

export function buildAnalyseInstructions(opts: {
  category: Category;
  brand: string;
  styleNo: string;
  styleName: string;
  colorways: string[];
  hardwareLibrary: { code: string; type: string; name: string }[];
}): string {
  const qs = prefillableQuestions(opts.category).map((q) => {
    const base: Record<string, unknown> = { id: q.id, label: q.label, kind: q.kind };
    if ("options" in q) base.options = q.options;
    if ("unit" in q) base.unit = q.unit === "dim" ? "pack unit (cm unless dims.unit says INCHES)" : q.unit;
    if (q.kind === "lib") base.value = "library CODE from the hardware list below, as a JSON string";
    if (q.visibility === "inferred") base.note = "not visible in a front render — basis must be inferred";
    return base;
  });
  return [
    `Analyse the attached product render for a new ${opts.category.toUpperCase()} pack.`,
    `Brand: ${opts.brand}. Style: ${opts.styleNo} ${opts.styleName}. Colorways: ${opts.colorways.join(", ")}.`,
    "",
    "Pre-fill every question below that the render lets you answer. Rules:",
    "- value_json is the JSON-encoded value: chips → one option string; multi → array of option strings; toggle → true/false; stepper → number; dims2 → {\"w\":n,\"h\":n}; lib → hardware CODE string; text → string.",
    "- Use option strings exactly as given. Only use a value outside the options when none fits (it becomes \"Other…\").",
    "- basis: \"seen\" when directly visible; \"estimated\" for any measurement you read off the render (never present an estimate as fact); \"inferred\" for back, interior, underside or anything hidden.",
    "- Skip a question rather than guess when the render gives no evidence.",
    "- materials: FABRICS AND LEATHERS ONLY (e.g. MAIN BODY MTL, TRIM MTL), each with its locations (FRONT, BACK, FLAP, GUSSET, STRAP, HANDLE…). They become numbered yellow callouts. Never list hardware, zippers, webbing hardware or trims made of metal here.",
    "- Turn what you SEE into structured rows, not notes: exterior_pockets (every outside pocket), hardware (every part with a quantity — plates, buckles, rings, eyelets, rivets, zip pulls, snaps), zippers (one entry per zipper position with qty), colorways (the colourway names shown, e.g. BLACK). Count carefully; give qty as the number of identical parts.",
    "- Ignore any text printed on the board around the product (labels like \"(REFER TO SPEC)\", dimensions, arrows) — read the product only.",
    "- visible_features / not_visible: short CAPITALS phrases.",
    "",
    "QUESTIONS:",
    JSON.stringify(qs),
    "",
    "HARDWARE LIBRARY (this brand):",
    JSON.stringify(opts.hardwareLibrary),
  ].join("\n");
}

export type NormalisedAnswer = {
  questionId: string;
  value: unknown;
  status: Exclude<AnswerStatus, "confirmed">;
  note: string;
};

/**
 * Validates the agent's answers against the question bank. Anything that does
 * not fit the question kind is dropped; measurements are always EST; hidden
 * features are always INFERRED.
 */
export function normaliseAiAnswers(
  category: Category,
  out: AnalyseRenderOutput,
  hardwareByCode: Map<string, { id: string; label: string }>,
): { answers: NormalisedAnswer[]; materials: MaterialEntry[]; dropped: string[] } {
  const byId = new Map(prefillableQuestions(category).map((q) => [q.id, q]));
  const answers: NormalisedAnswer[] = [];
  const dropped: string[] = [];
  for (const a of out.answers ?? []) {
    const q = byId.get(a.question_id);
    if (!q) {
      dropped.push(`${a.question_id}: unknown question`);
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(a.value_json);
    } catch {
      raw = a.value_json;
    }
    const value = coerce(q, raw, hardwareByCode);
    if (value === undefined) {
      dropped.push(`${a.question_id}: value ${a.value_json} does not fit ${q.kind}`);
      continue;
    }
    let status: NormalisedAnswer["status"] = "ai";
    const isMeasurement = q.kind === "stepper" && q.unit !== "qty" ? true : q.kind === "dims2";
    if (isMeasurement || a.basis === "estimated") status = "est";
    if (a.basis === "inferred" || q.visibility === "inferred") status = "inferred";
    answers.push({ questionId: q.id, value, status, note: (a.note ?? "").toUpperCase() });
  }
  const materials: MaterialEntry[] = (out.materials ?? [])
    .filter((m) => m.name?.trim() && !NOT_A_MATERIAL.test(m.name.toUpperCase()))
    .map((m, i) => ({ callout: i + 1, name: m.name.trim().toUpperCase(), locations: (m.locations ?? []).map((l) => l.toUpperCase()) }));
  return { answers, materials, dropped };
}

function coerce(q: Question, v: unknown, hw: Map<string, { id: string; label: string }>): unknown {
  switch (q.kind) {
    case "chips": {
      if (typeof v !== "string" || !v.trim()) return undefined;
      const up = v.trim().toUpperCase();
      if (q.options.includes(up)) return up;
      return q.noOther ? undefined : up;
    }
    case "multi": {
      const arr = Array.isArray(v) ? v : typeof v === "string" ? [v] : null;
      if (!arr) return undefined;
      const vals = arr.filter((x): x is string => typeof x === "string").map((x) => x.trim().toUpperCase());
      return vals.length ? vals : undefined;
    }
    case "toggle":
      return typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : undefined;
    case "stepper": {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    }
    case "dims2": {
      if (!v || typeof v !== "object") return undefined;
      const o = v as { w?: unknown; h?: unknown };
      const w = Number(o.w),
        h = Number(o.h);
      return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : undefined;
    }
    case "lib": {
      if (q.lib !== "hardware" || typeof v !== "string") return undefined;
      return hw.get(v.trim().toUpperCase());
    }
    case "text":
      return typeof v === "string" && v.trim() ? v.trim().toUpperCase() : undefined;
    default:
      return undefined;
  }
}

export type StructuredPrefill = {
  pocketRows: Record<string, unknown>[];
  hardwareRows: Record<string, unknown>[];
  zipperRows: Record<string, unknown>[];
  colorwayNames: string[];
};

/**
 * The structured part of analyse_render: pockets, hardware and zippers become answer rows (one row per
 * physical pocket / zipper; hardware keeps its quantity), colourway names become the pack's names.
 * Library items are only linked when the agent named an existing code; otherwise the row carries what
 * was seen and the designer picks the part (the gate blocks export until they do).
 */
export function structuredPrefill(out: AnalyseRenderOutput, hardwareByCode: Map<string, { id: string; label: string }>): StructuredPrefill {
  const U = (v: unknown) => String(v ?? "").trim().toUpperCase();
  const n = (v: unknown) => Math.max(1, Math.min(20, Math.round(Number(v) || 1)));
  const pocketRows = (out.exterior_pockets ?? []).flatMap((p) =>
    Array.from({ length: n(p.qty) }, () => ({ type: U(p.type), position: U(p.position), ...(U(p.detail) ? { detail: U(p.detail) } : {}) })),
  );
  const hardwareRows = (out.hardware ?? [])
    .filter((h) => U(h.description) || U(h.type))
    .map((h) => {
      const item = hardwareByCode.get(U(h.library_code));
      const seen = [U(h.description) || U(h.type), U(h.type) && U(h.description) && !U(h.description).includes(U(h.type)) ? `(${U(h.type)})` : ""].filter(Boolean).join(" ");
      return { ...(item ? { item } : {}), qty: n(h.qty), ...(U(h.placement) ? { placement: U(h.placement) } : {}), seen };
    });
  const zipperRows = (out.zippers ?? []).flatMap((z) =>
    Array.from({ length: n(z.qty) }, () => ({
      position: U(z.position),
      ...(U(z.size) && U(z.size) !== "UNKNOWN" ? { size: U(z.size) } : {}),
      ...(U(z.type) && U(z.type) !== "UNKNOWN" ? { type: U(z.type) } : {}),
    })),
  );
  const colorwayNames = (out.colorways ?? []).map((c) => U(c.name)).filter(Boolean).slice(0, 26);
  return { pocketRows, hardwareRows, zipperRows, colorwayNames };
}
