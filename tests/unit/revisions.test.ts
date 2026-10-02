import { describe, expect, it } from "vitest";
import { changeLine, diffSnapshots, sectionsForQuestion } from "@/lib/revision-diff";

const base = {
  answers: {
    "dims.unit": "CM",
    "dims.h": 16,
    "hb.strap.length": 120,
    "branding.logo_type": "METAL PLATE",
    "interior.pockets": [{ type: "SLIP POCKET", w: 14, top_offset: 2.5 }],
    "materials.matrix": { "-A": { mat_1: { lib: { id: "x", label: "JUNFA #2" } } } },
    "header.due_date": "ASAP",
  },
  flats: { FRONT: "aaa" },
};

describe("revision change log", () => {
  it("logo metal → TPU flags pages 1 and 2", () => {
    const after = { ...base, answers: { ...base.answers, "branding.logo_type": "TPU / RUBBER PATCH" } };
    const ch = diffSnapshots(base, after, "Handbags");
    expect(ch).toHaveLength(1);
    expect(changeLine(ch[0])).toBe("LOGO TYPE: METAL PLATE → TPU / RUBBER PATCH");
    expect(ch[0].sections).toEqual(expect.arrayContaining(["MATERIALS / HARDWARE", "MEASUREMENTS SHEET"]));
  });

  it("numbers carry units; tables are reported row by row; due date is not a change", () => {
    const after = {
      answers: {
        ...base.answers,
        "hb.strap.length": 125,
        "interior.pockets": [{ type: "SLIP POCKET", w: 15, top_offset: 2.5 }, { type: "ZIP POCKET" }],
        "header.due_date": "2026-11-01",
        "materials.matrix": { "-A": { mat_1: { lib: { id: "y", label: "JUNFA #24" } } } },
      },
      flats: { FRONT: "bbb", BACK: "ccc" },
    };
    const lines = diffSnapshots(base, after, "Handbags").map(changeLine);
    expect(lines).toContain("STRAP TOTAL LENGTH: 120 CM → 125 CM");
    expect(lines.some((l) => /POCKETS 1 .*W.*: 14 CM → 15 CM/.test(l))).toBe(true);
    expect(lines.some((l) => /POCKETS 2 ADDED/.test(l))).toBe(true);
    expect(lines).toContain("-A MATERIAL #1: JUNFA #2 → JUNFA #24");
    expect(lines).toContain("FRONT VIEW FLAT REDRAWN");
    expect(lines).toContain("BACK VIEW FLAT ADDED");
    expect(lines.join(" ")).not.toMatch(/DUE/);
  });

  it("maps questions to the pages that show them", () => {
    expect(sectionsForQuestion("interior.pockets")).toEqual(["INTERIOR & LINING"]);
    expect(sectionsForQuestion("pom.list")).toEqual(["MEASUREMENTS SHEET"]);
    expect(sectionsForQuestion("comments.list", { "comments.list": [{ pages: ["REFERENCE PHOTOS FOR CONSTRUCTION"] }] })).toEqual(["REFERENCE PHOTOS FOR CONSTRUCTION"]);
  });
});
