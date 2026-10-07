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

  // A supplier PDF is accepted as the photo: its first page goes in as an image.
  await page.getByTestId("hw-photo").setInputFiles({ name: "supplier-drawing.pdf", mimeType: "application/pdf", buffer: tinyPdf() });
  const photo = page.getByRole("img", { name: "Hardware photo" });
  await expect(photo).toHaveAttribute("src", /\.png$/);
  await expect.poll(() => photo.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(800); // 200 pt page at the 4× cap
});

/** A one-page PDF with a filled square (a stand-in for a supplier drawing). */
function tinyPdf(): Buffer {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>",
  ];
  const stream = "0 0 0 rg 50 50 100 100 re f";
  objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
