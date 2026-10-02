import { describe, expect, it } from "vitest";
import { assignRows, cleanFinish, partType, realCode, resolveParts, type LibPart, type SheetPart } from "@/lib/hardware-match";
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

describe("spec parts merge into the render's rows (round 6, item 2)", () => {
  // OW-BSHO-90004: the render pre-fill made these rows; the spec then listed its parts.
  const renderRows = [
    { qty: 1, placement: "FRONT CENTRE", seen: "ARROWS LOGO PLATE" },
    { qty: 1, placement: "STRAP", seen: "SQUARE PRONG BUCKLE" },
    { qty: 1, placement: "FRONT POCKET LEFT", seen: "RING PULL" },
    { qty: 1, placement: "FRONT POCKET RIGHT", seen: "RING PULL" },
    { qty: 1, placement: "FRONT POCKET LEFT", seen: "ZIPPER SLIDER" },
    { qty: 1, placement: "FRONT POCKET RIGHT", seen: "ZIPPER SLIDER" },
    { qty: 1, placement: "TOP CORNERS", seen: "STRAP ANCHOR" },
  ];
  const types: Record<string, string> = { p: "LOGO PLATE", b: "BUCKLE", z: "ZIPPER PULL", s: "ZIPPER SLIDER", r: "SQUARE RING", e: "EYELET" };
  const part = (id: string, description: string, size: string, location = "", qty: number | null = null) => ({ type: types[id], size, item: { id, label: id.toUpperCase() }, description, location, qty });
  const parts = [
    part("p", "ARROWS LOGO PLATE", "50 X 32 MM", "FRONT CENTRE"),
    part("b", "SQUARE PRONG BUCKLE", "INNER 40 MM", "STRAP"),
    part("r", "RECTANGULAR STRAP RING", "40 X 15 MM", "BOTH TOP CORNERS"),
    part("z", "RING ZIP PULL", "", "FRONT POCKET ZIPS"),
    part("s", "#5 SLIDER", "", "FRONT POCKET ZIPS"),
    part("e", "METAL EYELET", "DIA 8 MM", "FRONT"),
  ];
  const out = assignRows(renderRows, parts, (id) => types[id]) as { item?: { id: string }; qty?: number; size?: string; seen?: string }[];

  it("links every row — strap anchor = square ring, both ring-pull rows = the zip pull — and adds only what the render missed", () => {
    expect(out.map((r) => r.item?.id ?? null)).toEqual(["p", "b", "z", "z", "s", "s", "r", "e"]);
    expect(out.filter((r) => !r.item)).toHaveLength(0);
  });
  it("square ring is qty 2 (both top corners) with the spec size", () => {
    expect(out[6]).toMatchObject({ qty: 2, size: "40 X 15 MM", seen: "STRAP ANCHOR" });
    expect(out[2].qty).toBe(1); // a part on two rows keeps each row's own qty
  });
  it("location decides between rows of the same type", () => {
    const two = [
      { qty: 1, placement: "BACK", seen: "D-RING" },
      { qty: 1, placement: "STRAP END", seen: "D-RING" },
    ];
    const r = assignRows(two, [{ type: "D-RING", size: "20 MM", item: { id: "d", label: "D" }, description: "D-RING", location: "STRAP END", qty: 2 }], () => "D-RING") as { item?: { id: string }; qty?: number }[];
    expect(r[1]).toMatchObject({ item: { id: "d" } });
  });
  it("blank rows are dropped", () => {
    expect(assignRows([{ qty: 1 }], [parts[0]], (id) => types[id])).toHaveLength(1);
  });
});

describe("finish is a value, never a note (round 6, item 1)", () => {
  it("pulls the finish out of a note and flags it", () => {
    expect(cleanFinish("NOT STATED ON SPEC SHEET — CONFIRM (GUNMETAL PER RENDER)")).toEqual({ value: "GUNMETAL", ai: true, note: "FINISH: NOT STATED ON SPEC SHEET — CONFIRM (GUNMETAL PER RENDER)" });
    expect(cleanFinish("TBC").value).toBe("");
    expect(cleanFinish("black nickel")).toEqual({ value: "BLACK NICKEL", ai: false, note: "" });
    expect(cleanFinish("GUNMETAL", false)).toMatchObject({ value: "GUNMETAL", ai: true });
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
