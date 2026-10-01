import { defineConfig } from "@playwright/test";
import path from "node:path";

const PORT = 3200;
const env = {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5433/techpack_test",
  AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
  AI_FIXTURE_DIR: path.resolve("tests/fixtures/ai"),
  SEED_ADMIN_EMAIL: "emily@iconluxurygroup.test",
  SEED_ADMIN_PASSWORD: "Atelier-2026!",
  SEED_ADMIN_NAME: "EMILY",
  BLOB_READ_WRITE_TOKEN: "",
  ANTHROPIC_API_KEY: "",
};
Object.assign(process.env, env);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: ".data/e2e-results.json" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.CHROME ? { executablePath: process.env.CHROME } : undefined,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    port: PORT,
    timeout: 300_000,
    reuseExistingServer: false,
    env,
  },
});
