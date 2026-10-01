import "server-only";
import puppeteer from "puppeteer-core";

/**
 * HTML → PDF with headless Chromium. On Vercel this uses @sparticuz/chromium; locally it uses
 * CHROME_PATH (or the Playwright Chromium in the cloud dev container).
 */
async function launch() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  }
  const executablePath = process.env.CHROME_PATH || process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] });
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 120_000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ width: "17in", height: "11in", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
