import { describe, expect, it } from "vitest";
import { specItems } from "@/lib/pdf/specs";

describe("show secondary unit in brackets", () => {
  it("prints each pack dimension with the other unit, and not the setting itself", () => {
    const items = specItems("Handbags", { "dims.unit": "CM", "dims.h": 16, "dims.w": 20, "dims.show_secondary": true });
    expect(items.find((i) => i.qid === "dims.h")?.lines).toEqual(['16 CM (6.3")']);
    expect(items.find((i) => i.qid === "dims.w")?.lines).toEqual(['20 CM (7.87")']);
    expect(items.some((i) => i.qid === "dims.show_secondary")).toBe(false);
  });
  it("inch packs bracket the centimetres; off by default", () => {
    expect(specItems("Handbags", { "dims.unit": "INCHES", "dims.h": 6.25, "dims.show_secondary": true }).find((i) => i.qid === "dims.h")?.lines).toEqual(['6.25" (15.88 CM)']);
    expect(specItems("Handbags", { "dims.unit": "CM", "dims.h": 16 }).find((i) => i.qid === "dims.h")?.lines).toEqual(["16 CM"]);
  });
});

describe("breakdown colour / print", () => {
  it("prints each material with its Pantone or print", () => {
    const items = specItems("Handbags", {
      "materials.list": [{ callout: 1, name: "MAIN BODY", locations: ["BODY"] }],
      "materials.matrix": { "-A": { mat_1: { text: "NYLON", colour: { text: "PANTONE 11-1111 TCX" } } }, "-B": { mat_1: { text: "SAFFIANO PU", colour: { lib: { id: "x", label: "WISTERIA FLORAL" } } } } },
    });
    expect(items.find((i) => i.qid === "materials.matrix")?.lines).toEqual(["-A: NYLON / PANTONE 11-1111 TCX", "-B: SAFFIANO PU / WISTERIA FLORAL"]);
  });
});

describe("cosmetic multi-piece set", () => {
  it("asks for the pieces only when the set switch is on, and prints them", async () => {
    const { visibleQuestions } = await import("@/lib/questions");
    const ids = (a: Record<string, unknown>) => visibleQuestions({ category: "Cosmetic bags", answers: a }).map((q) => q.id);
    expect(ids({})).not.toContain("cos.set_pieces");
    expect(ids({ "cos.is_set": true })).toContain("cos.set_pieces");
    const items = specItems("Cosmetic bags", {
      "dims.unit": "INCHES",
      "cos.is_set": true,
      "cos.set_pieces": [{ piece: "LARGE POUCH", qty: 1, h: 6, w: 9, d: 3 }, { piece: "FLAT POUCH", qty: 2, h: 4, w: 6 }],
    });
    expect(items.find((i) => i.qid === "cos.set_pieces")?.lines).toEqual(['LARGE POUCH · 1 · 6" · 9" · 3"', 'FLAT POUCH · 2 · 4" · 6"']);
  });
});
