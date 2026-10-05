/**
 * "Start from…" ranking (V2 §3 step 2): the existing packs most like this one — same brand, same
 * category and silhouette, a similar name — most recent first among equals. Pure.
 */
export type Candidate = { id: string; styleNo: string; styleName: string; brandId: string; category: string; silhouette: string; updatedAt: Date };

const words = (s: string) => new Set(s.toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w.length > 2));

export function similarityScore(me: Omit<Candidate, "id" | "updatedAt" | "styleNo">, c: Candidate): number {
  let s = 0;
  if (c.brandId === me.brandId) s += 3;
  if (c.category === me.category) s += 3;
  if (me.silhouette && c.silhouette === me.silhouette) s += 2;
  const a = words(me.styleName),
    b = words(c.styleName);
  for (const w of a) if (b.has(w)) s += 1;
  return s;
}

/** The best `n` candidates that share at least the brand or the category. */
export function rankSimilar(me: Omit<Candidate, "id" | "updatedAt" | "styleNo">, all: Candidate[], n = 3): Candidate[] {
  return all
    .map((c) => ({ c, s: similarityScore(me, c) }))
    .filter((x) => x.s >= 3)
    .sort((x, y) => y.s - x.s || y.c.updatedAt.getTime() - x.c.updatedAt.getTime())
    .slice(0, n)
    .map((x) => x.c);
}

/** The answer that names a pack's silhouette / type, per category. */
export const SILHOUETTE_IDS = ["hb.silhouette", "slg.type", "men.type", "cos.type", "belt.type", "lug.size", "slug.size", "duf.type", "rduf.type", "cube.type", "cool.type", "neck.shape"];
