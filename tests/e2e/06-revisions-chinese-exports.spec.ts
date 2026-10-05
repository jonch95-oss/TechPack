/**
 * PHASE 4 ACCEPTANCE TEST — BRIEF Part 6 items 4 and 5, plus the file exports.
 *  5. "Changing the PINK013 logo from metal to TPU must produce R1 with *UPDATED* on pages 1 and 2,
 *     plus a change-log entry."
 *  4. "Bilingual export of PINK013 must render cleanly with Chinese under every English line."
 *  Exports: line art as SVG / AI / EPS, artwork as layered PSD, everything as a ZIP.
 *
 * Runs after 02 (PINK013 entered), 04 (BOM, Blair) and 05 (line art). The answers 02 doesn't enter
 * (strap, logo size, construction …) are filled straight into the database so the gate passes.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { readPsd } from "ag-psd";
import { hardware, materials, packAnswers, packs, prints, revisions, users } from "../../src/db/schema";
import { referenceAssets } from "./assets";
import { login } from "./helpers";

const SHOTS = process.env.SHOTS_DIR;
const OUT = path.join(process.cwd(), ".data", "phase4");
const BLAIR = { email: "blair@iconluxurygroup.test", password: "Blair-Studio-2026!" };
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(sql);
test.afterAll(() => sql.end());

async function setAnswers(packId: string, values: Record<string, unknown>) {
  for (const [questionId, value] of Object.entries(values))
    await db.insert(packAnswers).values({ packId, questionId, value, status: "confirmed" }).onConflictDoUpdate({ target: [packAnswers.packId, packAnswers.questionId], set: { value, status: "confirmed" } });
}

async function loginAs(browser: Browser, email: string, password: string) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Enter the studio" }).click();
  await expect(page.getByRole("heading", { name: "Tech Packs" })).toBeVisible();
  return page;
}

/** Ask for review as Emily, sign off as Blair. */
async function signOff(page: Page, blair: Page, packId: string) {
  await page.goto(`/packs/${packId}`);
  await page.getByTestId("signoff").getByTestId("request-review").click();
  await expect(page.getByTestId("signoff")).toContainText("In review");
  await blair.goto(`/packs/${packId}`);
  await blair.getByTestId("approve").click();
  await expect(blair.getByTestId("signoff")).toContainText("Signed off by BLAIR");
}

/** Per-page text, whitespace removed (vertical text extracts letter-spaced). */
function pdfText(file: string) {
  const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [file]).toString())![1]);
  return Array.from({ length: pages }, (_, i) => execFileSync("pdftotext", ["-f", String(i + 1), "-l", String(i + 1), "-raw", file, "-"]).toString().replace(/\s+/g, ""));
}

async function download(page: Page, url: string, name: string) {
  const res = await page.request.get(url, { timeout: 180_000 });
  expect(res.status(), await res.text().catch(() => "")).toBe(200);
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name);
  writeFileSync(file, await res.body());
  return file;
}

test("Phase 4: R1 with *UPDATED* flags and change log, bilingual EN/中文, AI/EPS/SVG/PSD/ZIP", async ({ page, browser }) => {
  const ref = referenceAssets();
  test.skip(!ref, "reference/ packs not present");
  await login(page);
  const [pink] = await db.select().from(packs).where(eq(packs.styleNo, "PINK013"));
  expect(pink, "run 02-pink013 first").toBeTruthy();

  /* ---------- complete what 02 doesn't enter, with the logo still METAL ---------- */
  const hw = await db.select().from(hardware).where(inArray(hardware.code, ["PINK003", "PINK005", "PINK006"]));
  const code = (c: string) => hw.find((h) => h.code === c)!;
  await db.update(hardware).set({ dimsMm: "30 X 12" }).where(and(inArray(hardware.code, ["PINK003", "PINK005"]), eq(hardware.dimsMm, "")));
  const [lining] = await db.select().from(materials).limit(1);
  await setAnswers(pink.id, {
    "branding.logo_type": "METAL LOGO PLATE",
    "hb.strap.width": 2,
    "hb.strap.length": 120,
    "branding.logo_size": { w: 40, h: 12 },
    "construction.list": [{ area: "BODY SEAMS", edge: "TURNED EDGE", stitch: "LOCKSTITCH 301", spi: 8 }, { area: "FLAP EDGE", edge: "RAW EDGE PAINTED", stitch: "LOCKSTITCH 301", spi: 8 }],
    "construction.thread_colour": "DTM",
    "interior.lining_material": { id: lining.id, label: lining.supplier },
    "pom.list": [
      { point: "TOTAL HEIGHT", value: 16, tol: 0.5, how: "BASE TO TOP EDGE AT CENTRE FRONT" },
      { point: "TOTAL WIDTH", value: 20, tol: 0.5, how: "SIDE SEAM TO SIDE SEAM ACROSS THE BASE" },
      { point: "TOTAL DEPTH", value: 8, tol: 0.5, how: "FRONT TO BACK AT THE BASE" },
      { point: "HANDLE DROP", value: 6.5, tol: 1, how: "TOP OF HANDLE TO TOP EDGE OF BAG" },
      { point: "FLAP HEIGHT", value: 7.5, tol: 0.3, how: "FOLD LINE TO FLAP EDGE AT CENTRE" },
      { point: "STRAP TOTAL LENGTH", value: 120, tol: 1.5, how: "END TO END INCL. HARDWARE" },
    ],
    "placements.list": [
      { item: { id: code("PINK005").id, label: "PINK005" }, qty: 1, from: "FROM FLAP EDGE", distance: 15 },
      { item: { id: code("PINK006").id, label: "PINK006" }, qty: 2, from: "FROM SIDE SEAM", distance: 40, spacing: 120 },
    ],
  });
  const failing = async () => ((await (await page.request.get(`/api/packs/${pink.id}/validation`)).json()).rules as { rule: string; status: string }[]).filter((r) => r.status === "fail").map((r) => r.rule);
  await expect.poll(failing, { timeout: 20_000 }).toEqual([]);

  /* ---------- original: signed off, exported ---------- */
  await db.insert(users).values({ email: BLAIR.email, name: "BLAIR", role: "designer", passwordHash: await bcrypt.hash(BLAIR.password, 10), mustChangePassword: false }).onConflictDoNothing();
  const blair = await loginAs(browser, BLAIR.email, BLAIR.password);
  await signOff(page, blair, pink.id);
  const original = pdfText(await download(page, `/api/packs/${pink.id}/pdf`, "PINK013-original.pdf"));
  const iso = new Date().toISOString().slice(0, 10);
  const today = `${iso.slice(5, 7)}.${iso.slice(8, 10)}.${iso.slice(0, 4)}`; // the header prints US order
  expect(original[0]).toContain(`STYLECODE:PINK013${today}ITEM:`); // standard header: date in red, no revision yet
  expect(original.join("")).not.toContain("*UPDATED*");
  expect(original.join("")).not.toContain("CHANGELOG");

  /* ---------- the change: logo METAL → TPU, through the UI ---------- */
  await page.goto(`/packs/${pink.id}`);
  await page.getByTestId("q-branding.logo_type").getByRole("radio", { name: "TPU / RUBBER PATCH", exact: true }).click();
  await expect(page.getByText("Saving…")).toHaveCount(0);
  await expect(page.getByTestId("signoff")).toContainText("Draft"); // the edit undid the sign-off
  await expect(page.getByTestId("pending-changes")).toContainText("Next export issues R1");
  await expect(page.getByTestId("pending-changes")).toContainText("LOGO TYPE: METAL LOGO PLATE → TPU / RUBBER PATCH");
  await signOff(page, blair, pink.id);

  const r1File = await download(page, `/api/packs/${pink.id}/pdf`, "PINK013-R1.pdf");
  const r1 = pdfText(r1File);
  expect(r1[0]).toContain("P1·OVERVIEW*UPDATED*R1"); // page 1 tag
  expect(r1[0]).toContain("LOGO:(CENTERED)TPU/RUBBERPATCH*UPDATED*");
  expect(r1[0]).toContain(`${today}R1`); // the header date carries the latest revision
  expect(r1[1]).toContain("P2·MEASUREMENTS");
  expect(r1[1]).toContain("*UPDATED*");
  expect(r1[2]).toContain("P3·REFERENCEIMAGES");
  expect(r1[2]).not.toContain("*UPDATED*"); // nothing changed there
  const log = r1.find((t) => t.includes("CHANGELOG"))!;
  expect(log).toBeTruthy();
  expect(log).toContain("*UPDATED*LOGOTYPE:METALLOGOPLATE→TPU/RUBBERPATCH");
  if (SHOTS) execFileSync("pdftoppm", ["-r", "50", "-f", "1", "-l", "2", "-png", r1File, path.join(SHOTS, "PINK013-R1")]);

  const revs = await db.select().from(revisions).where(eq(revisions.packId, pink.id));
  expect(revs.map((r) => r.number).sort()).toEqual([0, 1]);
  // Earlier revisions stay downloadable.
  await page.reload();
  await expect(page.getByTestId("revision-ORIGINAL")).toBeVisible();
  await expect(page.getByTestId("revision-R1")).toBeVisible();
  const orig = revs.find((r) => r.number === 0)!;
  const again = await page.request.get(orig.pdfUrl!);
  expect(again.status()).toBe(200);
  expect((await again.body()).subarray(0, 4).toString()).toBe("%PDF");

  /* ---------- bilingual: EN + 中文 ---------- */
  await page.getByTestId("language").getByRole("radio", { name: "EN + 中文" }).click();
  await expect.poll(async () => (await db.select().from(packs).where(eq(packs.id, pink.id)))[0].chineseOn).toBe(true);
  const zhFile = await download(page, `/api/packs/${pink.id}/pdf`, "PINK013-R1-zh.pdf");
  const zh = pdfText(zhFile);
  const cjk = /[㐀-鿿]/;
  zh.forEach((t, i) => expect(cjk.test(t), `page ${i + 1} has Chinese`).toBe(true));
  expect(zh[0]).toContain("总览"); // section name
  const zhColourways = zh.find((t) => t.includes("COLOURWAYS"))!;
  expect(zhColourways).toContain("边油"); // EDGE PAINT (glossary)
  expect(zhColourways).toContain("里布"); // LINING (glossary)
  expect(zh[1]).toContain("尺寸");
  expect(execFileSync("pdffonts", [zhFile]).toString()).toMatch(/NotoSansSC|Noto Sans SC|IconSC/i);
  // Every English line has its Chinese: the final export refuses otherwise, and it went through.
  const html = await (await page.request.get(`/api/packs/${pink.id}/pdf?draft=1&format=html`)).text();
  expect(html).toContain("MATERIAL / COLOUR BREAKDOWN");
  if (SHOTS) execFileSync("pdftoppm", ["-r", "60", "-f", "1", "-l", "2", "-png", zhFile, path.join(SHOTS, "PINK013-zh")]);
  expect((await db.select().from(revisions).where(eq(revisions.packId, pink.id))).length).toBe(2); // language isn't a revision

  /* ---------- exports: SVG / AI / EPS / PSD / ZIP ---------- */
  const svg = readFileSync(await download(page, `/api/packs/${pink.id}/flats/front.svg`, "front.svg"), "utf8");
  expect(svg).toMatch(/^<\?xml/);
  for (const id of ["outline", "stitching", "hardware", "dimensions", "callouts"]) expect(svg).toContain(`id="${id}"`);
  const ai = await download(page, `/api/packs/${pink.id}/flats/front.ai`, "front.ai");
  expect(readFileSync(ai).subarray(0, 4).toString()).toBe("%PDF");
  expect(execFileSync("pdftotext", [ai, "-"]).toString()).toContain("20 CM");
  const eps = await download(page, `/api/packs/${pink.id}/flats/front.eps`, "front.eps");
  expect(readFileSync(eps, "utf8")).toMatch(/^%!PS-Adobe-3\.0 EPSF-3\.0/);
  try {
    execFileSync("gs", ["-q", "-dNOPAUSE", "-dBATCH", "-dSAFER", "-dEPSCrop", "-sDEVICE=png16m", "-r40", `-sOutputFile=${path.join(OUT, "front-eps.png")}`, eps]);
    expect(readFileSync(path.join(OUT, "front-eps.png")).length).toBeGreaterThan(5000);
  } catch (e) {
    if (!String(e).includes("ENOENT")) throw e; // no Ghostscript installed: skip the render check
  }

  // The PINK lining print gets its motif (a reference image stands in for the artwork) so the PSD carries the repeat.
  const dir = path.join(process.cwd(), ".data", "uploads", "e2e-pink");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "lining.png"), ref!.swatchPink);
  await db.update(prints).set({ motifUrl: "/api/files/e2e-pink/lining.png" }).where(eq(prints.name, "PINK TONAL HEAT STAMP REPEAT"));
  const zipFile = await download(page, `/api/packs/${pink.id}/export`, "PINK013.zip");
  const listing = execFileSync("unzip", ["-l", zipFile]).toString();
  for (const f of ["README.txt", "PINK013A_B_JODIE_R1.pdf", "line-art/PINK013_FRONT.svg", "line-art/PINK013_FRONT.ai", "line-art/PINK013_FRONT.eps", "line-art/PINK013_BACK.eps", "artwork/PINK013_JODIE_artwork.psd"]) expect(listing).toContain(f);
  const psdPath = path.join(OUT, "zip");
  execFileSync("unzip", ["-o", "-q", zipFile, "-d", psdPath]);
  const psd = readPsd(readFileSync(path.join(psdPath, "artwork", "PINK013_JODIE_artwork.psd")), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
  const groups = (psd.children ?? []).map((g) => [g.name, (g.children ?? []).map((c) => c.name)]);
  expect(groups).toEqual(
    expect.arrayContaining([
      ["COLORWAY RENDERS", ["PINK013-A", "PINK013-B"]],
      ["LINING REPEAT", ["REPEAT", "TILE BOX"]],
      ["LINE ART", ["FRONT VIEW", "BACK VIEW"]],
    ]),
  );
});
