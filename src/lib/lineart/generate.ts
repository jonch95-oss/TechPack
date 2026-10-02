import "server-only";
import { friendlyAIError } from "@/lib/ai/errors";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { edgeLineArt, renderSilhouette } from "./trace";
import type { View } from "./geometry";

/**
 * Render → technical flat raster (BRIEF 1.7 "Generation"). Claude does not generate images, so
 * this uses the image API in IMAGE_API_KEY (IMAGE_PROVIDER = openai | google; IMAGE_MODEL
 * overrides the model). Without a key — or if the call fails — the render itself is turned into
 * line art (edge trace) so the designer always gets something editable.
 *
 * Test seam: `flat-<view>.png` in FLAT_FIXTURE_DIR or AI_FIXTURE_DIR is used when present.
 */

const VIEW_TEXT: Record<View, string> = {
  FRONT: "the FRONT view, looking straight at the front panel",
  BACK: "the BACK view (the side not visible in the render — infer it from the product's construction; keep handles, straps and hardware consistent with the front)",
  SIDE: "the SIDE view (right side), showing the gusset depth and how the strap / handle attaches",
  TOP: "the TOP view, looking straight down, showing the opening / zip and the depth",
};

export function flatPrompt(view: View, category: string) {
  return [
    `Convert this product render (${category}) into a factory technical flat drawing: ${VIEW_TEXT[view]}.`,
    "Strict orthographic projection, no perspective. Black outline about 1 pt thick, pure white fill, no shading, no gradients, no texture, no colour, no shadows, no background.",
    "Draw seams and topstitching as thin dashed lines. Draw hardware (rings, snaps, logo plate, zip pulls) as clean outlines.",
    "Keep exact proportions of the product. Centre it on a white page with generous margins. No text, no labels, no dimensions.",
  ].join(" ");
}

export type FlatRaster = { png: Buffer; source: "AI" | "TRACE"; note: string; mask?: Buffer };

export async function generateFlatRaster(render: Buffer, view: View, category: string): Promise<FlatRaster> {
  for (const dir of [process.env.FLAT_FIXTURE_DIR, process.env.AI_FIXTURE_DIR]) {
    if (!dir) continue;
    const data = await readFile(path.join(dir, `flat-${view.toLowerCase()}.png`)).catch(() => null);
    if (data) return { png: data, source: "AI", note: "fixture" };
  }
  const key = process.env.IMAGE_API_KEY;
  let apiError = "";
  if (key) {
    try {
      const png = (process.env.IMAGE_PROVIDER ?? "openai").toLowerCase().startsWith("google") ? await google(render, view, category, key) : await openai(render, view, category, key);
      return { png, source: "AI", note: "" };
    } catch (e) {
      apiError = friendlyAIError(e, "image", "Drawing the flat");
    }
  }
  if (view !== "FRONT") throw new Error(apiError || "Back, side and top views need the image service (IMAGE_API_KEY).");
  // Front view: trace the render itself so the designer isn't blocked — but only when a trace can work.
  // A dark or sheer product (black leather, micro-mesh) traces as a solid blob, so stop with a clear message.
  const why = await untraceable(render);
  if (why) throw new Error(`${apiError || "No image service is set up."} The render can't be traced instead — ${why}. Try again once the image service is back, or upload your own flat drawing.`);
  return {
    png: await edgeLineArt(render),
    mask: await renderSilhouette(render),
    source: "TRACE",
    note: apiError ? `${apiError} Traced from the render instead — tidy it in the editor.` : "No image API key — traced straight from the render. Tidy it in the editor.",
  };
}

/**
 * Why a render can't be traced into line art, or "" when it can. Looks only at the product (pixels
 * that differ from the border colour): too dark → no visible seams; too busy (mesh, sheer, heavy
 * texture) → edges everywhere.
 */
export async function untraceable(render: Buffer): Promise<string> {
  const { data, info } = await sharp(render).rotate().flatten({ background: "#ffffff" }).resize({ width: 400, height: 400, fit: "inside" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height;
  const border: number[] = [];
  for (let x = 0; x < W; x++) border.push(data[x], data[(H - 1) * W + x]);
  for (let y = 0; y < H; y++) border.push(data[y * W], data[y * W + W - 1]);
  const bg = border.sort((a, b) => a - b)[border.length >> 1];
  let n = 0,
    sum = 0,
    busy = 0;
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (Math.abs(data[i] - bg) < 30) continue;
      n++;
      sum += data[i];
      const gx = data[i + 1] - data[i - 1],
        gy = data[i + W] - data[i - W];
      if (Math.abs(gx) + Math.abs(gy) > 60) busy++;
    }
  if (n < W * H * 0.02) return "no product found on it";
  if (sum / n < 70) return "the product is too dark for its seams to show";
  if (busy / n > 0.22) return "the material is sheer or heavily textured, so edges are everywhere";
  return "";
}

async function asPng(render: Buffer) {
  return sharp(render).flatten({ background: "#ffffff" }).resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true }).png().toBuffer();
}

async function openai(render: Buffer, view: View, category: string, key: string) {
  const meta = await sharp(render).metadata();
  const landscape = (meta.width ?? 1) >= (meta.height ?? 1);
  const form = new FormData();
  form.append("model", process.env.IMAGE_MODEL || "gpt-image-1");
  form.append("prompt", flatPrompt(view, category));
  form.append("image", new Blob([new Uint8Array(await asPng(render))], { type: "image/png" }), "render.png");
  form.append("size", landscape ? "1536x1024" : "1024x1536");
  form.append("quality", "high");
  form.append("background", "opaque");
  const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(240_000) });
  const json = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; error?: { message?: string } };
  if (!res.ok || !json.data?.[0]?.b64_json) throw new Error(json.error?.message ?? `OpenAI images ${res.status}`);
  return Buffer.from(json.data[0].b64_json, "base64");
}

async function google(render: Buffer, view: View, category: string, key: string) {
  const model = process.env.IMAGE_MODEL || "gemini-2.5-flash-image";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: "image/png", data: (await asPng(render)).toString("base64") } }, { text: flatPrompt(view, category) }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
    signal: AbortSignal.timeout(240_000),
  });
  const json = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[]; error?: { message?: string } };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data);
  const data = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!res.ok || !data) throw new Error(json.error?.message ?? `Google image ${res.status}`);
  return Buffer.from(data, "base64");
}
