import { normaliseType } from "@/lib/library-import";

/**
 * Hardware read from a spec sheet / supplier sheet / photo → library items and pack rows. Each part
 * keeps its own type: it matches a library item only of the same type, and only on a real supplier
 * code or the same size; otherwise it gets its own new item. Each part fills the pack row of its own
 * type (the row the render pre-fill made), with the size the sheet gives. Pure, so it is unit-tested.
 */

export type SheetPart = { type: string; description: string; supplier_code: string; dims_mm: string; material: string; finish: string; finish_stated?: boolean; qty?: number | null; location?: string };
export type LibPart = { id: string; code: string; type: string; dimsMm: string; notes: string };
export type Resolved<T extends LibPart = LibPart> = { part: SheetPart; type: string; size: string; match: T | null; key: string };

const norm = (s: string) =>
  String(s ?? "")
    .toUpperCase()
    .replace(/Ø/g, "DIA ")
    .replace(/[×*]/g, " X ")
    .replace(/\bMM\b/g, " ")
    .replace(/[^0-9A-Z.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A supplier code worth matching on: not a placeholder like N/A, TBC, "-" or "0". */
export function realCode(code: string) {
  const c = String(code ?? "").trim().toUpperCase();
  if (c.length < 3 || !/[0-9]/.test(c) || !/^[A-Z0-9][A-Z0-9\-./ ]*$/.test(c)) return "";
  if (/^(N\/?A|TBC|TBD|NONE|NIL|UNKNOWN|SEE .*)$/.test(c)) return "";
  return c;
}

/** The part's type, from its type field, else its description ("SQUARE PRONG BUCKLE" → BUCKLE). */
export function partType(p: { type?: string; description?: string }) {
  const fromType = normaliseType(p.type ?? "");
  const fromDesc = normaliseType(p.description ?? "");
  // A generic type ("HARDWARE", "METAL PART") loses to a description that names the part.
  if (!fromType || /^(HARDWARE|METAL|PART|TRIM|ACCESSORY|COMPONENT)S?\b/.test(fromType)) return fromDesc || fromType;
  return fromType;
}

/** The size as it goes on the pack row: "INNER 40 MM", "40 X 15 MM", "DIA 8 MM". */
export function sizeLabel(dims: string) {
  const s = norm(dims);
  return s ? `${s} MM` : "";
}

/** Which library item each part is (or null = create one). Parts that are the same part share a key. */
export function resolveParts<T extends LibPart>(parts: SheetPart[], lib: T[]): Resolved<T>[] {
  return parts
    .filter((p) => (p.type || p.description || "").trim())
    .map((part) => {
      const type = partType(part);
      const dims = norm(part.dims_mm);
      const code = realCode(part.supplier_code);
      const match =
        (code && lib.find((h) => h.type === type && new RegExp(`SUPPLIER CODE ${code.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(\\s|$|·)`).test(h.notes.toUpperCase()))) ||
        (dims && lib.find((h) => h.type === type && norm(h.dimsMm) === dims)) ||
        null;
      return { part, type, size: sizeLabel(part.dims_mm), match, key: `${type}|${code || dims || norm(part.description)}` };
    });
}

/** Types that are the same family of part: a render's "STRAP ANCHOR" is the spec's SQUARE RING. */
function family(type: string) {
  if (["SQUARE RING", "D-RING", "O-RING"].includes(type) || /\b(RING|ANCHOR|LOOP|CONNECTOR)\b/.test(type)) return "RING";
  return type;
}

const STOP = new Set(["THE", "AND", "ON", "OF", "AT", "TO", "IN", "FOR", "WITH", "SIDE", "PART"]);
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w) && !/^\d/.test(w)));
const overlap = (a: string, b: string) => {
  const wa = words(a);
  let n = 0;
  for (const w of words(b)) if (wa.has(w)) n++;
  return n;
};
/** "BOTH TOP CORNERS", "EACH SIDE", "PAIR" → 2 when the sheet gives no quantity. */
const impliedQty = (loc: string) => (/\b(BOTH|EACH|PAIR|TWO|X ?2)\b/.test(norm(loc)) ? 2 : 0);

export type LinkedPart = { type: string; size: string; item: { id: string; label: string }; description: string; location?: string; qty?: number | null; note?: string };
type Row = Record<string, unknown>;

/**
 * Merges each part into the pack's hardware rows (the ones the render pre-fill made) instead of adding
 * rows: the best unused row of the same type — or the same family (a STRAP ANCHOR row takes the square
 * ring) — preferring the row whose placement matches the part's location. A part on the sheet once but
 * on several rows (two ring zip pulls) links every such row. The sheet's quantity applies when the part
 * sits on one row ("BOTH TOP CORNERS" = 2). Rows a designer linked to a different part are left alone,
 * parts with no row get one, and blank rows are dropped — no empty item rows remain for a sheet part.
 */
export function assignRows(rows: Row[], linked: LinkedPart[], typeOfItem: (id: string) => string | undefined) {
  const out = rows.map((r) => ({ ...r }));
  const itemOf = (r: Row) => r.item as { id: string } | undefined;
  const rowType = (r: Row) => {
    const it = itemOf(r);
    return (it && typeOfItem(it.id)) || partType({ description: String(r.seen ?? "") });
  };
  const score = (r: Row, l: LinkedPart) => {
    const it = itemOf(r);
    if (it && it.id !== l.item.id) return 0;
    const t = rowType(r);
    const typeScore = t === l.type ? 3 : family(t) === family(l.type) ? 2 : 0;
    if (!typeScore) return 0;
    return typeScore * 100 + (it ? 50 : 0) + overlap(`${r.placement ?? ""} ${r.seen ?? ""}`, `${l.location ?? ""} ${l.description}`);
  };
  const best = (l: LinkedPart, free: (k: number) => boolean) => {
    let bi = -1;
    let bs = 0;
    out.forEach((r, k) => {
      if (!free(k)) return;
      const s = score(r, l);
      if (s > bs) [bi, bs] = [k, s];
    });
    return bi;
  };
  const used = new Set<number>();
  const rowsOf = new Map<LinkedPart, number[]>();
  const put = (k: number, l: LinkedPart) => {
    const r = out[k];
    const note = l.note && !String(r.seen ?? "").includes(l.note) ? [r.seen, l.note].filter(Boolean).join(" · ") : r.seen;
    out[k] = { ...r, item: l.item, ...(l.size ? { size: l.size } : {}), ...(note ? { seen: note } : {}) };
    used.add(k);
    rowsOf.set(l, [...(rowsOf.get(l) ?? []), k]);
  };
  // 1. each part to its best row; parts with no row get a new one.
  for (const l of linked) {
    const k = best(l, (i) => !used.has(i));
    if (k >= 0) put(k, l);
    else {
      out.push({ item: l.item, qty: l.qty || impliedQty(l.location ?? "") || 1, placement: (l.location ?? "").toUpperCase(), seen: [l.description.toUpperCase(), l.note].filter(Boolean).join(" · "), ...(l.size ? { size: l.size } : {}) });
      used.add(out.length - 1);
      rowsOf.set(l, [out.length - 1]);
    }
  }
  // 2. rows still without an item that are the same part (a second zip pull, the other strap anchor).
  out.forEach((r, k) => {
    if (used.has(k) || itemOf(r)) return;
    let bl: LinkedPart | null = null;
    let bs = 0;
    for (const l of linked) {
      const s = score(r, l);
      if (s > bs) [bl, bs] = [l, s];
    }
    if (bl) put(k, bl);
  });
  // 3. the sheet's quantity, where the part sits on one row.
  for (const [l, ks] of rowsOf) {
    if (ks.length !== 1) continue;
    const q = l.qty || impliedQty(l.location ?? "");
    if (q) out[ks[0]] = { ...out[ks[0]], qty: q };
  }
  return out.filter((r) => itemOf(r) || String(r.seen ?? "").trim() || String(r.placement ?? "").trim());
}

const FINISH_WORDS = [
  "SHINY CHAMPAGNE GOLD", "LIGHT GOLD", "ANTIQUE BRASS", "GUNMETAL", "GUN METAL", "SHINY NICKEL", "BLACK NICKEL", "MATTE BLACK", "ROSE GOLD",
  "ANTIQUE SILVER", "SHINY SILVER", "PALE GOLD", "SHINY GOLD", "MATTE GOLD", "RUTHENIUM", "CHROME", "PALLADIUM", "COPPER", "NICKEL", "GOLD", "SILVER", "BRASS", "BLACK",
];
const NOTE_RE = /NOT (STATED|GIVEN|SPECIFIED|SHOWN|LISTED|ON)|CONFIRM|\b(PER|FROM|AS) (THE )?(RENDER|BOARD|PHOTO|IMAGE)|\bTB[CD]\b|UNKNOWN|ASSUMED|ESTIMATED|\?/;

/**
 * A finish is a value, never a note. "NOT STATED ON SPEC SHEET — CONFIRM (GUNMETAL PER RENDER)" →
 * value GUNMETAL, AI-suggested (needs confirm), and the note kept for the row's "seen".
 */
export function cleanFinish(raw: string, stated = true): { value: string; ai: boolean; note: string } {
  const up = String(raw ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!up) return { value: "", ai: false, note: "" };
  if (!NOTE_RE.test(up) && up.length <= 40) return stated ? { value: up, ai: false, note: "" } : { value: up, ai: true, note: `FINISH ${up} FROM RENDER — CONFIRM` };
  const inParens = [...up.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const pick = (s: string) => FINISH_WORDS.find((f) => new RegExp(`\\b${f}\\b`).test(s));
  const found = inParens.map(pick).find(Boolean) ?? pick(up) ?? "";
  const value = found === "GUN METAL" ? "GUNMETAL" : found;
  return { value, ai: true, note: `FINISH: ${up}` };
}
