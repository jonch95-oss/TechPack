import "server-only";
import sharp from "sharp";
import type { FileMarks } from "@/db/schema";
import { readStoredFile } from "@/lib/storage";

export type CropBox = { x: number; y: number; w: number; h: number };

/**
 * Finds the product on a render or design board: the largest blob that differs from the background
 * (estimated from the border), plus any other large blob next to it (a strap that leaves the bag).
 * Small blobs — board text such as "(REFER TO SPEC)", arrows, dimension labels — are left out.
 * Returns fractions of the image, or null when the product already fills the frame.
 */
export async function detectProductBox(data: Buffer): Promise<CropBox | null> {
  const { data: px, info } = await sharp(data).rotate().flatten({ background: "#ffffff" }).resize({ width: 320, height: 320, fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height,
    C = info.channels;
  // Background: median of the border pixels, per channel.
  const border: number[][] = [[], [], []];
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) for (let c = 0; c < 3; c++) border[c].push(px[(y * W + x) * C + c]);
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) for (let c = 0; c < 3; c++) border[c].push(px[(y * W + x) * C + c]);
  const bg = border.map((v) => v.sort((a, b) => a - b)[v.length >> 1]);
  let mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const d = Math.max(Math.abs(px[i * C] - bg[0]), Math.abs(px[i * C + 1] - bg[1]), Math.abs(px[i * C + 2] - bg[2]));
    mask[i] = d > 30 ? 1 : 0;
  }
  // Close small gaps (stitching, sheer mesh) so one product is one blob.
  const r = Math.max(1, Math.round(Math.min(W, H) / 120));
  const dil = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const yy = y + dy,
            xx = x + dx;
          if (yy >= 0 && yy < H && xx >= 0 && xx < W) dil[yy * W + xx] = 1;
        }
    }
  mask = dil;
  // Connected components (4-neighbour).
  const label = new Int32Array(W * H).fill(-1);
  const blobs: { area: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || label[i] >= 0) continue;
    const b = { area: 0, x0: W, y0: H, x1: 0, y1: 0 };
    const id = blobs.length;
    blobs.push(b);
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop()!;
      const x = j % W,
        y = (j / W) | 0;
      b.area++;
      if (x < b.x0) b.x0 = x;
      if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y;
      if (y > b.y1) b.y1 = y;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1])
        if (k >= 0 && mask[k] && label[k] < 0) {
          label[k] = id;
          stack.push(k);
        }
    }
  }
  if (!blobs.length) return null;
  blobs.sort((a, b) => b.area - a.area);
  const box = { ...blobs[0] };
  const near = Math.min(W, H) * 0.04;
  for (const b of blobs.slice(1)) {
    if (b.area < blobs[0].area * 0.12) continue; // text and arrows stay out
    const gapX = Math.max(0, b.x0 - box.x1, box.x0 - b.x1),
      gapY = Math.max(0, b.y0 - box.y1, box.y0 - b.y1);
    if (Math.max(gapX, gapY) > near) continue;
    box.x0 = Math.min(box.x0, b.x0);
    box.y0 = Math.min(box.y0, b.y0);
    box.x1 = Math.max(box.x1, b.x1);
    box.y1 = Math.max(box.y1, b.y1);
  }
  const pad = Math.min(W, H) * 0.02;
  const x0 = Math.max(0, box.x0 - pad),
    y0 = Math.max(0, box.y0 - pad),
    x1 = Math.min(W, box.x1 + 1 + pad),
    y1 = Math.min(H, box.y1 + 1 + pad);
  const crop = { x: x0 / W, y: y0 / H, w: (x1 - x0) / W, h: (y1 - y0) / H };
  if (crop.w > 0.97 && crop.h > 0.97) return null;
  if (crop.w < 0.05 || crop.h < 0.05) return null;
  return roundBox(crop);
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
function roundBox(b: CropBox): CropBox {
  return { x: r4(b.x), y: r4(b.y), w: r4(b.w), h: r4(b.h) };
}

/** A crop box from the client, clamped to the image; null for "whole image". */
export function cleanCrop(c: unknown): CropBox | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const n = (v: unknown) => Math.min(1, Math.max(0, Number(v) || 0));
  const x = n(o.x),
    y = n(o.y);
  const w = Math.min(1 - x, n(o.w)),
    h = Math.min(1 - y, n(o.h));
  if (w < 0.02 || h < 0.02) return null;
  if (x < 0.002 && y < 0.002 && w > 0.996 && h > 0.996) return null;
  return roundBox({ x, y, w, h });
}

/** Applies a crop to image bytes (PNG out, so nothing is lost twice). */
export async function applyCrop(data: Buffer, crop: CropBox | null | undefined): Promise<{ data: Buffer; contentType: string } | null> {
  if (!crop) return null;
  const img = sharp(data).rotate();
  const m = await img.metadata();
  const W = m.autoOrient?.width ?? m.width ?? 0,
    H = m.autoOrient?.height ?? m.height ?? 0;
  if (!W || !H) return null;
  const left = Math.max(0, Math.round(crop.x * W)),
    top = Math.max(0, Math.round(crop.y * H));
  const width = Math.max(1, Math.min(W - left, Math.round(crop.w * W))),
    height = Math.max(1, Math.min(H - top, Math.round(crop.h * H)));
  return { data: await img.extract({ left, top, width, height }).png().toBuffer(), contentType: "image/png" };
}

/** A pack file as used everywhere downstream (PDF, AI read, line art, PSD): cropped when it has a crop. */
export async function readCroppedFile(file: { url: string; marks?: FileMarks | null }): Promise<{ data: Buffer; contentType: string }> {
  const f = await readStoredFile(file.url);
  return (await applyCrop(f.data, file.marks?.crop)) ?? f;
}

/** A point marked on the full image, in the cropped image's coordinates. */
export function intoCrop(p: { x: number; y: number }, crop: CropBox | null | undefined) {
  if (!crop) return p;
  return { x: (p.x - crop.x) / crop.w, y: (p.y - crop.y) / crop.h };
}
