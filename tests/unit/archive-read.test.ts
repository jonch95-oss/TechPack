import { describe, expect, it } from "vitest";
import { buildArchiveInstructions, normaliseArchive, pdfPageCount, type ReadArchiveOutput } from "@/lib/archive-read";

describe("V2 §7 — archive importer", () => {
  it("counts a PDF's pages from its page objects", () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Pages /Kids [2 0 R 3 0 R] >>\n2 0 obj << /Type /Page >>\n3 0 obj << /Type/Page /Parent 1 0 R >>\n%%EOF", "latin1");
    expect(pdfPageCount(pdf)).toBe(2);
  });
  it("keeps only answers the category asks, parsed; drops the rest by id", () => {
    const out: ReadArchiveOutput = {
      brand: "acme",
      category: "handbags",
      style_no: "abc 101",
      style_name: "city tote",
      colorways: [{ code: "A", name: "black" }, { code: "-B", name: "red" }],
      answers: [
        { question_id: "dims.h", value_json: "16", note: "front view" },
        { question_id: "hb.silhouette", value_json: "\"tote\"", note: "" },
        { question_id: "lug.size", value_json: "\"20\"", note: "" },
        { question_id: "dims.w", value_json: "not json", note: "" },
      ],
      hardware: [{ code: "ac01", type: "d-ring", name: "", dims_mm: "20 x 15", material: "", finish: "gold" }, { code: "", type: "x", name: "", dims_mm: "", material: "", finish: "" }],
      materials: [],
      agent_notes: "",
    };
    const r = normaliseArchive(out);
    expect(r).toMatchObject({ brand: "ACME", category: "Handbags", styleNo: "ABC101", styleName: "CITY TOTE", colorways: [{ code: "-A", name: "BLACK" }, { code: "-B", name: "RED" }] });
    expect(r.answers).toEqual([{ questionId: "dims.h", value: 16, note: "FRONT VIEW" }, { questionId: "hb.silhouette", value: "TOTE", note: "" }]);
    expect(r.dropped).toEqual(["lug.size", "dims.w"]);
    expect(r.hardware).toEqual([{ code: "AC01", type: "D-RING", name: "", dims_mm: "20 X 15", material: "", finish: "GOLD" }]);
  });
  it("tells the read to state only what the pack states and never contact details", () => {
    const t = buildArchiveInstructions(["ACME"]);
    expect(t).toMatch(/Never guess/);
    expect(t).toMatch(/Never return supplier bank, phone/);
    expect(t).toContain("dims.h — ");
  });
});
