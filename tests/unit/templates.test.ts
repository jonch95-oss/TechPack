import { describe, expect, it } from "vitest";
import { readMeta } from "@/lib/lineart/geometry";
import { templateFlat, templateFor } from "@/lib/lineart/templates";

describe("V2 §8 — line-art fallback: silhouette template flats", () => {
  it("picks a template by category and silhouette", () => {
    expect(templateFor("Handbags", "TOTE")).toEqual({ shape: "TRAPEZOID", handle: true });
    expect(templateFor("Handbags", "HOBO")).toEqual({ shape: "HALF_MOON", handle: false });
    expect(templateFor("Handbags", "SATCHEL")).toEqual({ shape: "RECT", handle: true });
    expect(templateFor("Hardside luggage", "")).toEqual({ shape: "CASE", handle: true });
    expect(templateFor("SLGs", "CARD CASE")).toEqual({ shape: "RECT", handle: false });
  });
  it("draws the body at the entered W × H (the outline box), with outline, stitch line and handle", () => {
    const svg = templateFlat({ view: "FRONT", unit: "cm", w: 20, h: 16, shape: "RECT", handle: true });
    const m = readMeta(svg);
    expect(m.view).toBe("FRONT");
    expect(m.bbox!.w / m.bbox!.h).toBeCloseTo(20 / 16, 3);
    expect(svg).toMatch(/<g id="outline"[^>]*>.*<path d="M[^"]+Z"\/><path d="M[^"]*A/);
    expect(svg).toMatch(/<g id="stitching"[^>]*><path d="M/);
  });
});
