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

  it("components and styles are separate sequences that never collide (V2.1 §7)", () => {
    expect(nextCode("PINK###", ["PINK003", "PINK004", "PINK005"], ["PINK013-A", "PINK013"])).toBe("PINK006");
    expect(nextCode("PINK###", ["PINK011", "PINK012"], ["PINK013", "PINK014-A"])).toBe("PINK015"); // skips codes styles use
  });

  it("a longer style number in the same family is never read as a component (PA_LUG_### → PA_LUG_009)", () => {
    const components = ["PA_LUG_001", "PA_LUG_002", "PA_LUG_003", "PA_LUG_004", "PA_LUG_005", "PA_LUG_006", "PA_LUG_007", "PA_LUG_008"];
    expect(nextCode("PA_LUG_###", components, ["PA_LUG_10001"])).toBe("PA_LUG_009");
    expect(codeNumber("PA_LUG_###", "PA_LUG_10001")).toBeNull();
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

import { checkCode } from "@/lib/codes";

describe("designer-entered codes", () => {
  const base = { format: "PINK###", brandName: "Pink London", componentCodes: ["PINK003", "PINK004", "PINK005"], styleNos: ["PINK013"] };
  it("accepts the next free code", () => {
    expect(checkCode({ ...base, code: "pink006" })).toEqual({ errors: [], warnings: [], suggestion: "PINK006" });
  });
  it("blocks duplicates and style-number clashes", () => {
    expect(checkCode({ ...base, code: "PINK005" }).errors[0]).toMatch(/already used/);
    expect(checkCode({ ...base, code: "PINK013" }).errors[0]).toMatch(/style number/);
    expect(checkCode({ ...base, code: "" }).errors[0]).toMatch(/PINK006/);
  });
  it("calls out wrong formats and skipped numbers without blocking", () => {
    expect(checkCode({ ...base, code: "PNK014" })).toMatchObject({ errors: [], warnings: [expect.stringMatching(/format/)] });
    expect(checkCode({ ...base, code: "PINK090" })).toMatchObject({ errors: [], warnings: [expect.stringMatching(/skips ahead/)] });
    expect(checkCode({ ...base, code: "PINK006" })).toMatchObject({ errors: [], warnings: [] });
    expect(checkCode({ ...base, code: "PINK014" }).warnings[0]).toMatch(/skips ahead — the next free number is PINK006/);
  });
});
