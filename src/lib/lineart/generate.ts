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
  if (key) {
    try {
      const png = (process.env.IMAGE_PROVIDER ?? "openai").toLowerCase().startsWith("google") ? await google(render, view, category, key) : await openai(render, view, category, key);
      return { png, source: "AI", note: "" };
    } catch (e) {
      const msg = friendlyAIError(e, "image", "Drawing the flat");
      if (view !== "FRONT") throw new Error(msg);
      // Front view: fall back to tracing the render so the designer isn't blocked.
      return { png: await edgeLineArt(render), mask: await renderSilhouette(render), source: "TRACE", note: `${msg} Traced from the render instead — tidy it in the editor.` };
    }
  }
  if (view !== "FRONT") throw new Error("Back, side and top views need the image API (IMAGE_API_KEY).");
  return { png: await edgeLineArt(render), mask: await renderSilhouette(render), source: "TRACE", note: "No image API key — traced straight from the render. Tidy it in the editor." };
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
