import { describe, expect, it } from "vitest";
import { gatePasses, validatePack, type ValidationInput } from "@/lib/validation";

const base: ValidationInput = {
  category: "Handbags",
  brand: { name: "Pink London", licensorRequired: false },
  answers: {},
  statuses: {},
  colorways: ["-A"],
  chineseOn: false,
  hardware: [],
  spelling: [],
};
const find = (r: ReturnType<typeof validatePack>, rule: string | RegExp) => r.find((x) => (typeof rule === "string" ? x.rule === rule : rule.test(x.rule)));

describe("validation gate (Part 5)", () => {
  it("blocks export while ★ fields are missing", () => {
    const r = validatePack(base);
    expect(gatePasses(r)).toBe(false);
    expect(find(r, /★ Height/)?.status).toBe("fail");
  });

  it("geometry: flap taller than the bag, pocket too wide, logo that doesn't fit, odd handle drop", () => {
    const r = validatePack({
      ...base,
      answers: {
        "dims.unit": "CM",
        "dims.h": 16,
        "dims.w": 20,
        "dims.d": 8,
        "hb.flap_height": 17,
        "hb.top_handle.drop": 30,
        "interior.pockets": [{ type: "SLIP POCKET", wall: "BACK WALL", w: 19, top_offset: 2.5 }],
        "branding.logo_size": { w: 60, h: 160 },
        "branding.offset": 15,
        "branding.placement": "CENTERED ON FLAP",
      },
    });
    expect(find(r, "Flap height ≤ body height")?.status).toBe("fail");
    expect(find(r, /Pocket 1/)?.fix).toMatch(/width 19 must be ≤ wall 20 − 2/);
    expect(find(r, "Logo size + offset fits its panel")?.status).toBe("fail");
    expect(find(r, /top handle drop/)?.status).toBe("fail");
  });

  it("PINK013 geometry passes", () => {
    const r = validatePack({
      ...base,
      answers: {
        "dims.unit": "CM",
        "dims.h": 16,
        "dims.w": 20,
        "dims.d": 8,
        "hb.flap_height": 7.5,
        "hb.top_handle.drop": 6.5,
        "hb.gusset": "STANDARD (NO PLEATS)",
        "interior.pockets": [{ type: "SLIP POCKET", wall: "BACK WALL", w: 14, top_offset: 2.5 }],
        "branding.logo_size": { w: 40, h: 12 },
        "branding.offset": 15,
        "branding.placement": "CENTERED ON FLAP",
      },
    });
    for (const rule of ["Flap height ≤ body height", "Logo size + offset fits its panel", "Gusset width = D"]) expect(find(r, rule)?.status, rule).toBe("pass");
    expect(find(r, /Pocket 1/)?.status).toBe("pass");
    expect(find(r, /top handle drop/)?.status).toBe("pass");
  });

  it("strap length vs drop, belt grading, carry-on limits", () => {
    expect(find(validatePack({ ...base, answers: { "hb.strap.length": 100, "hb.strap.drop": 55 } }), /Strap total length/)?.status).toBe("fail");
    expect(find(validatePack({ ...base, category: "Belts", answers: { "belt.lengths": [{ length: 80 }, { length: 85 }, { length: 92 }] } }), /Belt lengths/)?.status).toBe("fail");
    const lug = validatePack({ ...base, category: "Hardside luggage", answers: { "lug.size": 'CARRY-ON 20"', "dims.unit": "INCHES", "dims.h": 23, "dims.w": 14, "dims.d": 9 } });
    expect(find(lug, /Carry-on/)?.status).toBe("warn");
  });

  it("licensor fields for Ted Baker / Champion; claims raise a test-report warning", () => {
    const tb = validatePack({ ...base, brand: { name: "Ted Baker", licensorRequired: true } });
    expect(find(tb, /licensor approval/)?.status).toBe("fail");
    const cool = validatePack({ ...base, category: "Coolers / insulated", answers: { "cool.cold_claim": true, "cool.cold_hours": 24, "cool.seams": "RF/HEAT-WELDED LEAKPROOF" } });
    expect(find(cool, /Cold-retention/)?.fix).toMatch(/test report/);
    expect(find(cool, /Leakproof/)?.status).toBe("warn");
  });

  it("spelling and capitals are language failures; finish mismatches are warnings", () => {
    const r = validatePack({
      ...base,
      answers: { "hardware.finish": "SHINY CHAMPAGNE GOLD", "header.reference_sample": "Betsy Johnson", "hardware.items": [{ item: { id: "h1", label: "PINK006" } }] },
      hardware: [{ id: "h1", code: "PINK006", type: "MAGNETIC SNAP", dimsMm: "14", finish: "GUNMETAL" }],
      spelling: [{ word: "CLOURE", suggestion: "CLOSURE", count: 1 }],
    });
    expect(find(r, "Spelling: CLOURE")?.fix).toBe("Change CLOURE → CLOSURE.");
    expect(find(r, "All callouts in capitals")?.status).toBe("fail");
    expect(find(r, /Hardware finish matches/)?.status).toBe("warn");
  });

  it("every comment letter must be placed on a page", () => {
    const r = validatePack({ ...base, answers: { "comments.list": [{ text: "A", pages: ["MATERIALS / HARDWARE"] }, { text: "B" }] } });
    expect(find(r, "Comment B isn't on any page")?.status).toBe("fail");
    expect(find(r, "Comment A isn't on any page")).toBeUndefined();
  });
});
