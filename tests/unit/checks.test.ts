import { describe, expect, it } from "vitest";
import { accentFindings, chipFindings, colourNameFindings, finishFindings, flatDimFindings, hiddenTextFindings, seeNextPageFindings, setPieceFindings, textureFindings } from "@/lib/checks";
import { spellcheckText } from "@/lib/spellcheck/core";

const svg = (label: string, x2: number) =>
  `<svg><g id="dimensions" data-paper-data='{"pxPerUnit":10,"unit":"cm"}'><g data-paper-data='{"kind":"dim","key":"w","label":"","x1":0,"y1":0,"x2":${x2},"y2":0,"offset":0}'><path d="M0 0L${x2} 0"/><text x="1" y="1">${label}</text></g></g></svg>`;

describe("V2.1 §11 — consistency checks from real packs", () => {
  it("a dimension that reads differently from its line, or from the entered size", () => {
    expect(flatDimFindings("FRONT", svg("20 CM", 200), { w: 20 })).toEqual([]);
    expect(flatDimFindings("FRONT", svg("22 CM", 200), { w: 20 }).map((f) => f.rule)).toEqual(["FRONT dimension reads 22 but its line measures 20", "FRONT W dimension reads 22, entered 20"]);
  });
  it("hidden or leftover text layers", () => {
    expect(hiddenTextFindings("FRONT", `<svg><text style="display:none">OLD</text><text> </text><text>OK</text></svg>`)[0].rule).toBe("FRONT: 2 hidden or leftover text layers");
    expect(hiddenTextFindings("FRONT", `<svg><text>OK</text></svg>`)).toEqual([]);
  });
  it("SEE NEXT PAGE with no next page", () => {
    expect(seeNextPageFindings([{ letter: "A", text: "SEE NEXT PAGE FOR DETAIL", lastPage: 6 }, { letter: "B", text: "SEE NEXT PAGE", lastPage: 3 }], 6).map((f) => f.rule)).toEqual(['Comment A says "SEE NEXT PAGE" but there is no next page']);
  });
  it("one Pantone code, two names", () => {
    expect(colourNameFindings(["17-1563 TCX CHERRY TOMATO, 19-4005 TCX BLACK", "17-1563 TCX TOMATO RED"])[0].rule).toBe("17-1563 TCX is named CHERRY TOMATO and TOMATO RED");
    expect(colourNameFindings(["17-1563 TCX CHERRY TOMATO", "17-1563 TCX CHERRY TOMATO"])).toEqual([]);
  });
  it("a chip number that doesn't match the card", () => {
    expect(chipFindings([{ colorway: "-A", column: "MATERIAL 1", text: "#12 FROM SWATCH CARD", cardShade: "#14" }])).toHaveLength(1);
    expect(chipFindings([{ colorway: "-A", column: "MATERIAL 1", text: "#12 FROM SWATCH CARD", cardShade: "12" }])).toHaveLength(0);
  });
  it("a set piece without a dimension", () => {
    expect(setPieceFindings([{ piece: "CUBE", size: "L", l: 30, w: 20 }, { piece: "POUCH", size: "S" }]).map((f) => f.rule)).toEqual(["Set piece S POUCH has no dimension label"]);
  });
  it("finish conflict between the pack and a part's record", () => {
    expect(finishFindings("LIGHT GOLD", [{ code: "X1", finish: "GUNMETAL" }, { code: "X2", finish: "SHINY CHAMPAGNE GOLD" }]).map((f) => f.rule)).toEqual(["Finish LIGHT GOLD conflicts with X1 (GUNMETAL)"]);
  });
  it("material described against its card's texture", () => {
    expect(textureFindings([{ callout: 1, name: "SMOOTH PU", card: "PEBBLE GRAIN PU" }])).toHaveLength(1);
    expect(textureFindings([{ callout: 1, name: "SMOOTH PU", card: "SMOOTH PU MIRROR" }])).toHaveLength(0);
  });
  it("interior vs exterior accents (info only)", () => {
    const f = accentFindings([{ name: "INTERIOR STITCHING", values: { "-A": "RED" } }, { name: "STITCHING", values: { "-A": "BLACK" } }]);
    expect(f).toEqual([expect.objectContaining({ info: true })]);
  });
});

describe("V2.1 §11 — spell-check", () => {
  const english = (w: string) => ["COLOR", "PRINT", "SCREEN", "MEN'S", "BAG", "LOGO", "BODY"].includes(w.toUpperCase());
  const flags = (t: string) => spellcheckText(t, english, () => []);
  it("corrects the typos found in real packs", () => {
    expect(flags("SCREEPRINT LOGO")).toEqual([expect.objectContaining({ word: "SCREEPRINT", suggestion: "SCREENPRINT" })]);
    expect(flags("RIPTSTOP BODY")[0]).toMatchObject({ word: "RIPTSTOP", suggestion: "RIPSTOP" });
    expect(flags("MENS BAG")[0]).toMatchObject({ word: "MENS", suggestion: "MEN'S" });
    expect(flags("MULTI- COLOR")).toEqual([expect.objectContaining({ word: "MULTI- COLOR", suggestion: "MULTI-COLOR" })]);
  });
  it("accepts the trade terms", () => {
    expect(flags("RIPSTOP WETPOUCH MULTI-COLOR SWIFTACH FPO TRAPUNTO BEVELED KNOCK-OUT TCX PMS")).toEqual([]);
  });
});
