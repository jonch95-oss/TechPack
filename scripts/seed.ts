/**
 * Seeds the launch brands and the first admin. Idempotent.
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 * Prefixes other than PINK and TB are placeholders — confirm them in Brands.
 */
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { brands, users } from "../src/db/schema";

const LAUNCH_BRANDS = [
  { name: "Pink London", codePrefix: "PINK", licensorRequired: false },
  { name: "Off-White", codePrefix: "OW", licensorRequired: false },
  { name: "Palm Angels", codePrefix: "PA", licensorRequired: false },
  { name: "PLAY Palm Angels", codePrefix: "PPA", licensorRequired: false },
  { name: "L/AB c/o Off-White", codePrefix: "LAB", licensorRequired: false },
  { name: "Ted Baker", codePrefix: "TB", licensorRequired: true },
  { name: "Champion", codePrefix: "CH", licensorRequired: true },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  for (const b of LAUNCH_BRANDS) {
    const existing = await db.select({ id: brands.id }).from(brands).where(eq(brands.name, b.name));
    if (!existing.length) await db.insert(brands).values({ ...b, codeFormat: `${b.codePrefix}###` });
  }
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!existing.length) {
      await db.insert(users).values({
        email,
        name: (process.env.SEED_ADMIN_NAME ?? "ADMIN").toUpperCase(),
        role: "admin",
        passwordHash: await bcrypt.hash(password, 10),
      });
      console.log(`Admin ${email} created.`);
    }
  }
  await sql.end();
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
