/**
 * PHASE 1 ACCEPTANCE TEST
 * "PINK013 can be entered end to end from its render with every answer in Part 6 captured."
 *
 * Needs the confidential reference pack in reference/ (gitignored). The render and swatch
 * cards are extracted from it with `pdfimages` — see tests/e2e/assets.ts.
 * AI calls are served from tests/fixtures/ai (AI_FIXTURE_DIR) because CI has no API key.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { referenceAssets } from "./assets";
import { login } from "./helpers";
import ExcelJS from "exceljs";

const SHOTS = process.env.SHOTS_DIR;
const shot = async (page: Page, name: string, fullPage = false) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
};

const assets = referenceAssets();
test.skip(!assets, "reference/PINK013-A_B_JODIE_SATCHEL.pdf not present — ask Jon for the reference packs");

/* ----------------------------- helpers ----------------------------- */

const q = (page: Page, id: string) => page.getByTestId(`q-${id}`);

/** Click a point given as fractions of the mark-up canvas, in the open PhotoMarks drawer. */
async function markAt(page: Page, fx: number, fy: number) {
  const canvas = page.getByTestId("marks-canvas");
  await expect(canvas.locator("img")).toBeVisible();
  await page.waitForFunction(() => (document.querySelector("[data-testid=marks-canvas] img") as HTMLImageElement | null)?.complete === true);
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: b.width * fx, y: b.height * fy } });
}

/** Upload a construction photo and set its caption, letter, page slot and (optionally) mark-up. */
async function construction(page: Page, name: string, buffer: Buffer, o: { caption: string; letter?: string; place?: string; zoom?: [number, number, number]; dot?: [number, number] }) {
  await page.getByTestId("upload-construction").setInputFiles({ name, mimeType: "image/jpeg", buffer });
  const cap = page.getByLabel(`Caption for ${name}`);
  await expect(cap).toBeVisible();
  const item = page.locator("li").filter({ has: cap });
  await cap.fill(o.caption);
  await cap.press("Enter");
  await settled(page);
  if (o.letter) {
    await item.getByLabel("Comment letter").selectOption(o.letter);
    await settled(page);
  }
  if (o.place) {
    await page.getByLabel(`Prints on for ${name}`).selectOption(o.place);
    await settled(page);
  }
  if (o.zoom || o.dot) {
    await page.getByLabel(`Mark up ${name}`).click();
    if (o.zoom) {
      await page.getByRole("radio", { name: "Zoom circle" }).click();
      await markAt(page, o.zoom[0], o.zoom[1]);
      await page.getByLabel("Zoom circle size").fill(String(o.zoom[2]));
    }
    if (o.dot) {
      await page.getByRole("radio", { name: "Red dot" }).click();
      await markAt(page, o.dot[0], o.dot[1]);
    }
    await page.getByTestId("marks-save").click();
    await expect(page.getByTestId("marks-canvas")).toBeHidden();
    await expect(page.getByLabel(`Mark up ${name}`)).toHaveText(o.zoom ? "Zoom ●" : "Dot ●");
  }
}

async function settled(page: Page) {
  await expect(page.getByText("Saving…")).toHaveCount(0);
}
async function chip(scope: Locator, option: string) {
  await scope.getByRole("radio", { name: option, exact: true }).click();
}
async function pickChip(page: Page, id: string, option: string) {
  await chip(q(page, id), option);
  await settled(page);
  await expect(q(page, id)).toHaveAttribute("data-status", "confirmed");
}
async function other(page: Page, id: string, text: string) {
  const box = q(page, id);
  await box.getByRole("button", { name: "Other…" }).click();
  await box.getByRole("textbox", { name: "Other" }).fill(text);
  await box.getByRole("textbox", { name: "Other" }).press("Enter");
  await settled(page);
}
async function yes(page: Page, id: string, v = true) {
  await chip(q(page, id), v ? "Yes" : "No");
  await settled(page);
  await expect(q(page, id)).toHaveAttribute("data-status", "confirmed");
}
async function step(scope: Locator, label: string, value: number) {
  const input = scope.getByRole("textbox", { name: label, exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}
async function number(page: Page, id: string, label: string, value: number) {
  await step(q(page, id), label, value);
  await settled(page);
  await expect(q(page, id)).toHaveAttribute("data-status", "confirmed");
}
async function confirm(page: Page, id: string) {
  await page.getByTestId(`confirm-${id}`).click();
  await expect(q(page, id)).toHaveAttribute("data-status", "confirmed");
}
async function text(page: Page, id: string, value: string) {
  const input = page.getByTestId(`q-input-${id}`);
  await input.fill(value);
  await input.press("Enter");
  await settled(page);
}
/** Opens a library picker and chooses the row matching `search`. */
async function pick(page: Page, opener: Locator, search: string) {
  await opener.click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("textbox", { name: "Search library" }).fill(search);
  await drawer.getByRole("button", { name: new RegExp(search.replace(/[#()]/g, "."), "i") }).first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await settled(page);
}

/* ----------------------------- the test ----------------------------- */

test("PINK013 JODIE — entered end to end from its render with every Part 6 answer captured", async ({ page }) => {
  const a = assets!;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });

  // Sign in (EMILY is the admin seeded for the test; she becomes SENT BY). First sign-in changes the temporary password.
  await login(page);

  /* ---- Brand: Pink London uses PINK + 3 digits ---- */
  await page.goto("/admin/brands");
  await expect(page.getByTestId("brand-PINK")).toContainText("PINK001");

  /* ---- Hardware: a CSV + photos + an Excel sheet with a pasted picture, reviewed before saving ---- */
  const tmp = path.join(process.cwd(), ".data", "e2e-import");
  mkdirSync(tmp, { recursive: true });
  writeFileSync(path.join(tmp, "PINK003.jpg"), a.keychain);
  writeFileSync(path.join(tmp, "pink-logo-plate.jpg"), a.logoPlate);
  writeFileSync(
    path.join(tmp, "pink-hardware.csv"),
    [
      "code,brand,type,name,dims mm,material,finish,logo treatment,enamel pantone,hollow/solid,photo",
      "PINK003,Pink London,Keychain,HEART PADLOCK KEYCHAIN W/ LOBSTER CLASP,,ZINC ALLOY,SHINY CHAMPAGNE GOLD,ENAMEL INLAY,PINK UNION JACK,SOLID,",
      "PINK004,Pink London,Woven label,PINK LONDON WOVEN LABEL,40 X 20,,,,,,",
      "PINK005,Pink London,Logo plate,PINK LONDON LOGO,,,SHINY CHAMPAGNE GOLD,ENGRAVED,,,pink-logo-plate.jpg",
    ].join("\n"),
  );
  // An Excel sheet where the designer pasted the photo straight into the row and left the code blank.
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hardware");
  ws.addRow(["Code", "Brand", "Type", "Name", "Dims (mm)", "Material", "Finish", "Photo"]);
  ws.addRow(["", "Pink London", "Magnetic snap", "MAGNETIC SNAP 14MM", "14", "IRON", "SHINY CHAMPAGNE GOLD", ""]);
  const imgId = wb.addImage({ buffer: a.logoPlate as unknown as ExcelJS.Buffer, extension: "jpeg" });
  ws.addImage(imgId, { tl: { col: 7, row: 1 }, ext: { width: 60, height: 20 } });
  await wb.xlsx.writeFile(path.join(tmp, "snaps.xlsx"));

  await page.goto("/library/hardware/import");
  await page.getByTestId("import-files-input").setInputFiles(["pink-hardware.csv", "snaps.xlsx", "PINK003.jpg", "pink-logo-plate.jpg"].map((f) => path.join(tmp, f)));
  await page.getByTestId("import-review").click();
  const hwRows = page.getByTestId("import-row");
  await expect(hwRows).toHaveCount(4);
  await expect(page.getByTestId("import-summary")).toContainText("1 need fixing");
  const snap = hwRows.filter({ hasText: "snaps.xlsx" });
  await expect(snap).toContainText("next free Pink London code is PINK006");
  await expect(snap.locator('[role="img"], img')).toHaveCount(1); // the pasted picture came across
  await snap.getByLabel("Code").fill("PINK006");
  await expect(page.getByTestId("import-summary")).not.toContainText("need fixing");
  await shot(page, "01-hardware-review");
  await page.getByTestId("import-save").click();
  await expect(page.getByTestId("import-report")).toContainText("4 added");
  await shot(page, "01b-hardware-import");

  /* ---- Materials: Junfa swatch cards #2 and #24, read by the agent, each field confirmed ---- */
  // -A card: the single-card page.
  await page.goto("/library/materials/new");
  await page.getByTestId("card-photo-input").setInputFiles({ name: "junfa-2.jpg", mimeType: "image/jpeg", buffer: a.swatchBlack });
  await page.locator("#m-supplier").fill("JUNFA LEATHER");
  await page.locator("#m-colourNo").fill("#2");
  await page.getByRole("button", { name: "Read card with AI" }).click();
  await expect(page.getByRole("status")).toContainText("confirm each");
  await expect(page.locator("#m-composition")).toHaveValue("50% TPU 50% COTTON");
  await expect(page.locator("#m-thickness")).toHaveValue("0.85MM ±0.05");
  await expect(page.locator("#m-width")).toHaveValue("138-140CM");
  await expect(page.locator("#m-colourName")).toHaveValue("IRIDESCENT BLACK");
  await shot(page, "02-swatch-ai-read");
  const badges = page.getByRole("button", { name: /AI-read — confirm/ });
  while ((await badges.count()) > 0) await badges.first().click();
  await page.getByRole("button", { name: "Save material" }).click();
  await page.waitForURL(/\/library\/materials\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("#2 IRIDESCENT BLACK");

  // -B card: bulk upload — a one-line sheet plus the card photo, read by the AI in the review table.
  writeFileSync(path.join(tmp, "junfa-24.jpg"), a.swatchPink);
  writeFileSync(path.join(tmp, "cards.csv"), "Supplier,Colour no.,Card photo\nJunfa Leather,24,junfa-24.jpg\n");
  await page.goto("/library/materials/import");
  await page.getByTestId("import-files-input").setInputFiles([path.join(tmp, "cards.csv"), path.join(tmp, "junfa-24.jpg")]);
  await page.getByTestId("import-review").click();
  await expect(page.getByTestId("import-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Read 1 card with AI" }).click();
  await expect(page.getByTestId("import-row").getByLabel("Composition")).toHaveValue("50% TPU 50% COTTON");
  await expect(page.getByTestId("import-row").getByLabel("Colour name")).toHaveValue("IRIDESCENT PINK");
  await shot(page, "02b-swatch-bulk-review");
  await page.getByTestId("import-save").click();
  await expect(page.getByTestId("import-report")).toContainText("1 added");

  /* ---- Print artwork: PINK tonal heat-stamp repeat, 10 × 10 cm tile, Pantone 203 C ---- */
  await page.goto("/library/prints/new");
  await page.locator("#p-name").fill("PINK TONAL HEAT STAMP REPEAT");
  await page.locator("#p-motif").fill("PINK WORDMARK");
  await chip(page.locator("main"), "STRAIGHT");
  await page.getByLabel("Tile width").fill("10");
  await page.getByLabel("Tile height").fill("10");
  await page.getByLabel("Colour 1").fill("PANTONE 203 C");
  await chip(page.locator("main"), "TONAL HEAT STAMP");
  await page.getByRole("button", { name: "Save artwork" }).click();
  await page.waitForURL(/\/library\/prints\/[0-9a-f-]{36}$/);

  /* ---- New pack ---- */
  await page.goto("/packs/new");
  await page.getByRole("button", { name: "Pink London" }).click();
  await page.getByRole("button", { name: "Handbags", exact: true }).click();
  await page.getByLabel("Style #").fill("PINK013");
  await page.getByLabel("Style name").fill("JODIE");
  await shot(page, "03-new-pack");
  await page.getByRole("button", { name: "Create pack" }).click();
  await page.waitForURL(/\/packs\/[0-9a-f-]{36}$/);
  const packId = page.url().split("/").pop()!;

  /* ---- Upload the render (a single image) and the colorway renders ---- */
  await page.getByTestId("upload-render").setInputFiles({ name: "PINK013-A.jpg", mimeType: "image/jpeg", buffer: a.renderBlack });
  // Crop step: a clean render needs no crop — the auto-detected box is the whole image.
  await expect(page.getByTestId("crop-canvas")).toBeVisible();
  await page.getByTestId("crop-save").click();
  await expect(page.getByTestId("crop-canvas")).toBeHidden();
  await expect(page.getByTestId("render-image")).toBeVisible();
  await page.getByTestId("upload-colorway_render").setInputFiles({ name: "PINK013-A.jpg", mimeType: "image/jpeg", buffer: a.renderBlack });
  await expect(page.locator("select[aria-label=Colorway]")).toHaveCount(1);
  await page.getByTestId("upload-colorway_render").setInputFiles({ name: "PINK013-B.jpg", mimeType: "image/jpeg", buffer: a.renderPink });
  await expect(page.locator("select[aria-label=Colorway]")).toHaveCount(2);
  await page.getByTestId("upload-construction").setInputFiles({ name: "strap-attachment.jpg", mimeType: "image/jpeg", buffer: a.strapDetail });

  /* ---- Logo point on the render (the LOGO label's leader line), and the page-placed photos ---- */
  await page.getByTestId("mark-logo").click();
  await markAt(page, 0.52, 0.47);
  await page.getByTestId("marks-save").click();
  await expect(page.getByTestId("marks-canvas")).toBeHidden();
  await construction(page, "side-view.png", a.sideView, { caption: "SIDE VIEW W/ SHOULDER STRAP ATTACHMENT LOOP", letter: "B", place: "MEASUREMENTS|SIDE_VIEW" });
  await construction(page, "strap-zoom.jpg", a.zoomSource, { caption: "SHOULDER STRAP ATTACHMENT DETAIL REFERENCE", letter: "B", place: "REFERENCE IMAGES|", zoom: [0.78, 0.45, 20] });
  await construction(page, "champion-lining.jpg", a.champion, { caption: "LINING IS TONAL HEAT STAMP REPEAT SAME AS CHAMPION EXAMPLE BELOW", place: "LINING / PRINT ARTWORK|APPLICATION", dot: [0.5, 0.4] });
  await shot(page, "03b-photo-placements");

  /* ---- AI pre-fill: everything it can see is marked "AI-suggested — confirm" ---- */
  await page.getByTestId("run-prefill").click();
  await expect(page.getByRole("status").filter({ hasText: "pre-filled" })).toBeVisible();
  await expect(q(page, "hb.silhouette")).toHaveAttribute("data-status", "ai");
  await expect(q(page, "hb.silhouette")).toContainText("AI-suggested — confirm");
  await expect(q(page, "dims.h")).toHaveAttribute("data-status", "est");
  await expect(q(page, "hb.closure")).toHaveAttribute("data-status", "inferred");
  await shot(page, "04-after-prefill");
  await shot(page, "04b-after-prefill-full", true);

  /* ---- Header ---- */
  // V2: the drafted description is DERIVED — trusted, editable, nothing to confirm.
  await expect(page.getByTestId("confirm-header.description")).toHaveCount(0);
  await expect(page.getByTestId("source-header.description")).toHaveText("Derived");
  await expect(page.getByTestId("q-input-header.description")).toHaveValue("SHOULDER BAG SATCHEL W/ FLAP & LONG SHOULDER STRAP");
  await other(page, "header.retailer", "PINK");
  await page.getByTestId("q-input-header.due_date").click();
  await settled(page);
  await text(page, "header.reference_sample", "BETSY JOHNSON");
  await yes(page, "header.physical_sample");

  /* ---- Dimensions: 16 × 20 × 8 cm (AI estimates replaced / confirmed) ---- */
  await pickChip(page, "dims.unit", "CM");
  await number(page, "dims.h", "Height (H)", 16);
  await number(page, "dims.w", "Width (W)", 20);
  await number(page, "dims.d", "Depth (D)", 8);

  /* ---- Colorway names ---- */
  const names = q(page, "colorways.names").getByRole("textbox");
  await names.nth(0).fill("IRIDESCENT BLACK");
  await names.nth(0).press("Enter");
  await settled(page);
  await names.nth(1).fill("IRIDESCENT PINK");
  await names.nth(1).press("Enter");
  await settled(page);

  /* ---- Handbag block ---- */
  await confirm(page, "hb.silhouette");
  await confirm(page, "hb.structure");
  await confirm(page, "hb.closure");
  await number(page, "hb.closure.snap_qty", "Snap qty", 2);
  await pickChip(page, "hb.closure.snap_spacing", "SPACED EVENLY");
  await confirm(page, "hb.flap");
  await number(page, "hb.flap_height", "Flap height", 7.5);
  await confirm(page, "hb.top_handle");
  await confirm(page, "hb.top_handle.qty");
  await number(page, "hb.top_handle.drop", "Handle drop", 6.5);
  await confirm(page, "hb.top_handle.style");
  await confirm(page, "hb.top_handle.attachment");
  await confirm(page, "hb.strap");
  await pickChip(page, "hb.strap.removable", "FIXED");
  await yes(page, "hb.strap.adjustable", false);
  await q(page, "hb.strap.attachment").getByRole("checkbox", { name: "SIDE LOOP" }).click();
  await settled(page);
  await confirm(page, "hb.gusset");
  await confirm(page, "hb.base");
  await yes(page, "hb.feet", false);
  await confirm(page, "hb.charm");
  await confirm(page, "hb.charm.code");

  /* ---- Materials list (AI-detected) ---- */
  await confirm(page, "materials.list");

  /* ---- Branding: TPU logo plate, ref PINK005, centred, 1.5 cm (15 mm) above the flap edge ---- */
  await pickChip(page, "branding.logo_type", "TPU / RUBBER PATCH");
  await confirm(page, "branding.logo_code");
  await confirm(page, "branding.placement");
  await number(page, "branding.offset", "Offset from nearest edge", 15);
  await confirm(page, "branding.offset_edge");
  await pickChip(page, "branding.finish", "SHINY CHAMPAGNE GOLD");

  /* ---- Edge + hardware ---- */
  await confirm(page, "edge.treatment");
  await confirm(page, "edge.paint_colour");
  await confirm(page, "hardware.finish");
  for (const [code, qty, placement] of [
    ["PINK005", 1, "CENTERED ON FLAP"],
    ["PINK006", 2, "UNDER FLAP, SPACED EVENLY"],
    ["PINK003", 1, "CLIPPED TO LEFT D-RING"],
  ] as const) {
    await page.getByTestId("hardware.items-add").click();
    const row = page.locator('[data-testid^="hardware.items-row-"]').last();
    await pick(page, row.getByRole("button", { name: /Choose from library/ }), code);
    await step(row, "Qty", qty);
    await settled(page);
    await row.getByRole("textbox").last().fill(placement);
    await row.getByRole("textbox").last().press("Enter");
    await settled(page);
  }

  /* ---- Interior: tonal heat-stamp lining, back-wall slip pocket, PINK004 woven label ---- */
  await confirm(page, "interior.lined");
  await pickChip(page, "interior.lining_artwork_type", "PRINT (LIBRARY)");
  await pick(page, page.getByTestId("q-input-interior.lining_print"), "PINK TONAL");
  await page.getByTestId("interior.pockets-add").click();
  const pocket = page.getByTestId("interior.pockets-row-0");
  await chip(pocket, "SLIP POCKET");
  await settled(page);
  await chip(pocket, "BACK WALL");
  await settled(page);
  await step(pocket, "W", 14);
  await settled(page);
  await step(pocket, "From top", 2.5);
  await settled(page);
  await chip(pocket, "Yes");
  await settled(page);
  await pickChip(page, "interior.pocket_edge", "BINDING");
  await pick(page, page.getByTestId("q-input-interior.label"), "PINK004");
  await step(q(page, "interior.label_size"), "Interior label size (W × H) width", 4);
  await settled(page);
  await step(q(page, "interior.label_size"), "Interior label size (W × H) height", 2);
  await settled(page);
  await number(page, "interior.label_offset", "Label offset (from the position above)", 1.5);
  await yes(page, "interior.label_centered");
  await yes(page, "interior.seam_binding", false);

  /* ---- Material / colour breakdown ---- */
  await pick(page, page.getByTestId("cell--A-mat_1").getByRole("button").first(), "IRIDESCENT BLACK");
  await pick(page, page.getByTestId("cell--B-mat_1").getByRole("button").first(), "IRIDESCENT PINK");
  await page.getByTestId("matrix-autofill").click();
  await settled(page);
  await expect(page.getByTestId("cell--A-edge_paint").getByRole("button", { name: "DTM" })).toHaveClass(/bg-ink/);

  /* ---- Comments (lettered red circles) ---- */
  for (const c of [
    "OVERALL EXTERIOR DIMENSIONS: 16 CM HEIGHT X 20 CM WIDTH X 8 CM DEPTH",
    "SATCHEL HAS SHOULDER STRAP THAT IS NOT REMOVABLE. SEE REFERENCE PHOTOS FOR CONSTRUCTION.",
    "TOP HANDLE DROP HEIGHT: 6.5 CM",
    "FRONT FLAP HAS SNAP CLOSURE. 2 SNAPS TOTAL, SPACED EVENLY UNDER FLAP.",
  ]) {
    await page.getByTestId("comments.list-add").click();
    const row = page.locator('[data-testid^="comments.list-row-"]').last();
    await row.locator("textarea").fill(c);
    await row.locator("textarea").press("Enter");
    await settled(page);
  }

  await shot(page, "05-pack-complete");
  await shot(page, "05b-pack-complete-full", true);

  /* ---- Reload: everything persisted ---- */
  await page.reload();
  await expect(q(page, "branding.logo_type").getByRole("radio", { name: "TPU / RUBBER PATCH" })).toHaveAttribute("aria-checked", "true");

  /* ---- Verify every Part 6 answer in the TechPack JSON ---- */
  const res = await page.request.get(`/api/packs/${packId}/techpack`);
  expect(res.ok()).toBeTruthy();
  const tp = await res.json();
  writeFileSync(path.join(process.cwd(), ".data", "PINK013.techpack.json"), JSON.stringify(tp, null, 2));

  const results: { item: string; ok: boolean; got: unknown }[] = [];
  const check = (item: string, got: unknown, ok: boolean) => results.push({ item, ok, got });
  const c = tp.construction;
  const pocket0 = tp.interior.pockets[0];
  const art = tp.artwork.find((x: { name: string }) => x.name === "PINK TONAL HEAT STAMP REPEAT");
  const cell = (cw: string, k: string) => tp.colorways.find((x: { code: string }) => x.code === cw).cells[k];

  check("16 × 20 × 8 cm", tp.dimensions, tp.dimensions.unit === "cm" && tp.dimensions.height === 16 && tp.dimensions.width === 20 && tp.dimensions.depth === 8 && tp.dimensions.status === "confirmed");
  check("6.5 cm handle drop", c["hb.top_handle.drop"], c["hb.top_handle.drop"] === "6.5 CM");
  check("Flap 7.5 cm", c["hb.flap_height"], c["hb.flap_height"] === "7.5 CM");
  check("2 magnetic snaps spaced evenly", [c["hb.closure"], c["hb.closure.snap_qty"], c["hb.closure.snap_spacing"]], c["hb.closure"] === "FLAP + MAGNETIC SNAP" && c["hb.closure.snap_qty"] === 2 && c["hb.closure.snap_spacing"] === "SPACED EVENLY");
  check("Fixed shoulder strap on side loops with swivel hooks", [c["hb.strap"], c["hb.strap.removable"], c["hb.strap.attachment"]], c["hb.strap"] === true && c["hb.strap.removable"] === "FIXED" && c["hb.strap.attachment"].includes("SIDE LOOP") && c["hb.strap.attachment"].includes("SWIVEL HOOK"));
  check("Standard gusset, no pleats", c["hb.gusset"], c["hb.gusset"] === "STANDARD (NO PLEATS)" && c["hb.gusset_width"] === "8 cm");
  const b = tp.branding[0];
  check("TPU logo plate centred 1.5 cm above flap edge, ref PINK005, shiny champagne gold", b, b.type === "TPU / RUBBER PATCH" && b.code === "PINK005" && b.placement === "CENTERED ON FLAP" && b.position_ref === "15 MM FROM FLAP EDGE" && b.finish === "SHINY CHAMPAGNE GOLD");
  check("Keychain PINK003", c["hb.charm.code"], c["hb.charm"] === true && c["hb.charm.code"] === "PINK003" && tp.hardware.some((h: { code: string }) => h.code === "PINK003"));
  check("Lining tonal heat-stamp PINK repeat, 10 × 10 cm tile, Pantone 203 C", art, tp.interior.lining_print === "PINK TONAL HEAT STAMP REPEAT" && art?.tile === "10 X 10 CM" && art?.colours.includes("PANTONE 203 C") && art?.application === "TONAL HEAT STAMP");
  check("Back-wall slip pocket 14 cm wide, 2.5 cm from top, with binding", [pocket0, tp.interior.pocket_edge], pocket0.type === "SLIP POCKET" && pocket0.wall === "BACK WALL" && pocket0.w === 14 && pocket0.top_offset === 2.5 && pocket0.unit === "cm" && tp.interior.pocket_edge === "BINDING");
  check("PINK004 woven label 4 × 2 cm, 1.5 cm below pocket top", tp.interior.label, tp.interior.label.code === "PINK004" && tp.interior.label.type === "WOVEN LABEL" && tp.interior.label.size.w === 4 && tp.interior.label.size.h === 2 && tp.interior.label.offset_below_pocket_top === 1.5);
  check("-A: Junfa smooth PU #2 iridescent black", cell("-A", "mat_1"), /JUNFA LEATHER SMOOTH PU \/ #2 IRIDESCENT BLACK/.test(cell("-A", "mat_1").text));
  check("-B: Junfa smooth PU #24 iridescent pink", cell("-B", "mat_1"), /JUNFA LEATHER SMOOTH PU \/ #24 IRIDESCENT PINK/.test(cell("-B", "mat_1").text));
  check("Edge paint DTM", [tp.construction["edge.paint_colour"], cell("-A", "edge_paint"), cell("-B", "edge_paint")], tp.construction["edge.paint_colour"] === "DTM" && cell("-A", "edge_paint") === "DTM" && cell("-B", "edge_paint") === "DTM");

  const part6Ids = [
    "dims.h", "dims.w", "dims.d", "hb.top_handle.drop", "hb.flap_height", "hb.closure", "hb.closure.snap_qty", "hb.closure.snap_spacing",
    "hb.strap", "hb.strap.removable", "hb.strap.attachment", "hb.gusset", "branding.logo_type", "branding.logo_code", "branding.placement",
    "branding.offset", "branding.finish", "hb.charm", "hb.charm.code", "interior.lining_print", "interior.pockets", "interior.pocket_edge",
    "interior.label", "interior.label_size", "interior.label_offset", "materials.matrix", "edge.treatment", "edge.paint_colour",
  ];
  const unconfirmed = part6Ids.filter((id) => tp.answer_status[id] !== "confirmed");
  check("Every Part 6 answer confirmed (no AI-suggested / EST left)", unconfirmed, unconfirmed.length === 0);
  check("Header: SENT BY from login, physical-sample banner, ASAP, reference sample", tp.header, tp.header.sent_by === "EMILY" && tp.header.physical_sample_to_follow === true && tp.header.due_date === "ASAP" && tp.header.reference_sample === "BETSY JOHNSON" && tp.header.proto_colorways.join() === "-A,-B");

  writeFileSync(path.join(process.cwd(), ".data", "PINK013.results.json"), JSON.stringify(results, null, 2));
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.item}${r.ok ? "" : `  → got ${JSON.stringify(r.got)}`}`);
  expect(results.filter((r) => !r.ok).map((r) => r.item)).toEqual([]);
});
