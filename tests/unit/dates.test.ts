import { describe, expect, it } from "vitest";
import { fmtDate, studioDay } from "@/lib/dates";

describe("studio dates (New York)", () => {
  it("late evening in New York is still that day, though UTC has rolled over", () => {
    const t = "2026-10-06T02:30:00Z"; // 22:30 on 5 Oct in New York
    expect(studioDay(t)).toBe("2026-10-05");
    expect(fmtDate(t)).toBe("05 Oct 2026");
  });
  it("short format", () => {
    expect(fmtDate("2026-03-01T12:00:00Z", { day: "2-digit", month: "short" })).toBe("01 Mar");
  });
});
