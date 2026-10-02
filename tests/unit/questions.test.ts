import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  allQuestions,
  completeness,
  draftDescription,
  matrixColumns,
  sectionsFor,
  visibleQuestions,
  type AnswerMap,
} from "@/lib/questions";

describe("question bank", () => {
  it("every category has the common block plus its own questions, with unique ids", () => {
    for (const c of CATEGORIES) {
      const ids = allQuestions(c).map((q) => q.id);
      expect(new Set(ids).size, c).toBe(ids.length);
      expect(ids).toContain("header.due_date");
      expect(sectionsFor(c).length).toBeGreaterThan(3);
    }
  });

  it("every chip question has options and every showIf points at a real question", () => {
    for (const c of CATEGORIES) {
      const ids = new Set(allQuestions(c).map((q) => q.id));
      for (const q of allQuestions(c)) {
        if (q.kind === "chips" || q.kind === "multi") expect(q.options.length, q.id).toBeGreaterThan(0);
        if (q.showIf && "q" in q.showIf && !q.showIf.q.startsWith("$")) expect(ids.has(q.showIf.q), `${c} ${q.id} → ${q.showIf.q}`).toBe(true);
      }
    }
  });

  it("handbag strap sub-questions appear only when the strap toggle is on", () => {
    const off = visibleQuestions({ category: "Handbags", answers: { "hb.strap": false } }).map((q) => q.id);
    expect(off).not.toContain("hb.strap.length");
    const on = visibleQuestions({ category: "Handbags", answers: { "hb.strap": true } }).map((q) => q.id);
    expect(on).toContain("hb.strap.length");
    expect(on).toContain("hb.strap.attachment");
  });

  it("nested conditions hide grandchildren when the parent is hidden", () => {
    const a: AnswerMap = { "hb.strap": false, "hb.strap.adjustable": true, "hb.strap.adjust_method": "HOLES" };
    const ids = visibleQuestions({ category: "Handbags", answers: a }).map((q) => q.id);
    expect(ids).not.toContain("hb.strap.holes");
  });

  it("men's Dopp kit routes to the cosmetic / toiletry questions", () => {
    const ids = visibleQuestions({ category: "Men's bags", answers: { "men.type": "DOPP KIT" } }).map((q) => q.id);
    expect(ids).toContain("cos.zip_size");
    expect(visibleQuestions({ category: "Men's bags", answers: { "men.type": "BRIEFCASE" } }).map((q) => q.id)).not.toContain("cos.zip_size");
  });

  it("licensor fields are required for Ted Baker / Champion brands and coolers", () => {
    const ids = (brand: boolean) => visibleQuestions({ category: "Toiletry kits", answers: {}, brand: { licensorRequired: brand } }).map((q) => q.id);
    expect(ids(true)).toContain("header.licensor");
    expect(ids(false)).not.toContain("header.licensor");
    expect(visibleQuestions({ category: "Coolers / insulated", answers: {} }).map((q) => q.id)).toContain("header.licensor");
  });

  it("completeness flags AI / EST answers until confirmed and blank matrix cells", () => {
    const answers: AnswerMap = {
      "dims.h": 16,
      "materials.list": [{ callout: 1, name: "MAIN BODY MTL", locations: [] }],
      "materials.matrix": { "-A": { mat_1: { text: "DTM" } } },
    };
    const issues = completeness({ category: "Handbags", answers }, { "dims.h": "est" }, ["-A", "-B"]);
    expect(issues.find((i) => i.questionId === "dims.h")?.problem).toBe("EST — CONFIRM");
    expect(issues.some((i) => i.label === "-B × MAIN BODY MTL")).toBe(true);
    expect(issues.some((i) => i.label === "-A × MAIN BODY MTL")).toBe(false);
  });

  it("matrix columns follow the brief: materials, lining, edge paint, zipper if any, hardware & snap, logo", () => {
    const cols = matrixColumns({ category: "Handbags", answers: { "materials.list": [{ callout: 1, name: "MAIN BODY MTL", locations: [] }] } }).map((c) => c.key);
    expect(cols).toEqual(["mat_1", "lining", "edge_paint", "hardware_finish", "logo"]);
    const dopp = matrixColumns({ category: "Toiletry kits", answers: {} }).map((c) => c.key);
    expect(dopp).toContain("zipper");
  });

  it("drafts the PINK013 description", () => {
    expect(draftDescription("Handbags", { "hb.silhouette": "SATCHEL", "hb.closure": "FLAP + MAGNETIC SNAP", "hb.strap": true })).toBe(
      "SHOULDER BAG SATCHEL W/ FLAP & LONG SHOULDER STRAP",
    );
  });
});
