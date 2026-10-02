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
  need("p2", 2, 2);
  need("p3", 3, 3);
  need("p4", 4, 4);
  need("p6", 6, 6);
  need("p7", 7, 7);
  need("p8", 8, 8);
  const f = (n: string) => readFileSync(path.join(OUT, n));
  // The side view on the measurements sheet is vector: crop it from a 150 dpi rendering.
  const side = path.join(OUT, "side-view.png");
  if (!existsSync(side)) {
    execFileSync("pdftoppm", ["-r", "150", "-f", "2", "-l", "2", "-png", "-singlefile", PDF, path.join(OUT, "p2-page")]);
    execFileSync("convert", [path.join(OUT, "p2-page.png"), "-crop", "600x660+1920+900", "+repage", side]);
  }
  return {
    renderPink: f("p3-000.jpg"), // ENLARGED CAD, PINK013-B
    renderBlack: f("p3-001.jpg"), // ENLARGED CAD, PINK013-A
    keychain: f("p1-010.jpg"),
    logoPlate: f("p1-000.jpg"),
    strapDetail: f("p4-000.jpg"),
    closureDetail: f("p2-004.jpg"), // MEASUREMENTS SHEET: front flap snap closure photo
    swatchBlack: f("p7-000.jpg"), // Junfa card, chip #2
    swatchPink: f("p8-000.jpg"), // Junfa card, chip #24
    zoomSource: f("p4-001.jpg"), // REFERENCE PHOTOS: shoulder strap attachment, shown as a zoom circle
    sideView: f("side-view.png"), // MEASUREMENTS SHEET side view (a flat in Phase 3; a photo slot until then)
    champion: f("p6-000.jpg"), // LINING ARTWORK application reference (Champion tonal heat stamp)
  };
}

const TB_PDF = path.join(process.cwd(), "reference", "TB25_ACC0023_GINGHAM_PU_DOPP_KIT_TP_R1.pdf");
const TB_OUT = path.join(OUT, "tb");

/**
 * Assets from the TB25_ACC0023 reference pack (needs poppler + ImageMagick). Its photos are Adobe
 * CMYK JPEGs stored inverted, so they are negated; its CAD and line art are vector, so they are cropped
 * from a 150 dpi rendering of the page.
 */
export function tbAssets() {
  if (!existsSync(TB_PDF)) return null;
  mkdirSync(TB_OUT, { recursive: true });
  const f = (n: string) => path.join(TB_OUT, n);
  if (!existsSync(f("page-5.png"))) {
    execFileSync("pdftoppm", ["-r", "150", "-png", "-f", "1", "-l", "6", TB_PDF, f("page")]);
    execFileSync("pdfimages", ["-j", "-f", "2", "-l", "6", TB_PDF, f("x")]);
  }
  const make = (out: string, args: string[]) => {
    if (!existsSync(f(out))) execFileSync("convert", [...args, f(out)]);
    return readFileSync(f(out));
  };
  const photo = (src: string, out: string) => make(out, [f(src), "-negate", "-colorspace", "sRGB", "-resize", "1400x1400>", "-quality", "88"]);
  return {
    render: make("render.png", [f("page-3.png"), "-crop", "1034x650+937+612", "+repage"]),
    pullFront: make("pull-front.png", [f("page-5.png"), "-crop", "110x380+1085+295", "+repage"]),
    pullSide: make("pull-side.png", [f("page-5.png"), "-crop", "70x360+1455+325", "+repage"]),
    lining: make("lining.png", [f("page-4.png"), "-crop", "300x300+1305+290", "+repage"]),
    logo: make("logo.png", [f("page-5.png"), "-crop", "330x130+845+940", "+repage"]),
    refs: [photo("x-000.jpg", "ref-1.jpg"), photo("x-001.jpg", "ref-2.jpg"), photo("x-002.jpg", "ref-3.jpg")],
    swatchBlackBrown: photo("x-013.jpg", "swatch-401-823.jpg"),
    swatchNavy: photo("x-015.jpg", "swatch-609.jpg"),
    binding: photo("x-004.jpg", "binding.jpg"), // INTERIOR: "PLEASE MAKE SURE TO ADD INTERIOR BINDING"
    teeth: photo("x-006.jpg", "teeth.jpg"), // HARDWARE: metal finish plastic teeth reference
  };
}
