import { describe, expect, it } from "vitest";
import { arrivalStatus, effectiveRank, resolve, sameValue, type StoredAnswer } from "@/lib/answer-source";

const a = (value: unknown, origin: StoredAnswer["origin"], status: StoredAnswer["status"] = "confirmed"): StoredAnswer => ({ value, origin, status });

describe("answer sources (V2 brief §2)", () => {
  it("settled origins arrive settled; AI and template numbers need confirming", () => {
    expect(arrivalStatus("SPEC")).toBe("confirmed");
    expect(arrivalStatus("HOUSE")).toBe("confirmed");
    expect(arrivalStatus("BASE_STYLE")).toBe("confirmed");
    expect(arrivalStatus("DERIVED")).toBe("confirmed");
    expect(arrivalStatus("AI")).toBe("ai");
    expect(arrivalStatus("TEMPLATE")).toBe("est");
    expect(arrivalStatus("SPEC", "est")).toBe("est"); // an estimate stays an estimate
  });

  it("a value a person confirmed counts as the designer's", () => {
    expect(effectiveRank(a("X", "AI", "confirmed"))).toBe(effectiveRank(a("X", "DESIGNER")));
    expect(effectiveRank(a("X", "AI", "ai"))).toBeLessThan(effectiveRank(a("X", "HOUSE")));
  });

  it("higher priority replaces lower: SPEC over BASE STYLE, HOUSE and AI", () => {
    for (const o of ["BASE_STYLE", "HOUSE", "DERIVED"] as const) expect(resolve(a(17, o), { value: 18.5, origin: "SPEC", status: "confirmed" }).action).toBe("write");
    expect(resolve(a(17, "TEMPLATE", "est"), { value: 18.5, origin: "SPEC", status: "confirmed" }).action).toBe("write");
    expect(resolve(a(17, "AI", "ai"), { value: 18.5, origin: "SPEC", status: "confirmed" }).action).toBe("write");
  });

  it("BASE STYLE beats AI: a different AI read is a conflict chip, never a silent replace", () => {
    const r = resolve(a("TOP-HANDLE", "BASE_STYLE"), { value: "SATCHEL", origin: "AI", status: "ai", note: "SATCHEL PROPORTIONS" });
    expect(r).toEqual({ action: "conflict", conflict: { origin: "AI", source: "", value: "SATCHEL", note: "SATCHEL PROPORTIONS" } });
  });

  it("nothing replaces a designer's value; a spec that disagrees proposes", () => {
    expect(resolve(a(18, "DESIGNER"), { value: 18.5, origin: "SPEC", status: "confirmed", source: "SPEC SHEET" }).action).toBe("conflict");
    expect(resolve(a(18, "AI", "confirmed"), { value: 18.5, origin: "SPEC", status: "confirmed" }).action).toBe("conflict");
    expect(resolve(a(18, "DESIGNER"), { value: 18, origin: "SPEC", status: "confirmed" }).action).toBe("skip"); // agrees: nothing to say
  });

  it("defaults never nag: a lower HOUSE / TEMPLATE / DERIVED value that differs is skipped", () => {
    expect(resolve(a("BLACK", "DESIGNER"), { value: "DTM", origin: "HOUSE", status: "confirmed" }).action).toBe("skip");
    expect(resolve(a(120, "SPEC"), { value: 110, origin: "TEMPLATE", status: "est" }).action).toBe("skip");
  });

  it("same value from a better source settles it (an AI value the spec proves)", () => {
    expect(resolve(a(16, "AI", "est"), { value: 16, origin: "SPEC", status: "confirmed" }).action).toBe("upgrade");
    expect(resolve(a(16, "SPEC"), { value: 16, origin: "AI", status: "ai" }).action).toBe("skip");
  });

  it("a newer read from the same source replaces an unconfirmed older one", () => {
    expect(resolve(a(2, "AI", "ai"), { value: 1, origin: "AI", status: "ai" }).action).toBe("write");
    expect(resolve(a(185, "SPEC"), { value: 190, origin: "SPEC", status: "confirmed" }).action).toBe("write");
  });

  it("merged composite answers (hardware rows) can be written even over designer rows", () => {
    expect(resolve(a([{ seen: "BUCKLE" }], "AI", "confirmed"), { value: [{ seen: "BUCKLE", size: "INNER 40 MM" }], origin: "SPEC", status: "confirmed" }, { merge: true }).action).toBe("write");
  });

  it("compares values sensibly", () => {
    expect(sameValue("dtm ", "DTM")).toBe(true);
    expect(sameValue({ w: 4, h: 1.2 }, { h: 1.2, w: 4 })).toBe(true);
    expect(sameValue({ w: 4, h: null }, { w: 4 })).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
  });
});
