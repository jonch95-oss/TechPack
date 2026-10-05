/**
 * Term-by-term English → Chinese for one printed line: longest phrase first (up to 6 words),
 * glossary terms before the built-in dictionary. Codes, numbers, Pantone references, units and
 * protected names (brand, style, supplier) stay as they are.
 */
export const hasCjk = (s: string) => /[㐀-鿿]/.test(s);

/** Words that need no Chinese: codes, numbers, units, Pantone, single letters. */
export function isNeutral(word: string) {
  return /\d/.test(word) || /^(CM|MM|IN|KG|G|L|PCS?|R\d+|[A-Z])$/i.test(word) || /^[^A-Z]*$/i.test(word);
}

export function wordTranslate(line: string, dict: Map<string, string>, protect: Set<string>): string {
  // Sentence full stops and the asterisks of *UPDATED* separate words; decimals (6.5) don't.
  const tokens = line
    .toUpperCase()
    .replace(/\.(?=\s|$)/g, " . ")
    .split(/(\s+|[,:;()/*]|—)/)
    .filter((t) => t !== undefined && t !== "");
  const words = tokens.map((t) => t.trim());
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!words[i]) {
      i++;
      continue;
    }
    let hit: { n: number; zh: string } | null = null;
    // Longest phrase over up to 6 word tokens (skipping the separators between them).
    for (let span = Math.min(tokens.length - i, 13); span >= 1 && !hit; span--) {
      const phrase = tokens.slice(i, i + span).join("").replace(/\s+/g, " ").trim();
      if (!phrase || /^[\s,:;()/—]/.test(tokens[i + span - 1]) && span > 1) continue;
      if (dict.has(phrase)) hit = { n: span, zh: dict.get(phrase)! };
    }
    if (hit) {
      if (hit.zh) out.push(hit.zh);
      i += hit.n;
      continue;
    }
    const w = words[i];
    if (protect.has(w) || isNeutral(w) || /^[,:;()/*.—]$/.test(w)) out.push(w === "." ? "。" : w);
    else out.push(w); // unknown English word: kept, so the line still reads
    i++;
  }
  return out
    .join(" ")
    .replace(/\s+([,:;)/])/g, "$1")
    .replace(/([(/])\s+/g, "$1")
    .replace(/([㐀-鿿])\s+(?=[㐀-鿿])/g, "$1")
    .trim();
}

/** Does the line contain English words that should have Chinese (not just codes / names)? */
export function needsChinese(line: string, protect: Set<string>) {
  return line
    .toUpperCase()
    .split(/[\s,:;()/*—]+|\.(?=\s|$)/)
    .some((w) => /[A-Z]{2,}/.test(w) && !isNeutral(w) && !protect.has(w));
}
