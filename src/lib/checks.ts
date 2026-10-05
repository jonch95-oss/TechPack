/**
 * Consistency checks from errors found in real packs (V2.1 §11). Pure: the PDF builder gathers the
 * inputs, the validator turns each finding into a rule (a warning at PROTO, a fail at PRODUCTION;
 * `info` findings only ever warn).
 */
import { parseData } from "@/lib/lineart/geometry";

export type Finding = { rule: string; fix: string; questionId?: string; info?: boolean };

const up = (s: unknown) => String(s ?? "").trim().toUpperCase();
const numberIn = (s: string) => {
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

/**
 * A dimension line whose printed length differs from the line it labels, or from the entered size it
 * stands for (its key is dims.w / dims.h / dims.d). `pxPerUnit` comes from the dimensions layer.
 */
export function flatDimFindings(view: string, svg: string, dims: { w?: number | null; h?: number | null; d?: number | null }): Finding[] {
  const out: Finding[] = [];
  const layer = svg.match(/<g\b[^>]*\bid="dimensions"[^>]*>/)?.[0];
  const meta = layer ? (parseData(layer) as { pxPerUnit?: number }) : {};
  const ppu = meta.pxPerUnit ?? null;
  for (const m of svg.matchAll(/<g\b[^>]*data-paper-data=(['"])[^>]*>/g)) {
    const d = parseData(m[0]) as { kind?: string; key?: string; label?: string; x1?: number; y1?: number; x2?: number; y2?: number };
    if (d.kind !== "dim") continue;
    const body = svg.slice(m.index! + m[0].length, svg.indexOf("</g>", m.index! + m[0].length));
    const text = (body.match(/<text\b[^>]*>([^<]*)<\/text>/)?.[1] ?? "").replace(d.label ?? "", "");
    const printed = numberIn(text);
    if (printed == null) continue;
    if (ppu && [d.x1, d.y1, d.x2, d.y2].every((x) => typeof x === "number")) {
      const drawn = Math.hypot(d.x2! - d.x1!, d.y2! - d.y1!) / ppu;
      if (Math.abs(drawn - printed) > Math.max(0.05 * drawn, 0.15))
        out.push({ rule: `${view} dimension reads ${printed} but its line measures ${Math.round(drawn * 10) / 10}`, fix: "Redraw the dimension line or correct its label." });
    }
    const key = (d.key ?? "").replace(/^dims\./, "") as "w" | "h" | "d";
    const entered = dims[key];
    if (typeof entered === "number" && Math.abs(entered - printed) > Math.max(0.02 * entered, 0.1))
      out.push({ rule: `${view} ${key.toUpperCase()} dimension reads ${printed}, entered ${entered}`, fix: "The line art and the entered size must agree.", questionId: `dims.${key}` });
  }
  return out;
}

/** Text the reader can't see but that is still in the file: hidden, transparent or empty text in a drawing. */
export function hiddenTextFindings(view: string, svg: string): Finding[] {
  const hidden = [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].filter(([, attrs, body]) => /display\s*[:=]\s*["']?none|visibility\s*[:=]\s*["']?hidden|opacity\s*[:=]\s*["']?0(?:\.0+)?\b|fill-opacity\s*[:=]\s*["']?0\b/i.test(attrs) || !body.trim());
  const hiddenGroups = [...svg.matchAll(/<g\b[^>]*(display\s*[:=]\s*["']?none|visibility\s*[:=]\s*["']?hidden)[^>]*>[\s\S]*?<text\b/gi)];
  const n = hidden.length + hiddenGroups.length;
  return n ? [{ rule: `${view}: ${n} hidden or leftover text layer${n > 1 ? "s" : ""}`, fix: "Delete text that doesn't print, or show it." }] : [];
}

/** "SEE NEXT PAGE" in a comment printed on the last page it could point from. */
export function seeNextPageFindings(comments: { letter: string; text: string; lastPage: number | null }[], pageCount: number): Finding[] {
  return comments
    .filter((c) => /SEE (THE )?NEXT PAGES?|SEE FOLLOWING PAGES?|CONTINUED ON NEXT PAGE/i.test(c.text) && (c.lastPage == null || c.lastPage >= pageCount))
    .map((c) => ({ rule: `Comment ${c.letter} says "SEE NEXT PAGE" but there is no next page`, fix: "Point the comment at the page by name, or add the page.", questionId: "comments.list" }));
}

/** The same Pantone code written with different colour names anywhere in the pack. */
export function colourNameFindings(texts: string[]): Finding[] {
  const names = new Map<string, Set<string>>();
  for (const t of texts)
    for (const m of up(t).matchAll(/\b(\d{2}-\d{4})\s*(?:TCX|TPX|TPG)\s+([A-Z][A-Z ]{2,30}?)(?=$|[,;/()\n]|\s{2}|\s(?:TCX|TPX|PANTONE|\d))/g)) {
      const set = names.get(m[1]) ?? new Set<string>();
      set.add(m[2].trim());
      names.set(m[1], set);
    }
  return [...names].filter(([, s]) => s.size > 1).map(([code, s]) => ({ rule: `${code} TCX is named ${[...s].join(" and ")}`, fix: "Use one colour name for one Pantone code on every page." }));
}

/** A breakdown cell that names a chip (#n) the linked card's shade doesn't match. */
export function chipFindings(cells: { colorway: string; column: string; text: string; cardShade: string | null }[]): Finding[] {
  const out: Finding[] = [];
  for (const c of cells) {
    const m = up(c.text).match(/#\s*(\w+)\s*(?:FROM SWATCH CARD|FROM CARD)|SWATCH\s*#\s*(\w+)/);
    const chip = m?.[1] ?? m?.[2];
    const shade = up(c.cardShade).replace(/^#/, "");
    if (chip && shade && chip !== shade) out.push({ rule: `${c.colorway} ${c.column}: chip #${chip} but the card's shade is #${shade}`, fix: "Pick the chip on the card, or correct the number.", questionId: "materials.matrix" });
  }
  return out;
}

/** A set piece with no size on it. */
export function setPieceFindings(rows: { piece?: string; size?: string; l?: number; w?: number; h?: number }[] | undefined): Finding[] {
  return (rows ?? [])
    .filter((r) => r && (r.piece || r.size) && (typeof r.l !== "number" || typeof r.w !== "number"))
    .map((r) => ({ rule: `Set piece ${up([r.size, r.piece].filter(Boolean).join(" "))} has no dimension label`, fix: "Give every piece its L × W (× H).", questionId: "cube.set" }));
}

const FINISH_WORDS = [/GOLD/, /SILVER|NICKEL/, /GUNMETAL/, /BLACK/, /BRASS/, /ROSE/, /MULTI|IRIDESCENT/];
/** The finish the pack states (read from the render or entered) against a part's own record. */
export function finishFindings(packFinish: string, parts: { code: string; finish: string }[]): Finding[] {
  const f = up(packFinish);
  if (!f) return [];
  const family = (s: string) => FINISH_WORDS.findIndex((re) => re.test(s));
  const fam = family(f);
  return parts
    .filter((p) => p.finish && fam >= 0 && family(up(p.finish)) >= 0 && family(up(p.finish)) !== fam)
    .map((p) => ({ rule: `Finish ${f} conflicts with ${p.code} (${up(p.finish)})`, fix: "Settle one finish: the render and the component sheet must agree.", questionId: "hardware.finish" }));
}

const TEXTURES: [RegExp, string][] = [
  [/\bSMOOTH\b/, "SMOOTH"],
  [/\bPEBBLE(D)?\b|\bPEBBLE[- ]GRAIN\b/, "PEBBLE"],
  [/\bSAFFIANO\b|\bCROSS[- ]GRAIN\b/, "SAFFIANO"],
  [/\bCROC(O|ODILE)?\b/, "CROC"],
  [/\bPATENT\b/, "PATENT"],
  [/\bSUEDE\b|\bNUBUCK\b/, "SUEDE"],
  [/\bQUILTED\b/, "QUILTED"],
];
/** A material described one way and linked to a card of another texture ("SMOOTH" vs a pebble-grain card). */
export function textureFindings(rows: { callout: number; name: string; card: string }[]): Finding[] {
  const tex = (s: string) => TEXTURES.filter(([re]) => re.test(up(s))).map(([, t]) => t);
  const out: Finding[] = [];
  for (const r of rows) {
    const a = tex(r.name),
      b = tex(r.card);
    if (a.length && b.length && !a.some((t) => b.includes(t)))
      out.push({ rule: `Material ${r.callout} says ${a.join("/")} but its card is ${b.join("/")}`, fix: "Correct the description or link the right card.", questionId: "materials.list" });
  }
  return out;
}

/** Interior and exterior accents in different colours (info only). */
export function accentFindings(trims: { name: string; values: Record<string, string> }[]): Finding[] {
  const out: Finding[] = [];
  for (const t of trims) {
    if (!/INTERIOR/i.test(t.name)) continue;
    const base = up(t.name).replace(/\bINTERIOR\b/, "").replace(/\s+/g, " ").trim();
    const ext = trims.find((x) => x !== t && up(x.name).replace(/\bEXTERIOR\b/, "").replace(/\s+/g, " ").trim() === base);
    if (!ext) continue;
    const diff = Object.keys(t.values).filter((cw) => ext.values[cw] && t.values[cw] && up(ext.values[cw]) !== up(t.values[cw]));
    if (diff.length) out.push({ rule: `Interior ${base} differs from exterior (${diff.join(", ")})`, fix: "Info — check this is intended.", info: true });
  }
  return out;
}
