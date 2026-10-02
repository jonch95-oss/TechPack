import "server-only";
import { asc, eq } from "drizzle-orm";
import { zipSync, strToU8 } from "fflate";
import { db } from "@/db";
import { flats, prints, type Flat } from "@/db/schema";
import type { LoadedPack } from "@/lib/data";
import { readMeta } from "@/lib/lineart/geometry";
import { buildPackDoc } from "@/lib/pdf/doc";
import { fonts } from "@/lib/pdf/html";
import { makePackPdf, pdfName } from "@/lib/pdf/make";
import { svgToPdf } from "@/lib/pdf/render";
import { revisionState } from "@/lib/revisions";
import { readStoredFile } from "@/lib/storage";
import type { LibValue, MatrixValue } from "@/lib/questions";
import { svgToEps } from "./eps";
import { buildPsd } from "./psd";

export type FlatFormat = "svg" | "ai" | "eps";

/** A flat as a standalone SVG: layers stay as named groups (they open as groups in Illustrator). */
export function standaloneSvg(f: Flat, title: string) {
  const meta = readMeta(f.svg);
  return f.svg
    .replace(/^<svg\b([^>]*)>/, (_m, a: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg${a.includes("xmlns=") ? "" : ' xmlns="http://www.w3.org/2000/svg"'}${a.replace(/\s(width|height)="[^"]*"/g, "")} width="${meta.w}" height="${meta.h}"><title>${title.replace(/[<&]/g, "")}</title>`)
    .replace(/\sdata-hidden="1"/g, "");
}

export async function flatFile(f: Flat, format: FlatFormat, title: string): Promise<{ data: Buffer; type: string }> {
  const svg = standaloneSvg(f, title);
  if (format === "svg") return { data: Buffer.from(svg), type: "image/svg+xml" };
  if (format === "eps") return { data: Buffer.from(svgToEps(svg, title)), type: "application/postscript" };
  // .ai — PDF-compatible: a vector PDF page of the drawing, which Illustrator opens as artwork.
  const meta = readMeta(f.svg);
  return { data: await svgToPdf(svg.replace(/^<\?xml[^>]*>\s*/, ""), meta.w, meta.h, fonts()), type: "application/pdf" };
}

/**
 * Everything for the factory hand-off as one ZIP (BRIEF 1.6 step 8): the PDF (the issued
 * revision when nothing has changed since, otherwise a watermarked draft), every flat as SVG / AI /
 * EPS, and the raster artwork as a layered PSD.
 */
export async function packZip(p: LoadedPack): Promise<{ zip: Buffer; name: string }> {
  const base = `${p.pack.styleNo}_${p.pack.styleName.replace(/\W+/g, "_")}`;
  const files: Record<string, Uint8Array> = {};
  const notes: string[] = [`${p.pack.styleNo} ${p.pack.styleName} — ${p.brand.name}`, `Exported ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, ""];

  const rev = await revisionState(p);
  const latest = rev.list.at(-1);
  if (latest?.pdfUrl && !rev.pending.length) {
    files[`${pdfName(p, latest.label === "ORIGINAL" ? "" : `_${latest.label}`)}`] = new Uint8Array((await readStoredFile(latest.pdfUrl)).data);
    notes.push(`PDF: ${latest.label} (${latest.date}).`);
  } else {
    const doc = await buildPackDoc(p);
    const { pdf } = await makePackPdf(p, doc, { draft: true });
    files[pdfName(p, "_DRAFT")] = new Uint8Array(pdf);
    notes.push(latest ? `PDF: DRAFT — ${rev.pending.length} change(s) since ${latest.label} not yet issued.` : "PDF: DRAFT — not yet issued.");
  }

  const rows = await db.select().from(flats).where(eq(flats.packId, p.pack.id)).orderBy(asc(flats.createdAt));
  for (const f of rows) {
    const title = `${p.pack.styleNo} ${f.view} VIEW`;
    for (const fmt of ["svg", "ai", "eps"] as const) files[`line-art/${p.pack.styleNo}_${f.view}.${fmt}`] = new Uint8Array((await flatFile(f, fmt, title)).data);
    notes.push(`Line art: ${f.view} (${f.status === "INFERRED" ? "INFERRED — CONFIRM" : f.status}) as SVG, AI, EPS.`);
  }

  // Layered PSD: colourway renders, lining repeat + tile box, line art.
  const renders: { name: string; data: Buffer }[] = [];
  for (const cw of p.pack.colorways) {
    const file = p.files.find((x) => x.kind === "colorway_render" && x.tag === cw) ?? (cw === p.pack.colorways[0] ? p.files.find((x) => x.kind === "render") : undefined);
    if (file) renders.push({ name: `${p.pack.styleNo}${cw}`, data: (await readStoredFile(file.url)).data });
  }
  const a = p.answers;
  const matrix = (a["materials.matrix"] as MatrixValue | undefined) ?? {};
  const printId = (a["interior.lining_print"] as LibValue | undefined)?.id ?? Object.values(matrix).map((r) => r?.lining?.lib?.id).find(Boolean);
  const [print] = printId ? await db.select().from(prints).where(eq(prints.id, printId)) : [];
  const repeat = print?.motifUrl ? { motif: (await readStoredFile(print.motifUrl)).data, tilePx: 320, label: print.tileW && print.tileH ? `${print.tileW} × ${print.tileH} ${print.tileUnit?.toUpperCase() ?? "CM"}` : "TILE" } : null;
  if (renders.length || repeat || rows.length) {
    files[`artwork/${base}_artwork.psd`] = new Uint8Array(await buildPsd({ renders, repeat, flats: rows.map((f) => ({ name: `${f.view} VIEW`, svg: standaloneSvg(f, f.view) })) }));
    notes.push(`Artwork: layered PSD (${[renders.length && "colourway renders", repeat && "lining repeat + tile box", rows.length && "line art"].filter(Boolean).join(", ")}).`);
  }
  files["README.txt"] = strToU8(notes.join("\n") + "\n\nNo prices, costing, MOQ or lead times — the factory fills those.\n");
  return { zip: Buffer.from(zipSync(files, { level: 6 })), name: `${base}.zip` };
}
