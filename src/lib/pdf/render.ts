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

/** A single drawing (SVG) → a PDF page of exactly its size; vector, so Illustrator opens it as artwork. */
export async function svgToPdf(svg: string, w: number, h: number, fontCss = ""): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const body = svg.replace(/<svg\b([^>]*)>/, (_m, a: string) => `<svg${a.replace(/\s(width|height)="[^"]*"/g, "")} width="${w}" height="${h}">`);
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"/><style>${fontCss}@page{size:${w}px ${h}px;margin:0}html,body{margin:0;padding:0}svg{display:block}text{font-family:IconCond,"Arial Narrow",Arial,sans-serif}</style></head><body>${body}</body></html>`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return Buffer.from(await page.pdf({ width: `${w}px`, height: `${h}px`, printBackground: true, preferCSSPageSize: true }));
  } finally {
    await browser.close();
  }
}

export type Bilingual = {
  translate: (lines: string[]) => Promise<{ zh: Map<string, string>; gaps: string[] }>;
  fontCss: (text: string) => string;
  onGaps?: (gaps: string[]) => void;
};

export async function htmlToPdf(html: string, opts: { bilingual?: Bilingual; inspect?: (page: import("puppeteer-core").Page) => Promise<void> } = {}): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 120_000 });
    await page.evaluate(() => document.fonts.ready);
    // Checks on the laid-out pages (the golden overflow check) run before the PDF is cut.
    if (opts.inspect) {
      await page.emulateMediaType("print");
      await opts.inspect(page);
    }
    if (opts.bilingual) await addChinese(page, opts.bilingual);
    const pdf = await page.pdf({ width: "17in", height: "11in", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Bilingual output (BRIEF 1.5): every printed line gets its Chinese underneath in a smaller size.
 * Lines are read from the laid-out page (leaf blocks, loose text runs, SVG callout text), so every
 * callout, comment, table header and instruction is covered, whichever template printed it.
 */
async function addChinese(page: import("puppeteer-core").Page, b: Bilingual) {
  const { leafs, svgs } = await page.evaluate(() => {
    const SKIP = ".zh, .draft, .no-zh, .style-head, style, script, title, .bubble, .callout";
    const isBlock = (el: Element) => {
      const d = getComputedStyle(el).display;
      return d !== "inline" && d !== "contents" && d !== "none";
    };
    const english = (s: string) => /[A-Za-z]{2,}/.test(s);
    const els = [...document.body.querySelectorAll("*")].filter((el) => !(el instanceof SVGElement) && !el.closest(SKIP) && el.tagName !== "BR" && el.tagName !== "IMG");
    const blockKids = (el: Element) => [...el.querySelectorAll("*")].some((d) => !(d instanceof SVGElement) && d.tagName !== "BR" && d.tagName !== "IMG" && !d.closest(".zh") && isBlock(d));
    // Loose inline text next to block children (e.g. a cell holding a block note then text): wrap it.
    for (const el of els) {
      if (!isBlock(el) || !blockKids(el)) continue;
      let run: Node[] = [];
      const flush = () => {
        const text = run.map((n) => n.textContent ?? "").join("");
        if (english(text) && run.length) {
          const w = document.createElement("span");
          w.setAttribute("data-zh-run", "1");
          run[0].parentNode!.insertBefore(w, run[0]);
          for (const n of run) w.appendChild(n);
        }
        run = [];
      };
      for (const n of [...el.childNodes]) {
        if (n.nodeType === 3 || (n.nodeType === 1 && !isBlock(n as Element) && !(n instanceof SVGElement) && !(n as Element).closest(SKIP))) run.push(n);
        else flush();
      }
      flush();
    }
    const leafs: string[][] = [];
    // Containers of drawings are never lines themselves (their SVG text is handled below).
    const targets = [...document.body.querySelectorAll("*")].filter((el) => !(el instanceof SVGElement) && !el.closest(SKIP) && !el.querySelector("svg") && ((isBlock(el) && !blockKids(el)) || el.hasAttribute("data-zh-run")));
    for (const el of targets) {
      if (el.parentElement?.closest("[data-zh-i]")) continue;
      const text = (el as HTMLElement).innerText.trim();
      if (!english(text)) continue;
      el.setAttribute("data-zh-i", String(leafs.length));
      leafs.push(text.split("\n").map((x) => x.trim()).filter(Boolean));
    }
    const svgs: string[] = [];
    for (const t of document.querySelectorAll("svg text")) {
      const s = (t.textContent ?? "").trim();
      if (!english(s) || t.closest("[style*='display: none']")) continue;
      t.setAttribute("data-zh-t", String(svgs.length));
      svgs.push(s);
    }
    return { leafs, svgs };
  });
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();
  const all = [...leafs.flat(), ...svgs];
  const { zh, gaps } = await b.translate(all);
  b.onGaps?.(gaps);
  const pick = (l: string) => zh.get(norm(l)) ?? "";
  const leafZh = leafs.map((lines) => lines.map(pick));
  const svgZh = svgs.map(pick);
  await page.evaluate(
    (leafZh: string[][], svgZh: string[]) => {
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      document.querySelectorAll("[data-zh-i]").forEach((el) => {
        const lines = leafZh[Number(el.getAttribute("data-zh-i"))].filter(Boolean);
        if (!lines.length) return;
        const s = document.createElement("span");
        // Page tags and headers keep the Chinese on one line so the page furniture doesn't grow.
        const inline = !!el.closest(".style-sub, .tag");
        s.className = inline ? "zh zh-inline" : "zh";
        s.innerHTML = lines.map(esc).join(inline ? " · " : "<br/>");
        el.appendChild(s);
      });
      document.querySelectorAll("svg text[data-zh-t]").forEach((t) => {
        const z = svgZh[Number(t.getAttribute("data-zh-t"))];
        if (!z) return;
        const ts = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        // Rotated text (dimension lines) carries its Chinese on the same line; callouts get a line below.
        const rotated = /rotate\(\s*-?(?!0[\s)])[\d.]+/.test(t.getAttribute("transform") ?? "");
        if (rotated) ts.textContent = ` ${z}`;
        else {
          ts.setAttribute("x", t.getAttribute("x") ?? "0");
          ts.setAttribute("dy", "1.1em");
        }
        ts.setAttribute("font-size", "72%");
        ts.setAttribute("font-family", "IconSC, IconCond, sans-serif");
        if (!rotated) ts.textContent = z;
        t.appendChild(ts);
      });
    },
    leafZh,
    svgZh,
  );
  const css = b.fontCss([...leafZh.flat(), ...svgZh].join(""));
  await page.addStyleTag({ content: `${css}\n.zh{display:block;font-family:"IconSC","IconCond",sans-serif;font-size:0.68em;line-height:1.2;font-weight:700;text-transform:none;letter-spacing:0;margin-top:1px;}.zh-inline{display:inline;margin:0 0 0 6px;}` });
  await page.evaluate(() => document.fonts.ready);
}
