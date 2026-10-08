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
