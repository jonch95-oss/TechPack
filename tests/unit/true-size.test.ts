import { describe, expect, it } from "vitest";
import { numbersOf, trueSize } from "@/lib/pdf/true-size";

describe("component views at true size (V2.1 §7)", () => {
  it("reads numbers from any size label", () => {
    expect(numbersOf("DIA 8")).toEqual([8]);
    expect(numbersOf("40 X 15 X 5.5")).toEqual([40, 15, 5.5]);
    expect(numbersOf("")).toEqual([]);
  });
  it("W × H: drawn at the given width and height", () => {
    expect(trueSize("40 X 20", 2)).toEqual({ wMm: 40, hMm: 20, exact: true });
  });
  it("one dimension: the longer side is that size — no 40 mm fallback", () => {
    expect(trueSize("DIA 8", 1)).toEqual({ wMm: 8, hMm: 8, exact: true });
    expect(trueSize("50", 0.5)).toEqual({ wMm: 25, hMm: 50, exact: true });
  });
  it("no dimension: not to scale", () => {
    expect(trueSize("", 1).exact).toBe(false);
  });
});
