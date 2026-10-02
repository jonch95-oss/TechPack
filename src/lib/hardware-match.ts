import { normaliseType } from "@/lib/library-import";

/**
 * Hardware read from a spec sheet / supplier sheet / photo → library items and pack rows. Each part
 * keeps its own type: it matches a library item only of the same type, and only on a real supplier
 * code or the same size; otherwise it gets its own new item. Each part fills the pack row of its own
 * type (the row the render pre-fill made), with the size the sheet gives. Pure, so it is unit-tested.
 */

export type SheetPart = { type: string; description: string; supplier_code: string; dims_mm: string; material: string; finish: string };
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

/**
 * Puts each part on a pack row of its own type — the first one not yet given a part in this read —
 * with its size; parts with no such row get a new row. Rows a designer already linked to a different
 * part are left alone.
 */
export function assignRows(rows: Record<string, unknown>[], linked: { type: string; size: string; item: { id: string; label: string }; description: string }[], typeOfItem: (id: string) => string | undefined) {
  const out = rows.map((r) => ({ ...r }));
  const used = new Set<number>();
  for (const l of linked) {
    const rowType = (r: Record<string, unknown>) => {
      const it = r.item as { id: string } | undefined;
      return (it && typeOfItem(it.id)) || partType({ description: String(r.seen ?? "") });
    };
    let i = out.findIndex((r, k) => !used.has(k) && rowType(r) === l.type && (!r.item || (r.item as { id: string }).id === l.item.id));
    if (i < 0) i = out.findIndex((r, k) => !used.has(k) && !r.item && rowType(r) === l.type);
    if (i >= 0) {
      out[i] = { ...out[i], item: l.item, ...(l.size ? { size: l.size } : {}) };
      used.add(i);
    } else {
      out.push({ item: l.item, qty: 1, seen: l.description.toUpperCase(), ...(l.size ? { size: l.size } : {}) });
      used.add(out.length - 1);
    }
  }
  return out;
}
