/**
 * The technical-designer additions, end to end on PINK013 (entered by 02-pink013):
 * POM template + tolerances, BOM from answers, hardware approval in the library, duplicate pack,
 * the gate blocking until hardware placement is given in mm, second-designer sign-off before the
 * final PDF, factory + factory Q&A, and the sample log with photo mark-up and carry-over of open
 * comments into the next round.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { hardware, materials, packAnswers, packs, users } from "../../src/db/schema";
import { referenceAssets } from "./assets";
import { login } from "./helpers";

const SHOTS = process.env.SHOTS_DIR;
const BLAIR = { email: "blair@iconluxurygroup.test", password: "Blair-Studio-2026!" };

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(sql);
test.afterAll(() => sql.end());

const answer = async (packId: string, qid: string) =>
  (await db.select().from(packAnswers).where(and(eq(packAnswers.packId, packId), eq(packAnswers.questionId, qid))))[0]?.value;

async function setAnswers(packId: string, values: Record<string, unknown>) {
  for (const [questionId, value] of Object.entries(values))
    await db
      .insert(packAnswers)
      .values({ packId, questionId, value, status: "confirmed" })
      .onConflictDoUpdate({ target: [packAnswers.packId, packAnswers.questionId], set: { value, status: "confirmed" } });
}

async function loginAs(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Enter the studio" }).click();
  await expect(page.getByRole("heading", { name: "Tech Packs" })).toBeVisible();
  return page;
}

const failing = async (page: Page, packId: string) =>
  ((await (await page.request.get(`/api/packs/${packId}/validation`)).json()).rules as { rule: string; status: string }[]).filter((r) => r.status === "fail").map((r) => r.rule);

test("technical designer: POM, BOM, approvals, duplicate, sign-off, factory Q&A, samples", async ({ page, browser }) => {
  const ref = referenceAssets();
  test.skip(!ref, "reference/ packs not present");
  await login(page);
  const [pink] = await db.select().from(packs).where(eq(packs.styleNo, "PINK013"));
  expect(pink, "run 02-pink013 first").toBeTruthy();

  /* ---------- POM template and standard tolerances ---------- */
  await page.goto(`/packs/${pink.id}`);
  await page.getByTestId("pom-template").click();
  await expect.poll(async () => ((await answer(pink.id, "pom.list")) as unknown[] | undefined)?.length ?? 0).toBeGreaterThanOrEqual(13);
  const pom = (await answer(pink.id, "pom.list")) as { point: string; value?: number; tol?: number; how: string }[];
  const row = (p: string) => pom.find((r) => r.point === p);
  expect(row("TOTAL HEIGHT")?.value).toBe(16);
  expect(row("TOTAL WIDTH")?.value).toBe(20);
  expect(row("HANDLE DROP")?.value).toBe(6.5);
  expect(row("FLAP HEIGHT")?.value).toBe(7.5);
  expect(row("STRAP DROP")?.value).toBeUndefined(); // not answered → left blank, never invented
  expect(row("TOTAL HEIGHT")?.how).toMatch(/BASE TO TOP EDGE/);
  await page.getByTestId("pom-tolerances").click();
  await expect.poll(async () => ((await answer(pink.id, "pom.list")) as { tol?: number }[]).every((r) => r.tol != null)).toBe(true);
  expect(((await answer(pink.id, "pom.list")) as { point: string; tol: number }[]).find((r) => r.point === "TOTAL HEIGHT")?.tol).toBe(0.5);

  /* ---------- BOM built from the answers ---------- */
  await page.getByTestId("bom-build").click();
  await expect.poll(async () => ((await answer(pink.id, "bom.list")) as unknown[] | undefined)?.length ?? 0).toBeGreaterThan(3);
  const bom = (await answer(pink.id, "bom.list")) as { component: string; description: string }[];
  expect(bom.map((r) => r.component)).toEqual(expect.arrayContaining(["MAIN MATERIAL", "THREAD", "HARDWARE", "LABEL"]));
  expect(bom.map((r) => r.description)).toEqual(expect.arrayContaining(["PINK005", "PINK006", "PINK003"]));
  expect(JSON.stringify(bom)).not.toMatch(/PRICE|COST|MOQ|\$/);
  if (SHOTS) await page.locator("#sec-bom").screenshot({ path: path.join(SHOTS, "bom.png") }).catch(() => {});

  /* ---------- gate: snaps "spaced evenly" and unplaced hardware are blocked ---------- */
  const before = await failing(page, pink.id);
  expect(before).toEqual(expect.arrayContaining(["Placement of PINK006 (MAGNETIC SNAP)", "Snaps “spaced evenly”"]));

  /* ---------- hardware approval in the library ---------- */
  const hw = await db.select().from(hardware).where(inArray(hardware.code, ["PINK005", "PINK006"]));
  const pink005 = hw.find((h) => h.code === "PINK005")!;
  const pink006 = hw.find((h) => h.code === "PINK006")!;
  const warns = async () => ((await (await page.request.get(`/api/packs/${pink.id}/validation`)).json()).rules as { rule: string; status: string }[]).filter((r) => r.status === "warn").map((r) => r.rule);
  // Plating / mould approval is a production check (round 5): a proto pack doesn't warn about it.
  expect(await warns()).not.toContain("Hardware PINK005");
  await page.goto(`/library/hardware/${pink005.id}`);
  await page.getByTestId("approval-status").getByRole("radio", { name: "APPROVED" }).click();
  await page.getByLabel("Approval note").fill("PLATING SAMPLE APPROVED");
  await page.getByRole("button", { name: "Save component" }).click();
  await expect(page.getByText("Saved.").or(page.getByRole("status"))).toBeVisible();
  await expect.poll(async () => (await db.select().from(hardware).where(eq(hardware.id, pink005.id)))[0].approval.status).toBe("APPROVED");
  expect(await warns()).not.toContain("Hardware PINK005");

  /* ---------- duplicate ---------- */
  await page.goto(`/packs/${pink.id}`);
  await page.getByTestId("duplicate-open").click();
  await page.getByLabel("New style #").fill("PINK014");
  await page.getByRole("button", { name: "Create the copy" }).click();
  await page.waitForURL((u) => /\/packs\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.includes(pink.id));
  const copyId = page.url().split("/").pop()!;
  await expect(page.getByText("Carried over from")).toBeVisible();
  await expect(page.getByText("PINK013").first()).toBeVisible();
  expect(await answer(copyId, "header.due_date")).toBeUndefined(); // due date cleared
  expect(await answer(copyId, "dims.h")).toBe(16);

  /* ---------- fill what's left so the gate passes (placement in mm, construction…) ---------- */
  const [lining] = await db.select().from(materials).limit(1);
  await db.update(hardware).set({ dimsMm: "30 X 12" }).where(and(inArray(hardware.code, ["PINK003", "PINK005"]), eq(hardware.dimsMm, ""))); // not given in the reference pack
  const pomFull = ((await answer(copyId, "pom.list")) as { point: string; value?: number; tol?: number; how: string }[]).filter((r) => r.value != null);
  await setAnswers(copyId, {
    "header.due_date": "ASAP",
    "hb.strap.width": 2,
    "hb.strap.length": 120,
    "branding.logo_size": { w: 40, h: 12 },
    "construction.list": [
      { area: "BODY SEAMS", edge: "TURNED EDGE", stitch: "LOCKSTITCH 301", spi: 8, thread: "BONDED NYLON TEX 70", allowance: 6 },
      { area: "FLAP EDGE", edge: "RAW EDGE PAINTED", stitch: "LOCKSTITCH 301", spi: 8 },
    ],
    "construction.thread_colour": "DTM",
    "interior.lining_material": { id: lining.id, label: lining.supplier },
    "pom.list": [...pomFull, { point: "STRAP TOTAL LENGTH", value: 120, tol: 1.5, how: "END TO END" }, { point: "STRAP WIDTH", value: 2, tol: 0.3, how: "EDGE TO EDGE" }],
    "placements.list": [
      { item: { id: pink005.id, label: "PINK005" }, qty: 1, from: "FROM FLAP EDGE", distance: 15, note: "CENTRED" },
      { item: { id: pink006.id, label: "PINK006" }, qty: 2, from: "FROM SIDE SEAM", distance: 40, spacing: 120, note: "UNDER FLAP" },
    ],
  });
  await expect.poll(() => failing(page, copyId), { timeout: 20_000 }).toEqual([]);

  /* ---------- second-designer sign-off before the final PDF ---------- */
  const finalPdf = () => page.request.get(`/api/packs/${copyId}/pdf`, { timeout: 180_000 });
  const unsigned = await finalPdf();
  expect(unsigned.status()).toBe(409);
  expect(await unsigned.text()).toMatch(/second designer/i);

  await page.reload();
  const signoff = page.getByTestId("signoff");
  await expect(signoff).toContainText("Draft");
  await signoff.getByTestId("request-review").click();
  await expect(signoff).toContainText("In review");
  await expect(signoff.getByTestId("approve")).toHaveCount(0); // you can't sign off your own pack
  await expect(page.getByRole("button", { name: "Export PDF — needs sign-off" })).toBeVisible();

  await db.insert(users).values({ email: BLAIR.email, name: "BLAIR", role: "designer", passwordHash: await bcrypt.hash(BLAIR.password, 10), mustChangePassword: false }).onConflictDoNothing();
  const blair = await loginAs(browser, BLAIR.email, BLAIR.password);
  await blair.goto(`/packs/${copyId}`);
  await blair.getByTestId("approve").click();
  await expect(blair.getByTestId("signoff")).toContainText("Signed off by BLAIR");
  await expect(blair.getByTestId("signoff")).toContainText("the PDF is unlocked");
  if (SHOTS) await blair.getByTestId("signoff").screenshot({ path: path.join(SHOTS, "signoff.png") });

  await page.reload();
  await expect(page.getByTestId("export-pdf")).toBeVisible();
  const signed = await finalPdf();
  expect(signed.status(), await signed.text().catch(() => "")).toBe(200);
  const out = path.join(process.cwd(), ".data", "phase2");
  mkdirSync(out, { recursive: true });
  const file = path.join(out, "PINK014.pdf");
  writeFileSync(file, await signed.body());
  const text = execFileSync("pdftotext", ["-raw", file, "-"]).toString().toUpperCase();
  for (const s of ["CONSTRUCTION DETAILS", "BILL OF MATERIALS", "POINT OF MEASURE", "HARDWARE PLACEMENT", "PINK006", "TURNED EDGE", "NO PRICES"]) expect(text).toContain(s);
  // V2 §3 step 5: in the studio the PDF builds as a background job and is offered for download when ready.
  await page.getByTestId("export-pdf").click();
  const ready = page.getByTestId("pdf-ready");
  await expect(ready).toContainText("PINK014", { timeout: 120_000 });
  const fromJob = await page.request.get((await ready.getAttribute("href"))!);
  expect(fromJob.status()).toBe(200);
  expect(fromJob.headers()["content-type"]).toContain("application/pdf");
  if (SHOTS) execFileSync("pdftoppm", ["-r", "50", "-png", file, path.join(SHOTS, "PINK014")]);

  /* ---------- factory, sent, factory Q&A ---------- */
  await page.getByLabel("Factory", { exact: true }).fill("JUNFA");
  await page.getByLabel("Factory style number").click(); // blur saves
  await expect.poll(async () => (await db.select().from(packs).where(eq(packs.id, copyId)))[0].factory).toBe("JUNFA");
  await page.getByRole("button", { name: "Mark sent to factory" }).click();
  await expect(page.getByTestId("signoff")).toContainText("Sent to factory");

  const qa = page.getByTestId("factory-qa");
  await qa.getByLabel("Factory question").fill("Can we use 18mm snaps instead of 14mm?");
  await qa.getByRole("button", { name: "Log question" }).click();
  await expect(qa).toContainText("CAN WE USE 18MM SNAPS".toLowerCase(), { ignoreCase: true });
  await qa.getByLabel("Answer to question 1").fill("NO — KEEP 14MM PINK006");
  await qa.getByLabel("Answer to question 1").press("Enter");
  await expect(qa).toContainText("NO — KEEP 14MM PINK006");

  /* ---------- sample log: proto with mark-up, then SMS with the open comment carried over ---------- */
  await page.getByTestId("samples-link").click();
  await page.waitForURL(/\/samples$/);
  await page.getByTestId("create-round").click();
  await expect(page.getByTestId("round")).toContainText("Proto");
  const add = page.getByTestId("add-sample-comment");
  await add.getByTestId("sample-photo").setInputFiles({ name: "proto.png", mimeType: "image/png", buffer: ref!.closureDetail });
  await expect(add.getByText("Photo added ✓")).toBeVisible();
  await add.getByLabel("Sample comment").fill("move snap 5mm towards centre");
  await add.getByRole("button", { name: "Add comment" }).click();
  const comment = page.getByTestId("sample-comment");
  await expect(comment).toHaveCount(1);
  await expect(comment).toContainText("MOVE SNAP 5MM TOWARDS CENTRE");
  await comment.getByTestId("markup-photo").click({ position: { x: 120, y: 100 } });
  await expect(comment.getByRole("button", { name: "Remove circle 1" })).toBeVisible();
  await comment.getByRole("radio", { name: "REVISE" }).click();
  await expect(comment.getByRole("radio", { name: "REVISE" })).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("round-verdict").getByRole("radio", { name: "APPROVED W/ COMMENTS" }).click();
  await expect(page.getByTestId("round-verdict").getByRole("radio", { name: "APPROVED W/ COMMENTS" })).toHaveAttribute("aria-checked", "true");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "samples-proto.png"), fullPage: true });

  await page.getByTestId("new-round").click();
  await expect(page.getByTestId("round-stage").getByRole("radio", { name: "SMS" })).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("create-round").click();
  await expect(page.getByTestId("round")).toContainText("Salesman sample");
  await expect(page.getByTestId("sample-comment")).toHaveCount(1);
  await expect(page.getByTestId("sample-comment")).toContainText("Carried from last round");
  await expect(page.getByTestId("sample-comment")).toContainText("MOVE SNAP 5MM TOWARDS CENTRE");
  await expect(page.getByTestId("sample-comment").getByRole("button", { name: "Remove circle 1" })).toBeVisible(); // mark-up comes across
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "samples-sms.png"), fullPage: true });

  // A PROTO round moved the SENT pack on; the sample comments print at the back of the pack.
  expect((await db.select().from(packs).where(eq(packs.id, copyId)))[0].status).toBe("PROTO_RECEIVED");
  const draft = await page.request.get(`/api/packs/${copyId}/pdf?draft=1`, { timeout: 180_000 });
  expect(draft.status()).toBe(200);
  writeFileSync(file, await draft.body());
  const draftText = execFileSync("pdftotext", ["-raw", file, "-"]).toString().toUpperCase();
  expect(draftText).toContain("SAMPLE COMMENTS");
  expect(draftText).toContain("MOVE SNAP 5MM TOWARDS CENTRE");

  /* ---------- dashboard: status filter ---------- */
  await page.goto("/?status=PROTO_RECEIVED");
  await expect(page.getByText("PINK014")).toBeVisible();
  await expect(page.getByText("PINK013")).toHaveCount(0);
});
