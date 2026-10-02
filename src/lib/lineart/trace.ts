import "server-only";
import sharp from "sharp";
import potrace from "potrace";
import { pointInPolygon, splitContours, type Contour } from "./geometry";

/**
 * Raster line art → vectors (BRIEF 1.7 "Vectorise"): potrace with closed paths and simplified
 * nodes, then split into layers — small isolated dashes become the STITCHING layer, everything
 * else the OUTLINE layer, and the outer silhouette is kept as a FILL shape (white in the flat,
 * material colour for "COLOUR INDICATIVE" previews).
 */

export type Traced = {
  w: number;
  h: number;
  outline: string[];
  stitching: string[];
  silhouette: string | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
};

const MAX = 1600;

/**
 * Normalises any raster to black lines on white at a sensible working size, with a white margin
 * (room for callouts and dimension lines around the drawing).
 */
export async function prepareLineArt(input: Buffer) {
  const resized = await sharp(input).flatten({ background: "#ffffff" }).resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true }).greyscale().png().toBuffer();
  const m = await sharp(resized).metadata();
  const pad = Math.round(Math.max(m.width ?? 0, m.height ?? 0) * PAD);
  const { data, info } = await sharp(resized).extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#ffffff" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const PAD = 0.14;

/**
 * The product's silhouette from the raster: close small gaps in the lines, flood the background in
 * from the edges, and trace what's left. Robust even when the drawn outline isn't one closed loop.
 */
async function silhouetteOf(data: Buffer, w: number, h: number, threshold: number, bbox: Traced["bbox"]) {
  const ink = Buffer.alloc(w * h, 0);
  for (let i = 0; i < w * h; i++) if (data[i] < threshold) ink[i] = 255;
  const boxArea = bbox ? bbox.w * bbox.h : w * h;
  // Small closing radius first (keeps handle loops open on clean flats); grow it until the outline
  // really encloses the body — traced renders have gaps in their outlines.
  let shrunk: Buffer | null = null;
  for (const k of [0.006, 0.015, 0.03]) {
    const r = Math.max(2, Math.round(Math.hypot(w, h) * k));
    const mask = await closedRegion(ink, w, h, r);
    const { data: eroded } = await sharp(mask, { raw: { width: w, height: h, channels: 1 } }).erode(r).raw().toBuffer({ resolveWithObject: true });
    let n = 0;
    for (let i = 0; i < w * h; i++) if (eroded[i] > 127) n++;
    shrunk = await sharp(eroded, { raw: { width: w, height: h, channels: 1 } }).negate().png().toBuffer();
    if (n >= boxArea * 0.45) break;
  }
  const d = await potraceBuffer(shrunk!, { threshold: 128, turdSize: 50, optTolerance: 1 });
  const parts = splitContours(d).sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  return parts[0]?.d ?? null;
}

/** Everything the background can't reach once the ink is thickened by `r` (255 = inside). */
async function closedRegion(ink: Buffer, w: number, h: number, r: number) {
  const { data: thick } = await sharp(ink, { raw: { width: w, height: h, channels: 1 } }).dilate(r).raw().toBuffer({ resolveWithObject: true });
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!bg[i] && thick[i] <= 127) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  const mask = Buffer.alloc(w * h, 0);
  for (let i = 0; i < w * h; i++) if (!bg[i]) mask[i] = 255;
  return mask;
}

function potraceBuffer(png: Buffer, params: { threshold?: number; turdSize?: number; optTolerance?: number }) {
  return new Promise<string>((resolve, reject) => {
    const t = new potrace.Potrace();
    t.setParameters({ threshold: params.threshold ?? 160, turdSize: params.turdSize ?? 6, optCurve: true, optTolerance: params.optTolerance ?? 0.4, alphaMax: 1 });
    t.loadImage(png, (err: Error | null) => {
      if (err) return reject(err);
      const tag = t.getPathTag();
      const m = /\sd="([^"]*)"/.exec(tag);
      resolve(m ? m[1] : "");
    });
  });
}

/** Traces black-on-white line art. `crop` limits the trace to a region (for "re-trace region"). */
export async function traceLineArt(
  input: Buffer,
  opts: { threshold?: number; crop?: { x: number; y: number; w: number; h: number }; scaleTo?: { w: number; h: number }; /** Black-on-white silhouette at the input's size (from the render). */ mask?: Buffer } = {},
): Promise<Traced> {
  const { data, w, h } = await prepareLineArt(input);
  let png = await sharp(data, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  let ox = 0,
    oy = 0;
  // The stored flat may be in a different pixel space from the source raster (e.g. a 1600 px trace
  // of a 1024 px image); `scaleTo` is that space so crops and results line up.
  const sx = opts.scaleTo ? opts.scaleTo.w / w : 1;
  const sy = opts.scaleTo ? opts.scaleTo.h / h : 1;
  if (opts.crop) {
    const c = {
      left: Math.max(0, Math.floor(opts.crop.x / sx)),
      top: Math.max(0, Math.floor(opts.crop.y / sy)),
      width: Math.max(1, Math.min(w, Math.ceil(opts.crop.w / sx))),
      height: Math.max(1, Math.min(h, Math.ceil(opts.crop.h / sy))),
    };
    c.width = Math.min(c.width, w - c.left);
    c.height = Math.min(c.height, h - c.top);
    png = await sharp(png).extract(c).png().toBuffer();
    ox = c.left;
    oy = c.top;
  }
  const d = await potraceBuffer(png, { threshold: opts.threshold, turdSize: Math.round(6 * (w / 1200)) });
  const contours = splitContours(d).map((c) => transformContour(c, ox, oy, sx, sy));
  const t = layerise(contours, opts.scaleTo?.w ?? w, opts.scaleTo?.h ?? h);
  if (!opts.crop) {
    if (opts.mask) {
      const m = await prepareLineArt(opts.mask);
      const png2 = await sharp(m.data, { raw: { width: m.w, height: m.h, channels: 1 } }).png().toBuffer();
      const parts = splitContours(await potraceBuffer(png2, { threshold: 128, turdSize: 50, optTolerance: 1 })).sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
      t.silhouette = parts[0]?.d ?? t.silhouette;
    } else t.silhouette = (await silhouetteOf(data, w, h, opts.threshold ?? 160, t.bbox)) ?? t.silhouette;
  }
  return t;
}

function transformContour(c: Contour, ox: number, oy: number, sx: number, sy: number): Contour {
  if (!ox && !oy && sx === 1 && sy === 1) return c;
  let k = 0;
  const d = c.d.replace(/-?\d+(?:\.\d+)?/g, (n) => {
    const v = Number(n);
    const r = k++ % 2 === 0 ? (v + ox) * sx : (v + oy) * sy;
    return String(Math.round(r * 100) / 100);
  });
  return {
    ...c,
    d,
    bbox: { x: (c.bbox.x + ox) * sx, y: (c.bbox.y + oy) * sy, w: c.bbox.w * sx, h: c.bbox.h * sy },
    area: c.area * sx * sy,
  };
}

/**
 * Groups contours with their holes, then sorts them into outline / stitching / silhouette.
 * potrace writes every contour the same way round (the fill rule makes holes), so holes are found
 * by nesting: a contour inside an odd number of others is a hole of the innermost one.
 */
export function layerise(contours: Contour[], w: number, h: number): Traced {
  if (!contours.length) return { w, h, outline: [], stitching: [], silhouette: null, bbox: null };
  const bySize = [...contours].sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  const contains = (o: Contour, c: Contour) =>
    Math.abs(o.area) > Math.abs(c.area) &&
    c.bbox.x >= o.bbox.x - 0.5 &&
    c.bbox.y >= o.bbox.y - 0.5 &&
    c.bbox.x + c.bbox.w <= o.bbox.x + o.bbox.w + 0.5 &&
    c.bbox.y + c.bbox.h <= o.bbox.y + o.bbox.h + 0.5 &&
    pointInPolygon(c.pts[0][0], c.pts[0][1], o.pts);
  const parent = new Map<Contour, Contour | null>();
  const depth = new Map<Contour, number>();
  for (const c of bySize) {
    // Bigger contours are already placed; the innermost container is the smallest one that holds it.
    let best: Contour | null = null;
    for (const o of bySize) {
      if (o === c) break;
      if (contains(o, c) && (!best || Math.abs(o.area) < Math.abs(best.area))) best = o;
    }
    parent.set(c, best);
    depth.set(c, best ? depth.get(best)! + 1 : 0);
  }
  const outers = bySize.filter((c) => depth.get(c)! % 2 === 0);
  const groups = new Map<Contour, Contour[]>(outers.map((o) => [o, []]));
  for (const c of bySize) if (depth.get(c)! % 2 === 1) groups.get(parent.get(c)!)?.push(c);

  // A stitch dash: small, elongated, no holes. Scale-independent: relative to the drawing.
  const diag = Math.hypot(w, h);
  const outline: string[] = [];
  const stitching: string[] = [];
  const shapes: Contour[] = [];
  for (const [o, hs] of groups) {
    const long = Math.max(o.bbox.w, o.bbox.h);
    const short = Math.max(1, Math.min(o.bbox.w, o.bbox.h));
    const isDash = hs.length === 0 && long < diag * 0.02 && long / short >= 1.8;
    const d = [o.d, ...hs.map((x) => x.d)].join(" ");
    if (isDash) stitching.push(d);
    else {
      outline.push(d);
      shapes.push(o);
    }
  }
  // The silhouette is the outside edge of the biggest outline shape (no holes): the bag's outer
  // contour, used as the fill behind the lines.
  const sil = shapes.filter((o) => depth.get(o) === 0)[0];
  const minX = Math.min(...shapes.map((o) => o.bbox.x));
  const minY = Math.min(...shapes.map((o) => o.bbox.y));
  const maxX = Math.max(...shapes.map((o) => o.bbox.x + o.bbox.w));
  const maxY = Math.max(...shapes.map((o) => o.bbox.y + o.bbox.h));
  return {
    w,
    h,
    outline,
    stitching,
    silhouette: sil?.d ?? null,
    bbox: shapes.length ? { x: round(minX), y: round(minY), w: round(maxX - minX), h: round(maxY - minY) } : null,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * No image API (or it failed): turn the render itself into line art — edges of a de-noised copy,
 * thresholded to the strongest ~8%. Perspective stays as in the render; the designer tidies it.
 */
/**
 * The product's silhouette in a render on a plain studio background: anything that differs from
 * the background colour (sampled at the edges) and is connected to... not the edges. Black on white,
 * same size as `edgeLineArt`.
 */
export async function renderSilhouette(render: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(render).flatten({ background: "#ffffff" }).resize({ width: 1200, height: 1200, fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width,
    h = info.height,
    c = info.channels;
  const edge: number[][] = [];
  for (let x = 0; x < w; x += 4) edge.push([...data.subarray(x * c, x * c + 3)], [...data.subarray(((h - 1) * w + x) * c, ((h - 1) * w + x) * c + 3)]);
  for (let y = 0; y < h; y += 4) edge.push([...data.subarray(y * w * c, y * w * c + 3)], [...data.subarray((y * w + w - 1) * c, (y * w + w - 1) * c + 3)]);
  const med = [0, 1, 2].map((k) => edge.map((p) => p[k]).sort((a, b) => a - b)[Math.floor(edge.length / 2)]);
  const isBg = (i: number) => Math.abs(data[i * c] - med[0]) + Math.abs(data[i * c + 1] - med[1]) + Math.abs(data[i * c + 2] - med[2]) < 36;
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!bg[i] && isBg(i)) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  const mask = Buffer.alloc(w * h, 255);
  for (let i = 0; i < w * h; i++) if (!bg[i]) mask[i] = 0;
  // Close specks and smooth the edge a little.
  return sharp(mask, { raw: { width: w, height: h, channels: 1 } }).median(5).png().toBuffer();
}

export async function edgeLineArt(render: Buffer): Promise<Buffer> {
  const base = sharp(render).flatten({ background: "#ffffff" }).resize({ width: 1200, height: 1200, fit: "inside" });
  const { data: g, info } = await base.greyscale().median(5).blur(1.2).raw().toBuffer({ resolveWithObject: true });
  const w = info.width,
    h = info.height;
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = (dx: number, dy: number) => g[(y + dy) * w + (x + dx)];
      const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
      const gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
      mag[y * w + x] = Math.hypot(gx, gy);
    }
  const sorted = Float32Array.from(mag).sort();
  const t = Math.max(30, sorted[Math.floor(sorted.length * 0.92)]);
  const out = Buffer.alloc(w * h, 255);
  for (let i = 0; i < w * h; i++) if (mag[i] > t) out[i] = 0;
  return sharp(out, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}
