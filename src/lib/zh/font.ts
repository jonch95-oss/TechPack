import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Noto Sans SC Bold for the Chinese lines. The font ships as ~100 unicode-range subsets; only the
 * subsets holding characters on the page are inlined (Chromium on Vercel has no CJK fonts).
 */
const DIR = path.join(process.cwd(), "node_modules", "@fontsource", "noto-sans-sc");
let blocks: { file: string; ranges: [number, number][] }[] | null = null;

function load() {
  if (blocks) return blocks;
  const css = readFileSync(path.join(DIR, "700.css"), "utf8");
  blocks = [...css.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)[\s\S]*?unicode-range:\s*([^;]+);/g)].map((m) => ({
    file: m[1],
    ranges: m[2].split(",").map((r) => {
      const [a, b] = r.trim().replace(/^U\+/i, "").split("-");
      return [parseInt(a, 16), parseInt(b ?? a, 16)] as [number, number];
    }),
  }));
  return blocks;
}

export function cjkFontCss(text: string) {
  const cps = new Set([...text].map((c) => c.codePointAt(0)!).filter((c) => c >= 0x2e80));
  if (!cps.size) return "";
  const used = load().filter((b) => [...cps].some((c) => b.ranges.some(([a, z]) => c >= a && c <= z)));
  return used
    .map((b) => {
      const data = readFileSync(path.join(DIR, "files", b.file)).toString("base64");
      const range = b.ranges.map(([a, z]) => (a === z ? `U+${a.toString(16)}` : `U+${a.toString(16)}-${z.toString(16)}`)).join(",");
      return `@font-face{font-family:"IconSC";font-weight:700;font-style:normal;src:url(data:font/woff2;base64,${data}) format("woff2");unicode-range:${range};}`;
    })
    .join("\n");
}
