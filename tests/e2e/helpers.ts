import { expect, type Page } from "@playwright/test";

export const ADMIN = { email: "emily@iconluxurygroup.test", temp: "Atelier-2026!", password: "Atelier-Studio-2026!" };

/** Signs in; the first time, the temporary password must be changed (as for every new account). */
export async function login(page: Page) {
  const attempt = async (pw: string) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill(pw);
    await page.getByRole("button", { name: "Enter the studio" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 5000 }).catch(() => {});
    return !new URL(page.url()).pathname.startsWith("/login");
  };
  if (await attempt(ADMIN.password)) return;
  expect(await attempt(ADMIN.temp)).toBe(true);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible();
  await page.goto("/"); // the studio sends you straight back until the password is changed
  await expect(page).toHaveURL(/\/account$/);
  await page.getByLabel("Current password").fill(ADMIN.temp);
  await page.getByLabel("New password", { exact: true }).fill(ADMIN.password);
  await page.getByLabel("Confirm new password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("heading", { name: "Tech Packs" })).toBeVisible();
}
