/**
 * What each answered question prints as (golden run 1, P0.1). One source for two jobs:
 *  - the SPECIFICATIONS block: every answered question whose value isn't already printed elsewhere
 *    prints as "LABEL: VALUE", grouped by section;
 *  - the "answered → printed" check: every answered question's value text appears in the PDF.
 * Booleans print as the feature ("MESH PANEL"), never as "YES"; reference answers print via refText().
 */
import { derivedValue, visibleQuestions, type AnswerMap, type Category, type Column, type Question, sectionsFor } from "@/lib/questions";
import { isReference, refText } from "@/lib/reference-answer";

export type SpecItem = {
  qid: string;
  section: string;
  label: string;
  /** Lines as they print under the label (one per row for tables). */
  lines: string[];
  /** Strings that must appear in the PDF for this answer to count as printed. */
  needles: string[];
  /** The value's own words, when a template prints it differently (either counts as printed). */
  alt?: string[];
  /** Row questions print as a small table (golden run 2 #4). */
  table?: { head: string[]; rows: string[][] };
};

/** Row keys that are the studio's own notes, never printed ("SEEN ON RENDER", where an answer came from). */
const INTERNAL_KEYS = new Set(["id", "seen", "source", "status", "confidence", "note_ai"]);
/** Derived answers that are facts of the product (gusset width = D is already printed as D). */
const DERIVED_FACTS = new Set(["$capacity", "$nesting"]);

/** Not facts about the product: page switches, the comments (checked on their own), automatic values. */
const SKIP_IDS = new Set(["comments.list", "dims.show_secondary"]); // a print setting, not a fact
const SKIP_PREFIX = ["pages.", "optional."];
const SKIP_KINDS = new Set<Question["kind"]>(["file"]);

const up = (s: unknown) => String(s ?? "").trim().toUpperCase();
const num = (n: number) => String(Math.round(n * 100) / 100);

/**
 * A millimetre value as a pack page prints it: in an inch pack the inches first with the mm in
 * brackets — 6.75" (171.5 MM) — and plain mm otherwise (golden run 2 #5).
 */
export function mmText(mm: number, inches: boolean) {
  return inches ? `${num(mm / 25.4)}" (${num(mm)} MM)` : `${num(mm)} MM`;
}

function stepText(n: number, unit: string, answers: AnswerMap) {
  if (unit === "mm") return mmText(n, answers["dims.unit"] === "INCHES");
  // A pack dimension, with the other unit in brackets when the pack asks for it.
  if (unit === "dim" && answers["dims.show_secondary"] === true)
    return `${num(n)}${unitText(unit, answers)} (${answers["dims.unit"] === "INCHES" ? `${num(n * 2.54)} CM` : `${num(n / 2.54)}"`})`;
  return `${num(n)}${unitText(unit, answers)}`;
}

function unitText(unit: string, answers: AnswerMap) {
  if (unit === "dim") return answers["dims.unit"] === "INCHES" ? '"' : " CM";
  return { mm: " MM", in: '"', L: " L", h: " H", spi: " SPI", deg: "°", D: "D", "%": "%", qty: "" }[unit] ?? "";
}

/** "Mesh panel" → "MESH PANEL"; "Removable?" → "REMOVABLE". */
export function featureText(label: string) {
  return up(label.replace(/\(.*?\)/g, "").replace(/[?:]/g, "")).replace(/\s+/g, " ").trim();
}

/** A library value's printed form: its code when the label starts with one ("PINK005 LOGO PLATE" → "PINK005"). */
function libNeedle(label: string) {
  const first = up(label).split(/\s+/)[0] ?? "";
  return /\d/.test(first) && first.length >= 3 ? first : up(label);
}

function cellText(c: Column | undefined, v: unknown, answers: AnswerMap): { text: string; needles: string[] } {
  if (v == null || v === "") return { text: "", needles: [] };
  if (isReference(v)) return { text: refText(v), needles: [refText(v)] };
  if (typeof v === "boolean") return v ? { text: featureText(c?.label ?? ""), needles: [] } : { text: "", needles: [] };
  if (typeof v === "number") return { text: c && c.kind === "stepper" ? stepText(v, c.unit, answers) : num(v), needles: [num(v)] };
  if (typeof v === "string") return { text: up(v), needles: [up(v)] };
  if (Array.isArray(v)) {
    const parts = v.map((x) => cellText(undefined, x, answers));
    return { text: parts.map((p) => p.text).filter(Boolean).join(", "), needles: parts.flatMap((p) => p.needles) };
  }
  if (typeof v === "object" && "label" in (v as object)) {
    const l = String((v as { label?: unknown }).label ?? "");
    return l ? { text: up(l), needles: [libNeedle(l)] } : { text: "", needles: [] };
  }
  return { text: "", needles: [] };
}

/** Printed lines + needles for one answered question ("" lines = nothing to print). */
export function valueOf(q: Question, v: unknown, answers: AnswerMap): { lines: string[]; needles: string[]; table?: SpecItem["table"] } {
  if (isReference(v)) return { lines: [refText(v)], needles: [refText(v)] };
  switch (q.kind) {
    case "toggle":
      return v === true ? { lines: [featureText(q.label)], needles: [featureText(q.label)] } : { lines: [], needles: [] };
    case "stepper":
      return typeof v === "number" ? { lines: [stepText(v, q.unit, answers)], needles: [num(v)] } : { lines: [], needles: [] };
    case "dims2": {
      const d = (v ?? {}) as { w?: number | null; h?: number | null };
      const parts = [d.w, d.h].filter((x): x is number => typeof x === "number");
      if (!parts.length) return { lines: [], needles: [] };
      // W × H in mm: an inch pack prints both in inches, the mm in brackets.
      const text = q.unit === "mm" && answers["dims.unit"] === "INCHES" ? `${parts.map((x) => `${num(x / 25.4)}"`).join(" X ")} (${parts.map(num).join(" X ")} MM)` : parts.map((x) => stepText(x, q.unit, answers)).join(" X ");
      return { lines: [text], needles: parts.map(num) };
    }
    case "rows": {
      const rows = (Array.isArray(v) ? (v as Record<string, unknown>[]) : []).filter((r) => r && typeof r === "object");
      const cols = q.columns.filter((c) => !INTERNAL_KEYS.has(c.key));
      // Extra keys a row carries beyond the columns (e.g. a note) print too — the studio's notes don't.
      const extraKeys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !q.columns.some((c) => c.key === k) && !INTERNAL_KEYS.has(k) && rows.some((r) => (typeof r[k] === "string" || typeof r[k] === "number") && String(r[k]).trim()));
      const cells = rows.map((r) => [...cols.map((c) => cellText(c, r[c.key], answers)), ...extraKeys.map((k) => cellText(undefined, typeof r[k] === "string" || typeof r[k] === "number" ? r[k] : null, answers))]);
      const used = [...cols.map((c) => featureText(c.label)), ...extraKeys.map((k) => up(k))].map((h, i) => ({ h, i })).filter(({ i }) => cells.some((row) => row[i].text));
      const kept = cells.filter((row) => used.some(({ i }) => row[i].text));
      if (!kept.length) return { lines: [], needles: [] };
      return {
        lines: kept.map((row) => used.map(({ i }) => row[i].text).filter(Boolean).join(" · ")),
        needles: kept.flatMap((row) => used.flatMap(({ i }) => row[i].needles)),
        table: { head: used.map(({ h }) => h), rows: kept.map((row) => used.map(({ i }) => row[i].text)) },
      };
    }
    case "materials": {
      const list = Array.isArray(v) ? (v as { callout?: number; name?: string; locations?: string[] }[]) : [];
      const named = list.filter((m) => m?.name);
      return { lines: named.map((m) => `${m.callout ?? ""} ${up(m.name)}${m.locations?.length ? ` — ${m.locations.map(up).join(", ")}` : ""}`.trim()), needles: named.map((m) => up(m.name)) };
    }
    case "colorway_matrix": {
      const lines: string[] = [];
      const needles: string[] = [];
      type Cell = { text?: string; lib?: { id?: string; label?: string }; colour?: { text?: string; lib?: { label?: string } } };
      for (const [cw, row] of Object.entries((v ?? {}) as Record<string, Record<string, Cell>>)) {
        const colourOf = (c: Cell) => up(c?.colour?.text ?? c?.colour?.lib?.label ?? "");
        const cells = Object.values(row ?? {})
          .map((c) => [c?.text ? up(c.text) : c?.lib?.label ? up(c.lib.label) : "", colourOf(c)].filter(Boolean).join(" / "))
          .filter(Boolean);
        if (cells.length) lines.push(`${up(cw)}: ${cells.join(" · ")}`);
        // Library cells print from the library (its own label format); typed cells print as typed.
        needles.push(...Object.values(row ?? {}).flatMap((c) => [c?.text ? up(c.text) : "", c?.colour?.text ? up(c.colour.text) : ""]).filter(Boolean));
      }
      return { lines, needles };
    }
    case "per_colorway_text": {
      const vals = Object.entries((v ?? {}) as Record<string, unknown>).filter(([, x]) => typeof x === "string" && x.trim());
      return { lines: vals.map(([cw, x]) => `${up(cw)}: ${up(x)}`), needles: vals.map(([, x]) => up(x)) };
    }
    default: {
      const c = cellText(undefined, v, answers);
      return { lines: c.text ? [c.text] : [], needles: c.needles };
    }
  }
}

/**
 * Every answered, visible question with what it prints as, in question-bank order. Sections that
 * are switched off (optional sections without their toggle) and page switches are left out.
 */
export function specItems(category: Category, answers: AnswerMap, printedAs: Record<string, string[]> = {}): SpecItem[] {
  const ctx = { category, answers };
  const sectionOf = new Map<string, string>();
  for (const s of sectionsFor(category)) for (const q of s.questions) sectionOf.set(q.id, up(s.title));
  const out: SpecItem[] = [];
  for (const q of visibleQuestions(ctx)) {
    if (SKIP_IDS.has(q.id) || SKIP_PREFIX.some((p) => q.id.startsWith(p)) || SKIP_KINDS.has(q.kind)) continue;
    if (q.kind === "derived") {
      // Automatic answers that are facts (capacity, nesting order) print like any answer (golden run 2 #6).
      const d = DERIVED_FACTS.has(q.from) ? derivedValue(q, ctx) : "";
      if (d && d !== "—") out.push({ qid: q.id, section: sectionOf.get(q.id) ?? "", label: featureText(q.label), lines: [up(d)], needles: [up(d)] });
      continue;
    }
    const v = answers[q.id];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    const { lines, needles, table } = valueOf(q, v, answers);
    if (!lines.length) continue;
    // A template that prints the answer in its own words ("SHOULDER STRAP IS NOT REMOVABLE") says so.
    const own = isReference(v) ? undefined : printedAs[q.id];
    out.push({ qid: q.id, section: sectionOf.get(q.id) ?? "", label: featureText(q.label), lines, needles: [...new Set((own ?? needles).filter(Boolean))], ...(own ? { alt: [...new Set(needles.filter(Boolean))] } : {}), ...(table && table.head.length > 1 ? { table } : {}) });
  }
  return out;
}

/** Upper-case, whitespace removed, quotes unified: how printed text is compared. */
export function tight(s: string) {
  return s.toUpperCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, "");
}

/** The items whose value is not (fully) present in `printed` (already-tightened text). */
export function missingFrom(items: SpecItem[], printedTight: string) {
  const found = (list: string[]) => list.every((n) => printedTight.includes(tight(n)));
  return items.filter((it) => !found(it.needles) && !(it.alt && found(it.alt)));
}
