import { describe, expect, it } from "vitest";
import { assignRows, partType, realCode, resolveParts, type LibPart, type SheetPart } from "@/lib/hardware-match";
import { normaliseSource } from "@/lib/ai/read-source";

/** The live round-5 bug: one spec sheet turned every hardware row into OW001 LOGO PLATE 50 × 32. */
const spec: SheetPart[] = [
  { type: "LOGO PLATE", description: "ARROWS LOGO PLATE", supplier_code: "N/A", dims_mm: "50 X 32", material: "ZINC ALLOY", finish: "BLACK NICKEL" },
  { type: "BUCKLE", description: "SQUARE PRONG BUCKLE", supplier_code: "N/A", dims_mm: "INNER 40", material: "ZINC ALLOY", finish: "BLACK NICKEL" },
  { type: "HARDWARE", description: "RECTANGULAR STRAP RING", supplier_code: "-", dims_mm: "40 × 15", material: "ZINC ALLOY", finish: "BLACK NICKEL" },
  { type: "EYELET", description: "METAL EYELET", supplier_code: "TBC", dims_mm: "Ø 8", material: "BRASS", finish: "BLACK NICKEL" },
];
const rows = [
  { qty: 1, seen: "ARROWS PLATE (LOGO PLATE)" },
  { qty: 1, seen: "SQUARE PRONG BUCKLE" },
  { qty: 2, seen: "RING ZIP PULL (ZIPPER PULL)" },
  { qty: 2, seen: "ZIPPER SLIDER" },
  { qty: 2, seen: "RECTANGULAR STRAP RING (SQUARE RING)" },
  { qty: 1, seen: "EYELET" },
];

describe("hardware from a spec sheet (round 5, item 1)", () => {
  it("each part keeps its own type", () => {
    expect(spec.map(partType)).toEqual(["LOGO PLATE", "BUCKLE", "SQUARE RING", "EYELET"]);
  });

  it("placeholder supplier codes never match anything", () => {
    for (const c of ["N/A", "-", "TBC", "TBD", "", "0", "NONE"]) expect(realCode(c)).toBe("");
    expect(realCode("BK-2231")).toBe("BK-2231");
  });

  it("a spec with 4 different parts gives 4 different library items — even when the library already has the first one", () => {
    // OW001 is what the first part creates (or what the bad run left in the library).
    const lib: LibPart[] = [{ id: "ow1", code: "OW001", type: "LOGO PLATE", dimsMm: "50 X 32", notes: "FROM SPEC SHEET · SUPPLIER CODE N/A" }];
    const r = resolveParts(spec, lib);
    expect(r.map((x) => x.match?.code ?? null)).toEqual(["OW001", null, null, null]); // only the plate is the plate
    expect(new Set(r.map((x) => x.key)).size).toBe(4); // and the other three are three new items
    expect(r.map((x) => x.size)).toEqual(["50 X 32 MM", "INNER 40 MM", "40 X 15 MM", "DIA 8 MM"]);
  });

  it("each part fills the row of its own type, with the spec's size; other rows are untouched", () => {
    const items = { "LOGO PLATE": "ow1", BUCKLE: "ow2", "SQUARE RING": "ow3", EYELET: "ow4" } as const;
    const resolved = resolveParts(spec, []);
    const linked = resolved.map((x) => ({ type: x.type, size: x.size, item: { id: items[x.type as keyof typeof items], label: items[x.type as keyof typeof items].toUpperCase() }, description: x.part.description }));
    const typeOf = (id: string) => Object.entries(items).find(([, v]) => v === id)?.[0];
    const out = assignRows(rows, linked, typeOf);
    expect(out.map((r) => [(r as { item?: { id: string } }).item?.id ?? null, (r as { size?: string }).size ?? null])).toEqual([
      ["ow1", "50 X 32 MM"],
      ["ow2", "INNER 40 MM"],
      [null, null], // zip pulls: not on the spec
      [null, null], // sliders: not on the spec
      ["ow3", "40 X 15 MM"],
      ["ow4", "DIA 8 MM"],
    ]);
    expect(out).toHaveLength(6); // nothing appended, nothing merged
  });

  it("a real supplier code matches only the part of the same type", () => {
    const lib: LibPart[] = [{ id: "x", code: "OW009", type: "BUCKLE", dimsMm: "", notes: "SUPPLIER CODE BK-2231" }];
    const r = resolveParts([{ ...spec[1], supplier_code: "BK-2231", dims_mm: "" }, { ...spec[0], supplier_code: "BK-2231" }], lib);
    expect(r.map((x) => x.match?.code ?? null)).toEqual(["OW009", null]);
  });
});

describe("materials named on the spec sheet (round 5, item 5)", () => {
  it("fill empty colourway cells as text, and add a material the list doesn't have", () => {
    const { values } = normaliseSource(
      "Handbags",
      {
        materials: [
          { callout: 1, colorway: "", description: "black nylon micro mesh", part: "MAIN BODY", locations: ["FRONT", "BACK"] },
          { callout: 0, colorway: "-A", description: "BLACK SMOOTH LEATHER 1.2MM", part: "TRIM", locations: ["TRIM", "STRAP"] },
          { callout: 0, colorway: "", description: "#5 METAL ZIPPER", part: "ZIP", locations: [] }, // not a material
        ],
      },
      { "materials.list": [{ callout: 1, name: "MICRO MESH", locations: ["FRONT"] }] },
      "cm",
      new Map(),
      ["-A"],
    );
    expect(values["materials.list"]).toEqual([
      { callout: 1, name: "MICRO MESH", locations: ["FRONT"] },
      { callout: 2, name: "TRIM MTL", locations: ["TRIM", "STRAP"] },
    ]);
    expect(values["materials.matrix"]).toEqual({ "-A": { mat_1: { text: "BLACK NYLON MICRO MESH" }, mat_2: { text: "BLACK SMOOTH LEATHER 1.2MM" } } });
  });
});
