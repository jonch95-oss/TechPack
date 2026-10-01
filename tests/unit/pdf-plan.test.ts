import { describe, expect, it } from "vitest";
import { planPages, type PlanInput } from "@/lib/pdf/plan";

const base: PlanInput = {
  hasInterior: false,
  productFeaturesOn: true,
  hasFeaturesOrRender: false,
  hasExtraMeasurements: false,
  colorwayRenderCount: 0,
  referencePhotoCount: 0,
  hasLiningArtwork: false,
  liningArtworkOnInterior: false,
  detailPanelCount: 0,
  swatches: [],
  swatchesOnOnePage: false,
  revisionCount: 0,
};

describe("page plan (Part 4 order, empty pages skipped)", () => {
  it("PINK013 → 8 pages in the reference order with correct cross-references", () => {
    const plan = planPages({
      ...base,
      productFeaturesOn: false,
      hasExtraMeasurements: true,
      colorwayRenderCount: 2,
      referencePhotoCount: 1,
      hasInterior: true,
      hasLiningArtwork: true,
      swatches: [
        { colorway: "-A", materialCallout: 1 },
        { colorway: "-B", materialCallout: 1 },
      ],
    });
    expect(plan.pages.map((p) => p.section)).toEqual([
      "MATERIALS / HARDWARE",
      "MEASUREMENTS SHEET",
      "ENLARGED CAD",
      "REFERENCE PHOTOS FOR CONSTRUCTION",
      "INTERIOR & LINING",
      "LINING / PRINT ARTWORK",
      "SWATCH CARDS",
      "SWATCH CARDS",
    ]);
    expect(plan.swatchRef("-A", 1)).toBe("7/8");
    expect(plan.swatchRef("-B", 1)).toBe("8/8");
    expect(plan.artworkRef()).toBe("6/8");
  });

  it("TB25_ACC0023 → 6 pages: features, references, interior with artwork, hardware detail, one swatch page", () => {
    const plan = planPages({
      ...base,
      hasFeaturesOrRender: true,
      referencePhotoCount: 3,
      hasInterior: true,
      hasLiningArtwork: true,
      liningArtworkOnInterior: true,
      detailPanelCount: 2,
      swatches: ["-A", "-B", "-C"].map((c) => ({ colorway: c, materialCallout: 1 })),
      swatchesOnOnePage: true,
    });
    expect(plan.total).toBe(6);
    expect(plan.pages.map((p) => p.section)).toEqual([
      "MATERIALS / HARDWARE",
      "PRODUCT FEATURES",
      "REFERENCE PHOTOS FOR CONSTRUCTION",
      "INTERIOR & LINING",
      "HARDWARE / BRANDING DETAIL",
      "SWATCH CARDS",
    ]);
    expect(plan.artworkRef()).toBe("4/6");
    expect(plan.swatchRef("-C", 1)).toBe("6/6");
  });

  it("a minimal pack is a single page", () => {
    expect(planPages(base).total).toBe(1);
  });
});
