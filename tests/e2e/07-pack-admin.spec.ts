/**
 * Admin-only archive / restore / delete for packs (review round 2, item 5).
 * Runs after 02 (needs the Pink London brand).
 */
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin archives, restores and deletes a pack", async ({ page }) => {
  await login(page);
  await page.goto("/packs/new");
  await page.getByRole("button", { name: "Pink London" }).click();
  await page.getByRole("button", { name: "Handbags", exact: true }).click();
  await page.getByLabel("Style #").fill("PINK998");
  await page.getByLabel("Style name").fill("SMOKE TEST");
  await page.getByRole("button", { name: "Create pack" }).click();
  await page.waitForURL(/\/packs\/[0-9a-f-]{36}$/);
  const url = page.url();

  // Archive: read-only, off the dashboard, listed under Archived.
  await page.getByTestId("archive-pack").click();
  await expect(page.getByTestId("archived-note")).toBeVisible();
  await expect(page.getByTestId("upload-render")).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByText("PINK998")).toHaveCount(0);
  await page.getByTestId("archived-filter").click();
  await expect(page.getByText("PINK998")).toBeVisible();

  // Restore: editable again.
  await page.goto(url);
  await page.getByTestId("archive-pack").click();
  await expect(page.getByTestId("archived-note")).toHaveCount(0);
  await expect(page.getByTestId("upload-render")).toHaveCount(1);

  // Delete: only once the style # is typed.
  await page.getByTestId("delete-pack-open").click();
  await expect(page.getByTestId("delete-pack")).toBeDisabled();
  await page.getByLabel("Type PINK998 to confirm").fill("pink998");
  await page.getByTestId("delete-pack").click();
  await page.waitForURL(/\/\?deleted=PINK998$/);
  await expect(page.getByRole("status").filter({ hasText: "PINK998 was deleted." })).toBeVisible();
  await expect(page.getByText("PINK998", { exact: true })).toHaveCount(0);
  expect((await page.request.get(url)).status()).toBe(404);
});
