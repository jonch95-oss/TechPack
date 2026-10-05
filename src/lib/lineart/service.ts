import { normalizePage } from "@/lib/page-names";
import "server-only";
import { readCroppedFile } from "@/lib/crop";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { flats, hardware, type Flat, type FlatView } from "@/db/schema";
import type { LoadedPack } from "@/lib/data";
import { readStoredFile, storeFile } from "@/lib/storage";
import type { Dims2Value, LibValue, MaterialEntry } from "@/lib/questions";
import { generateFlatRaster } from "./generate";
import { traceLineArt } from "./trace";
import { templateFlat, templateFor } from "./templates";
import { SILHOUETTE_IDS } from "@/lib/similar-score";
import { annotate, flatSvg, readMeta, replaceLayer, setDimMeta, tracedLayers, type AnnotateInput, type Box, type View } from "./geometry";

/** Everything auto-annotation needs from the pack answers (entered values only). */
export async function annotationInput(p: LoadedPack, view: View, meta: { w: number; h: number; bbox: Box | null }): Promise<AnnotateInput> {
  const a = p.answers;
  const num = (k: string) => (typeof a[k] === "number" ? (a[k] as number) : undefined);
  const logoId = (a["branding.logo_code"] as LibValue | undefined)?.id;
  const logoHw = logoId ? (await db.select({ code: hardware.code }).from(hardware).where(eq(hardware.id, logoId)))[0] : undefined;
  const logoSize = a["branding.logo_size"] as Dims2Value | undefined;
  const comments = ((a["comments.list"] as { pages?: string[] }[] | undefined) ?? [])
    .map((c, i) => ({ letter: String.fromCharCode(65 + i), pages: (c.pages ?? []).map(normalizePage) }))
    .filter((c) => c.pages.includes("OVERVIEW") || c.pages.includes("MEASUREMENTS"));
  return {
    view,
    unit: a["dims.unit"] === "INCHES" ? "in" : "cm",
    w: meta.w,
    h: meta.h,
    bbox: meta.bbox,
    dims: { h: num("dims.h"), w: num("dims.w"), d: num("dims.d") },
    extras: {
      handleDrop: num("hb.top_handle.drop") ?? num("duf.handle_drop") ?? num("men.handle_drop") ?? num("cool.handle_drop"),
      flapHeight: num("hb.flap_height"),
      logoOffsetMm: num("branding.offset"),
      logoSizeMm: logoSize ? { w: logoSize.w ?? undefined, h: logoSize.h ?? undefined } : undefined,
    },
    materials: ((a["materials.list"] as MaterialEntry[] | undefined) ?? []).map((m) => ({ callout: m.callout, name: m.name, locations: m.locations ?? [] })),
    comments: comments.map((c) => ({ letter: c.letter })),
    logo: a["branding.logo_type"] ? { code: logoHw?.code ?? "", type: String(a["branding.logo_type"]) } : null,
  };
}

/** Re-draws the automatic dimension lines and callouts from the current outline and answers. */
export async function reannotate(svg: string, p: LoadedPack, opts: { dimensions?: boolean; callouts?: boolean } = {}) {
  const meta = readMeta(svg);
  const input = await annotationInput(p, meta.view, meta);
  const res = annotate(input);
  let out = setDimMeta(svg, { pxPerUnit: res.pxPerUnit, unit: input.unit, view: meta.view });
  if (opts.dimensions !== false) out = replaceLayer(out, "dimensions", res.dimensions);
  if (opts.callouts !== false) out = replaceLayer(out, "callouts", res.callouts);
  return { svg: out, pxPerUnit: res.pxPerUnit };
}

export async function getFlat(packId: string, view: FlatView) {
  return (await db.select().from(flats).where(and(eq(flats.packId, packId), eq(flats.view, view))))[0] ?? null;
}

/**
 * Generates (or regenerates) one view: image API → raster (stored for re-tracing) → potrace →
 * layered SVG → scaled to the entered dimensions with automatic dimension lines and callouts.
 * The back view starts as INFERRED ("INFERRED — CONFIRM") until a designer approves it.
 */
export async function generateFlat(p: LoadedPack, view: FlatView, userId: string, upload?: Buffer): Promise<{ flat: Flat; note: string }> {
  let png: Buffer;
  let source: "AI" | "TRACE" | "UPLOAD";
  let note = "";
  let mask: Buffer | undefined;
  if (upload) {
    png = upload;
    source = "UPLOAD";
  } else {
    const render = p.files.find((f) => f.kind === "render");
    if (!render) throw new Error("Upload the render first.");
    const img = await readCroppedFile(render); // board text never gets traced
    let r: Awaited<ReturnType<typeof generateFlatRaster>>;
    try {
      r = await generateFlatRaster(img.data, view, p.pack.category);
    } catch (e) {
      // The image service can't draw it and the render won't trace (V2 §8): fall back to the base
      // style's flat, then to a silhouette template at the entered size — never a raw trace.
      const fb = await fallbackFlat(p, view, userId, (e as Error).message);
      if (fb) return fb;
      throw e;
    }
    png = r.png;
    source = r.source;
    note = r.note;
    mask = r.mask;
  }
  const sourceUrl = await storeFile(`flats/${p.pack.id}`, `${view.toLowerCase()}-${source.toLowerCase()}.png`, png, "image/png");
  const t = await traceLineArt(png, { mask });
  if (!t.outline.length) throw new Error("Nothing to trace — the image came back empty.");
  const unit = p.answers["dims.unit"] === "INCHES" ? "in" : "cm";
  const base = flatSvg({ view, unit, pxPerUnit: null, bbox: t.bbox, w: t.w, h: t.h }, tracedLayers(t));
  const { svg } = await reannotate(base, p);
  // Generated back / side / top views are inferred; the designer's own drawing isn't.
  const status = view !== "FRONT" && !upload ? "INFERRED" : "DRAFT";
  const [flat] = await db
    .insert(flats)
    .values({ packId: p.pack.id, view, status, source, sourceUrl, svg, updatedBy: userId })
    .onConflictDoUpdate({ target: [flats.packId, flats.view], set: { status, source, sourceUrl, svg, updatedBy: userId, updatedAt: new Date() } })
    .returning();
  return { flat, note };
}

/**
 * Line-art fallbacks (V2 §8): (a) the base style's flat of this view, re-dimensioned to this pack;
 * (b) a silhouette template scaled to the entered W × H. Both arrive INFERRED for the designer to adjust.
 * Null when neither is possible (no base flat and no W × H).
 */
export async function fallbackFlat(p: LoadedPack, view: FlatView, userId: string, why: string): Promise<{ flat: Flat; note: string } | null> {
  let svg: string | null = null;
  let source = "";
  let note = "";
  if (p.pack.copiedFrom) {
    const [base] = await db.select().from(flats).where(and(eq(flats.packId, p.pack.copiedFrom), eq(flats.view, view)));
    if (base) {
      svg = base.svg;
      source = "BASE_STYLE";
      note = `${why} Started from the base style's ${view.toLowerCase()} flat, re-dimensioned to this pack — adjust it in the editor.`;
    }
  }
  const w = typeof p.answers["dims.w"] === "number" ? (p.answers["dims.w"] as number) : null;
  const h = typeof p.answers["dims.h"] === "number" ? (p.answers["dims.h"] as number) : null;
  if (!svg && view === "FRONT" && w && h) {
    const sil = String(SILHOUETTE_IDS.map((k) => p.answers[k]).find((v) => typeof v === "string") ?? "");
    const tpl = templateFor(p.pack.category, sil);
    svg = templateFlat({ view, unit: p.answers["dims.unit"] === "INCHES" ? "in" : "cm", w, h, ...tpl });
    source = "TEMPLATE";
    note = `${why} Drew a ${tpl.shape.toLowerCase().replace("_", "-")} silhouette template at ${w} × ${h} instead — adjust it in the editor.`;
  }
  if (!svg) return null;
  const { svg: out } = await reannotate(svg, p);
  const [flat] = await db
    .insert(flats)
    .values({ packId: p.pack.id, view, status: "INFERRED", source, sourceUrl: null, svg: out, updatedBy: userId })
    .onConflictDoUpdate({ target: [flats.packId, flats.view], set: { status: "INFERRED", source, sourceUrl: null, svg: out, updatedBy: userId, updatedAt: new Date() } })
    .returning();
  return { flat, note };
}

/** Re-traces one rectangle of the source raster (e.g. with a different threshold). */
export async function retraceRegion(flat: Flat, rect: Box, threshold = 160) {
  if (!flat.sourceUrl) throw new Error("This flat has no source image to re-trace.");
  const meta = readMeta(flat.svg);
  const src = await readStoredFile(flat.sourceUrl);
  const t = await traceLineArt(src.data, { crop: rect, threshold, scaleTo: { w: meta.w, h: meta.h } });
  return { outline: t.outline, stitching: t.stitching };
}
