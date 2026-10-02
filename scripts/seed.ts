/**
 * Seeds the launch brands and the first admin. Idempotent.
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 * Prefixes other than PINK and TB are placeholders — confirm them in Brands.
 */
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { brands, glossary, users } from "../src/db/schema";
import { DEFAULT_GLOSSARY } from "../src/lib/zh/dictionary";

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
  // Neon: migrations and seeding use the direct (unpooled) connection; the app uses the pooled one.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  for (const b of LAUNCH_BRANDS) {
    const existing = await db.select({ id: brands.id }).from(brands).where(eq(brands.name, b.name));
    if (!existing.length) await db.insert(brands).values({ ...b, codeFormat: `${b.codePrefix}###` });
  }
  // Starter trade glossary (BRIEF 1.5) — only when empty, so admins' edits are never overwritten.
  if (!(await db.select({ id: glossary.id }).from(glossary).limit(1)).length) {
    await db.insert(glossary).values(DEFAULT_GLOSSARY.map(([en, zh]) => ({ en, zh }))).onConflictDoNothing();
    console.log(`Glossary seeded (${DEFAULT_GLOSSARY.length} terms).`);
  }
  // The first admin is Jon; the password comes from SEED_ADMIN_PASSWORD (set in Vercel) and must be changed at first sign-in.
  const email = (process.env.SEED_ADMIN_EMAIL || "jonc@iconluxurygroup.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!existing.length) {
      await db.insert(users).values({
        email,
        name: (process.env.SEED_ADMIN_NAME || "JON").toUpperCase(),
        role: "admin",
        mustChangePassword: true,
        passwordHash: await bcrypt.hash(password, 10),
      });
      console.log(`Admin ${email} created.`);
    }
  } else if (email) {
    console.log("SEED_ADMIN_PASSWORD not set — first admin not created.");
  }
  await sql.end();
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
