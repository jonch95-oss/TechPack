import "server-only";
import type { LoadedPack } from "@/lib/data";
import { cjkFontCss } from "@/lib/zh/font";
import { translateLines } from "@/lib/zh/translate";
import type { PackDoc } from "./doc";
import { renderPackHtml } from "./html";
import { htmlToPdf } from "./render";

/** Renders a pack's PDF; with 中文 on, every line gets its Chinese (and any gaps are reported). */
export async function makePackPdf(p: LoadedPack, doc: PackDoc, opts: { draft: boolean }) {
  let gaps: string[] = [];
  const bilingual = p.pack.chineseOn
    ? {
        translate: (lines: string[]) =>
          translateLines(lines, { ai: true, protect: [p.brand.name, p.pack.styleName, p.pack.styleNo, p.sentBy, "ICON LUXURY GROUP", ...doc.swatches.map((s) => s.supplier)].filter(Boolean) }),
        fontCss: cjkFontCss,
        onGaps: (g: string[]) => (gaps = g),
      }
    : undefined;
  const pdf = await htmlToPdf(renderPackHtml(doc, { draft: opts.draft }), { bilingual });
  return { pdf, gaps };
}

export function pdfName(p: LoadedPack, suffix = "") {
  return `${p.pack.styleNo}${p.pack.colorways.length ? p.pack.colorways.join("_").replace(/-/g, "") : ""}_${p.pack.styleName.replace(/\W+/g, "_")}${suffix}.pdf`;
}
