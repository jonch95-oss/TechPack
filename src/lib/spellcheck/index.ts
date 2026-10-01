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
