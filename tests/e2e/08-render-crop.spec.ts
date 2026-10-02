/**
 * Round 3, item 4: a design board with spec text beside the product is cropped to the product on
 * upload (auto-detected, editable). The cropped image is what the pack shows and prints.
 * Runs after 02 (needs the Pink London brand). Uses the PINK013 render on a synthetic board.
 */
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { referenceAssets } from "./assets";
import { login } from "./helpers";

const assets = referenceAssets();
test.skip(!assets, "reference/PINK013-A_B_JODIE_SATCHEL.pdf not present");

test("render upload: board text is cropped off, crop is editable", async ({ page }) => {
  const bag = await sharp(assets!.renderBlack).resize(700).toBuffer();
  const text = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><text x="930" y="200" font-size="38" font-family="Arial" font-weight="700">(REFER TO SPEC)</text><text x="80" y="960" font-size="30" font-family="Arial">STYLE PINK997 BLACK</text></svg>`,
  );
  const board = await sharp({ create: { width: 1400, height: 1000, channels: 3, background: "#ffffff" } })
    .composite([{ input: bag, left: 150, top: 250 }, { input: text, left: 0, top: 0 }])
    .jpeg()
    .toBuffer();

  await login(page);
  await page.goto("/packs/new");
  await page.getByRole("button", { name: "Pink London" }).click();
  await page.getByRole("button", { name: "Handbags", exact: true }).click();
  await page.getByLabel("Style #").fill("PINK997");
  await page.getByLabel("Style name").fill("CROP TEST");
  await page.getByRole("button", { name: "Create pack" }).click();
  await page.waitForURL(/\/packs\/[0-9a-f-]{36}$/);

  await page.getByTestId("upload-render").setInputFiles({ name: "board.jpg", mimeType: "image/jpeg", buffer: board });
  const box = page.getByTestId("crop-box");
  await expect(box).toBeVisible();
  // Auto-detected: the bag (x 150–850 of 1400, y 250–846 of 1000), not the text at the top right.
  const style = (await box.getAttribute("style")) ?? "";
  const pct = (k: string) => Number(new RegExp(`${k}: ([\\d.]+)%`).exec(style)?.[1]);
  expect(pct("left")).toBeGreaterThan(6);
  expect(pct("left")).toBeLessThan(12);
  expect(pct("left") + pct("width")).toBeLessThan(66); // "(REFER TO SPEC)" starts at 66%
  expect(pct("top")).toBeGreaterThan(20);
  await page.getByTestId("crop-save").click();
  await expect(page.getByTestId("render-image")).toHaveAttribute("data-cropped", "1");

  // The pack shows (and prints) the cropped image.
  const src = (await page.getByTestId("render-image").getAttribute("src"))!;
  const res = await page.request.get(src);
  expect(res.ok()).toBe(true);
  const meta = await sharp(Buffer.from(await res.body())).metadata();
  expect(meta.width).toBeLessThan(900);
  expect(meta.width).toBeGreaterThan(650);

  // Editable: drag a new box, then go back to the whole image.
  await page.getByTestId("crop-render").click();
  const canvas = page.getByTestId("crop-canvas");
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.7, { steps: 5 });
  await page.mouse.up();
  await page.getByTestId("crop-save").click();
  await expect(page.getByTestId("crop-render")).toHaveText("Cropped ●");
  await page.getByTestId("crop-render").click();
  await page.getByRole("button", { name: "Use the whole image" }).click();
  await expect(page.getByTestId("render-image")).toHaveAttribute("data-cropped", "0");
});
