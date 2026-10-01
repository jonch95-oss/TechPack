import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { TECHNICAL_DESIGNER_SYSTEM_PROMPT } from "./system-prompt";

export const DEFAULT_MODEL = "claude-opus-5-5";

export function aiModel() {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export class AIUnavailableError extends Error {}

export type AIImage = { data: Buffer; contentType: string };

export type AICallResult<T> = { output: T; model: string; fixture: boolean };

/**
 * One structured call to the Technical Designer agent.
 *
 * Test seam: when AI_FIXTURE_DIR is set (tests / local dev without a key), the
 * response is read from `<AI_FIXTURE_DIR>/<task>.json` instead of calling the API.
 * Never set it in Vercel.
 */
export async function callTechnicalDesigner<T>(opts: {
  task: "analyse_render" | "read_swatch_card" | "build_pack" | "validate" | "diff_revision" | "translate";
  instructions: string;
  images: AIImage[];
  schema: Record<string, unknown>;
  fixtureName?: string;
}): Promise<AICallResult<T>> {
  const fixtureDir = process.env.AI_FIXTURE_DIR;
  if (fixtureDir) {
    const file = path.join(fixtureDir, `${opts.fixtureName ?? opts.task}.json`);
    return { output: JSON.parse(await readFile(file, "utf8")) as T, model: "fixture", fixture: true };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new AIUnavailableError("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic();
  const model = aiModel();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...opts.images.map(
      (img): Anthropic.Beta.BetaImageBlockParam => ({
        type: "image",
        source: {
          type: "base64",
          media_type: normaliseMediaType(img.contentType),
          data: img.data.toString("base64"),
        },
      }),
    ),
    { type: "text", text: `TASK: ${opts.task}\n\n${opts.instructions}` },
  ];

  const useFallback = FALLBACK_MODELS.has(model);
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 32000,
    system: TECHNICAL_DESIGNER_SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: opts.schema } },
    messages: [{ role: "user", content }],
    ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (msg.stop_reason === "max_tokens") throw new Error("The model response was cut off (max_tokens).");
  const text = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { output: JSON.parse(text) as T, model: msg.model, fixture: false };
}

function normaliseMediaType(ct: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const t = ct.toLowerCase();
  if (t.includes("png")) return "image/png";
  if (t.includes("gif")) return "image/gif";
  if (t.includes("webp")) return "image/webp";
  return "image/jpeg";
}
