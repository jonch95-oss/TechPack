/**
 * Pure layout hints for the PDF (golden run 1), shared by the PDF builder, the studio and the tests:
 * where a material callout or the logo sits on the front view, how a wall is named, how dates print.
 */

/**
 * Where a material's yellow numbered callout sits on the front view (#12): where the designer placed
 * it, else a suggestion from the material's locations. Fractions of the product image.
 */
export function calloutPoint(m: { pos?: { x: number; y: number } | null; locations?: string[] }, k: number): { x: number; y: number; suggested: boolean } {
  if (m.pos) return { ...m.pos, suggested: false };
  const loc = (m.locations ?? []).join(" ").toUpperCase();
  const at = (x: number, y: number) => ({ x, y: y + (k % 2) * 0.04, suggested: true });
  if (/FLAP/.test(loc)) return at(0.5, 0.32);
  if (/HANDLE/.test(loc)) return at(0.5, 0.08);
  if (/STRAP/.test(loc)) return at(0.85, 0.06);
  if (/GUSSET|SIDE|END/.test(loc)) return at(0.94, 0.6);
  if (/BASE|BOTTOM/.test(loc)) return at(0.5, 0.9);
  if (/TRIM|PIPING|BINDING|EDGE/.test(loc)) return at(0.08, 0.45);
  if (/LID|TOP/.test(loc)) return at(0.5, 0.18);
  if (/POCKET/.test(loc)) return at(0.35, 0.7);
  return at(0.25 + (k % 3) * 0.2, 0.55);
}

/**
 * Where the logo sits on the front view, from its placement (golden run 1 #10). Null when the
 * placement doesn't say — the studio then asks for a click on the logo instead of guessing the centre.
 */
export function logoPointFor(placement: string): { x: number; y: number } | null {
  const p = placement.toUpperCase();
  if (!p.trim()) return null;
  const x = /LEFT/.test(p) ? 0.25 : /RIGHT/.test(p) ? 0.75 : /CENT(ER|RE)|MIDDLE|FLAP|FRONT|BACK|LID|SHELL/.test(p) ? 0.5 : null;
  const y = /FLAP/.test(p) ? 0.42 : /BOTTOM|BASE|LOWER/.test(p) ? 0.8 : /TOP|UPPER|LID/.test(p) ? 0.22 : /CENT(ER|RE)|MIDDLE|FRONT|BACK|SHELL/.test(p) ? 0.55 : null;
  if (x == null && y == null) return null;
  return { x: x ?? 0.5, y: y ?? 0.55 };
}

/** "OTHER: LEFT SIDE" → SIDE 1, "RIGHT SIDE" → SIDE 2; other walls as written (golden run 1 #8). */
export function wallName(w: string | undefined): string | undefined {
  if (!w) return w;
  const t = w.toUpperCase().replace(/^OTHER:\s*/, "").trim();
  if (/LEFT/.test(t) && /SIDE|END/.test(t)) return "SIDE 1";
  if (/RIGHT/.test(t) && /SIDE|END/.test(t)) return "SIDE 2";
  return t;
}

/** 2026-10-02 → 10.02.2026: every Icon original prints US order (golden run 1 #16). */
export function usDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[2]}.${m[3]}.${m[1]}` : iso;
}
