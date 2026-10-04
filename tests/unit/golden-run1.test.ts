/**
 * Golden run 1 (the real packs printed through the standard layout): the rules behind its fixes.
 * Neutral placeholder data only — no product from the golden set.
 */
import { describe, expect, it } from "vitest";
import { missingFrom, specItems, tight, valueOf } from "@/lib/pdf/specs";
import { planPages, trimsLayout, type PlanInput } from "@/lib/pdf/plan";
import { calloutPoint, logoPointFor, usDate, wallName } from "@/lib/pdf/hints";
import { completeness, findQuestion } from "@/lib/questions";
import { validatePack } from "@/lib/validation";

const base: PlanInput = {
  hasInterior: false,
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

describe("P0.1 — every answer prints: the SPECIFICATIONS items", () => {
  it("booleans print as the feature, never YES; false prints nothing", () => {
    const q = findQuestion("Packing cubes", "cube.mesh")!;
    expect(valueOf(q, true, {})).toEqual({ lines: ["MESH PANEL"], needles: ["MESH PANEL"] });
    expect(valueOf(q, false, {}).lines).toEqual([]);
  });

  it("reference answers print as written", () => {
    const q = findQuestion("Handbags", "branding.placement")!;
    expect(valueOf(q, { ref: "PER_IMAGE", image: "2" }, {}).lines).toEqual(["PLEASE FOLLOW REFERENCE IMAGE 2"]);
  });

  it("set rows print one line per piece with units; duffel sizes are answers like any other", () => {
    const items = specItems("Packing cubes", { "dims.unit": "INCHES", "cube.set": [{ size: "S", qty: 2, l: 10, w: 7, h: 3 }], "cube.mesh": true });
    const set = items.find((i) => i.qid === "cube.set")!;
    expect(set.lines[0]).toBe('SIZE S · QTY 2 · L 10" · W 7" · H 3"');
    expect(items.some((i) => i.qid === "cube.mesh")).toBe(true);
    const duf = specItems("Rolling duffels", { "dims.unit": "CM", "rduf.size_l": 70, "rduf.wheels_inline": true });
    expect(duf.map((i) => i.qid)).toEqual(expect.arrayContaining(["rduf.size_l", "rduf.wheels_inline"]));
  });

  it("page switches and switched-off optional sections are exempt", () => {
    const items = specItems("Handbags", { "pages.product_features": true, "opt.labels.types": ["CARE LABEL"], "comments.list": [{ text: "X" }] });
    expect(items.map((i) => i.qid)).toEqual([]);
    const on = specItems("Handbags", { "optional.opt.labels": true, "opt.labels.types": ["CARE LABEL"] });
    expect(on.map((i) => i.qid)).toEqual(["opt.labels.types"]);
  });

  it("an answer counts as printed in the template's words or in its own", () => {
    const items = specItems("Handbags", { "hb.strap": true }, { "hb.strap": ["SHOULDER STRAP IS REMOVABLE"] });
    expect(missingFrom(items, tight("… SHOULDER STRAP IS REMOVABLE …"))).toEqual([]);
    expect(missingFrom(items, tight(items[0].lines.join(" ")))).toEqual([]);
    expect(missingFrom(items, tight("NOTHING HERE")).map((i) => i.qid)).toEqual(["hb.strap"]);
  });
});

describe("P0.2 — comments and photos make their page print", () => {
  it("a forced page prints even with nothing else on it", () => {
    const pages = planPages({ ...base, forced: ["TRIMS & HARDWARE", "CONSTRUCTION DETAILS"] }).pages.map((p) => p.section);
    expect(pages).toEqual(["OVERVIEW", "TRIMS & HARDWARE", "CONSTRUCTION DETAILS"]);
  });
});

describe("P0.3 — TRIMS & HARDWARE paginates", () => {
  it("seven parts run over four pages, two to a page, the logo row on the last", () => {
    const pages = trimsLayout(7, true);
    expect(pages.map((p) => p.to - p.from)).toEqual([2, 2, 2, 1]);
    expect(pages[3].row).toBe(true);
    const plan = planPages({ ...base, detailPanelCount: 7, trimsPages: pages.length });
    expect(plan.pages.filter((p) => p.section === "TRIMS & HARDWARE").map((p) => ("part" in p ? `${p.part.i}/${p.part.of}` : ""))).toEqual(["1/4", "2/4", "3/4", "4/4"]);
  });

  it("a full last page puts the logo row on a page of its own", () => {
    expect(trimsLayout(2, true).map((p) => [p.to - p.from, p.row])).toEqual([[2, false], [0, true]]);
  });

  it("SPECIFICATIONS pages follow OVERVIEW; a Hardware pack is one component sheet", () => {
    expect(planPages({ ...base, specPages: 2 }).pages.map((p) => p.section)).toEqual(["OVERVIEW", "SPECIFICATIONS", "SPECIFICATIONS"]);
    expect(planPages({ ...base, componentOnly: true, hasColourways: true, detailPanelCount: 1 }).pages.map((p) => p.section)).toEqual(["TRIMS & HARDWARE"]);
  });
});

describe("P1 — layout hints", () => {
  it("the logo leader follows the placement, and has no default when the placement doesn't say", () => {
    expect(logoPointFor("BOTTOM RIGHT")).toEqual({ x: 0.75, y: 0.8 });
    expect(logoPointFor("CENTERED ON FLAP")).toEqual({ x: 0.5, y: 0.42 });
    expect(logoPointFor("")).toBeNull();
    expect(logoPointFor("ON THE HANGTAG")).toBeNull();
  });

  it("LEFT / RIGHT SIDE pockets land on SIDE 1 / SIDE 2", () => {
    expect(wallName("OTHER: LEFT SIDE")).toBe("SIDE 1");
    expect(wallName("RIGHT SIDE")).toBe("SIDE 2");
    expect(wallName("BACK WALL")).toBe("BACK WALL");
  });

  it("dates print in US order", () => {
    expect(usDate("2026-10-02")).toBe("10.02.2026");
  });

  it("material callouts are suggested from locations until placed", () => {
    expect(calloutPoint({ locations: ["FLAP"] }, 0)).toMatchObject({ x: 0.5, y: 0.32, suggested: true });
    expect(calloutPoint({ pos: { x: 0.1, y: 0.2 }, locations: ["FLAP"] }, 0)).toEqual({ x: 0.1, y: 0.2, suggested: false });
  });
});

describe("#17 — a set's pieces are its size at PROTO", () => {
  it("cube.set rows satisfy H / W / D", () => {
    const answers = { "dims.unit": "INCHES", "cube.set": [{ size: "S", qty: 1, l: 10, w: 7, h: 3 }] };
    const ids = completeness({ category: "Packing cubes", answers }, {}, ["-A"], "PROTO").map((i) => i.questionId);
    expect(ids).not.toContain("dims.h");
    expect(ids).not.toContain("dims.w");
    const none = completeness({ category: "Packing cubes", answers: { "dims.unit": "INCHES" } }, {}, ["-A"], "PROTO").map((i) => i.questionId);
    expect(none).toContain("dims.h");
  });
});

describe("#7 — photo letters are comment letters", () => {
  it("warns when a photo shares a comment's letter but not its text", () => {
    const rules = validatePack({ category: "Handbags", brand: { name: "X", licensorRequired: false }, answers: { "comments.list": [{ text: "FIRST", pages: ["OVERVIEW"] }, { text: "SECOND", pages: ["OVERVIEW"] }] }, statuses: {}, colorways: ["-A"], chineseOn: false, hardware: [], spelling: [], photos: [{ letter: "A", note: "FIRST" }, { letter: "B", note: "SOMETHING ELSE" }] });
    expect(rules.filter((r) => r.rule.startsWith("Photo ")).map((r) => [r.rule, r.status])).toEqual([["Photo B caption ≠ comment B", "warn"]]);
  });
});
