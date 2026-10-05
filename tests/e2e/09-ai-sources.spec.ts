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

  // V2 §2: the designer types a strap width before the spec arrives — the spec may only propose.
  const strapW = page.getByTestId("q-hb.strap.width").locator("input").first();
  await strapW.fill("4");
  await strapW.press("Enter");
  await expect(page.getByText("Saved ✓")).toBeVisible();

  /* ---- 3a. Spec sheet (Excel) from the prompt ---- */
  await page.getByTestId("spec-prompt-upload").click();
  await expect(page.getByTestId("slot-spec_sheet")).toBeInViewport();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SPEC");
  ws.addRows([["POINT", "MM", "TOL"], ["TOTAL HEIGHT", 185, 5], ["TOTAL WIDTH", 255, 5], ["TOTAL DEPTH", 70, 3], ["STRAP WIDTH", 38, 1], ["POCKET W", 160, 2], ["ZIP OPENING", 140, 2]]);
  await page.getByTestId("source-spec_sheet").setInputFiles({ name: "PINK996 spec.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await wb.xlsx.writeBuffer()) });
  await expect(page.getByTestId("slot-spec_sheet").getByTestId("source-status")).toContainText(/answers? filled/, { timeout: 30_000 });
  await expect(page.getByTestId("spec-prompt")).toHaveCount(0);
  // A spec sheet is a trusted source (V2 brief §2): settled, tagged, nothing to confirm one by one.
  await expect(page.getByTestId("source-dims.h")).toHaveText("From spec sheet");
  await expect(page.getByTestId("q-dims.h")).not.toContainText("confirm");
  // The spec disagrees with the designer's strap width (38 MM = 3.8 CM): a conflict chip, not a silent replace.
  const conflict = page.getByTestId("conflict-hb.strap.width");
  await expect(conflict).toContainText("SPEC SHEET reads 3.8");
  await expect(strapW).toHaveValue("4");
  await page.getByTestId("conflict-switch-hb.strap.width").click();
  await expect(conflict).toHaveCount(0);
  await expect(strapW).toHaveValue("3.8");
  await expect(page.getByTestId("source-hb.strap.width")).toHaveText("From spec sheet");
  // Round 5, item 1: 4 different parts on the spec → 4 different library items, each on its own row with its size.
  const specStatus = await page.getByTestId("slot-spec_sheet").getByTestId("source-status").innerText();
  const made = [...specStatus.matchAll(/PINK\d+ (LOGO PLATE|BUCKLE|SQUARE RING|EYELET)/gi)].map((m) => m[0].toUpperCase());
  expect(made).toHaveLength(4);
  expect(new Set(made.map((m) => m.split(" ")[0])).size).toBe(4);
  const hwRows = page.getByTestId("q-hardware.items");
  const rowValues = (i: number) => hwRows.getByTestId(`hardware.items-row-${i}`).locator("input, textarea").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(await rowValues(1)).toContain("SQUARE PRONG BUCKLE");
  // Rows from the render: 0 arrows plate, 1 buckle, 2 ring zip pulls, 3 strap rings, 4 eyelet.
  for (const [row, size] of [[0, "50 X 32 MM"], [1, "INNER 40 MM"], [3, "40 X 15 MM"], [4, "DIA 8 MM"]] as const) expect(await rowValues(row)).toContain(size);
  // Round 6: the spec's zip pull merges into the render's zip-pull row (no size on the spec), the
  // strap rings sit at both top corners (qty 2), no row is left without an item, and the finish the
  // spec didn't print is a value (GUNMETAL, AI-suggested) with the note kept in "seen".
  expect((await rowValues(2)).join(" ")).not.toMatch(/ MM/);
  expect((await rowValues(2)).join(" ")).toContain("FINISH: NOT STATED ON SPEC SHEET");
  expect(await rowValues(3)).toContain("2");
  await expect(hwRows.getByTestId(/^hardware\.items-row-/)).toHaveCount(5);
  await expect(hwRows).not.toContainText("Pick or add");
  // Round 5, item 5: materials named on the spec pre-fill the breakdown cells.
  await expect(needed).not.toContainText("MICRO MESH (-A) — SWATCH / MATERIAL");
  await expect(page.getByTestId("cell-text--A-mat_2").locator("input, textarea").first()).toHaveValue("BLACK SMOOTH LEATHER 1.2MM");
  await expect(page.getByTestId("cell-text--A-mat_1").locator("input, textarea").first()).toHaveValue("BLACK NYLON MICRO MESH");
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

  /* ---- 3d. Sample photo with a ruler: EST from the scale ---- */
  await page.getByTestId("source-scale_photo").setInputFiles({ name: "ruler.png", mimeType: "image/png", buffer: sheetImg });
  await expect(page.getByTestId("slot-scale_photo").getByTestId("source-status")).toContainText(/answers? filled/, { timeout: 30_000 });
  await expect(page.getByTestId("q-hb.strap.drop")).toContainText("EST from sample photo — confirm");
  // Round 5, item 2: confirm everything from one upload in one click.
  await page.getByTestId("confirm-all-sample-photo").click();
  await expect(page.getByTestId("q-hb.strap.drop")).not.toContainText("confirm");
  await expect(page.getByTestId("confirm-all-sample-photo")).toHaveCount(0);

  // Remaining counts after the sources.
  await expect(counts(page)).not.toHaveText("12 measurements · 1 material · 5 hardware still needed");
});
