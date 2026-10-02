/**
 * Round 4: the CAD upload drives an accurate pack.
 *  1. A board that says "(REFER TO SPEC)" asks for the spec sheet straight away.
 *  2. Pre-fill → "Needed from you": one line per missing fact, with counts, each jumping to its field.
 *  3. Optional sources the AI reads: spec sheet (Excel), hardware supplier sheet, swatch card, sample
 *     photo with a ruler — answers marked "From <source> — confirm" (EST for the ruler).
 * AI answers come from tests/fixtures/ai/*.PINK996.json (an Off-White-style micro-mesh shoulder bag).
 * Runs after 02 (Pink London brand, Junfa #2 material).
 */
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { referenceAssets } from "./assets";
import { login } from "./helpers";

const assets = referenceAssets();
test.skip(!assets, "reference/PINK013-A_B_JODIE_SATCHEL.pdf not present");

const counts = (page: Page) => page.getByTestId("needed-counts");

test("REFER TO SPEC prompt, Needed from you, and AI-read sources", async ({ page }) => {
  test.setTimeout(240_000);
  const bag = await sharp(assets!.renderBlack).resize(700).toBuffer();
  const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><text x="930" y="200" font-size="38" font-family="Arial" font-weight="700">(REFER TO SPEC)</text></svg>`);
  const board = await sharp({ create: { width: 1400, height: 1000, channels: 3, background: "#ffffff" } }).composite([{ input: bag, left: 150, top: 250 }, { input: text, left: 0, top: 0 }]).jpeg().toBuffer();

  await login(page);
  await page.goto("/packs/new");
  await page.getByRole("button", { name: "Pink London" }).click();
  await page.getByRole("button", { name: "Handbags", exact: true }).click();
  await page.getByLabel("Style #").fill("PINK996");
  await page.getByLabel("Style name").fill("MESH SHOULDER");
  await page.getByRole("button", { name: "Create pack" }).click();
  await page.waitForURL(/\/packs\/[0-9a-f-]{36}$/);

  /* ---- 1. Board says REFER TO SPEC → prompt ---- */
  await page.getByTestId("upload-render").setInputFiles({ name: "board.jpg", mimeType: "image/jpeg", buffer: board });
  await page.getByTestId("crop-save").click();
  await expect(page.getByTestId("spec-prompt")).toContainText("(REFER TO SPEC)", { timeout: 30_000 });

  /* ---- 2. Pre-fill → Needed from you ---- */
  await page.getByTestId("run-prefill").click();
  await expect(page.getByRole("status").filter({ hasText: "pre-filled" })).toBeVisible({ timeout: 30_000 });
  const needed = page.getByTestId("needed");
  for (const line of [
    "OVERALL SIZE — H × W × D",
    "FRONT ZIP POCKET 1 — POCKET SIZE (W × H)",
    "FRONT ZIP POCKET 2 — ZIP OPENING LENGTH",
    "SQUARE PRONG BUCKLE — INNER WIDTH",
    "RECTANGULAR STRAP RING (SQUARE RING) — INNER SIZE (W × H)",
    "ARROWS PLATE (LOGO PLATE) — W × H",
    "EYELET — DIAMETER",
    "STRAP WIDTH",
    "STRAP TOTAL LENGTH",
    "STRAP ADJUSTMENT RANGE (SHORTEST – LONGEST)",
    "MICRO MESH (-A) — SWATCH / MATERIAL",
  ])
    await expect(needed).toContainText(line);
  await expect(counts(page)).toHaveText("12 measurements · 1 material · 5 hardware still needed");
  // Hardware and zippers are never numbered materials; colourway from the render.
  await expect(page.getByTestId("q-materials.list")).not.toContainText("ZIPPER");
  // A line jumps to its row.
  await needed.getByRole("button", { name: "SQUARE PRONG BUCKLE — INNER WIDTH" }).click();
  await expect(page.getByTestId("hardware.items-row-1")).toBeInViewport();

  /* ---- 3a. Spec sheet (Excel) from the prompt ---- */
  await page.getByTestId("spec-prompt-upload").click();
  await expect(page.getByTestId("slot-spec_sheet")).toBeInViewport();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SPEC");
  ws.addRows([["POINT", "MM", "TOL"], ["TOTAL HEIGHT", 185, 5], ["TOTAL WIDTH", 255, 5], ["TOTAL DEPTH", 70, 3], ["STRAP WIDTH", 38, 1], ["POCKET W", 160, 2], ["ZIP OPENING", 140, 2]]);
  await page.getByTestId("source-spec_sheet").setInputFiles({ name: "PINK996 spec.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await wb.xlsx.writeBuffer()) });
  await expect(page.getByTestId("slot-spec_sheet").getByTestId("source-status")).toContainText(/answers? filled/, { timeout: 30_000 });
  await expect(page.getByTestId("spec-prompt")).toHaveCount(0);
  await expect(page.getByTestId("q-dims.h")).toContainText("From spec sheet — confirm");
  await expect(page.getByTestId("q-dims.h").getByRole("spinbutton").or(page.getByTestId("q-dims.h").locator("input")).first()).toHaveValue("18.5");
  await expect(needed).not.toContainText("OVERALL SIZE");
  await expect(needed).not.toContainText("SQUARE PRONG BUCKLE — INNER WIDTH");
  await expect(needed).not.toContainText("FRONT ZIP POCKET 1 — ZIP OPENING LENGTH");

  /* ---- 3b. Hardware supplier sheet: parts added to the library with the next code and linked ---- */
  const sheetImg = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#f4f4f4" } }).png().toBuffer();
  await page.getByTestId("source-hardware_sheet").setInputFiles({ name: "supplier-sheet.png", mimeType: "image/png", buffer: sheetImg });
  await expect(page.getByTestId("slot-hardware_sheet").getByTestId("source-status")).toContainText(/added to library: PINK\d+/, { timeout: 30_000 });
  await expect(needed).not.toContainText("SQUARE PRONG BUCKLE — PICK OR ADD THE LIBRARY PART");
  await expect(needed).not.toContainText("EYELET — DIAMETER");
  await expect(page.getByTestId("q-hardware.items")).toContainText("From hardware sheet — confirm");

  /* ---- 3c. Swatch card: matched to the library (Junfa #2) and put in the breakdown ---- */
  await page.getByLabel("Swatch for").selectOption("1|-A");
  await page.getByTestId("source-swatch_photo").setInputFiles({ name: "junfa.jpg", mimeType: "image/jpeg", buffer: assets!.swatchBlack });
  await expect(page.getByTestId("slot-swatch_photo").getByTestId("source-status")).toContainText(/linked: JUNFA LEATHER/, { timeout: 30_000 });
  await expect(needed).not.toContainText("MICRO MESH (-A) — SWATCH / MATERIAL");

  /* ---- 3d. Sample photo with a ruler: EST from the scale ---- */
  await page.getByTestId("source-scale_photo").setInputFiles({ name: "ruler.png", mimeType: "image/png", buffer: sheetImg });
  await expect(page.getByTestId("slot-scale_photo").getByTestId("source-status")).toContainText(/answers? filled/, { timeout: 30_000 });
  await expect(page.getByTestId("q-hb.strap.drop")).toContainText("EST from sample photo — confirm");

  // Remaining counts after the sources.
  await expect(counts(page)).not.toHaveText("12 measurements · 1 material · 5 hardware still needed");
});
