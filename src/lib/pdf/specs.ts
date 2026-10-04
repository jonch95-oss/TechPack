/**
 * What each answered question prints as (golden run 1, P0.1). One source for two jobs:
 *  - the SPECIFICATIONS block: every answered question whose value isn't already printed elsewhere
 *    prints as "LABEL: VALUE", grouped by section;
 *  - the "answered → printed" check: every answered question's value text appears in the PDF.
 * Booleans print as the feature ("MESH PANEL"), never as "YES"; reference answers print via refText().
 */
import { visibleQuestions, type AnswerMap, type Category, type Column, type Question, sectionsFor } from "@/lib/questions";
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
};

/** Not facts about the product: page switches, the comments (checked on their own), automatic values. */
const SKIP_IDS = new Set(["comments.list"]);
const SKIP_PREFIX = ["pages.", "optional."];
const SKIP_KINDS = new Set<Question["kind"]>(["derived", "file"]);

const up = (s: unknown) => String(s ?? "").trim().toUpperCase();
const num = (n: number) => String(Math.round(n * 100) / 100);

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
  if (typeof v === "number") return { text: `${num(v)}${c && c.kind === "stepper" ? unitText(c.unit, answers) : ""}`, needles: [num(v)] };
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
export function valueOf(q: Question, v: unknown, answers: AnswerMap): { lines: string[]; needles: string[] } {
  if (isReference(v)) return { lines: [refText(v)], needles: [refText(v)] };
  switch (q.kind) {
    case "toggle":
      return v === true ? { lines: [featureText(q.label)], needles: [featureText(q.label)] } : { lines: [], needles: [] };
    case "stepper":
      return typeof v === "number" ? { lines: [`${num(v)}${unitText(q.unit, answers)}`], needles: [num(v)] } : { lines: [], needles: [] };
    case "dims2": {
      const d = (v ?? {}) as { w?: number | null; h?: number | null };
      const parts = [d.w, d.h].filter((x): x is number => typeof x === "number");
      return parts.length ? { lines: [parts.map((x) => `${num(x)}${unitText(q.unit, answers)}`).join(" X ")], needles: parts.map(num) } : { lines: [], needles: [] };
    }
    case "rows": {
      const rows = Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
      const lines: string[] = [];
      const needles: string[] = [];
      for (const r of rows) {
        if (!r || typeof r !== "object") continue;
        const cells = q.columns.map((c) => ({ c, ...cellText(c, r[c.key], answers) })).filter((x) => x.text);
        // Extra keys a row carries beyond the columns (e.g. a note) print too.
        const extra = Object.entries(r)
          .filter(([k, x]) => !q.columns.some((c) => c.key === k) && !["id", "seen", "source", "status"].includes(k) && (typeof x === "string" || typeof x === "number") && String(x).trim())
          .map(([k, x]) => ({ k, ...cellText(undefined, x, answers) }));
        if (!cells.length && !extra.length) continue;
        lines.push([...cells.map((x) => (q.columns.length > 1 ? `${up(x.c.label)} ${x.text}` : x.text)), ...extra.map((x) => x.text)].join(" · "));
        needles.push(...cells.flatMap((x) => x.needles), ...extra.flatMap((x) => x.needles));
      }
      return { lines, needles };
    }
    case "materials": {
      const list = Array.isArray(v) ? (v as { callout?: number; name?: string; locations?: string[] }[]) : [];
      const named = list.filter((m) => m?.name);
      return { lines: named.map((m) => `${m.callout ?? ""} ${up(m.name)}${m.locations?.length ? ` — ${m.locations.map(up).join(", ")}` : ""}`.trim()), needles: named.map((m) => up(m.name)) };
    }
    case "colorway_matrix": {
      const lines: string[] = [];
      const needles: string[] = [];
      for (const [cw, row] of Object.entries((v ?? {}) as Record<string, Record<string, { text?: string; lib?: { id?: string; label?: string } }>>)) {
        const cells = Object.values(row ?? {})
          .map((c) => (c?.text ? up(c.text) : c?.lib?.label ? up(c.lib.label) : ""))
          .filter(Boolean);
        if (cells.length) lines.push(`${up(cw)}: ${cells.join(" · ")}`);
        // Library cells print from the library (its own label format); typed cells print as typed.
        needles.push(...Object.values(row ?? {}).map((c) => (c?.text ? up(c.text) : "")).filter(Boolean));
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
    const v = answers[q.id];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    const { lines, needles } = valueOf(q, v, answers);
    if (!lines.length) continue;
    // A template that prints the answer in its own words ("SHOULDER STRAP IS NOT REMOVABLE") says so.
    const own = isReference(v) ? undefined : printedAs[q.id];
    out.push({ qid: q.id, section: sectionOf.get(q.id) ?? "", label: featureText(q.label), lines, needles: [...new Set((own ?? needles).filter(Boolean))], ...(own ? { alt: [...new Set(needles.filter(Boolean))] } : {}) });
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
