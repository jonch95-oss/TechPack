import { describe, expect, it } from "vitest";
import { boardAnswers, normaliseBoard } from "@/lib/board-read";
import { buildAnalyseInstructions, normaliseAiAnswers, type AnalyseRenderOutput } from "@/lib/ai/analyse-render";

describe("V2.1 §11 — reading board text", () => {
  const board = normaliseBoard({
    board_text: ["please add binding to all seams", "(REFER TO SPEC)", "STYLE-002 RED"],
    refers_to_spec: false,
    reference: "",
    skus: [{ style: "style-001", colour: "black" }, { style: "STYLE-002", colour: "RED" }],
    colour_key: [{ chip: "1", component: "body", value: "pantone 19-4005 tcx" }],
    instructions: ["PLEASE SAMPLE IN THE LARGE SIZE"],
    only_notes: [{ style: "STYLE-002", feature: "contrast piping" }],
    actual_size: ["LOGO"],
    captions: ["REFERENCE FOR HANDLE SHAPE"],
    reference_product: true,
  });
  it("sorts the board into capitals, and finds PLEASE instructions in loose text too", () => {
    expect(board.refersToSpec).toBe(true);
    expect(board.instructions).toEqual(["PLEASE SAMPLE IN THE LARGE SIZE", "PLEASE ADD BINDING TO ALL SEAMS"]);
    expect(board.colourKey).toEqual([{ chip: "1", component: "BODY", value: "PANTONE 19-4005 TCX" }]);
    expect(board.referenceProduct).toBe(true);
  });
  it("suggests comments, colourway-scoped features and colourway names — never over what is there", () => {
    const pack = { styleNo: "STYLE", colorways: ["-A", "-B"], colorwayStyles: { "-A": "STYLE-001", "-B": "STYLE-002" } };
    const s = Object.fromEntries(boardAnswers(board, pack, { "comments.list": [{ text: "PLEASE SAMPLE IN THE LARGE SIZE", pages: ["OVERVIEW"] }] }).map((x) => [x.questionId, x.value]));
    expect(s["comments.list"]).toEqual([{ text: "PLEASE SAMPLE IN THE LARGE SIZE", pages: ["OVERVIEW"] }, { text: "PLEASE ADD BINDING TO ALL SEAMS", pages: ["OVERVIEW"] }]);
    expect(s["pages.features"]).toEqual([{ text: "CONTRAST PIPING", only: "-B" }]);
    expect(s["colorways.names"]).toEqual({ "-A": "BLACK", "-B": "RED" });
    expect(boardAnswers(board, pack, { "colorways.names": { "-A": "NOIR" } }).some((x) => x.questionId === "colorways.names")).toBe(false);
  });
});

describe("V2.1 §11 — reference products and several images", () => {
  it("a value read off a reference product is never a plain suggestion", () => {
    const out = { answers: [{ question_id: "hb.top_handle.drop", value_json: "12", basis: "seen", confidence: "high", note: "drop seen on reference product" }], materials: [], exterior_pockets: [], hardware: [], zippers: [], colorways: [], visible_features: [], not_visible: [], agent_notes: "" } as unknown as AnalyseRenderOutput;
    const a = normaliseAiAnswers("Handbags", out, new Map()).answers.find((x) => x.questionId === "hb.top_handle.drop");
    expect(a).toBeTruthy();
    {
      expect(a!.status).not.toBe("ai");
      expect(a!.confidence).toBe("low");
      expect(a!.note).toMatch(/TAKEN FROM REFERENCE PRODUCT — CONFIRM/);
    }
  });
  it("labels every image after the render", () => {
    const t = buildAnalyseInstructions({ category: "Handbags", brand: "B", styleNo: "S", styleName: "N", colorways: ["-A"], hardwareLibrary: [], extraImages: ["COLOURWAY -B RENDER", "REFERENCE PHOTO"] });
    expect(t).toContain("1 = THIS STYLE'S RENDER; 2 = COLOURWAY -B RENDER; 3 = REFERENCE PHOTO");
    expect(t).toMatch(/Never take a spec .* off a reference product/);
  });
});
