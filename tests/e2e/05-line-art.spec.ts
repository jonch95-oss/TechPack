/**
 * PHASE 3 ACCEPTANCE TEST
 * "Front flat of the Jodie render is editable and its dimension lines read 16 × 20 cm."
 *
 * Runs after 02-pink013 (PINK013 entered from its render). There is no image API key in tests,
 * so the front view is traced straight from the render (the same fallback the studio uses without
 * a key); the back view comes from a flat fixture written at run time (never committed — it is
 * derived from the confidential render).
 */
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { flats, packs } from "../../src/db/schema";
import { referenceAssets } from "./assets";
import { login } from "./helpers";

const SHOTS = process.env.SHOTS_DIR;
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(sql);
test.afterAll(() => sql.end());

const count = async (page: Page, layer: string) => Number(await page.getByTestId(`layer-count-${layer}`).textContent());

test("Phase 3: Jodie front flat is editable and its dimension lines read 16 × 20 cm", async ({ page }) => {
  const ref = referenceAssets();
  test.skip(!ref, "reference/ packs not present");
  // Back-view fixture: an edge drawing of the mirrored render (stands in for the image API).
  const fixtures = path.resolve(".data/flat-fixtures");
  mkdirSync(fixtures, { recursive: true });
  const src = path.join(fixtures, "render.jpg");
  writeFileSync(src, ref!.renderBlack);
  execFileSync("convert", [src, "-flop", "-colorspace", "gray", "-blur", "0x1.2", "-edge", "3", "-negate", "-threshold", "60%", path.join(fixtures, "flat-back.png")]);

  await page.setViewportSize({ width: 1440, height: 1500 });
  await login(page);
  const [pink] = await db.select().from(packs).where(eq(packs.styleNo, "PINK013"));
  expect(pink, "run 02-pink013 first").toBeTruthy();
  await page.goto(`/packs/${pink.id}`);
  await page.getByTestId("lineart-link").click();
  await page.waitForURL(/\/flats$/);

  /* ---------- generate the front view: traced, scaled, dimensioned ---------- */
  await page.getByTestId("generate-flat").click();
  const editor = page.getByTestId("flat-editor");
  await expect(editor).toHaveAttribute("data-ready", "1", { timeout: 120_000 });
  await expect(page.getByTestId("dim-W")).toHaveText("20 CM");
  await expect(page.getByTestId("dim-H")).toHaveText("16 CM");
  await expect(page.getByTestId("dim-HANDLE_DROP")).toHaveText("6.5 CM");
  await expect(page.getByTestId("dim-FLAP")).toHaveText("7.5 CM");
  await expect(page.getByTestId("dim-LOGO_OFFSET")).toHaveText("1.5 CM");
  expect(await count(page, "outline")).toBeGreaterThan(5);
  expect(await count(page, "stitching")).toBeGreaterThan(0);
  expect(await count(page, "callouts")).toBeGreaterThanOrEqual(2); // material 1 + logo
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "lineart-front.png"), fullPage: true });

  /* ---------- editable: draw a line, it saves and survives a reload ---------- */
  const before = await count(page, "outline");
  const canvas = page.getByTestId("flat-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.getByTestId("tool-line").click();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.82);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.82);
  await page.mouse.dblclick(box.x + box.width * 0.6, box.y + box.height * 0.82);
  await expect.poll(() => count(page, "outline")).toBe(before + 1);
  await expect(page.getByTestId("flat-save")).toHaveText("Saved", { timeout: 15_000 });

  /* undo / redo */
  await page.getByTestId("tool-undo").click();
  await expect.poll(() => count(page, "outline")).toBe(before);
  await page.getByTestId("tool-redo").click();
  await expect.poll(() => count(page, "outline")).toBe(before + 1);
  await expect(page.getByTestId("flat-save")).toHaveText("Saved", { timeout: 15_000 });

  await page.reload();
  await expect(page.getByTestId("flat-editor")).toHaveAttribute("data-ready", "1");
  expect(await count(page, "outline")).toBe(before + 1);
  await expect(page.getByTestId("dim-W")).toHaveText("20 CM");

  /* dimension lines read true: drag an end of the width line and the label follows */
  const stored = (await db.select().from(flats).where(eq(flats.packId, pink.id)))[0];
  const w = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(stored.svg)!;
  const W = Number(w[1]),
    H = Number(w[2]);
  const m = /data-paper-data='(\{"kind":"dim","key":"W"[^']*\})'/.exec(stored.svg)!;
  const spec = JSON.parse(m[1]) as { x1: number; y1: number; x2: number; y2: number; offset: number };
  await canvas.scrollIntoViewIfNeeded();
  const cb = (await canvas.boundingBox())!;
  const zoom = Math.min(cb.width / W, cb.height / H) * 0.96;
  const toScreen = (x: number, y: number) => ({ x: cb.x + cb.width / 2 + (x - W / 2) * zoom, y: cb.y + cb.height / 2 + (y - H / 2) * zoom });
  const end = toScreen(spec.x2, spec.y2 + spec.offset);
  await page.getByTestId("tool-nodes").click();
  await page.mouse.move(end.x, end.y);
  await page.mouse.down();
  await page.mouse.move(end.x - 60, end.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId("dim-W")).not.toHaveText("20 CM");
  await page.getByTestId("tool-undo").click();
  await expect(page.getByTestId("dim-W")).toHaveText("20 CM");
  await expect(page.getByTestId("flat-save")).toHaveText("Saved", { timeout: 15_000 });

  /* ---------- back view: generated second, INFERRED — CONFIRM until approved ---------- */
  await page.getByTestId("view-BACK").click();
  await page.getByTestId("generate-flat").click();
  await expect(page.getByTestId("inferred-tag")).toBeVisible({ timeout: 120_000 });
  const gate = async () => ((await (await page.request.get(`/api/packs/${pink.id}/validation`)).json()).rules as { rule: string; status: string }[]).filter((r) => r.status === "fail").map((r) => r.rule);
  expect(await gate()).toContain("BACK view is inferred");

  /* ---------- the flats in the PDF: vector, dimensioned, INFERRED tag ---------- */
  const pdf = async (name: string) => {
    const res = await page.request.get(`/api/packs/${pink.id}/pdf?draft=1`, { timeout: 180_000 });
    expect(res.status()).toBe(200);
    const file = path.join(process.cwd(), ".data", "phase2", `${name}.pdf`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, await res.body());
    if (SHOTS) execFileSync("pdftoppm", ["-r", "50", "-f", "1", "-l", "2", "-png", file, path.join(SHOTS, name)]);
    // Whitespace-free: vertical dimension text extracts letter-spaced.
    return (n: number) => execFileSync("pdftotext", ["-f", String(n), "-l", String(n), "-raw", file, "-"]).toString().toUpperCase().replace(/\s+/g, "");
  };
  let text = await pdf("PINK013-lineart");
  expect(text(1)).toContain("FRONTVIEW");
  expect(text(1)).toContain("BACKVIEW");
  expect(text(1)).toContain("INFERRED—CONFIRM");
  expect(text(1)).toContain("LOGOPINK005");
  expect(text(2)).toContain("MEASUREMENTSSHEET");
  expect(text(2)).toContain("20CM");
  expect(text(2)).toContain("16CM");
  expect(text(2)).toContain("HANDLEDROP6.5CM");

  await page.getByTestId("approve-flat").click();
  await expect(page.getByTestId("inferred-tag")).toHaveCount(0);
  await expect.poll(gate).not.toContain("BACK view is inferred");
  text = await pdf("PINK013-lineart-approved");
  expect(text(1)).not.toContain("INFERRED—CONFIRM");
});
