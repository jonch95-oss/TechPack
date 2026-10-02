/**
 * Which Icon template pages a pack gets (BRIEF Part 4), in order, with empty pages skipped and
 * page numbers / cross-references computed after skipping.
 */
import type { PageSection } from "@/lib/page-names";

export type PlanInput = {
  hasInterior: boolean;
  productFeaturesOn: boolean;
  hasFeaturesOrRender: boolean;
  hasExtraMeasurements: boolean;
  colorwayRenderCount: number;
  referencePhotoCount: number;
  hasLiningArtwork: boolean;
  liningArtworkOnInterior: boolean;
  detailPanelCount: number;
  /** One entry per colorway × material that has a swatch card photo. */
  swatches: { colorway: string; materialCallout: number }[];
  swatchesOnOnePage: boolean;
  revisionCount: number;
  hasConstruction?: boolean;
  hasBom?: boolean;
  hasSampleComments?: boolean;
};

export type PlannedPage =
  | { section: "MATERIALS / HARDWARE" }
  | { section: "PRODUCT FEATURES" }
  | { section: "MEASUREMENTS SHEET" }
  | { section: "ENLARGED CAD" }
  | { section: "REFERENCE PHOTOS FOR CONSTRUCTION" }
  | { section: "INTERIOR & LINING"; withArtwork: boolean }
  | { section: "LINING / PRINT ARTWORK" }
  | { section: "HARDWARE / BRANDING DETAIL" }
  | { section: "SWATCH CARDS"; swatches: { colorway: string; materialCallout: number }[] }
  | { section: "CONSTRUCTION DETAILS" }
  | { section: "BILL OF MATERIALS" }
  | { section: "CHANGE LOG" }
  | { section: "SAMPLE COMMENTS" };

export type Plan = {
  pages: (PlannedPage & { n: number })[];
  total: number;
  /** "7/8" for the page holding a colorway × material swatch card. */
  swatchRef: (colorway: string, callout: number) => string | null;
  /** Page holding the lining artwork. */
  artworkRef: () => string | null;
  ref: (section: PageSection) => string | null;
};

export function planPages(i: PlanInput): Plan {
  const pages: PlannedPage[] = [{ section: "MATERIALS / HARDWARE" }];
  if (i.productFeaturesOn && i.hasFeaturesOrRender) pages.push({ section: "PRODUCT FEATURES" });
  if (i.hasExtraMeasurements) pages.push({ section: "MEASUREMENTS SHEET" });
  if (i.colorwayRenderCount >= 2) pages.push({ section: "ENLARGED CAD" });
  if (i.referencePhotoCount > 0) pages.push({ section: "REFERENCE PHOTOS FOR CONSTRUCTION" });
  if (i.hasInterior) pages.push({ section: "INTERIOR & LINING", withArtwork: i.hasLiningArtwork && i.liningArtworkOnInterior });
  if (i.hasLiningArtwork && !(i.hasInterior && i.liningArtworkOnInterior)) pages.push({ section: "LINING / PRINT ARTWORK" });
  if (i.detailPanelCount > 0) pages.push({ section: "HARDWARE / BRANDING DETAIL" });
  if (i.hasConstruction) pages.push({ section: "CONSTRUCTION DETAILS" });
  if (i.hasBom) pages.push({ section: "BILL OF MATERIALS" });
  if (i.swatches.length) {
    if (i.swatchesOnOnePage) pages.push({ section: "SWATCH CARDS", swatches: i.swatches });
    else for (const s of i.swatches) pages.push({ section: "SWATCH CARDS", swatches: [s] });
  }
  if (i.revisionCount > 0) pages.push({ section: "CHANGE LOG" });
  if (i.hasSampleComments) pages.push({ section: "SAMPLE COMMENTS" });

  const numbered = pages.map((p, k) => ({ ...p, n: k + 1 }));
  const total = numbered.length;
  const tag = (n: number) => `${n}/${total}`;
  return {
    pages: numbered,
    total,
    swatchRef: (cw, callout) => {
      const p = numbered.find((x) => x.section === "SWATCH CARDS" && x.swatches.some((s) => s.colorway === cw && s.materialCallout === callout));
      return p ? tag(p.n) : null;
    },
    artworkRef: () => {
      const p = numbered.find((x) => x.section === "LINING / PRINT ARTWORK") ?? numbered.find((x) => x.section === "INTERIOR & LINING" && x.withArtwork);
      return p ? tag(p.n) : null;
    },
    ref: (section) => {
      const p = numbered.find((x) => x.section === section);
      return p ? tag(p.n) : null;
    },
  };
}
