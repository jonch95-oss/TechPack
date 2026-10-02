/**
 * The standard tech pack pages (V2.1 §2.4) — one layout and page order for every brand — in print
 * order. Empty pages are skipped when a pack is planned.
 */
export const PAGE_SECTIONS = [
  "OVERVIEW",
  "MEASUREMENTS",
  "REFERENCE IMAGES",
  "COLOURWAYS",
  "TRIMS & HARDWARE",
  "INTERIOR & LINING",
  "LINING / PRINT ARTWORK",
  "CONSTRUCTION DETAILS",
  "BILL OF MATERIALS",
  "SWATCH CARDS",
  "SAMPLE COMMENTS",
  "CHANGE LOG",
] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];

/** Page names used before the standard layout, as stored in older comments and uploads. */
const LEGACY: Record<string, PageSection> = {
  "MATERIALS / HARDWARE": "OVERVIEW",
  "PRODUCT FEATURES": "OVERVIEW",
  "MEASUREMENTS SHEET": "MEASUREMENTS",
  "ENLARGED CAD": "COLOURWAYS",
  "REFERENCE PHOTOS FOR CONSTRUCTION": "REFERENCE IMAGES",
  "HARDWARE / BRANDING DETAIL": "TRIMS & HARDWARE",
};

/** A stored page name in the standard naming (unknown names pass through unchanged). */
export function normalizePage(p: string): string {
  return LEGACY[p] ?? p;
}
