/**
 * PHASE 2 ACCEPTANCE TEST
 * "PINK013 and TB25_ACC0023 PDFs match the reference packs page for page; spell-check flags
 *  CLOURE, RECIEVE, IRRIDESCENT, INGRAIVED."
 *
 * Runs after 02-pink013 (which enters PINK013 through the UI). TB25_ACC0023 is seeded from its
 * reference pack. Each generated PDF is compared page by page with the content of the reference
 * page it corresponds to (text extracted with pdftotext). Spelling in the expectations is the
 * corrected spelling — the app fixes CLOURE etc.
 *
 * Flats (line art) arrive in Phase 3: until then the CAD render stands in for front-view flats
 * and dimensions are listed in red rather than drawn on a flat.
 */
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { referenceAssets, tbAssets } from "./assets";
import { login, ADMIN } from "./helpers";
import { seedTb25 } from "./seed-tb25";

const OUT = path.join(process.cwd(), ".data", "phase2");
const SHOTS = process.env.SHOTS_DIR;

type PageExpect = { reference: string; contains: string[] };

/** PINK013 reference pages 1–8 (same order in the Icon template). */
const PINK013: PageExpect[] = [
  {
    reference: "1/8 MATERIALS / HARDWARE",
    contains: [
      "PAGE 1/8", "MATERIALS / HARDWARE", "ICON LUXURY GROUP", "ATTN: FTY", "RETAILER : PINK", "REFERENCE SAMPLE: BETSY JOHNSON",
      "SENT BY: EMILY", "DUE DATE: ASAP", "PROTO : PINK013-A, B", "BAG CATEGORY: SATCHEL", "STYLE NAME: JODIE",
      "16 CM H X 20 CM W X 8 CM D", "SHOULDER BAG SATCHEL W/ FLAP & LONG SHOULDER STRAP",
      "OVERALL EXTERIOR DIMENSIONS: 16 CM HEIGHT X 20 CM WIDTH X 8 CM DEPTH", "SHOULDER STRAP THAT IS NOT REMOVABLE",
      "YOU WILL RECEIVE A PHYSICAL SAMPLE IN SIMILAR", "FRONT VIEW", "LOGO (CENTERED", "PINK003 INCLUDED",
      "MATERIAL / COLOR BREAKDOWN", "MAIN BODY MTL", "(SEE PG 7/8 FOR SWATCH CARD REFERENCE)", "(SEE PG 8/8 FOR SWATCH CARD REFERENCE)",
      "JUNFA LEATHER SMOOTH PU / #2 IRIDESCENT BLACK", "JUNFA LEATHER SMOOTH PU / #24 IRIDESCENT PINK",
      "TONAL HEAT STAMP CUSTOM ARTWORK", "SEE DETAIL SHEET PG 6/8", "EDGE PAINT", "DTM", "SHINY CHAMPAGNE GOLD", "TPU", "REF TO PINK005",
      "PINK013-A", "PINK013-B",
    ],
  },
  {
    reference: "2/8 MEASUREMENTS SHEET",
    contains: [
      "PAGE 2/8", "MEASUREMENTS SHEET", "TOP HANDLE DROP HEIGHT: 6.5 CM", "FRONT FLAP HAS SNAP CLOSURE", "2 SNAPS TOTAL, SPACED EVENLY UNDER FLAP",
      "7.5 CM", "1.5 CM", "16 CM TOTAL HEIGHT", "20 CM TOTAL WIDTH", "8 CM TOTAL DEPTH", "LOGO (CENTERED)", "FRONT FLAP SNAP CLOSURE",
      "STANDARD GUSSET", "SHOULDER STRAP",
    ],
  },
  { reference: "3/8 ENLARGED CAD", contains: ["PAGE 3/8", "ENLARGED CAD", "PINK013-A", "PINK013-B"] },
  { reference: "4/8 REFERENCE PHOTOS FOR CONSTRUCTION", contains: ["PAGE 4/8", "REFERENCE PHOTOS FOR CONSTRUCTION", "SHOULDER STRAP ATTACHMENT DETAIL REFERENCE"] },
  {
    reference: "5/8 INTERIOR & LINING",
    contains: [
      "PAGE 5/8", "INTERIOR & LINING", "ADD PINK004 PINK LONDON WOVEN LABEL (CENTERED)", "INTERIOR MAIN COMPARTMENT BACK WALL", "(PKT IS CENTERED)",
      "W/ LINING", "BINDING", "2.5 CM", "14 CM", "1.5 CM", "2 CM", "4 CM", "REMAINING HEIGHT",
    ],
  },
  { reference: "6/8 LINING ARTWORK", contains: ["PAGE 6/8", "LINING ARTWORK", "LINING IS TONAL HEAT STAMP REPEAT", "10 CM", "PANTONE 203 C"] },
  { reference: "7/8 MAIN BODY #1 MTL (-A)", contains: ["PAGE 7/8", "MAIN BODY #1 MTL", "FOR REFERENCE PINK013-A ONLY", "JUNFA LEATHER", "SWATCH CARD", "SMOOTH PU / #2", "IRIDESCENT BLACK"] },
  { reference: "8/8 MAIN BODY #1 MTL (-B)", contains: ["PAGE 8/8", "MAIN BODY #1 MTL", "FOR REFERENCE PINK013-B ONLY", "JUNFA LEATHER", "SWATCH CARD", "SMOOTH PU / #24", "IRIDESCENT PINK"] },
];

/**
 * TB25_ACC0023 reference pages, in the order the Icon template prints them. The reference itself
 * is in Ted Baker's order (features, references, materials, interior, hardware, fabric) — the
 * `reference` label gives the reference page each one corresponds to.
 */
const TB25: PageExpect[] = [
  {
    reference: "TB p3 — materials / colour breakdown",
    contains: [
      "PAGE 1/6", "MATERIALS / HARDWARE", "TB25_ACC0023", "GINGHAM PU MEN'S DOPP KIT", "DOUBLED PU 22MM HANDLE. PLEASE EDGE PAINT ALL PU IN BLACK.",
      "GINGHAM EFFECT PU LEATHER", "SMOOTH PU LEATHER TRIM", "ZIPPER", "#8 PLASTIC W/ METAL FINISH", "BLACK TAPE", "DTM TAPE", "GUNMETAL COLOR TEETH",
      "SWATCH CARD REFERENCE", "BLACK", "BROWN", "NAVY", "PU DEBOSSED LOGO PATCH WITH GUNMETAL FILLING",
    ],
  },
  {
    reference: "TB p1 — product features",
    contains: [
      "PAGE 2/6", "PRODUCT FEATURES", "GINGHAM PU MEN'S DOPP KIT", "ZIPPERED MAIN COMPARTMENT", "BACK ZIPPERED POCKET", "PU TRIM", "GINGHAM EFFECT PU BODY",
      "PU DEBOSSED LOGO", "GUNMETAL HARDWARE", "INTERIOR ORG", "PRINTED LINING", "1MM PADDING ALL OVER", '5.25"', '4.25"', '10.25"',
    ],
  },
  { reference: "TB p2 — reference images", contains: ["PAGE 3/6", "REFERENCE", "REFERENCE IMAGES"] },
  {
    reference: "TB p4 — interior + lining repeat",
    contains: ["PAGE 4/6", "INTERIOR & LINING", "#5 NYLON COIL ZIPPERED POCKET", "INTERIOR SIDE 1", "REPEAT", "190D POLY HEAT SEAL TEXTURE", "BLACK", "17-3914 TCX SHARKSKIN", "20.8 MM", "PLEASE MAKE SURE TO ADD INTERIOR BINDING"],
  },
  {
    reference: "TB p5 — hardware / branding detail",
    contains: ["PAGE 5/6", "HARDWARE / BRANDING DETAIL", "ZIPPER PULL", "16 X 42 MM", "SIZE 100%", "GUNMETAL", "HOLLOW", "INKED METALLIC LOGO", "EMBOSSED ENAMEL INLAY", "55MM", "21.8MM", "LOGO DEBOSS WITH GUNMETAL"],
  },
  { reference: "TB p6 — fabric reference", contains: ["PAGE 6/6", "FABRIC REFERENCE", "BLACK", "BROWN", "NAVY", "JINXIN", "AH316HB-P"] },
];

const norm = (s: string) => s.toUpperCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

async function pdfPages(page: Page, packId: string, name: string) {
  const res = await page.request.get(`/api/packs/${packId}/pdf?draft=1`, { timeout: 180_000 });
  expect(res.status(), await res.text().catch(() => "")).toBe(200);
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.pdf`);
  writeFileSync(file, await res.body());
  const info = execFileSync("pdfinfo", [file]).toString();
  const count = Number(/Pages:\s+(\d+)/.exec(info)![1]);
  const size = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(info)!;
  const texts = Array.from({ length: count }, (_, i) => norm(execFileSync("pdftotext", ["-f", String(i + 1), "-l", String(i + 1), "-raw", file, "-"]).toString()));
  if (SHOTS) execFileSync("pdftoppm", ["-r", "50", "-png", file, path.join(SHOTS, name)]);
  return { file, count, width: Number(size[1]), height: Number(size[2]), texts };
}

function compare(name: string, expected: PageExpect[], got: { count: number; texts: string[] }) {
  const results = expected.map((e, i) => {
    const text = got.texts[i] ?? "";
    // Vertical dimension text (e.g. 21.8MM up the side of the logo patch) extracts letter-spaced.
    const tight = text.replace(/\s+/g, "");
    const missing = e.contains.filter((c) => !text.includes(norm(c)) && !tight.includes(norm(c).replace(/\s+/g, "")));
    return { page: i + 1, reference: e.reference, ok: missing.length === 0, missing };
  });
  for (const r of results) console.log(`${name} p${r.page}  ${r.ok ? "PASS" : "FAIL"}  ${r.reference}${r.ok ? "" : `  → missing ${JSON.stringify(r.missing)}`}`);
  return results;
}

test("Phase 2: PDFs page for page, validation gate, spell-check", async ({ page }) => {
  const pink = referenceAssets();
  const tb = tbAssets();
  test.skip(!pink || !tb, "reference packs not present");
  await login(page);

  /* ---------- finish PINK013's page set-up through the workspace ---------- */
  await page.getByRole("link", { name: /PINK013/ }).click();
  await page.waitForURL(/\/packs\//);
  const packId = page.url().split("/").pop()!;
  const q = (id: string) => page.getByTestId(`q-${id}`);
  const settled = () => expect(page.getByText("Saving…")).toHaveCount(0);

  // Comment letters → pages (A, B on page 1; C, D on the measurements sheet, as on the reference).
  for (const [i, where] of [[0, "MATERIALS / HARDWARE"], [1, "MATERIALS / HARDWARE"], [2, "MEASUREMENTS SHEET"], [3, "MEASUREMENTS SHEET"]] as const) {
    await page.getByTestId(`comments.list-row-${i}`).getByRole("checkbox", { name: where, exact: true }).click();
    await settled();
  }
  // Product features page: off for PINK013 (the reference has none).
  await q("pages.product_features").getByRole("radio", { name: "No" }).click();
  await settled();

  // Construction photos: B = strap attachment (reference photos page), D = closure detail (measurements sheet).
  // 02-pink013 already added the side view, the strap zoom and the Champion lining photo.
  const fileItem = (name: string) => page.locator("li").filter({ has: page.getByLabel(`Caption for ${name}`) });
  await page.getByTestId("upload-construction").setInputFiles({ name: "closure.jpg", mimeType: "image/jpeg", buffer: pink!.closureDetail });
  await expect(page.getByLabel("Caption for closure.jpg")).toBeVisible();
  for (const [name, letter, caption] of [["strap-attachment.jpg", "B", "SHOULDER STRAP ATTACHMENT DETAIL REFERENCE"], ["closure.jpg", "D", "FRONT FLAP SNAP CLOSURE"]]) {
    await fileItem(name).getByLabel("Comment letter").selectOption(letter);
    await settled();
    await fileItem(name).getByLabel(`Caption for ${name}`).fill(caption);
    await fileItem(name).getByLabel(`Caption for ${name}`).press("Enter");
    await settled();
  }
  await expect(fileItem("closure.jpg").getByLabel("Comment letter")).toHaveValue("D");

  /* ---------- spell-check: the four misspellings from the source packs ---------- */
  await page.getByTestId("comments.list-add").click();
  const row = page.getByTestId("comments.list-row-4");
  // Adding the row saves and re-renders it; type only once that save has landed, or the textarea
  // can be swapped out between fill and Enter ("element was detached").
  await expect(row).toBeVisible();
  await settled();
  await expect(row.locator("textarea")).toBeEditable();
  await row.locator("textarea").fill("FRONT FLAP SNAP CLOURE. YOU WILL RECIEVE IRRIDESCENT BLACK. INGRAIVED LOGO.");
  await expect(row.locator("textarea")).toHaveValue(/INGRAIVED LOGO\.$/);
  await row.locator("textarea").press("Enter");
  await settled();
  const spelling = page.getByTestId("spelling");
  for (const [bad, good] of [["CLOURE", "CLOSURE"], ["RECIEVE", "RECEIVE"], ["IRRIDESCENT", "IRIDESCENT"], ["INGRAIVED", "ENGRAVED"]]) await expect(spelling).toContainText(`${bad} → ${good}`);
  if (SHOTS) await page.getByTestId("export-panel").screenshot({ path: path.join(SHOTS, "gate-spelling.png") });
  const v = await (await page.request.get(`/api/packs/${packId}/validation`)).json();
  const flagged = v.spelling.map((s: { word: string }) => s.word).sort();
  console.log("in-app spell-check flags:", v.spelling.map((s: { word: string; suggestion: string }) => `${s.word}→${s.suggestion}`).join(", "));
  expect(flagged).toEqual(["CLOURE", "INGRAIVED", "IRRIDESCENT", "RECIEVE"]);
  // One-click accept, then the comment reads correctly.
  while ((await spelling.getByRole("button", { name: "Accept" }).count()) > 0) {
    const n = await spelling.getByRole("button", { name: "Accept" }).count();
    await spelling.getByRole("button", { name: "Accept" }).first().click();
    await expect(spelling.getByRole("button", { name: "Accept" })).toHaveCount(n - 1, { timeout: 20_000 });
  }
  await expect(page.getByTestId("comments.list-row-4").locator("textarea")).toHaveValue("FRONT FLAP SNAP CLOSURE. YOU WILL RECEIVE IRIDESCENT BLACK. ENGRAVED LOGO.");
  await page.getByRole("button", { name: "Remove row 5" }).click();
  await settled();

  /* ---------- validation gate: export is blocked, and says exactly why ---------- */
  const blocked = await page.request.get(`/api/packs/${packId}/pdf`);
  expect(blocked.status()).toBe(409);
  const failing = (await blocked.json()).failing.map((r: { rule: string }) => r.rule);
  console.log("PINK013 gate — still to fix:", failing.join(" | "));
  // V2.1 §1.3: at PROTO only the strap spec still blocks (no reference answer was given for it) …
  expect(failing).toEqual(["★ Strap width", "★ Strap total length"]);
  // … while production asks for the rest.
  const prod = (await (await page.request.get(`/api/packs/${packId}/validation?stage=PRODUCTION`)).json()).rules.filter((r: { status: string }) => r.status === "fail").map((r: { rule: string }) => r.rule);
  expect(prod).toEqual(expect.arrayContaining(["★ Strap width", "★ Strap total length", "★ Logo size (W × H)", "★ Lining material"]));
  await expect(page.getByTestId("gate-status")).toContainText("to fix");
  if (SHOTS) await page.getByTestId("export-panel").screenshot({ path: path.join(SHOTS, "gate-blocked.png") });

  /* ---------- PDFs, page for page ---------- */
  const tbId = await seedTb25(tb!, ADMIN.email);
  const pinkPdf = await pdfPages(page, packId, "PINK013");
  const tbPdf = await pdfPages(page, tbId, "TB25_ACC0023");
  for (const p of [pinkPdf, tbPdf]) {
    expect(p.width).toBe(1224); // 17 in
    expect(p.height).toBe(792); // 11 in
  }
  const tbGate = await (await page.request.get(`/api/packs/${tbId}/validation`)).json();
  console.log("TB25 gate — still to fix:", tbGate.rules.filter((r: { status: string }) => r.status === "fail").map((r: { rule: string }) => r.rule).join(" | "));

  const pinkResults = compare("PINK013", PINK013, pinkPdf);
  const tbResults = compare("TB25_ACC0023", TB25, tbPdf);
  writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ PINK013: { pages: pinkPdf.count, results: pinkResults }, TB25_ACC0023: { pages: tbPdf.count, results: tbResults } }, null, 2));
  expect(pinkPdf.count).toBe(8);
  expect(tbPdf.count).toBe(6);
  expect([...pinkResults, ...tbResults].filter((r) => !r.ok)).toEqual([]);
});
