import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spellcheckText, type SpellFlag } from "./core";

export type { SpellFlag };

let words: Set<string> | null = null;
let list: string[] | null = null;

function load() {
  if (!words) {
    const file = path.join(process.cwd(), "node_modules", "word-list", "words.txt");
    list = readFileSync(file, "utf8").split("\n").filter(Boolean);
    words = new Set(list);
  }
  return { words: words!, list: list! };
}

/** Spell-check text against the trade dictionary + English word list. */
export function spellcheck(text: string, extraOk: string[] = []): SpellFlag[] {
  const { words, list } = load();
  return spellcheckText(text, (w) => words.has(w), () => list, extraOk);
}

/**
 * Incremental spell-check for a pack (V2 brief §8): each answer's text is checked once and cached, so
 * a save re-checks only the answer that changed. Flags are merged across answers (counts summed).
 */
const cache = new Map<string, SpellFlag[]>();
export function spellcheckParts(parts: string[], extraOk: string[] = []): SpellFlag[] {
  const ok = extraOk.join("|");
  const merged = new Map<string, SpellFlag>();
  for (const text of parts) {
    if (!text.trim()) continue;
    const key = `${ok}\u0000${text}`;
    let flags = cache.get(key);
    if (!flags) {
      flags = spellcheck(text, extraOk);
      if (cache.size > 20_000) cache.delete(cache.keys().next().value!);
      cache.set(key, flags);
    }
    for (const f of flags) {
      const m = merged.get(f.word);
      merged.set(f.word, m ? { ...m, count: m.count + f.count, suggestion: m.suggestion ?? f.suggestion } : { ...f });
    }
  }
  return [...merged.values()];
}
