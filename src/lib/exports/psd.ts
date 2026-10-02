import "server-only";
import sharp, { type OverlayOptions, type Sharp } from "sharp";
import { writePsdBuffer, type Layer, type Psd } from "ag-psd";

/**
 * Layered PSD of the pack's raster artwork (BRIEF 1.6 / 1.10): colourway renders, the lining repeat
 * with its tile box, and the line art — one layer each, grouped, on a common canvas.
 */
export type PsdSource = {
  renders: { name: string; data: Buffer }[];
  repeat?: { motif: Buffer; tilePx: number; label: string } | null;
  flats: { name: string; svg: string }[];
};

const W = 2400,
  H = 1600;

async function layerFrom(img: Sharp, name: string, opts: { hidden?: boolean } = {}): Promise<Layer & { _png: Buffer }> {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return { name, hidden: opts.hidden, left: 0, top: 0, imageData: { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) }, _png: png };
}

/** The layer without our private preview PNG. */
function bare(l: Layer & { _png: Buffer }): Layer {
  const out: Layer & { _png?: Buffer } = { ...l };
  delete out._png;
  return out;
}

/** An image fitted (contain) into the canvas, on transparent. */
async function fitted(buf: Buffer) {
  const inner = await sharp(buf).flatten({ background: "#ffffff" }).resize({ width: W - 160, height: H - 160, fit: "inside" }).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: inner, gravity: "center" }]).png();
}

export async function buildPsd(src: PsdSource): Promise<Buffer> {
  const groups: Layer[] = [];
  const visible: Buffer[] = [];

  if (src.renders.length) {
    const children: (Layer & { _png: Buffer })[] = [];
    for (const [i, r] of src.renders.entries()) children.push(await layerFrom(sharp(await (await fitted(r.data)).toBuffer()), r.name, { hidden: i > 0 }));
    groups.push({ name: "COLORWAY RENDERS", opened: true, children: children.map(bare) });
    visible.push(children[0]._png);
  }

  if (src.repeat) {
    const t = Math.max(40, Math.round(src.repeat.tilePx));
    const tile = await sharp(src.repeat.motif).resize({ width: t, height: t, fit: "cover" }).png().toBuffer();
    const tiles: OverlayOptions[] = [];
    for (let y = 0; y < H; y += t) for (let x = 0; x < W; x += t) tiles.push({ input: tile, left: x, top: y });
    const repeat = await layerFrom(sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).composite(tiles).png(), "REPEAT", { hidden: src.renders.length > 0 });
    const bx = Math.round(W / 2 - t / 2),
      by = Math.round(H / 2 - t / 2);
    const boxSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${bx}" y="${by}" width="${t}" height="${t}" fill="none" stroke="#e2231a" stroke-width="6"/><text x="${bx + t / 2}" y="${by - 16}" fill="#e2231a" font-family="Arial" font-weight="700" font-size="40" text-anchor="middle">${src.repeat.label.replace(/[<&]/g, "")}</text></svg>`;
    const box = await layerFrom(sharp(Buffer.from(boxSvg)), "TILE BOX", { hidden: src.renders.length > 0 });
    groups.push({ name: "LINING REPEAT", opened: true, children: [repeat, box].map(bare) });
    if (!src.renders.length) visible.push(repeat._png, box._png);
  }

  if (src.flats.length) {
    const children: (Layer & { _png: Buffer })[] = [];
    for (const f of src.flats) children.push(await layerFrom(sharp(await (await fitted(await sharp(Buffer.from(f.svg)).png().toBuffer())).toBuffer()), f.name, { hidden: true }));
    groups.push({ name: "LINE ART", opened: false, children: children.map(bare) });
  }

  const composite = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(visible.map((input) => ({ input })))
    .raw()
    .toBuffer();
  const psd: Psd = { width: W, height: H, children: groups, imageData: { width: W, height: H, data: new Uint8ClampedArray(composite.buffer, composite.byteOffset, composite.length) } };
  return Buffer.from(writePsdBuffer(psd, { generateThumbnail: false }));
}
