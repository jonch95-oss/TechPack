/**
 * Bulk library uploads: a hardware PDF read by the AI (fixture), code call-outs in the review
 * table, the downloadable Excel template, and the live code check on the component form.
 */
import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { login } from "./helpers";

const TB_PDF = path.join(process.cwd(), "reference", "TB25_ACC0023_GINGHAM_PU_DOPP_KIT_TP_R1.pdf");

test("hardware from a PDF: codes missing → called out → designer enters them → saved", async ({ page }) => {
  test.skip(!existsSync(TB_PDF), "reference/TB25 pack not present");
  await login(page);

  // Templates download as real .xlsx files.
  const tpl = await page.request.get("/api/templates/hardware");
  expect(tpl.ok()).toBeTruthy();
  expect(tpl.headers()["content-type"]).toContain("spreadsheetml");
  expect((await tpl.body()).subarray(0, 2).toString()).toBe("PK");

  await page.goto("/library/hardware/import");
  await page.getByTestId("import-files-input").setInputFiles(TB_PDF);
  await expect(page.getByTestId("import-files")).toContainText("PDF");
  await page.getByTestId("import-review").click();

  const rows = page.getByTestId("import-row");
  await expect(rows).toHaveCount(2);
  await expect(page.getByTestId("import-summary")).toContainText("2 need fixing");
  await expect(rows.first()).toContainText("Enter a code — the next free Ted Baker code is TB001");
  await expect(page.getByTestId("import-save")).toBeDisabled();

  // Typing the same code twice is called out; fixing it clears the call-out.
  await rows.nth(0).getByLabel("Code").fill("TB001");
  await rows.nth(1).getByLabel("Code").fill("TB001");
  await expect(rows.nth(1)).toContainText("repeated in this upload");
  await rows.nth(1).getByLabel("Code").fill("TB002");
  await expect(page.getByTestId("import-summary")).toContainText("2");
  await expect(page.getByTestId("import-summary")).not.toContainText("need fixing");
  await page.getByTestId("import-save").click();
  await expect(page.getByTestId("import-report")).toContainText("2 added");
  await expect(page.getByTestId("import-report")).toContainText("TB001 · TB002");

  // The component form checks codes live: duplicates block, other formats are called out.
  await page.goto("/library/hardware/new");
  await page.locator("select").first().selectOption({ label: "Ted Baker" });
  await expect(page.getByLabel("Code")).toHaveValue("TB003"); // next free code pre-filled
  await page.getByLabel("Code").fill("TB001");
  await expect(page.getByTestId("code-check")).toContainText("already used by another component");
  await page.getByLabel("Code").fill("TB-PULL");
  await expect(page.getByTestId("code-check")).toContainText("doesn't follow the Ted Baker format");
  await page.getByRole("button", { name: /Use next free · TB003/ }).click();
  await expect(page.getByLabel("Code")).toHaveValue("TB003");
});
