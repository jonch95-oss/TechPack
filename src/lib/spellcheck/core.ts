import { KNOWN_CORRECTIONS, TRADE_TERMS } from "./trade";

export type SpellFlag = { word: string; suggestion: string | null; count: number };

const TRADE = new Set(TRADE_TERMS.map((t) => t.toUpperCase()));

/** Damerau–Levenshtein distance, capped. */
export function distance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > cap) return cap + 1;
  }
  return d[a.length][b.length];
}

/**
 * A word is fine when it's in the trade dictionary, the English list, or is a code / number /
 * measurement / Pantone reference. Hyphenated and slashed words are checked part by part.
 */
export function makeChecker(english: (w: string) => boolean, extraOk: string[] = []) {
  const extra = new Set(extraOk.map((x) => x.toUpperCase()));
  const ok = (raw: string): boolean => {
    const w = raw.toUpperCase();
    if (w.length < 3 || /\d/.test(w) || TRADE.has(w) || extra.has(w)) return true;
    if (/[-/]/.test(w)) return w.split(/[-/]/).every((p) => !p || ok(p));
    if (KNOWN_CORRECTIONS[w]) return false;
    const lw = w.toLowerCase();
    if (english(lw)) return true;
    // Simple plurals / possessives of known words.
    if (lw.endsWith("s") && (english(lw.slice(0, -1)) || TRADE.has(w.slice(0, -1)))) return true;
    if (lw.endsWith("'s") && english(lw.slice(0, -2))) return true;
    return false;
  };
  return ok;
}

/** Words only: tokens that carry digits or underscores (codes like TB25_ACC0023, PINK005) are skipped. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const chunk of text.split(/[\s,;:.()[\]{}"“”!?*+=<>|]+/)) {
    if (!chunk || /[\d_#]/.test(chunk)) continue;
    const m = chunk.match(/[A-Za-z][A-Za-z'’/-]*[A-Za-z]|[A-Za-z]+/g);
    if (m) out.push(...m);
  }
  return out;
}

export function spellcheckText(
  text: string,
  english: (w: string) => boolean,
  suggestFrom: () => Iterable<string>,
  extraOk: string[] = [],
): SpellFlag[] {
  const ok = makeChecker(english, extraOk);
  const counts = new Map<string, number>();
  for (const t of tokenize(text)) {
    const w = t.toUpperCase().replace(/’/g, "'");
    // An all-caps word of 4 letters or fewer is an abbreviation (DIA, TOL, SPI …): never "corrected",
    // unless it's a misspelling we know.
    if (isAbbreviation(t) && !KNOWN_CORRECTIONS[w]) continue;
    if (!ok(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  // A hyphenated word broken by a space ("MULTI- COLOR") is one word (V2.1 §11).
  const broken = new Map<string, string>();
  for (const m of text.matchAll(/\b([A-Za-z]{2,})- ([A-Za-z]{2,})\b/g)) {
    const w = `${m[1]}- ${m[2]}`.toUpperCase();
    counts.set(w, (counts.get(w) ?? 0) + 1);
    broken.set(w, `${m[1]}-${m[2]}`.toUpperCase());
  }
  if (broken.size) return [...counts].map(([word, count]) => ({ word, count, suggestion: broken.get(word) ?? suggest(word, suggestFrom) }));
  return [...counts].map(([word, count]) => ({ word, count, suggestion: suggest(word, suggestFrom) }));
}

/** All capitals (A–Z only), 4 letters or fewer: DIA, TOL, SPI, PU … */
export function isAbbreviation(token: string) {
  return /^[A-Z]{1,4}$/.test(token);
}

/** Known correction first; otherwise the closest trade term, then the closest English word. */
export function suggest(word: string, suggestFrom: () => Iterable<string>): string | null {
  const w = word.toUpperCase();
  if (KNOWN_CORRECTIONS[w]) return KNOWN_CORRECTIONS[w];
  let best: { w: string; d: number } | null = null;
  const consider = (cand: string) => {
    const d = distance(w, cand, 2);
    if (d <= 2 && (!best || d < best.d)) best = { w: cand, d };
  };
  for (const t of TRADE) if (t.length > 3) consider(t);
  if (best) return (best as { w: string }).w;
  const lw = w.toLowerCase();
  for (const cand of suggestFrom()) {
    if (Math.abs(cand.length - lw.length) > 2 || cand[0] !== lw[0]) continue;
    const d = distance(lw, cand, 2);
    if (d <= 2 && (!best || d < best.d)) best = { w: cand.toUpperCase(), d };
    if (best && best.d === 1) break;
  }
  return best ? (best as { w: string }).w : null;
}
