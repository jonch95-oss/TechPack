import { describe, expect, it } from "vitest";
import { dueWindow, filterHref, parseFilters } from "@/lib/dashboard";

describe("V2 §8 — dashboard filters", () => {
  it("keeps only valid filter values", () => {
    const f = parseFilters({ q: " pink ", status: "SENT", brand: "nope", category: "Handbags", stage: "production", due: "week", mine: "1", view: "pipeline", page: "3" });
    expect(f).toMatchObject({ q: "PINK", status: "SENT", brand: "", category: "Handbags", stage: "PRODUCTION", due: "week", mine: true, view: "pipeline", page: 3 });
    expect(parseFilters({ status: "BOGUS", category: "Rockets", page: "-2" })).toMatchObject({ status: "", category: "", page: 1 });
  });
  it("builds the URL for a change, resetting the page", () => {
    const f = parseFilters({ q: "PINK", status: "SENT", page: "4" });
    expect(filterHref(f, { status: "" })).toBe("/?q=PINK");
    expect(filterHref(f, { page: 5 })).toBe("/?q=PINK&status=SENT&page=5");
    expect(filterHref(parseFilters({}), {})).toBe("/");
  });
  it("due windows are ISO dates a week apart", () => {
    expect(dueWindow(new Date("2026-10-05T12:00:00Z"))).toEqual({ today: "2026-10-05", week: "2026-10-12" });
  });
});
