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
import { annotate, flatSvg, readMeta, replaceLayer, setDimMeta, tracedLayers, type AnnotateInput, type Box, type View } from "./geometry";

/** Everything auto-annotation needs from the pack answers (entered values only). */
export async function annotationInput(p: LoadedPack, view: View, meta: { w: number; h: number; bbox: Box | null }): Promise<AnnotateInput> {
  const a = p.answers;
  const num = (k: string) => (typeof a[k] === "number" ? (a[k] as number) : undefined);
  const logoId = (a["branding.logo_code"] as LibValue | undefined)?.id;
  const logoHw = logoId ? (await db.select({ code: hardware.code }).from(hardware).where(eq(hardware.id, logoId)))[0] : undefined;
  const logoSize = a["branding.logo_size"] as Dims2Value | undefined;
  const comments = ((a["comments.list"] as { pages?: string[] }[] | undefined) ?? [])
    .map((c, i) => ({ letter: String.fromCharCode(65 + i), pages: c.pages ?? [] }))
    .filter((c) => c.pages.includes("MATERIALS / HARDWARE") || c.pages.includes("MEASUREMENTS SHEET"));
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
    const r = await generateFlatRaster(img.data, view, p.pack.category);
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

/** Re-traces one rectangle of the source raster (e.g. with a different threshold). */
export async function retraceRegion(flat: Flat, rect: Box, threshold = 160) {
  if (!flat.sourceUrl) throw new Error("This flat has no source image to re-trace.");
  const meta = readMeta(flat.svg);
  const src = await readStoredFile(flat.sourceUrl);
  const t = await traceLineArt(src.data, { crop: rect, threshold, scaleTo: { w: meta.w, h: meta.h } });
  return { outline: t.outline, stitching: t.stitching };
}
