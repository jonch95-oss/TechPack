/**
 * A sign-in cookie whose session has ended (signed out elsewhere, password reset, deactivated)
 * must land on the login page, not loop between / and /login ("too many redirects").
 */
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { ADMIN, login } from "./helpers";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test("an ended session goes to the login page, and signing in again works", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Tech Packs" })).toBeVisible();

  // End every session behind the cookie, as a password reset or sign-out elsewhere does.
  await sql`delete from sessions where user_id = (select id from users where email = ${ADMIN.email})`;

  const res = await page.goto("/packs/new");
  expect(res?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Enter the studio" }).click();
  await expect(page.getByRole("heading", { name: "Tech Packs" })).toBeVisible();
});
