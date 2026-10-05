/**
 * Golden run 1 (the real packs printed through the standard layout): the rules behind its fixes.
 * Neutral placeholder data only — no product from the golden set.
 */
import { describe, expect, it } from "vitest";
import { missingFrom, mmText, specItems, tight, valueOf } from "@/lib/pdf/specs";
import { logoRows, planPages, trimsLayout, type PlanInput } from "@/lib/pdf/plan";
import { calloutPoint, caseHalves, logoPointFor, reliefCallout, spreadPoints, usDate, wallName } from "@/lib/pdf/hints";
import { completeness, findQuestion, matrixColumns, visibleQuestions } from "@/lib/questions";
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
    expect(set.table).toEqual({ head: ["SIZE", "QTY", "L", "W", "H"], rows: [["S", "2", '10"', '7"', '3"']] });
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
    const pages = trimsLayout(7, [7.4]);
    expect(pages.map((p) => p.to - p.from)).toEqual([2, 2, 2, 1]);
    expect(pages[3].rows).toEqual([0]);
    const plan = planPages({ ...base, detailPanelCount: 7, trimsPages: pages.length });
    expect(plan.pages.filter((p) => p.section === "TRIMS & HARDWARE").map((p) => ("part" in p ? `${p.part.i}/${p.part.of}` : ""))).toEqual(["1/4", "2/4", "3/4", "4/4"]);
  });

  it("a full last page puts the logo row on a page of its own", () => {
    expect(trimsLayout(2, [7.4]).map((p) => [p.to - p.from, p.rows.length])).toEqual([[2, 0], [0, 1]]);
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

describe("golden run 2", () => {
  it("#1 every material gets a callout and none overlap, even when two share a spot", () => {
    const pts = spreadPoints([{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1.1, y: 1 }], 0.34, { x: 0, y: 0, w: 4, h: 3 });
    for (let i = 0; i < pts.length; i++) for (let j = 0; j < i; j++) expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThanOrEqual(0.34);
    expect(pts.every((p) => p.x >= 0 && p.x <= 4 - 0.34 && p.y >= 0 && p.y <= 3 - 0.34)).toBe(true);
    // The first location decides: a fabric for the lid and a handle wrap goes on the lid.
    expect(calloutPoint({ locations: ["TOP LID", "HANDLE WRAP"] }, 0)).toMatchObject({ x: 0.5, y: 0.18 });
  });

  it("#4 the studio's notes never print, and rows print as a table", () => {
    const items = specItems("Handbags", { "hardware.items": [{ item: { id: "", label: "XX001 RING" }, qty: 2, placement: "SIDES", seen: "SEEN ON RENDER" }] });
    const hw = items.find((i) => i.qid === "hardware.items")!;
    expect(JSON.stringify(hw)).not.toMatch(/SEEN ON RENDER/);
    expect(hw.table?.head).toEqual(expect.arrayContaining(["QTY"]));
  });

  it("#5 mm values in an inch pack print in inches with the mm in brackets", () => {
    expect(mmText(171.5, true)).toBe('6.75" (171.5 MM)');
    expect(mmText(15, false)).toBe("15 MM");
    const logo = specItems("Handbags", { "dims.unit": "INCHES", "branding.logo_size": { w: 171.5, h: 25.4 } }).find((i) => i.qid === "branding.logo_size")!;
    expect(logo.lines[0]).toBe('6.75" X 1" (171.5 X 25.4 MM)');
  });

  it("#6 the nesting order prints", () => {
    const items = specItems("Packing cubes", { "cube.set": [{ size: "S", qty: 1, l: 1, w: 1, h: 1 }, { size: "L", qty: 1, l: 3, w: 3, h: 3 }] });
    expect(items.find((i) => i.qid === "cube.nesting")?.lines).toEqual(["L > S"]);
  });

  it("#3 trims photos get 3 in of room or a page of their own", () => {
    expect(trimsLayout(1, [7.4], true).map((p) => [p.to - p.from, p.rows.length, p.photos])).toEqual([[1, 1, "row"]]);
    expect(trimsLayout(1, [], true).map((p) => [p.to - p.from, p.photos])).toEqual([[1, "grid"]]);
    expect(trimsLayout(2, [], true).map((p) => [p.to - p.from, p.photos])).toEqual([[2, false], [0, "grid"]]);
    expect(trimsLayout(0, [], true).map((p) => p.photos)).toEqual(["grid"]);
    // A full-width logo row leaves no room beside it: the photos get their own page.
    expect(trimsLayout(1, [16], true).map((p) => p.photos)).toEqual([false, "grid"]);
  });

  it("#3 a caption saying actual size without a real width is flagged, never guessed", () => {
    const rules = validatePack({ category: "Handbags", brand: { name: "X", licensorRequired: false }, answers: {}, statuses: {}, colorways: ["-A"], chineseOn: false, hardware: [], spelling: [], photos: [{ letter: "A", note: "PULLER — ACTUAL SIZE" }, { letter: "B", note: "ACTUAL SIZE", actualWidthMm: 40 }] });
    expect(rules.filter((r) => r.rule.endsWith("actual size")).map((r) => r.rule)).toEqual(["Photo A — actual size"]);
  });
});

describe("golden run 2 P2 — the AI read on fields a render can't settle", () => {
  it("they are INFERRED / low unless seen unambiguously", async () => {
    const { normaliseAiAnswers } = await import("@/lib/ai/analyse-render");
    const out = {
      answers: [
        { question_id: "edge.treatment", value_json: '"PAINTED"', basis: "seen" as const, confidence: "med" as const, note: "" },
        { question_id: "hardware.finish", value_json: '"GUNMETAL"', basis: "seen" as const, confidence: "high" as const, note: "" },
        { question_id: "hb.silhouette", value_json: '"TOTE"', basis: "seen" as const, confidence: "med" as const, note: "" },
      ],
      materials: [],
      exterior_pockets: [],
      hardware: [],
      zippers: [],
      colorways: [],
      visible_features: [],
      not_visible: [],
      agent_notes: "",
    };
    const { answers } = normaliseAiAnswers("Handbags", out as never, new Map());
    const by = Object.fromEntries(answers.map((a) => [a.questionId, [a.status, a.confidence]]));
    expect(by["edge.treatment"]).toEqual(["inferred", "low"]);
    expect(by["hardware.finish"]).toEqual(["ai", "high"]);
    expect(by["hb.silhouette"]).toEqual(["ai", "med"]);
  });

  it("the eval counts confident-wrong and invented measurements", async () => {
    const { scoreRead } = await import("@/lib/ai/eval");
    const s = scoreRead(
      [
        { questionId: "edge.treatment", value: "PAINTED", status: "ai", note: "", confidence: "high" },
        { questionId: "construction.thread_colour", value: "BLACK", status: "inferred", note: "", confidence: "low" },
        { questionId: "hb.silhouette", value: "TOTE", status: "ai", note: "", confidence: "med" },
        { questionId: "dims.h", value: 30, status: "est", note: "", confidence: "low" },
      ],
      { "edge.treatment": "FOLDED", "construction.thread_colour": "DTM", "hb.silhouette": "tote" },
    );
    expect(s).toMatchObject({ correct: 1, wrong: ["edge.treatment", "construction.thread_colour"], confidentWrong: ["edge.treatment"], invented: ["dims.h"] });
  });
});

describe("V2.1 step 4 — multi-style packs, sets, size families", () => {
  it("a multi-style pack lists every style #; a single style keeps its own", async () => {
    const { styleCodesOf } = await import("@/lib/pdf/hints");
    expect(styleCodesOf({ styleNo: "AB-001", colorways: ["-A", "-B"], colorwayStyles: { "-A": "AB-001", "-B": "AB-002" } })).toEqual(["AB-001", "AB-002"]);
    expect(styleCodesOf({ styleNo: "AB-001", colorways: ["-A", "-B"], colorwayStyles: {} })).toEqual(["AB-001"]);
    expect(styleCodesOf({ styleNo: "AB-001", colorways: ["-A", "-B"], colorwayStyles: { "-B": "AB-002" } })).toEqual(["AB-001", "AB-002"]);
  });

  it("named variants keep their names when a colourway is removed", async () => {
    const { removeColorway } = await import("@/lib/colorways");
    expect(removeColorway(["-A", "VINTAGE", "-B", "-C"], "-B").next).toEqual(["-A", "VINTAGE", "-B"]);
  });

  it("a set nests within each piece type, and a flat piece needs no H", () => {
    const items = specItems("Packing cubes", {
      "cube.set": [
        { piece: "CUBE", size: "S", qty: 1, l: 10, w: 8, h: 4 },
        { piece: "CUBE", size: "L", qty: 1, l: 20, w: 15, h: 8 },
        { piece: "POUCH", size: "M", qty: 1, l: 12, w: 9 },
        { piece: "POUCH", size: "S", qty: 1, l: 8, w: 6 },
      ],
    });
    expect(items.find((i) => i.qid === "cube.nesting")?.lines).toEqual(["CUBES: L > S · POUCHES: M > S"]);
    const ids = completeness({ category: "Packing cubes", answers: { "dims.unit": "CM", "cube.set": [{ piece: "POUCH", size: "M", qty: 1, l: 12, w: 9 }] } }, {}, ["-A"], "PROTO").map((i) => i.questionId);
    expect(ids).not.toContain("dims.h");
  });

  it("size family and sample size are answers that print", () => {
    const items = specItems("Hardside luggage", { "header.size_family": '20", 24", 28"', "header.sample_size": '28"' });
    expect(items.map((i) => i.qid)).toEqual(["header.size_family", "header.sample_size"]);
  });
});

describe("V2.1 step 5 — logos and embellishments", () => {
  it("logo panels pack into rows by width", () => {
    expect(logoRows([3.9, 3.9, 3.9, 3.9, 7.4])).toEqual([[0, 1, 2], [3, 4]]);
    expect(logoRows([])).toEqual([]);
  });
});

describe("V2.1 step 5 — breakdown trim columns", () => {
  it("each pack trim is a breakdown column headed by a T callout, after the materials", () => {
    const cols = matrixColumns({ category: "Handbags", answers: { "materials.list": [{ callout: 1, name: "BODY", locations: [] }], "materials.trims": [{ name: "piping" }, { name: "" }, { name: "binding" }] } });
    const keys = cols.map((c) => c.key);
    expect(keys.slice(0, 3)).toEqual(["mat_1", "trim_1", "trim_3"]);
    expect(cols.find((c) => c.key === "trim_1")).toMatchObject({ label: "PIPING", trim: "T1" });
  });
});

describe("V2.1 step 5 — component record", () => {
  it("a relief prints as depth + treatment + location", () => {
    expect(reliefCallout({ treatment: "debossed", mm: 1.5, location: "logo art" })).toBe("1.5MM DEBOSSED LOGO ART");
    expect(reliefCallout({ treatment: "ENGRAVED", mm: null, location: "FACE" })).toBe("ENGRAVED FACE");
  });
  it("the record's questions exist on the component sheet, with the new types, finishes and materials", () => {
    for (const id of ["hw.colour", "hw.relief", "hw.orientation", "hw.parent", "hw.usage", "hw.finish_standard"]) expect(findQuestion("Hardware", id), id).toBeTruthy();
    const opts = (id: string) => ((findQuestion("Hardware", id) as { options?: string[] }).options ?? []);
    for (const t of ["HUBCAP", "TROLLEY TUBE / HANDLE SYSTEM", "PUSH BUTTON", "CARRY HANDLE", "CORNER GUARD", "CORD LOCK", "BUNGEE-CORD PULLER", "WEBBING PULLER", "EYELET", "WHEEL", "ZIPPER SLIDER", "FINISH STANDARD"]) expect(opts("hw.type")).toContain(t);
    for (const f of ["MULTI-COLOR (VACUUM-PLATED IRIDESCENT)", "AGED SILVER", "BLACK", "PANTONE-MATCHED PLASTIC"]) expect(opts("hw.finish")).toContain(f);
    for (const m of ["PLASTIC", "RUBBER", "TPU"]) expect(opts("hw.material")).toContain(m);
  });
});

describe("V2.1 step 5 — hardside interior by half", () => {
  it("groups features lid → base → both → unstated, numbering each half", () => {
    const h = caseHalves([{ half: "BASE HALF", feature: "x straps with centre buckle" }, { feature: "ZIPPERED POCKET" }, { half: "LID HALF", feature: "ZIPPERED DIVIDER PANEL", qty: 1 }, { half: "LID HALF", feature: "MESH POCKET", qty: 2, note: "on divider" }, { half: "BASE HALF" }]);
    expect(h).toEqual([
      { half: "LID HALF", lines: ["ZIPPERED DIVIDER PANEL", "2 × MESH POCKET — ON DIVIDER"] },
      { half: "BASE HALF", lines: ["X STRAPS WITH CENTRE BUCKLE"] },
      { half: "INTERIOR", lines: ["ZIPPERED POCKET"] },
    ]);
  });
  it("the layout question is asked for hardside cases only", () => {
    expect(findQuestion("Hardside luggage", "interior.layout")).toBeTruthy();
    expect(findQuestion("Handbags", "interior.layout")?.showIf).toEqual({ category: ["Hardside luggage"] });
  });
});

describe("V2.1 step 6 — packaging, labels and compliance pages", () => {
  it("print only when switched on, one page each, after the swatch cards and before the change log", () => {
    expect(planPages(base).pages.some((p) => p.section === "PACKAGING & LABELS")).toBe(false);
    const pages = planPages({ ...base, revisionCount: 1, packaging: ["HANGTAG", "MASTER CARTON LABEL"] }).pages;
    expect(pages.map((p) => ("item" in p ? p.item : p.section))).toEqual(["OVERVIEW", "HANGTAG", "MASTER CARTON LABEL", "CHANGE LOG"]);
    expect(planPages({ ...base, componentOnly: true, packaging: ["HANGTAG"] }).pages.some((p) => p.section === "PACKAGING & LABELS")).toBe(false);
  });
  it("each page is an optional section, off by default", () => {
    for (const id of ["pkg.hangtag.artwork", "pkg.coo_label.made_in", "pkg.carton_label.fields", "pkg.warranty_card.copy", "pkg.polybag.warning"]) {
      expect(findQuestion("Handbags", id), id).toBeTruthy();
      expect(visibleQuestions({ category: "Handbags", answers: {} }).some((q) => q.id === id)).toBe(false);
    }
    expect(visibleQuestions({ category: "Handbags", answers: { "optional.pkg.hangtag": true } }).some((q) => q.id === "pkg.hangtag.artwork")).toBe(true);
  });
});
