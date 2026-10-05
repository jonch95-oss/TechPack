import { describe, expect, it } from "vitest";
import { bulkConfirmable, groupOf, orderRows, type ReviewRow } from "@/lib/review";

const row = (id: string, o: Partial<ReviewRow> = {}): ReviewRow => ({ id, group: groupOf(id), conflict: false, answered: true, required: false, ...o });

describe("review screen (V2 §3 step 3)", () => {
  it("groups answers as a spec sheet", () => {
    expect(groupOf("dims.h")).toBe("Body");
    expect(groupOf("hb.closure.snap_qty")).toBe("Closure");
    expect(groupOf("hb.strap.width")).toBe("Handles & straps");
    expect(groupOf("hb.ext_pockets")).toBe("Pockets & zips");
    expect(groupOf("zippers.list")).toBe("Pockets & zips");
    expect(groupOf("branding.logo_type")).toBe("Branding");
    expect(groupOf("hardware.items")).toBe("Hardware");
    expect(groupOf("interior.lined")).toBe("Interior");
    expect(groupOf("materials.matrix")).toBe("Materials & colours");
  });

  it("conflicts and low-confidence rows sit at the top of their group", () => {
    const rows = [row("dims.h"), row("dims.w", { status: "ai" }), row("hb.silhouette", { status: "ai", confidence: "low" }), row("dims.d", { conflict: true })];
    expect(orderRows(rows).map((r) => r.id)).toEqual(["dims.d", "hb.silhouette", "dims.w", "dims.h"]);
  });

  it("bulk confirm never takes conflicts or low confidence; All visible takes only render reads", () => {
    const rows = [
      row("hb.silhouette", { status: "ai", confidence: "high" }),
      row("hb.closure.type", { status: "ai" }),
      row("hb.closure.snap_qty", { status: "inferred" }),
      row("dims.h", { status: "est" }),
      row("hb.strap.width", { status: "sourced" }),
      row("branding.logo_type", { status: "ai", confidence: "low" }),
      row("hb.strap.removable", { status: "ai", conflict: true }),
    ];
    expect(bulkConfirmable(rows, { group: "Closure" })).toEqual(["hb.closure.type", "hb.closure.snap_qty"]);
    expect(bulkConfirmable(rows, { allVisible: true }, (id) => (id === "hb.strap.width" ? "SAMPLE PHOTO" : ""))).toEqual(["hb.silhouette", "hb.closure.type"]);
  });
});
