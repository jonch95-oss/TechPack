import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { glossary, translations } from "@/db/schema";
import { callTechnicalDesigner } from "@/lib/ai/client";
import { TRADE_ZH } from "./dictionary";
import { hasCjk, needsChinese, wordTranslate } from "./words";

export const norm = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();

export type Translation = { zh: Map<string, string>; gaps: string[] };

/**
 * Chinese for every printed line (BRIEF 1.5): the admin glossary first (whole line, then term by
 * term), then cached model translations, then — when `ai` is on and a key is set — the Technical
 * Designer model with the glossary as hard rules; anything still missing is translated term by
 * term from the glossary and the built-in trade dictionary.
 */
export async function translateLines(lines: string[], opts: { ai: boolean; protect: string[] }): Promise<Translation> {
  const protect = new Set(opts.protect.flatMap((p) => norm(p).split(/\s+/)).filter(Boolean));
  const uniq = [...new Set(lines.map(norm))].filter((l) => l && needsChinese(l, protect));
  const gl = await db.select({ en: glossary.en, zh: glossary.zh }).from(glossary);
  const dict = new Map<string, string>(Object.entries(TRADE_ZH));
  for (const g of gl) dict.set(norm(g.en), g.zh);
  const out = new Map<string, string>();

  // 1. Whole-line glossary hits.
  for (const l of uniq) if (gl.some((g) => norm(g.en) === l)) out.set(l, dict.get(l)!);
  // 2. Cached model translations.
  const todo = uniq.filter((l) => !out.has(l));
  if (todo.length) for (const r of await db.select().from(translations).where(inArray(translations.en, todo))) out.set(r.en, r.zh);
  // 3. The model, with the glossary as hard rules.
  const missing = uniq.filter((l) => !out.has(l));
  if (opts.ai && missing.length && process.env.ANTHROPIC_API_KEY && !process.env.AI_FIXTURE_DIR) {
    for (let i = 0; i < missing.length; i += 150) {
      const chunk = missing.slice(i, i + 150);
      try {
        const res = await callTechnicalDesigner<{ items: { en: string; zh: string }[] }>({
          task: "translate",
          effort: "low",
          instructions: [
            "Translate each English tech-pack line into Simplified Chinese for a bag factory.",
            "Use these glossary terms exactly (English = Chinese):",
            ...gl.map((g) => `${norm(g.en)} = ${g.zh}`),
            "Keep codes, style numbers, Pantone / TCX references, measurements and units exactly as written.",
            `Keep these names unchanged: ${[...protect].join(", ") || "—"}.`,
            "Return one item per input line, with `en` copied exactly.",
            "",
            ...chunk.map((l, k) => `${k + 1}. ${l}`),
          ].join("\n"),
          images: [],
          schema: { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["en", "zh"], properties: { en: { type: "string" }, zh: { type: "string" } } } } } },
        });
        const rows = res.output.items.map((it) => ({ en: norm(it.en), zh: it.zh.trim() })).filter((r) => chunk.includes(r.en) && hasCjk(r.zh));
        for (const r of rows) out.set(r.en, r.zh);
        if (rows.length) await db.insert(translations).values(rows).onConflictDoNothing();
      } catch {
        // Fall through to term-by-term translation below.
      }
    }
  }
  // 4. Term by term from the glossary + dictionary.
  for (const l of uniq) if (!out.has(l)) out.set(l, wordTranslate(l, dict, protect));
  // A line still without Chinese is a gap — except a short run of words the dictionary doesn't
  // know at all (a person's or reference brand's name, e.g. BETSY JOHNSON), which stays English.
  const gaps = uniq.filter((l) => !hasCjk(out.get(l) ?? "") && l.split(/\s+/).filter((w) => /[A-Z]{2,}/.test(w)).length > 3);
  return { zh: out, gaps };
}
