import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { spellcheckText, distance } from "@/lib/spellcheck/core";

const list = readFileSync("node_modules/word-list/words.txt", "utf8").split("\n").filter(Boolean);
const words = new Set(list);
const check = (t: string, extra: string[] = []) => spellcheckText(t, (w) => words.has(w), () => list, extra);

describe("spell-check against the trade dictionary", () => {
  it("corrects the misspellings from the brief", () => {
    const flags = check("FRONT FLAP HAS SNAP CLOURE. YOU WILL RECIEVE A SAMPLE. IRRIDESCENT BLACK. DE-BOSSED (INGRAIVED LOGO). SHINY CHAMPANGE GOLD");
    expect(Object.fromEntries(flags.map((f) => [f.word, f.suggestion]))).toEqual({
      CLOURE: "CLOSURE",
      RECIEVE: "RECEIVE",
      IRRIDESCENT: "IRIDESCENT",
      INGRAIVED: "ENGRAVED",
      CHAMPANGE: "CHAMPAGNE",
    });
  });

  it("accepts trade terms, codes, measurements and Pantone references", () => {
    expect(check("PU EDGE PAINT DTM. TPU LOGO REF TO PINK005. 17-3914 TCX SHARKSKIN. PANTONE 203 C. 16 cm H X 20 cm W. #8 COIL ZIP. W/ PKT. SEE PG 6/8. CROSSBODY DOPP KIT")).toEqual([]);
  });

  it("accepts spec-sheet abbreviations and never 'corrects' a short all-caps abbreviation", () => {
    expect(check("BUCKLE INNER W 40MM. EYELET DIA 8 MM Ø 8. TOL +/- 2MM. W×H 50 X 32 CM. PU / TPU / DTM. SEE POM + BOM. 8 SPI. PP SAMPLE, SMS.")).toEqual([]);
    expect(check("ADD XYZQ LABEL. SEE QWRT.")).toEqual([]); // unknown 4-letter caps: an abbreviation, not a typo
    expect(check("ADD Xyzq LABEL")[0]).toMatchObject({ word: "XYZQ" }); // not all caps → still checked
  });

  it("suggests the nearest word for unknown typos", () => {
    expect(check("ADJUSTEBLE STRAP")[0]).toMatchObject({ word: "ADJUSTEBLE", suggestion: "ADJUSTABLE" });
    expect(distance("GUSET", "GUSSET")).toBe(1);
  });

  for (const [name, file] of [
    ["PINK013", "reference/PINK013-A_B_JODIE_SATCHEL.pdf"],
    ["TB25_ACC0023", "reference/TB25_ACC0023_GINGHAM_PU_DOPP_KIT_TP_R1.pdf"],
  ] as const) {
    it.skipIf(!existsSync(file))(`flags the misspellings in the ${name} reference pack`, () => {
      const text = execFileSync("pdftotext", ["-layout", file, "-"]).toString();
      const flags = check(text, ["EMILY"]); // team names are passed in by the app
      console.log(`${name} flags:`, flags.map((f) => `${f.word}${f.suggestion ? `→${f.suggestion}` : ""}`).join(", "));
      const words = flags.map((f) => f.word);
      if (name === "PINK013") expect(words.sort()).toEqual(["CLOURE", "IRRIDESCENT", "RECIEVE"]);
      else expect(words).toEqual(["INGRAIVED"]);
    });
  }
});
