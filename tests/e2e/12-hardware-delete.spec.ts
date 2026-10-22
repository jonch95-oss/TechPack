/** Admins delete hardware from the library; a part a pack still uses is refused, with the packs named. */
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { login } from "./helpers";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test("delete an unused part; a part in use is kept", async ({ page }) => {
  await sql`delete from hardware where code in ('ZZDEL1', 'ZZDEL2')`;
  const [free] = await sql`insert into hardware (code, type) values ('ZZDEL1', 'D-RING') returning id`;
  const [used] = await sql`insert into hardware (code, type) values ('ZZDEL2', 'D-RING') returning id`;
  const [pack] = await sql`select id, style_no from packs order by created_at limit 1`;
  if (pack) await sql`insert into library_usage (pack_id, lib, item_id) values (${pack.id}, 'hardware', ${used.id})`;

  await login(page);
  page.on("dialog", (d) => d.accept());

  await page.goto(`/library/hardware/${free.id}`);
  await page.getByTestId("delete-hardware").click();
  await expect(page).toHaveURL(/\/library\/hardware$/);
  expect((await sql`select 1 from hardware where id = ${free.id}`).length).toBe(0);

  if (pack) {
    await page.goto(`/library/hardware/${used.id}`);
    await page.getByTestId("delete-hardware").click();
    await expect(page.getByRole("alert")).toContainText(`ZZDEL2 is used in ${pack.style_no}`);
    expect((await sql`select 1 from hardware where id = ${used.id}`).length).toBe(1);
  }
  await sql`delete from library_usage where item_id = ${used.id}`;
  await sql`delete from hardware where id = ${used.id}`;
});
