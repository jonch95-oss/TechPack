import { describe, expect, it } from "vitest";
import { TRADE_ZH, DEFAULT_GLOSSARY } from "@/lib/zh/dictionary";
import { hasCjk, needsChinese, wordTranslate } from "@/lib/zh/words";

const dict = new Map<string, string>([...Object.entries(TRADE_ZH), ...DEFAULT_GLOSSARY]);
const protect = new Set(["JUNFA", "JODIE", "PINK", "LONDON"]);
const t = (s: string) => wordTranslate(s, dict, protect);

describe("Chinese, term by term", () => {
  it("translates trade lines and keeps codes, numbers and names", () => {
    expect(t("EDGE PAINT")).toBe("边油");
    expect(t("MATERIAL / COLOR BREAKDOWN")).toBe("材料/颜色明细");
    expect(t("TOP HANDLE DROP HEIGHT: 6.5 CM")).toBe("手挽高度: 6.5 CM");
    const junfa = t("JUNFA LEATHER SMOOTH PU / #2 IRIDESCENT BLACK");
    expect(junfa).toContain("JUNFA");
    expect(junfa).toContain("#2");
    expect(junfa).toContain("幻彩");
    expect(t("FRONT FLAP SNAP CLOSURE")).toBe("前幅翻盖扣开合");
    expect(hasCjk(t("YOU WILL RECEIVE A PHYSICAL SAMPLE IN SIMILAR"))).toBe(true);
  });

  it("knows which lines need Chinese", () => {
    expect(needsChinese("PINK013-A", protect)).toBe(false);
    expect(needsChinese("16 CM", protect)).toBe(false);
    expect(needsChinese("PINK LONDON", protect)).toBe(false);
    expect(needsChinese("PANTONE 203 C", protect)).toBe(true);
    expect(needsChinese("SHINY CHAMPAGNE GOLD", protect)).toBe(true);
  });
});
