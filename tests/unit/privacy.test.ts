import { describe, expect, it } from "vitest";
import { printableCardRegion, scrubContact, scrubDeep } from "@/lib/privacy";
import { materialLabel } from "@/lib/material-label";

describe("V2.1 §10 — supplier card privacy", () => {
  it("drops contact and payment lines, in English and Chinese", () => {
    const raw = ["SMOOTH PU 0.85MM", "TEL: +86 138 0000 0000", "电话：0755-12345678", "BANK OF EXAMPLE A/C 6222 0000 0000 0000", "开户行：示例银行", "ADD: NO. 1 EXAMPLE ROAD", "地址：示例路1号", "WIDTH 138-140CM", "sales@example.com"].join("\n");
    const out = scrubContact(raw);
    expect(out).toContain("SMOOTH PU 0.85MM");
    expect(out).toContain("WIDTH 138-140CM");
    for (const bad of ["138 0000", "12345678", "6222", "示例银行", "EXAMPLE ROAD", "示例路", "sales@"]) expect(out).not.toContain(bad);
  });
  it("masks long digit runs in free text but keeps a field's article number", () => {
    expect(scrubContact("CALL 13800000000 FOR SAMPLES")).toBe("CALL [REDACTED] FOR SAMPLES");
    expect(scrubContact("AH3160012345", { numbers: false })).toBe("AH3160012345");
    expect(scrubDeep({ articleNo: "1234567890", raw_text: "1234567890", rows: [{ notes: "FAX 0755 1234 5678" }] })).toEqual({ articleNo: "1234567890", raw_text: "[REDACTED]", rows: [{ notes: "" }] });
  });
  it("prints a card from just above its chips; without a chip box the header band is dropped", () => {
    expect(printableCardRegion([{ x: 0.3, y: 0.5, w: 0.1, h: 0.1 }, { x: 0.1, y: 0.4, w: 0.1, h: 0.1 }])).toEqual({ x: 0, y: expect.closeTo(0.34, 5), w: 1, h: expect.closeTo(0.66, 5) });
    expect(printableCardRegion([null]).y).toBe(0.2);
  });
});

describe("V2.1 §10 — cross-brand F-codes and quality references", () => {
  const m = { supplier: "SUPPLIER", articleName: "RIPSTOP", colourNo: "12", colourName: "BLACK" };
  it("leads with the F-code and swatch number", () => {
    expect(materialLabel({ ...m, iconCode: "F-0001" })).toBe("F-0001 SWATCH #12 BLACK — SUPPLIER RIPSTOP");
    expect(materialLabel(m)).toBe("SUPPLIER RIPSTOP / #12 BLACK");
  });
  it("a quality reference names no colour", () => {
    expect(materialLabel({ ...m, qualityOnly: true })).toBe("SUPPLIER RIPSTOP (QUALITY REFERENCE)");
  });
});
