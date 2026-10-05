import { describe, expect, it } from "vitest";
import { remapAnswers, remapTag, removeColorway } from "@/lib/colorways";

describe("colourways follow their data (V2 §3 step 2)", () => {
  it("removing -B re-letters -C to -B and moves its data", () => {
    const { next, map } = removeColorway(["-A", "-B", "-C"], "-B");
    expect(next).toEqual(["-A", "-B"]);
    expect(map).toEqual({ "-B": null, "-A": "-A", "-C": "-B" });
    const answers = {
      "materials.matrix": { "-A": { mat_1: { text: "BLACK" } }, "-B": { mat_1: { text: "PINK" } }, "-C": { mat_1: { text: "NUDE" } } },
      "colorways.names": { "-A": "BLACK", "-B": "PINK", "-C": "NUDE" },
      "dims.h": 16,
      "hardware.items": [{ qty: 1 }],
    };
    expect(remapAnswers(answers, map)).toEqual({
      "materials.matrix": { "-A": { mat_1: { text: "BLACK" } }, "-B": { mat_1: { text: "NUDE" } } },
      "colorways.names": { "-A": "BLACK", "-B": "NUDE" },
    });
  });

  it("uploads tagged with a colourway move with it; ones for a removed colourway are dropped", () => {
    const { map } = removeColorway(["-A", "-B", "-C"], "-B");
    expect(remapTag("-C", map)).toBe("-B");
    expect(remapTag("2|-C", map)).toBe("2|-B");
    expect(remapTag("2|-B", map)).toBeNull();
    expect(remapTag("FRONT", map)).toBe("FRONT");
  });
});
