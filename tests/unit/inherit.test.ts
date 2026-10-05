import { describe, expect, it } from "vitest";
import { DEFAULT_GROUPS, inheritGroupOf, inherits, reseedColourways } from "@/lib/inherit";
import { rankSimilar } from "@/lib/similar-score";

describe("V2 §8 — New from…: inherit groups", () => {
  it("files every question into a group; category questions are BODY", () => {
    expect(inheritGroupOf("hb.closure.type")).toBe("BODY");
    expect(inheritGroupOf("dims.h")).toBe("DIMENSIONS");
    expect(inheritGroupOf("materials.matrix")).toBe("MATERIALS");
    expect(inheritGroupOf("interior.pockets")).toBe("INTERIOR");
    expect(inheritGroupOf("pkg.hangtag.size")).toBe("PACKAGING");
    expect(inheritGroupOf("optional.pkg.hangtag")).toBe("PACKAGING");
    expect(inheritGroupOf("comments.list")).toBe("COMMENTS");
  });
  it("never carries the due date; comments only when asked", () => {
    expect(inherits("header.due_date", DEFAULT_GROUPS)).toBe(false);
    expect(inherits("header.retailer", DEFAULT_GROUPS)).toBe(true);
    expect(inherits("comments.list", DEFAULT_GROUPS)).toBe(false);
    expect(inherits("comments.list", [...DEFAULT_GROUPS, "COMMENTS"])).toBe(true);
    expect(inherits("interior.lined", ["BODY"])).toBe(false);
  });
});

describe("V2 §8 — a new colourway of an existing style", () => {
  it("seeds each new colourway's breakdown row from the chosen one and names it", () => {
    const a = { "materials.matrix": { "-A": { mat_1: { text: "BLACK" }, edge_paint: { text: "DTM" } }, "-B": { mat_1: { text: "RED" } } }, "colorways.names": { "-A": "BLACK", "-B": "RED" }, "dims.h": 16 };
    const out = reseedColourways(a, "-A", [{ code: "-C", name: "navy" }]);
    expect(out["materials.matrix"]).toEqual({ "-C": { mat_1: { text: "BLACK" }, edge_paint: { text: "DTM" } } });
    expect(out["colorways.names"]).toEqual({ "-C": "NAVY" });
    expect(out["dims.h"]).toBe(16);
  });
});

describe("V2 §3 — Start from…: similar packs", () => {
  const now = new Date("2026-10-01");
  const c = (id: string, brandId: string, category: string, silhouette: string, styleName: string, d = now) => ({ id, styleNo: id, styleName, brandId, category, silhouette, updatedAt: d });
  it("ranks same brand + category + silhouette first, then name, then recency; ignores unrelated packs", () => {
    const all = [c("X", "b2", "Belts", "", "OTHER"), c("A", "b1", "Handbags", "TOTE", "CITY TOTE"), c("B", "b1", "Handbags", "SATCHEL", "CITY SATCHEL", new Date("2026-09-01")), c("C", "b1", "Handbags", "SATCHEL", "MINI", new Date("2026-09-30")), c("D", "b2", "Handbags", "SATCHEL", "MINI")];
    expect(rankSimilar({ styleName: "CITY SATCHEL II", brandId: "b1", category: "Handbags", silhouette: "SATCHEL" }, all).map((x) => x.id)).toEqual(["B", "C", "A"]);
  });
});
