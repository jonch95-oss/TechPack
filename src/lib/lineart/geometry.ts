/**
 * Flat geometry shared by the server (tracing, auto-annotation, PDF) and the editor: contour
 * splitting, the layered SVG document format, scaling to H × W (× D) and the automatic
 * dimension lines / callouts. Nothing here invents a measurement: every dimension line is drawn
 * from an entered value, and its label is computed back from its drawn length.
 */

export type Box = { x: number; y: number; w: number; h: number };
export type Contour = { d: string; bbox: Box; area: number; pts: [number, number][] };

export const LAYERS = ["fill", "outline", "stitching", "hardware", "dimensions", "callouts"] as const;
export type LayerName = (typeof LAYERS)[number];
export const EDITABLE_LAYERS: LayerName[] = ["outline", "stitching", "hardware", "callouts", "dimensions"];

export type View = "FRONT" | "BACK" | "SIDE" | "TOP";
export type Unit = "cm" | "in";

/** Splits a potrace path (`M … C … L … Z M …`) into contours with bounding box and signed area. */
export function splitContours(d: string): Contour[] {
  const parts = d.match(/M[^M]*/g) ?? [];
  return parts.map((part) => {
    const nums = (part.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      area = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const [nx, ny] = pts[(i + 1) % pts.length];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      area += x * ny - nx * y;
    }
    return { d: part.trim(), bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, area: area / 2, pts };
  });
}

export function pointInPolygon(x: number, y: number, pts: [number, number][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------------------ */
/* Document format                                                     */
/* ------------------------------------------------------------------ */

export type FlatMeta = { view: View; unit: Unit; pxPerUnit: number | null; bbox: Box | null; w: number; h: number };

const attr = (o: unknown) => JSON.stringify(o).replace(/&/g, "&amp;").replace(/'/g, "&#39;");

/**
 * The stored flat: one `<g id="layer">` per layer. Metadata rides in `data-paper-data` so the
 * Paper.js editor round-trips it untouched.
 */
export function flatSvg(meta: FlatMeta, layers: Partial<Record<LayerName, string>>) {
  const g = (name: LayerName, style: string) => `<g id="${name}" ${style}${name === "outline" ? ` data-paper-data='${attr({ bbox: meta.bbox })}'` : ""}${name === "dimensions" ? ` data-paper-data='${attr({ pxPerUnit: meta.pxPerUnit, unit: meta.unit, view: meta.view })}'` : ""}>${layers[name] ?? ""}</g>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${meta.w} ${meta.h}" width="${meta.w}" height="${meta.h}" data-view="${meta.view}">`,
    g("fill", `fill="#ffffff" stroke="none"`),
    g("outline", `fill="#111111" fill-rule="evenodd" stroke="none"`),
    g("stitching", `fill="#111111" stroke="none"`),
    g("hardware", `fill="none" stroke="#111111"`),
    g("dimensions", ""),
    g("callouts", ""),
    `</svg>`,
  ].join("");
}

export function tracedLayers(t: { outline: string[]; stitching: string[]; silhouette: string | null }) {
  return {
    fill: t.silhouette ? `<path d="${t.silhouette}"/>` : "",
    outline: t.outline.map((d) => `<path d="${d}"/>`).join(""),
    stitching: t.stitching.map((d) => `<path d="${d}"/>`).join(""),
  };
}

/** Reads the metadata back out of a stored flat (server side, no DOM). */
export function readMeta(svg: string): FlatMeta {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const view = (/data-view="(\w+)"/.exec(svg)?.[1] ?? "FRONT") as View;
  const data = (id: string) => {
    const tag = new RegExp(`<g\\b[^>]*\\bid="${id}"[^>]*>`).exec(svg)?.[0];
    return tag ? parseData(tag) : {};
  };
  const dim = data("dimensions");
  const out = data("outline");
  return {
    view,
    unit: dim.unit === "in" ? "in" : "cm",
    pxPerUnit: typeof dim.pxPerUnit === "number" ? dim.pxPerUnit : null,
    bbox: (out.bbox as Box | undefined) ?? null,
    w: vb ? Number(vb[1]) : 0,
    h: vb ? Number(vb[2]) : 0,
  };
}

/** Decodes a `data-paper-data` attribute written either by us ('…') or by Paper.js ("…" with entities). */
export function parseData(tag: string): Record<string, unknown> {
  const m = /data-paper-data=(['"])(.*?)\1/.exec(tag);
  if (!m) return {};
  try {
    return JSON.parse(decodeEntities(m[2])) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const decodeEntities = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Replaces one layer's contents (server side). */
export function replaceLayer(svg: string, name: LayerName, inner: string) {
  const re = new RegExp(`(<g[^>]*id="${name}"[^>]*>)([\\s\\S]*?)(</g>)(?=\\s*(?:<g\\b[^>]*\\bid="(?:${LAYERS.join("|")})"|</svg>))`);
  if (re.test(svg)) return svg.replace(re, (_m, open: string, _inner: string, close: string) => `${open}${inner}${close}`);
  return svg.replace("</svg>", `<g id="${name}">${inner}</g></svg>`);
}

/** Sets the metadata on the dimensions layer (pixels per unit). */
export function setDimMeta(svg: string, meta: { pxPerUnit: number | null; unit: Unit; view: View }) {
  return svg.replace(/<g\b[^>]*\bid="dimensions"[^>]*>/, (tag) => `${tag.replace(/\sdata-paper-data=(['"]).*?\1/, "").replace(/>$/, "")} data-paper-data='${attr(meta)}'>`);
}

/* ------------------------------------------------------------------ */
/* Scale                                                               */
/* ------------------------------------------------------------------ */

/** Which entered dimension the drawing's width represents in each view. */
export function widthDim(view: View, dims: { h?: number; w?: number; d?: number }) {
  if (view === "SIDE") return dims.d;
  return dims.w;
}

export function heightDim(view: View, dims: { h?: number; w?: number; d?: number }) {
  if (view === "TOP") return dims.d;
  return dims.h;
}

/** Pixels per unit so the drawing's bounding-box width reads the entered width. */
export function pxPerUnitFor(view: View, bbox: Box | null, dims: { h?: number; w?: number; d?: number }) {
  const wd = widthDim(view, dims);
  if (!bbox || !wd || wd <= 0) return null;
  return bbox.w / wd;
}

export function fmtLen(len: number, unit: Unit) {
  const v = unit === "in" ? Math.round(len * 8) / 8 : Math.round(len * 10) / 10;
  const s = Number.isInteger(v) ? String(v) : String(v);
  return unit === "in" ? `${s}"` : `${s} CM`;
}

/* ------------------------------------------------------------------ */
/* Dimension lines                                                     */
/* ------------------------------------------------------------------ */

export type DimSpec = { key: string; label?: string; x1: number; y1: number; x2: number; y2: number; offset: number };

/**
 * A red dimension line with end ticks and its length written along it. The label is always the
 * drawn length ÷ pixels-per-unit, so it reads true; `label` adds a name (e.g. HANDLE DROP).
 */
export function dimSvg(s: DimSpec, pxPerUnit: number, unit: Unit, size: number) {
  const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  const text = `${s.label ? `${s.label} ` : ""}${fmtLen(len / pxPerUnit, unit)}`;
  const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
  const nx = -Math.sin(ang),
    ny = Math.cos(ang);
  const ox = nx * s.offset,
    oy = ny * s.offset;
  const a = { x: s.x1 + ox, y: s.y1 + oy },
    b = { x: s.x2 + ox, y: s.y2 + oy };
  const t = size * 0.45;
  const tick = (p: { x: number; y: number }) => `<path d="M${r(p.x - nx * t)} ${r(p.y - ny * t)}L${r(p.x + nx * t)} ${r(p.y + ny * t)}"/>`;
  const ext = (from: { x: number; y: number }, to: { x: number; y: number }) => `<path d="M${r(from.x)} ${r(from.y)}L${r(to.x)} ${r(to.y)}" stroke-dasharray="${r(size * 0.25)} ${r(size * 0.2)}" stroke-width="${r(size * 0.04)}"/>`;
  const deg = (ang * 180) / Math.PI;
  const flip = deg > 90 || deg < -90;
  const rot = flip ? deg + 180 : deg;
  // Text sits beside the line (outside the offset side), centred on it; the baseline is placed
  // explicitly rather than with dominant-baseline so every renderer agrees.
  const fs = size * 0.8;
  const side = Math.sign(s.offset || 1);
  const c = { x: (a.x + b.x) / 2 + nx * size * 0.6 * side, y: (a.y + b.y) / 2 + ny * size * 0.6 * side };
  const rr = (rot * Math.PI) / 180;
  const mid = { x: c.x - Math.sin(rr) * fs * 0.35, y: c.y + Math.cos(rr) * fs * 0.35 };
  const data = attr({ kind: "dim", key: s.key, label: s.label ?? "", x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, offset: s.offset });
  return `<g data-paper-data='${data}' stroke="#e2231a" fill="none" stroke-width="${r(size * 0.07)}">${s.offset ? ext({ x: s.x1, y: s.y1 }, a) + ext({ x: s.x2, y: s.y2 }, b) : ""}<path d="M${r(a.x)} ${r(a.y)}L${r(b.x)} ${r(b.y)}"/>${tick(a)}${tick(b)}<text x="${r(mid.x)}" y="${r(mid.y)}" transform="rotate(${r(rot)} ${r(mid.x)} ${r(mid.y)})" fill="#e2231a" stroke="none" font-family="IconCond, Arial Narrow, Arial, sans-serif" font-weight="700" font-size="${r(fs)}" text-anchor="middle">${esc(text)}</text></g>`;
}

const r = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ------------------------------------------------------------------ */
/* Auto-annotation                                                     */
/* ------------------------------------------------------------------ */

export type AnnotateInput = {
  view: View;
  unit: Unit;
  w: number;
  h: number;
  bbox: Box | null;
  dims: { h?: number; w?: number; d?: number };
  /** Extra entered measurements drawn on the front view. */
  extras?: { handleDrop?: number; flapHeight?: number; logoOffsetMm?: number; logoSizeMm?: { w?: number; h?: number } };
  materials: { callout: number; name: string; locations: string[] }[];
  comments: { letter: string }[];
  logo?: { code: string; type: string } | null;
};

/** Where on the body each material location points (fractions of the body box). */
const LOCATION_POINTS: Record<string, [number, number]> = {
  FLAP: [0.3, 0.2],
  FRONT: [0.35, 0.7],
  BODY: [0.35, 0.7],
  BACK: [0.35, 0.65],
  GUSSET: [0.98, 0.6],
  SIDE: [0.98, 0.6],
  BASE: [0.5, 0.98],
  BOTTOM: [0.5, 0.98],
  HANDLE: [0.5, -0.25],
  STRAP: [0.02, 0.8],
  TRIM: [0.1, 0.5],
  PIPING: [0.02, 0.4],
  POCKET: [0.6, 0.6],
  BINDING: [0.6, 0.02],
  "ZIP PULLER": [0.85, 0.05],
};

function bodyBox(bbox: Box, ppu: number | null, hd?: number): Box {
  // The drawing's bbox includes handles/straps; the body is the bottom H of it at the drawn width.
  if (!ppu || !hd) return bbox;
  const bh = Math.min(bbox.h, hd * ppu);
  return { x: bbox.x, y: bbox.y + bbox.h - bh, w: bbox.w, h: bh };
}

export function annotate(i: AnnotateInput): { pxPerUnit: number | null; dimensions: string; callouts: string } {
  const bbox = i.bbox;
  if (!bbox) return { pxPerUnit: null, dimensions: "", callouts: "" };
  const ppu = pxPerUnitFor(i.view, bbox, i.dims);
  const size = annotSize(i.w, i.h);
  const hd = heightDim(i.view, i.dims);
  const wd = widthDim(i.view, i.dims);
  const body = bodyBox(bbox, ppu, hd);
  const gap = size * 2.2;
  const dims: string[] = [];
  if (ppu) {
    const bottom = body.y + body.h;
    if (wd) dims.push(dimSvg({ key: "W", x1: body.x, y1: bottom, x2: body.x + wd * ppu, y2: bottom, offset: gap }, ppu, i.unit, size));
    if (hd) dims.push(dimSvg({ key: "H", x1: body.x + body.w, y1: bottom, x2: body.x + body.w, y2: bottom - hd * ppu, offset: gap }, ppu, i.unit, size));
    if (i.view === "FRONT" && i.extras) {
      const top = bottom - (hd ?? 0) * ppu;
      const cx = body.x + body.w / 2;
      if (i.extras.handleDrop) dims.push(dimSvg({ key: "HANDLE_DROP", label: "HANDLE DROP", x1: cx, y1: top, x2: cx, y2: top - i.extras.handleDrop * ppu, offset: 0 }, ppu, i.unit, size));
      if (i.extras.flapHeight) dims.push(dimSvg({ key: "FLAP", label: "FLAP", x1: body.x, y1: top, x2: body.x, y2: top + i.extras.flapHeight * ppu, offset: -gap }, ppu, i.unit, size));
      if (i.extras.flapHeight && i.extras.logoOffsetMm) {
        const flapEdge = top + i.extras.flapHeight * ppu;
        const off = (i.extras.logoOffsetMm / (i.unit === "in" ? 25.4 : 10)) * ppu;
        dims.push(dimSvg({ key: "LOGO_OFFSET", label: "LOGO", x1: cx + body.w * 0.18, y1: flapEdge, x2: cx + body.w * 0.18, y2: flapEdge - off, offset: 0 }, ppu, i.unit, size));
      }
    }
  }

  /* material callouts down the right, comment bubbles down the left, leader lines to the body */
  const out: string[] = [];
  const longest = Math.max(2, ...(i.logo ? [`LOGO ${i.logo.code}`.length] : [2]));
  const right = Math.min(bbox.x + bbox.w + size * 4.5, i.w - size * (1 + longest * 0.5));
  const mats = i.materials.filter((m) => i.view !== "BACK" || !m.locations.every((l) => l === "FLAP"));
  mats.forEach((m, k) => {
    const loc = m.locations.find((l) => LOCATION_POINTS[l]) ?? "BODY";
    const [fx, fy] = LOCATION_POINTS[loc];
    const tx = body.x + body.w * fx,
      ty = body.y + body.h * fy;
    const cy = body.y + size * 1.5 + k * size * 2.6;
    out.push(calloutSvg({ kind: "material", label: String(m.callout), x: right, y: cy, tx, ty }, size));
  });
  if (i.logo && i.view === "FRONT") {
    const flapH = i.extras?.flapHeight && ppu ? i.extras.flapHeight * ppu : body.h * 0.4;
    const tx = body.x + body.w / 2,
      ty = body.y + flapH * 0.6;
    out.push(calloutSvg({ kind: "logo", label: `LOGO ${i.logo.code}`.trim(), x: right, y: body.y + size * 1.5 + mats.length * size * 2.6, tx, ty }, size));
  }
  const left = Math.max(size * 1.2, bbox.x - size * 4.5);
  i.comments.forEach((c, k) => out.push(calloutSvg({ kind: "comment", label: c.letter, x: left, y: body.y + size * 1.5 + k * size * 2.6 }, size)));
  return { pxPerUnit: ppu, dimensions: dims.join(""), callouts: out.join("") };
}

/** Callout / dimension text size for a drawing of this pixel size. */
export function annotSize(w: number, h: number) {
  return Math.max(14, Math.hypot(w, h) * 0.016);
}

export type CalloutSpec = { kind: "material" | "comment" | "logo"; label: string; x: number; y: number; tx?: number; ty?: number };

/** Yellow numbered circle (materials), red lettered circle (comments) or red label (logo / hardware), with a leader line. */
export function calloutSvg(c: CalloutSpec, size: number) {
  const data = attr({ kind: c.kind, label: c.label, x: r(c.x), y: r(c.y), tx: c.tx ?? null, ty: c.ty ?? null });
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return "";
  const lead = c.tx != null && c.ty != null ? `<path d="M${r(c.x)} ${r(c.y)}L${r(c.tx)} ${r(c.ty)}" stroke="${c.kind === "material" ? "#111111" : "#e2231a"}" stroke-width="${r(size * 0.07)}" fill="none"/><circle cx="${r(c.tx)}" cy="${r(c.ty)}" r="${r(size * 0.14)}" fill="${c.kind === "material" ? "#111111" : "#e2231a"}"/>` : "";
  const font = `font-family="IconCond, Arial Narrow, Arial, sans-serif" font-weight="700"`;
  if (c.kind === "logo")
    return `<g data-paper-data='${data}'>${lead}<rect x="${r(c.x - size * 0.2)}" y="${r(c.y - size * 0.65)}" width="${r(size * (0.6 + c.label.length * 0.5))}" height="${r(size * 1.3)}" fill="#ffffff" stroke="none"/><text x="${r(c.x)}" y="${r(c.y + size * 0.3)}" fill="#e2231a" ${font} font-size="${r(size * 0.85)}">${esc(c.label)}</text></g>`;
  const fill = c.kind === "material" ? "#f7e400" : "#e2231a";
  const tc = c.kind === "material" ? "#111111" : "#ffffff";
  return `<g data-paper-data='${data}'>${lead}<circle cx="${r(c.x)}" cy="${r(c.y)}" r="${r(size * 0.75)}" fill="${fill}" stroke="#111111" stroke-width="${r(size * 0.06)}"/><text x="${r(c.x)}" y="${r(c.y + size * 0.3)}" fill="${tc}" ${font} font-size="${r(size * 0.85)}" text-anchor="middle">${esc(c.label)}</text></g>`;
}

/** Reads every dimension line's key and label length back from a flat (for checks and tests). */
export function readDimensions(svg: string) {
  const out: { key: string; label: string; length: number; text: string }[] = [];
  const meta = readMeta(svg);
  for (const m of svg.matchAll(/<g\b[^>]*data-paper-data=(['"])[^>]*>/g)) {
    const d = parseData(m[0]) as Partial<DimSpec> & { kind?: string; label?: string };
    if (d.kind !== "dim" || d.x1 == null || d.x2 == null || d.y1 == null || d.y2 == null) continue;
    const len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
    const length = meta.pxPerUnit ? len / meta.pxPerUnit : NaN;
    out.push({ key: String(d.key ?? ""), label: d.label ?? "", length, text: meta.pxPerUnit ? fmtLen(length, meta.unit) : "" });
  }
  return out;
}

/**
 * A stored flat prepared for inlining into a page (PDF / workspace): sized by its container,
 * optionally recoloured (COLOUR INDICATIVE previews fill the silhouette with the material colour).
 */
export function inlineFlat(svg: string, opts: { className?: string; fill?: string } = {}) {
  let s = svg.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, "")} preserveAspectRatio="xMidYMid meet" class="${opts.className ?? "flat"}">`);
  if (opts.fill) s = s.replace(/(<g\b[^>]*\bid="fill"[^>]*?)\sfill="[^"]*"/, `$1 fill="${opts.fill}"`);
  return s;
}

/** Material callout numbers and comment letters drawn on a flat. */
export function calloutsOn(svg: string) {
  const out = { materials: new Set<string>(), comments: new Set<string>() };
  for (const m of svg.matchAll(/<g\b[^>]*data-paper-data=(['"])[^>]*>/g)) {
    const d = parseData(m[0]) as { kind?: string; label?: string };
    if (d.kind === "material" && d.label) out.materials.add(d.label);
    if (d.kind === "comment" && d.label) out.comments.add(d.label);
  }
  return out;
}
