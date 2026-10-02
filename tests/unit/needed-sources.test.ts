import { describe, expect, it } from "vitest";
import { neededFromYou } from "@/lib/needed";
import { normaliseSource } from "@/lib/ai/read-source";

/** The Off-White micro-mesh shoulder bag straight after pre-fill (round 3's structured rows). */
const ow = {
  "dims.unit": "CM",
  "dims.h": 18,
  "dims.w": 25,
  "dims.d": 7,
  "hb.ext_pockets": [
    { type: "ZIP POCKET", position: "FRONT", detail: "CURVED, RING PULL" },
    { type: "ZIP POCKET", position: "FRONT", detail: "CURVED, RING PULL" },
  ],
  "zippers.list": [
    { position: "FRONT POCKET", size: "#5", type: "METAL" },
    { position: "FRONT POCKET", size: "#5", type: "METAL" },
  ],
  "hardware.items": [
    { qty: 1, seen: "ARROWS PLATE (LOGO PLATE)" },
    { qty: 1, seen: "SQUARE PRONG BUCKLE" },
    { qty: 2, seen: "RING ZIP PULL (ZIPPER PULL)" },
    { qty: 2, seen: "RECTANGULAR STRAP RING (SQUARE RING)" },
    { qty: 1, seen: "EYELET" },
  ],
  "hb.strap": true,
  "materials.list": [{ callout: 1, name: "MICRO MESH", locations: ["FRONT", "BACK"] }],
};
const st = { "dims.h": "est", "dims.w": "est", "dims.d": "est", "hb.ext_pockets": "ai", "hardware.items": "ai", "zippers.list": "ai", "hb.strap": "ai" };

describe("Needed from you (round 4, item 1)", () => {
  const { items, counts } = neededFromYou({ category: "Handbags", answers: ow, statuses: st, colorways: ["-A"] });
  const labels = items.map((i) => i.label);

  it("lists every fact the render can't give, from what the AI saw", () => {
    expect(labels).toEqual(
      expect.arrayContaining([
        "OVERALL SIZE — H × W × D",
        "FRONT ZIP POCKET 1 — POCKET SIZE (W × H)",
        "FRONT ZIP POCKET 1 — ZIP OPENING LENGTH",
        "FRONT ZIP POCKET 2 — POCKET SIZE (W × H)",
        "FRONT ZIP POCKET 2 — ZIP OPENING LENGTH",
        "SQUARE PRONG BUCKLE — INNER WIDTH",
        "RECTANGULAR STRAP RING (SQUARE RING) — INNER SIZE (W × H)",
        "ARROWS PLATE (LOGO PLATE) — W × H",
        "EYELET — DIAMETER",
        "STRAP WIDTH",
        "STRAP TOTAL LENGTH",
        "STRAP ADJUSTMENT RANGE (SHORTEST – LONGEST)",
        "MICRO MESH (-A) — SWATCH / MATERIAL",
      ]),
    );
    expect(labels.some((l) => /ZIP PULL.*—.*(SIZE|LENGTH)/.test(l))).toBe(false); // pulls come with their drawing
  });

  it("each line jumps to its field and row", () => {
    expect(items.find((i) => i.label === "FRONT ZIP POCKET 2 — ZIP OPENING LENGTH")).toMatchObject({ questionId: "zippers.list", row: 1 });
    expect(items.find((i) => i.label === "SQUARE PRONG BUCKLE — INNER WIDTH")).toMatchObject({ questionId: "hardware.items", row: 1 });
    expect(items.find((i) => i.label === "STRAP WIDTH")).toMatchObject({ questionId: "hb.strap.width" });
  });

  it("counts measurements / materials / hardware", () => {
    expect(counts).toEqual({ measurement: 12, material: 1, hardware: 5 });
  });

  it("drops lines as they are answered", () => {
    const done = neededFromYou({
      category: "Handbags",
      answers: { ...ow, "hardware.items": (ow["hardware.items"] as object[]).map((r) => ({ ...r, size: "25 MM" })) },
      statuses: { ...st, "dims.h": "confirmed", "dims.w": "confirmed", "dims.d": "sourced" },
      colorways: ["-A"],
    });
    expect(done.items.map((i) => i.label)).not.toContain("OVERALL SIZE — H × W × D");
    expect(done.items.filter((i) => /INNER|DIAMETER|W × H$/.test(i.label) && !/POCKET/.test(i.label))).toEqual([]);
  });
});

describe("read_source mapping (round 4, item 2)", () => {
  const hw = new Map<string, { id: string; label: string }>();
  it("spec sheet: H × W × D, points of measure, pocket and zip sizes, hardware sizes — in the pack unit", () => {
    const { values, dropped } = normaliseSource(
      "Handbags",
      {
        answers: [
          { question_id: "dims.h", value_json: "180", unit: "MM", note: "SPEC: HEIGHT 180MM" },
          { question_id: "hb.strap.width", value_json: "1.5", unit: "IN", note: "" },
          { question_id: "not.a.question", value_json: "1", unit: "", note: "" },
        ],
        row_values: [
          { question_id: "hb.ext_pockets", row: 0, column: "w", value_json: "15", unit: "CM", note: "" },
          { question_id: "zippers.list", row: 1, column: "length", value_json: "140", unit: "MM", note: "" },
          { question_id: "hardware.items", row: 1, column: "size", value_json: "\"inner 25 mm\"", unit: "", note: "" },
          { question_id: "zippers.list", row: 7, column: "length", value_json: "1", unit: "CM", note: "" },
        ],
        new_rows: [],
        measurements: [
          { point: "TOTAL WIDTH", value: 250, unit: "MM", tolerance: 5, how: "at base" },
          { point: "STRAP DROP", value: 55, unit: "CM", tolerance: null, how: "" },
        ],
        hardware: [],
        board_notes: [],
        notes: "",
      },
      ow,
      "cm",
      hw,
    );
    expect(values["dims.h"]).toBe(18);
    expect(values["dims.w"]).toBe(25); // from the TOTAL WIDTH point of measure
    expect(values["hb.strap.width"]).toBe(3.8);
    expect((values["hb.ext_pockets"] as { w?: number }[])[0].w).toBe(15);
    expect((values["zippers.list"] as { length?: number }[])[1].length).toBe(14);
    expect((values["hardware.items"] as { size?: string }[])[1].size).toBe("INNER 25 MM");
    expect(values["pom.list"]).toEqual([
      { point: "TOTAL WIDTH", value: 25, tol: 0.5, how: "AT BASE" },
      { point: "STRAP DROP", value: 55, how: "" },
    ]);
    expect(dropped.join()).toMatch(/not\.a\.question/);
    expect(dropped.join()).toMatch(/zippers\.list\[7\]/);
  });

  it("interior photo: adds the pockets it sees as new rows", () => {
    const { values } = normaliseSource(
      "Handbags",
      { answers: [], row_values: [], new_rows: [{ question_id: "interior.pockets", row_json: JSON.stringify({ type: "slip pocket", wall: "back wall" }), unit: "", note: "SEEN ON INTERIOR PHOTO" }], measurements: [], hardware: [], board_notes: [], notes: "" },
      ow,
      "cm",
      hw,
    );
    expect(values["interior.pockets"]).toEqual([{ type: "SLIP POCKET", wall: "BACK WALL" }]);
  });
});
