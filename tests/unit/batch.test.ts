import { describe, expect, it } from "vitest";
import { categoryOf, checkRow, groupRenders, parseBatchTable, parseColourways } from "@/lib/batch";

describe("V2 §8 — batch create from a spreadsheet", () => {
  const table = [
    [],
    ["Style #", "Style name", "Brand", "Category", "Base style", "Colourways", "Render"],
    ["abc101", "city tote", "Acme", "handbags", "ABC100", "BLACK, RED", "abc101-a.png, abc101-b.png"],
    ["", "", "", "", "", "", ""],
    ["ABC102", "", "Nope", "rockets", "", "-A", ""],
  ];
  it("reads the header row, capitals, colourways and render lists; skips blank rows", () => {
    const { rows, errors } = parseBatchTable(table);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ line: 3, styleNo: "ABC101", styleName: "CITY TOTE", category: "Handbags", base: "ABC100", renders: ["abc101-a.png", "abc101-b.png"], colorways: [{ code: "-A", name: "BLACK" }, { code: "-B", name: "RED" }] });
  });
  it("checks each row against the studio", () => {
    const { rows } = parseBatchTable(table);
    const ctx = { brands: ["ACME"], taken: (s: string) => s === "ABC999", bases: (s: string) => s === "ABC100", files: ["abc101-a.png"], seen: new Set<string>() };
    expect(checkRow(rows[0], ctx)).toEqual(["Render abc101-b.png not uploaded."]);
    expect(checkRow(rows[1], ctx)).toEqual(["Style name is required.", "Unknown brand Nope.", "Category is required (one of the app's categories)."]);
  });
  it("parses colourways and categories", () => {
    expect(parseColourways("-C NAVY; -D")).toEqual([{ code: "-C", name: "NAVY" }, { code: "-D", name: undefined }]);
    expect(categoryOf("Packing cube")).toBe("Packing cubes");
    expect(categoryOf("")).toBe("");
  });
});

describe("V2 §8 — a folder of renders", () => {
  it("groups files by style #, colourways from the suffix", () => {
    expect(groupRenders(["PINKX01-B.jpg", "PINKX01-A.png", "dir/TBX_0002.png"])).toEqual([
      { styleNo: "PINKX01", colorways: [{ code: "-A" }, { code: "-B" }], renders: ["PINKX01-B.jpg", "PINKX01-A.png"] },
      { styleNo: "TBX_0002", colorways: [{ code: "-A" }], renders: ["dir/TBX_0002.png"] },
    ]);
  });
});
