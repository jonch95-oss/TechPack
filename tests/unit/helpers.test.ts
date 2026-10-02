import { describe, expect, it } from "vitest";
import { applyStandardTolerances, bomFromAnswers, contentLabel, pomFromTemplate, standardTolerance, templateKey } from "@/lib/questions/helpers";
import { planPages } from "@/lib/pdf/plan";

describe("POM templates", () => {
  it("picks the silhouette template and copies only answered values", () => {
    const a = { "dims.unit": "CM", "dims.h": 16, "dims.w": 20, "dims.d": 8, "hb.top_handle.drop": 6.5, "hb.flap_height": 7.5, "branding.offset": 15 };
    expect(templateKey("Handbags", a)).toBe("HANDBAG");
    expect(templateKey("Handbags", { "hb.silhouette": "TOTE" })).toBe("TOTE");
    expect(templateKey("Men's bags", { "men.type": "DOPP KIT" })).toBe("COSMETIC");
    const rows = pomFromTemplate("Handbags", a);
    const v = (p: string) => rows.find((r) => r.point === p);
    expect(v("TOTAL HEIGHT")?.value).toBe(16);
    expect(v("HANDLE DROP")?.value).toBe(6.5);
    expect(v("LOGO OFFSET")?.value).toBe(1.5); // 15 mm → 1.5 cm
    expect(v("STRAP DROP")?.value).toBeUndefined(); // never invented
    expect(v("TOTAL HEIGHT")?.how).toMatch(/BASE TO TOP EDGE/);
  });

  it("keeps existing rows and does not duplicate them", () => {
    const rows = pomFromTemplate("Handbags", { "dims.h": 16 }, [{ point: "TOTAL HEIGHT", value: 99, how: "X" }]);
    expect(rows.filter((r) => r.point === "TOTAL HEIGHT")).toEqual([{ point: "TOTAL HEIGHT", value: 99, how: "X" }]);
  });

  it("standard tolerances fill blanks only, in cm or inches", () => {
    expect(standardTolerance("STRAP TOTAL LENGTH", 120, false)).toBe(1.5);
    expect(standardTolerance("HANDLE DROP", 6.5, false)).toBe(1);
    expect(standardTolerance("FLAP HEIGHT", 7.5, false)).toBe(0.3);
    expect(standardTolerance("TOTAL WIDTH", 20, false)).toBe(0.5);
    expect(standardTolerance("TOTAL WIDTH", 50, false)).toBe(1);
    expect(standardTolerance("TOTAL WIDTH", 8, true)).toBe(0.25); // 0.5 cm ≈ 1/4 in
    const out = applyStandardTolerances([{ point: "TOTAL HEIGHT", value: 16, how: "" }, { point: "TOTAL WIDTH", value: 20, tol: 0.2, how: "" }], false);
    expect(out.map((r) => r.tol)).toEqual([0.5, 0.2]);
  });
});

describe("BOM and content label", () => {
  const a = {
    "materials.list": [
      { callout: 1, name: "PU", locations: ["BODY"] },
      { callout: 2, name: "SUEDE", locations: ["GUSSET"] },
    ],
    "materials.matrix": { "-A": { mat_1: { lib: { id: "m1", label: "PU BLACK" } }, mat_2: { lib: { id: "m2", label: "SUEDE" } } } },
    "interior.lined": true,
    "interior.lining_material": { id: "l1", label: "POLY TWILL" },
    "hardware.items": [{ item: { id: "h1", label: "HW-001 D-RING" }, qty: 2, placement: "SIDES" }],
    "hardware.finish": "LIGHT GOLD",
    "zippers.list": [{ position: "TOP", size: "#5", type: "METAL", ends: "CLOSED END", slider: "AUTO LOCK", tape: "BLACK", teeth: "GOLD" }],
  };

  it("builds rows from the answers without prices or quantities it can't know", () => {
    const rows = bomFromAnswers(a as never);
    expect(rows.map((r) => r.component)).toEqual(["MAIN MATERIAL", "TRIM", "LINING", "THREAD", "ZIPPER", "HARDWARE"]);
    expect(rows.find((r) => r.component === "HARDWARE")).toMatchObject({ qty: 2, colour: "LIGHT GOLD" });
    expect(rows[0].unit).toBe("FTY TO CONFIRM");
    expect(JSON.stringify(rows)).not.toMatch(/\$|PRICE|COST|MOQ/);
    // Running it again keeps the existing rows.
    expect(bomFromAnswers(a as never, rows)).toHaveLength(rows.length);
  });

  it("assembles the content label and lists what's missing", () => {
    const comp: Record<string, string> = { m1: "100% POLYURETHANE", l1: "100% POLYESTER" };
    const out = contentLabel(a as never, ["-A"], (id) => comp[id]);
    expect(out["-A"].text).toBe("EXTERIOR: 100% POLYURETHANE  ·  LINING: 100% POLYESTER");
    expect(out["-A"].missing).toEqual(["SUEDE"]);
  });
});

describe("plan pages for the new sections", () => {
  it("adds construction, BOM and sample pages in order", () => {
    const p = planPages({
      hasInterior: false, productFeaturesOn: false, hasFeaturesOrRender: false, hasExtraMeasurements: false, colorwayRenderCount: 1, referencePhotoCount: 0,
      hasLiningArtwork: false, liningArtworkOnInterior: false, detailPanelCount: 1, swatches: [{ colorway: "-A", materialCallout: 1 }], swatchesOnOnePage: true,
      revisionCount: 1, hasConstruction: true, hasBom: true, hasSampleComments: true,
    });
    expect(p.pages.map((x) => x.section)).toEqual(["MATERIALS / HARDWARE", "HARDWARE / BRANDING DETAIL", "CONSTRUCTION DETAILS", "BILL OF MATERIALS", "SWATCH CARDS", "CHANGE LOG", "SAMPLE COMMENTS"]);
    expect(p.ref("BILL OF MATERIALS")).toBe("4/7");
  });
});
