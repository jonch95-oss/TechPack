/**
 * V2 build step 1 (docs/V2-SEAMLESS-BRIEF.md §12.1): the keyboard-first Review screen with bulk
 * confirm, editable setup (style #, category, colourways with their data following), and the PDF as
 * a background job. Source priority / conflict chips are covered in 09, the final PDF job in 04.
 * Runs after 09 (works on its PINK996 pack, AI answers from tests/fixtures/ai/*.PINK996.json).
 */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { packs } from "../../src/db/schema";
import { referenceAssets } from "./assets";
import { login } from "./helpers";

test.skip(!referenceAssets(), "reference assets not present (spec 09 creates the pack this uses)");

test("Review screen, editable setup and background PDF", async ({ page }) => {
  test.setTimeout(180_000);
  const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5433/techpack", { max: 1 });
  const db = drizzle(sql);
  const [pack] = await db.select({ id: packs.id }).from(packs).where(eq(packs.styleNo, "PINK996"));
  await sql.end();
  expect(pack, "spec 09 leaves the PINK996 pack").toBeTruthy();
  page.on("dialog", (d) => void d.accept());

  await login(page);
  await page.goto(`/packs/${pack.id}`);

  /* ---- Review: compact spec sheet, grouped, keyboard-first ---- */
  await page.getByTestId("mode-review").click();
  const review = page.getByTestId("review-screen");
  await expect(review).toBeVisible();
  for (const g of ["Body", "Handles & straps", "Hardware", "Materials & colours"]) await expect(page.getByTestId(`review-group-${g}`)).toBeVisible();

  // Enter confirms the row under the cursor.
  const sil = page.getByTestId("review-row-hb.silhouette");
  await expect(page.getByTestId("review-confirm-hb.silhouette")).toBeVisible();
  await sil.click();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("review-confirm-hb.silhouette")).toHaveCount(0);

  // E edits in place; a number key picks the nth option; Esc closes.
  await page.keyboard.press("e");
  const edit = page.getByTestId("review-edit-hb.silhouette");
  await expect(edit).toBeVisible();
  const second = (await edit.getByRole("radio").nth(1).innerText()).trim();
  await page.keyboard.press("Escape");
  await expect(edit).toHaveCount(0);
  await page.keyboard.press("2");
  await expect(page.getByTestId("review-value-hb.silhouette")).toHaveText(second);
  await expect(page.getByText("Saved ✓")).toBeVisible();

  // ? shows the shortcuts; / searches.
  await page.keyboard.press("?");
  await expect(page.getByTestId("review-help")).toBeVisible();
  await page.keyboard.press("/");
  await page.keyboard.type("silhouette");
  await expect(review.locator("[data-row]")).toHaveCount(1);
  await page.getByLabel("Search answers").fill("");

  // ✓ All visible settles the render's own reads in one go (never EST, inferred or conflicts).
  const visible = page.getByTestId("review-confirm-visible");
  await expect(visible).toBeVisible();
  await visible.click();
  await expect(visible).toHaveCount(0);
  await expect(page.getByText("Saved ✓")).toBeVisible();

  // The view is remembered.
  await page.reload();
  await expect(page.getByTestId("review-screen")).toBeVisible();
  await page.getByTestId("mode-all").click();
  await expect(page.getByTestId("review-screen")).toHaveCount(0);

  /* ---- V2.1 §1: answer by reference; the stage is one click ---- */
  await page.getByTestId("ref-open-hb.strap.attachment").click();
  await page.getByTestId("ref-kind-SAME_AS").click();
  await page.getByTestId("ref-style-hb.strap.attachment").fill("PINK013");
  await page.getByTestId("ref-save-hb.strap.attachment").click();
  await expect(page.getByTestId("ref-value-hb.strap.attachment")).toHaveText("↪ SAME AS PINK013");
  await expect(page.getByText("Saved ✓")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("ref-value-hb.strap.attachment")).toHaveText("↪ SAME AS PINK013");
  await expect(page.getByTestId("stage-PROTO")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("stage-PRODUCTION").click();
  await expect(page.getByTestId("stage-PRODUCTION")).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByTestId("stage-PRODUCTION")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("stage-PROTO").click();
  await expect(page.getByTestId("stage-PROTO")).toHaveAttribute("aria-checked", "true");

  /* ---- Setup stays editable: style #, colourways (their data follows) ---- */
  await page.getByTestId("edit-setup").click();
  await page.getByTestId("setup-style").fill("PINK996B");
  await page.getByTestId("setup-save").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("PINK996B");

  await page.getByTestId("add-cw").click();
  await expect(page.getByTestId("setup-cw--B")).toBeVisible();
  await page.getByLabel("Name of -B").fill("PINK");
  await page.getByLabel("Name of -A").click(); // blur saves the name
  await expect(page.getByRole("status").filter({ hasText: "Renamed." })).toBeVisible();
  // Removing -A moves -B (and its name) up to -A.
  await page.getByTestId("remove-cw--A").click();
  await expect(page.getByTestId("setup-cw--B")).toHaveCount(0);
  await expect(page.getByLabel("Name of -A")).toHaveValue("PINK");

  /* ---- Multi-style packs (V2.1 §4): a colourway's own style #, unique across the studio ---- */
  await page.getByTestId("setup-cw-style--A").fill("PINK013");
  await page.getByLabel("Name of -A").click(); // blur saves
  await expect(page.getByRole("alert")).toContainText("PINK013 already exists.");
  await page.getByTestId("setup-cw-style--A").fill("PINK996C");
  await page.getByLabel("Name of -A").click();
  await expect(page.getByRole("status").filter({ hasText: "Style # saved." })).toBeVisible();
  await page.keyboard.press("Escape");
  // Every style # is searchable on the dashboard.
  await page.goto("/?q=PINK996C");
  await expect(page.getByTestId("pack-styles")).toContainText("PINK996C");
  await page.goBack();

  /* ---- Draft PDF builds as a background job ---- */
  await page.getByTestId("draft-pdf").click();
  const ready = page.getByTestId("pdf-ready");
  await expect(ready).toContainText("PINK996B", { timeout: 120_000 });
  const pdf = await page.request.get((await ready.getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
});
