/**
 * Line-art fallbacks (V2 §8): when the image service can't draw a flat (no key, an error, or a dark /
 * sheer product that won't trace), a silhouette template flat scaled to the entered H × W — a clean
 * outline the designer adjusts in the editor. Never a raw trace of a render it can't read. Pure.
 */
import { flatSvg, type Box, type View } from "./geometry";

export type TemplateShape = "RECT" | "TRAPEZOID" | "HALF_MOON" | "CASE";

/** The template for a category / silhouette. */
export function templateFor(category: string, silhouette: string): { shape: TemplateShape; handle: boolean } {
  const s = silhouette.toUpperCase();
  if (/LUGGAGE/i.test(category)) return { shape: "CASE", handle: true };
  if (/TOTE|BUCKET/.test(s)) return { shape: "TRAPEZOID", handle: true };
  if (/HOBO|SADDLE|HALF|CRESCENT/.test(s)) return { shape: "HALF_MOON", handle: false };
  if (/SATCHEL|TOP-HANDLE|DOCTOR|BOWLING/.test(s)) return { shape: "RECT", handle: true };
  return { shape: "RECT", handle: false };
}

const r = (n: number) => Math.round(n * 10) / 10;

/** A closed outline as points, inside box b. */
function outlinePoints(shape: TemplateShape, b: Box): [number, number][] {
  const { x, y, w, h } = b;
  if (shape === "TRAPEZOID") {
    const k = w * 0.08;
    return [[x, y], [x + w, y], [x + w - k, y + h], [x + k, y + h]];
  }
  if (shape === "HALF_MOON") {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI + (Math.PI * i) / 24;
      pts.push([x + w / 2 + (w / 2) * Math.cos(a), y + h * 0.35 + h * 0.35 * Math.sin(a)]);
    }
    pts.push([x + w, y + h], [x, y + h]);
    return pts;
  }
  // RECT / CASE: rounded rectangle (a case gets bigger corners).
  const rad = Math.min(w, h) * (shape === "CASE" ? 0.12 : 0.05);
  const pts: [number, number][] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (Math.PI / 2) * (i / 6);
      pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
    }
  };
  corner(x + w - rad, y + rad, -Math.PI / 2);
  corner(x + w - rad, y + h - rad, 0);
  corner(x + rad, y + h - rad, Math.PI / 2);
  corner(x + rad, y + rad, Math.PI);
  return pts;
}

const pathOf = (pts: [number, number][]) => `M${pts.map(([px, py]) => `${r(px)} ${r(py)}`).join("L")}Z`;

/** The same outline shrunk toward its centre by `t` (the line weight). */
function inset(pts: [number, number][], b: Box, t: number): [number, number][] {
  const cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  const sx = (b.w - 2 * t) / b.w,
    sy = (b.h - 2 * t) / b.h;
  return pts.map(([px, py]) => [cx + (px - cx) * sx, cy + (py - cy) * sy]);
}

/**
 * The template flat: body outline (as a filled ring, like a traced line), an optional handle arc
 * above it, the stitch line inside, scaled to the entered W × H (px per unit fixed), so the automatic
 * dimension lines read the entered size.
 */
export function templateFlat(opts: { view: View; unit: "cm" | "in"; w: number; h: number; shape: TemplateShape; handle: boolean }): string {
  const ppu = opts.unit === "in" ? 40 : 16; // px per unit
  const bw = Math.max(1, opts.w) * ppu,
    bh = Math.max(1, opts.h) * ppu;
  const margin = Math.max(bw, bh) * 0.35;
  const handleH = opts.handle ? bh * 0.45 : 0;
  const body: Box = { x: margin, y: margin + handleH, w: bw, h: bh };
  const t = Math.max(2, Math.min(bw, bh) * 0.012);
  const outer = outlinePoints(opts.shape, body);
  const ring = `${pathOf(outer)}${pathOf(inset(outer, body, t))}`;
  const seam = inset(outer, body, Math.min(bw, bh) * 0.035);
  const seamRing = `${pathOf(seam)}${pathOf(inset(seam, body, t * 0.5))}`;
  // A carry handle: an arch over the middle 40 % of the top, drawn as a ring like the body line.
  let handle = "";
  if (opts.handle) {
    const x0 = body.x + bw * 0.3,
      x1 = body.x + bw * 0.7,
      rx = (x1 - x0) / 2;
    handle = `<path d="M${r(x0)} ${r(body.y)}A${r(rx)} ${r(handleH)} 0 0 1 ${r(x1)} ${r(body.y)}L${r(x1 - 2 * t)} ${r(body.y)}A${r(rx - 2 * t)} ${r(handleH - 2 * t)} 0 0 0 ${r(x0 + 2 * t)} ${r(body.y)}Z"/>`;
  }
  const w = body.x + bw + margin,
    h = body.y + bh + margin;
  // The outline box is the body (the handle sits above it), so W × H dimension lines measure the body.
  return flatSvg(
    { view: opts.view, unit: opts.unit, pxPerUnit: null, bbox: { x: r(body.x), y: r(body.y), w: r(bw), h: r(bh) }, w: r(w), h: r(h) },
    { fill: `<path d="${pathOf(outer)}"/>`, outline: `<path d="${ring}"/>${handle}`, stitching: `<path d="${seamRing}" fill-rule="evenodd"/>` },
  );
}
