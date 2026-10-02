import { describe, expect, it } from "vitest";
import { emptyRow, hasErrors, matchImage, normaliseType, parseCsv, rowIssues, type ImportContext } from "@/lib/library-import";

const ctx: ImportContext = {
  brands: [
    { id: "pink", name: "Pink London", codePrefix: "PINK", codeFormat: "PINK###" },
    { id: "tb", name: "Ted Baker", codePrefix: "TB", codeFormat: "TB###" },
  ],
  defaultBrandId: null,
  existingCodes: { PINK003: "pink", PINK004: "pink" },
  styleNos: ["PINK013"],
  existingMaterials: ["JUNFA LEATHER|#2|SMOOTH PU"],
};

describe("library import — parsing", () => {
  it("maps loose hardware headers and normalises types", () => {
    const { rows, errors } = parseCsv("hardware", "Code,Brand,Type,Description,Dimensions,Plating,Image\nPINK005,Pink London,Logo plate,Pink plate,40 x 12,shiny champagne gold,pink005.png\n,Pink London,magnet,,14,,\n");
    expect(errors).toEqual([]);
    expect(rows[0].fields).toMatchObject({ code: "PINK005", type: "LOGO PLATE", dimsMm: "40 X 12", finish: "SHINY CHAMPAGNE GOLD" });
    expect(rows[0].imageRefs.photo).toBe("pink005.png");
    expect(rows[1].fields).toMatchObject({ code: "", type: "MAGNETIC SNAP" });
  });

  it("finds the header under a title row and skips the template example", () => {
    const { rows } = parseCsv("material", "ICON MATERIALS\nSupplier,Article name,Colour no.,Colour name,Composition\nEXAMPLE,SMOOTH PU,#24,IRIDESCENT PINK,50% TPU\nJunfa Leather,Smooth PU,2,iridescent black,50% TPU 50% cotton\n");
    expect(rows).toHaveLength(1);
    expect(rows[0].fields).toMatchObject({ supplier: "JUNFA LEATHER", colourNo: "#2", colourName: "IRIDESCENT BLACK" });
  });

  it("explains unrecognised sheets", () => {
    expect(parseCsv("hardware", "foo,bar\n1,2\n").errors[0]).toMatch(/no recognisable columns/);
  });

  it("matches images by named column, then by code / colour number", () => {
    const files = ["imgs/PINK003.jpg", "imgs/plate.png", "cards/24.jpg"];
    expect(matchImage(files, "plate.png", "PINK005")).toBe("imgs/plate.png");
    expect(matchImage(files, "", "PINK003")).toBe("imgs/PINK003.jpg");
    expect(matchImage(files, "", "#24")).toBe("cards/24.jpg");
    expect(matchImage(files, "", "PINK009")).toBeNull();
  });

  it("knows the trims", () => {
    expect(normaliseType("zipper puller")).toBe("ZIPPER PULL");
    expect(normaliseType("Keychain")).toBe("KEYCHAIN/CHARM");
    expect(normaliseType("woven label")).toBe("WOVEN LABEL");
  });
});

describe("library import — call-outs", () => {
  const hw = (fields: Record<string, string>) => {
    const r = emptyRow("hardware", "test");
    r.fields = { ...r.fields, ...fields };
    return r;
  };

  it("blocks a row with no code, and says what the next free code is", () => {
    const r = hw({ brand: "Pink London", type: "MAGNETIC SNAP" });
    const iss = rowIssues("hardware", [r], ctx)[r.key];
    expect(hasErrors(iss)).toBe(true);
    expect(iss.find((i) => i.field === "code")?.message).toMatch(/PINK005/); // components and styles are separate sequences (V2.1 §7)
  });

  it("blocks codes repeated in the upload or clashing with a style number", () => {
    const a = hw({ code: "PINK006", brand: "Pink London", type: "RIVET" });
    const b = hw({ code: "PINK006", brand: "Pink London", type: "RIVET" });
    const c = hw({ code: "PINK013", brand: "Pink London", type: "RIVET" });
    const iss = rowIssues("hardware", [a, b, c], ctx);
    expect(iss[a.key].some((i) => /repeated in this upload/.test(i.message))).toBe(true);
    expect(iss[c.key].some((i) => /style number/.test(i.message))).toBe(true);
  });

  it("calls out — but allows — existing codes (update), odd formats and unknown finishes", () => {
    const upd = hw({ code: "PINK003", brand: "Pink London", type: "KEYCHAIN/CHARM" });
    const odd = hw({ code: "PNK-7", brand: "Pink London", type: "RIVET", finish: "GOLDISH" });
    const iss = rowIssues("hardware", [upd, odd], ctx);
    expect(hasErrors(iss[upd.key])).toBe(false);
    expect(iss[upd.key].some((i) => /will update/.test(i.message))).toBe(true);
    expect(hasErrors(iss[odd.key])).toBe(false);
    expect(iss[odd.key].map((i) => i.level)).toEqual(expect.arrayContaining(["warning"]));
  });

  it("uses the default brand, or the code prefix, when the row doesn't name one", () => {
    const r = hw({ code: "TB004", type: "ZIPPER PULL" });
    expect(hasErrors(rowIssues("hardware", [r], ctx)[r.key])).toBe(false);
    const none = hw({ code: "X1", type: "RIVET" });
    expect(rowIssues("hardware", [none], ctx)[none.key].some((i) => i.field === "brand")).toBe(true);
    expect(rowIssues("hardware", [none], { ...ctx, defaultBrandId: "pink" })[none.key].some((i) => i.field === "brand")).toBe(false);
  });

  it("materials need a supplier and a colour; existing cards are flagged", () => {
    const r = emptyRow("material", "x");
    expect(hasErrors(rowIssues("material", [r], ctx)[r.key])).toBe(true);
    const dup = emptyRow("material", "y");
    dup.fields = { ...dup.fields, supplier: "JUNFA LEATHER", colourNo: "#2", articleName: "SMOOTH PU" };
    const iss = rowIssues("material", [dup], ctx)[dup.key];
    expect(hasErrors(iss)).toBe(false);
    expect(iss.some((i) => /Already in the library/.test(i.message))).toBe(true);
  });
});
