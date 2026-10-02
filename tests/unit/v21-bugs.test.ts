import { describe, expect, it } from "vitest";
import { unitLabel, visibleQuestions } from "@/lib/questions";

describe("V2.1 §5: Duffels keep their unit", () => {
  for (const category of ["Duffels", "Rolling duffels"] as const) {
    it(`${category}: dims.unit is asked and applies; H/W/D are not (L × W × H live in the duffel section)`, () => {
      const ids = visibleQuestions({ category, answers: {} }).map((q) => q.id);
      expect(ids).toContain("dims.unit");
      expect(ids).not.toContain("dims.h");
      expect(unitLabel("dim", { "dims.unit": "INCHES" })).toBe("in");
    });
  }
  it("handbags still ask H × W × D", () => {
    const ids = visibleQuestions({ category: "Handbags", answers: {} }).map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(["dims.unit", "dims.h", "dims.w", "dims.d"]));
  });
});
