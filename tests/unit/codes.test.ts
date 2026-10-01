import { describe, expect, it } from "vitest";
import { codeNumber, nextCode, parseCodeFormat, suffixesFor } from "@/lib/codes";

describe("code assignment", () => {
  it("parses a prefix + digits format", () => {
    expect(parseCodeFormat("PINK###")).toEqual({ before: "PINK", digits: 3, after: "" });
    expect(() => parseCodeFormat("PINK")).toThrow();
  });

  it("assigns the next number after existing components (PINK003, 004, 005 → PINK006)", () => {
    expect(nextCode("PINK###", ["PINK003", "PINK004", "PINK005"])).toBe("PINK006");
  });

  it("checks style numbers too, so components and styles never collide", () => {
    expect(nextCode("PINK###", ["PINK003", "PINK004", "PINK005", "PINK013-A", "PINK013"])).toBe("PINK014");
  });

  it("ignores other brands' codes and malformed codes", () => {
    expect(nextCode("PINK###", ["TB001", "PINKX", "PINK12"])).toBe("PINK001");
    expect(codeNumber("PINK###", "pink007")).toBe(7);
  });

  it("supports an admin-overridden format", () => {
    expect(nextCode("TB_HW####", ["TB_HW0009", "TB25_ACC0023"])).toBe("TB_HW0010");
  });

  it("builds colorway suffixes", () => {
    expect(suffixesFor(2)).toEqual(["-A", "-B"]);
  });
});
