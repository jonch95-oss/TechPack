import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TECHNICAL_DESIGNER_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { buildAnalyseInstructions, normaliseAiAnswers, type AnalyseRenderOutput } from "@/lib/ai/analyse-render";
import { normaliseChipBox } from "@/lib/ai/read-swatch";

describe("Technical Designer agent", () => {
  it("uses the Part 2 system prompt verbatim", () => {
    const brief = readFileSync("docs/BRIEF.md", "utf8");
    const start = brief.indexOf("## PART 2");
    const a = brief.indexOf("```\n", start) + 4;
    const b = brief.indexOf("```", a);
    expect(TECHNICAL_DESIGNER_SYSTEM_PROMPT).toBe(brief.slice(a, b).replace(/\n$/, ""));
  });

  const fixture = JSON.parse(readFileSync("tests/fixtures/ai/analyse_render.PINK013.json", "utf8")) as AnalyseRenderOutput;
  const hw = new Map([
    ["PINK003", { id: "00000000-0000-0000-0000-000000000003", label: "PINK003" }],
    ["PINK005", { id: "00000000-0000-0000-0000-000000000005", label: "PINK005" }],
  ]);

  it("tags measurements EST, hidden features INFERRED, the rest AI-suggested", () => {
    const { answers } = normaliseAiAnswers("Handbags", fixture, hw);
    const by = Object.fromEntries(answers.map((a) => [a.questionId, a]));
    expect(by["dims.h"].status).toBe("est");
    expect(by["hb.top_handle.drop"].status).toBe("est");
    expect(by["hb.closure"].status).toBe("inferred");
    expect(by["interior.lined"].status).toBe("inferred");
    expect(by["hb.silhouette"]).toMatchObject({ status: "ai", value: "SATCHEL", note: "BOXY SATCHEL BODY WITH FRONT FLAP" });
    expect(by["hb.charm.code"].value).toEqual({ id: "00000000-0000-0000-0000-000000000003", label: "PINK003" });
  });

  it("drops values that don't fit the question", () => {
    const { answers, dropped } = normaliseAiAnswers("Handbags", fixture, hw);
    expect(answers.find((a) => a.questionId === "hb.feet")).toBeUndefined();
    expect(dropped.join()).toContain("hb.feet");
  });

  it("numbers detected materials as callouts", () => {
    const { materials } = normaliseAiAnswers("Handbags", fixture, hw);
    expect(materials).toEqual([{ callout: 1, name: "MAIN BODY MTL", locations: ["FRONT", "BACK", "FLAP", "GUSSET", "STRAP", "HANDLE"] }]);
  });

  it("instructions list the category questions and the brand hardware", () => {
    const text = buildAnalyseInstructions({ category: "Handbags", brand: "Pink London", styleNo: "PINK013", styleName: "JODIE", colorways: ["-A", "-B"], hardwareLibrary: [{ code: "PINK005", type: "LOGO PLATE", name: "" }] });
    expect(text).toContain("hb.closure");
    expect(text).toContain("PINK005");
    expect(text).not.toContain("opt.stitching");
  });

  it("clamps the swatch chip box", () => {
    expect(normaliseChipBox({ found: true, x: 0.9, y: 0.5, w: 0.3, h: 0.1 })).toEqual({ x: 0.9, y: 0.5, w: expect.closeTo(0.1, 5), h: 0.1 });
    expect(normaliseChipBox({ found: false, x: 0, y: 0, w: 0, h: 0 })).toBeNull();
  });
});
