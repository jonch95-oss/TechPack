import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PDF = path.join(process.cwd(), "reference", "PINK013-A_B_JODIE_SATCHEL.pdf");
const OUT = path.join(process.cwd(), ".data", "ref-assets");

/** Extracts the render, swatch cards and trims from the reference PINK013 pack (needs poppler `pdfimages`). */
export function referenceAssets() {
  if (!existsSync(PDF)) return null;
  mkdirSync(OUT, { recursive: true });
  const need = (prefix: string, first: number, last: number) => {
    if (!existsSync(path.join(OUT, `${prefix}-000.jpg`))) execFileSync("pdfimages", ["-j", "-f", String(first), "-l", String(last), PDF, path.join(OUT, prefix)]);
  };
  need("p1", 1, 1);
  need("p3", 3, 3);
  need("p4", 4, 4);
  need("p7", 7, 7);
  need("p8", 8, 8);
  const f = (n: string) => readFileSync(path.join(OUT, n));
  return {
    renderPink: f("p3-000.jpg"), // ENLARGED CAD, PINK013-B
    renderBlack: f("p3-001.jpg"), // ENLARGED CAD, PINK013-A
    keychain: f("p1-010.jpg"),
    logoPlate: f("p1-000.jpg"),
    strapDetail: f("p4-000.jpg"),
    swatchBlack: f("p7-000.jpg"), // Junfa card, chip #2
    swatchPink: f("p8-000.jpg"), // Junfa card, chip #24
  };
}
