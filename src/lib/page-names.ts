/** Section names of the Icon template pages (BRIEF Part 4), in print order. */
export const PAGE_SECTIONS = [
  "MATERIALS / HARDWARE",
  "PRODUCT FEATURES",
  "MEASUREMENTS SHEET",
  "ENLARGED CAD",
  "REFERENCE PHOTOS FOR CONSTRUCTION",
  "INTERIOR & LINING",
  "LINING / PRINT ARTWORK",
  "HARDWARE / BRANDING DETAIL",
  "CONSTRUCTION DETAILS",
  "BILL OF MATERIALS",
  "SWATCH CARDS",
  "CHANGE LOG",
  "SAMPLE COMMENTS",
] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];
