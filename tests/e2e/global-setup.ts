import { execSync } from "node:child_process";
import postgres from "postgres";

/** Fresh test database for every run: drop everything, migrate, seed brands + the admin. */
export default async function globalSetup() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await sql.end();
  execSync("npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts", { stdio: "inherit", env: process.env });
}
