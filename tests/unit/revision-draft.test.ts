import { describe, expect, it } from "vitest";
import { buildDraftInstructions, normaliseDraft } from "@/lib/revision-draft";

describe("V2 §9 — factory comments drafted into changes", () => {
  const answers = { "dims.h": 16, "dims.w": 20, "hb.silhouette": "SATCHEL" };
  it("keeps changes the pack can take, linked to their comment; drops unknown ids, bad JSON, no-ops and repeats", () => {
    const r = normaliseDraft("Handbags", answers, {
      changes: [
        { comment: "bag 1cm taller", question_id: "dims.h", value_json: "17", note: "per factory" },
        { comment: "again", question_id: "dims.h", value_json: "18", note: "" },
        { comment: "same", question_id: "dims.w", value_json: "20", note: "" },
        { comment: "x", question_id: "lug.size", value_json: "\"20\"", note: "" },
        { comment: "y", question_id: "hb.silhouette", value_json: "tote", note: "" },
      ],
      unmapped: ["looks good"],
      agent_notes: "",
    });
    expect(r.proposals).toEqual([{ comment: "BAG 1CM TALLER", questionId: "dims.h", value: 17, note: "PER FACTORY" }]);
    expect(r.dropped).toEqual(["dims.h", "lug.size", "hb.silhouette"]);
    expect(r.unmapped).toEqual(["LOOKS GOOD"]);
  });
  it("tells the AI never to invent a number the comment doesn't give", () => {
    const t = buildDraftInstructions("Handbags", answers, "STRAP LONGER");
    expect(t).toMatch(/never invent a measurement/);
    expect(t).toContain("STRAP LONGER");
  });
});
