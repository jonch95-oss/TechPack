/**
 * Paper size of a component view drawn at 100% (V2.1 §7). The size comes from the part's own
 * dimensions — never a made-up default:
 *  - "40 X 15" → the view's width 40 mm, height 15 mm (the image's own aspect when it disagrees is
 *    fitted inside, so neither side is overstated);
 *  - one number ("DIA 8", "INNER 40", "50") → the view's longer side is that size;
 *  - no number → not drawn to scale (the panel must not say "SIZE 100%").
 */
export type TrueSize = { wMm: number; hMm: number; exact: boolean };

export function numbersOf(dims: string): number[] {
  return (String(dims ?? "").match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0);
}

/** `aspect` = the view image's width / height. `nominal` is the drawing height used when no size is known. */
export function trueSize(dims: string, aspect: number, nominal = 30): TrueSize {
  const n = numbersOf(dims);
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  if (n.length >= 2) {
    const [w, h] = n;
    // Fit the image inside W × H at its own aspect, so neither side is drawn larger than given.
    return a >= w / h ? { wMm: w, hMm: w / a, exact: true } : { wMm: h * a, hMm: h, exact: true };
  }
  if (n.length === 1) return a >= 1 ? { wMm: n[0], hMm: n[0] / a, exact: true } : { wMm: n[0] * a, hMm: n[0], exact: true };
  return { wMm: nominal * a, hMm: nominal, exact: false };
}
