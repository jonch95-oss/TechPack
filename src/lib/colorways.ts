/**
 * Colourways can be added, removed or renamed anywhere, and their data follows (V2 brief §3 step 2).
 * Suffixes stay -A, -B … in order: removing -B of -A/-B/-C makes the old -C the new -B, and every
 * per-colourway answer (breakdown matrix, colourway names) and colourway-tagged upload moves with it.
 * Pure, so it is unit-tested.
 */
export const suffix = (i: number) => `-${String.fromCharCode(65 + i)}`;
const SUFFIX = /^-[A-Z0-9]{1,3}$/;

/** Old suffix → new suffix (null = removed). */
export type ColorwayMap = Record<string, string | null>;

export function removeColorway(list: string[], gone: string): { next: string[]; map: ColorwayMap } {
  const keep = list.filter((c) => c !== gone);
  const map: ColorwayMap = { [gone]: null };
  keep.forEach((c, i) => (map[c] = suffix(i)));
  return { next: keep.map((_, i) => suffix(i)), map };
}

/** An answer keyed by colourway suffix (matrix rows, names): its keys follow the map. */
function isPerColorway(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every((k) => SUFFIX.test(k));
}

/** The answers that change, with their new values. */
export function remapAnswers(answers: Record<string, unknown>, map: ColorwayMap): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [qid, v] of Object.entries(answers)) {
    if (!isPerColorway(v)) continue;
    const next: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const to = k in map ? map[k] : k;
      if (to) next[to] = x;
    }
    if (JSON.stringify(next) !== JSON.stringify(v)) out[qid] = next;
  }
  return out;
}

/** Upload tags that name a colourway ("-B" on a colourway render, "2|-B" on a swatch card). */
export function remapTag(tag: string, map: ColorwayMap): string | null {
  const parts = tag.split("|");
  const i = parts.findIndex((p) => SUFFIX.test(p));
  if (i < 0 || !(parts[i] in map)) return tag;
  const to = map[parts[i]];
  if (!to) return null; // its colourway was removed
  parts[i] = to;
  return parts.join("|");
}
