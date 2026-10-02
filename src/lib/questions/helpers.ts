/**
 * One-click helpers for the technical designer. None of them invent a measurement: values are only
 * copied from answers the designer already gave; everything else is left blank to fill.
 */
import type { AnswerMap, Category, LibValue, MaterialEntry, MatrixValue } from "./types";

export type PomRow = { point: string; value?: number; tol?: number; how: string };

/** How each point is measured — printed on the POM table so every factory measures the same way. */
export const HOW_TO_MEASURE: Record<string, string> = {
  "TOTAL HEIGHT": "BASE TO TOP EDGE AT CENTRE FRONT, BAG STANDING, EXCL. HANDLE",
  "TOTAL WIDTH": "SIDE SEAM TO SIDE SEAM ACROSS THE BASE",
  "TOTAL DEPTH": "FRONT TO BACK AT THE BASE (GUSSET WIDTH)",
  "TOP WIDTH": "SIDE SEAM TO SIDE SEAM ACROSS THE TOP EDGE",
  "BASE WIDTH": "SIDE SEAM TO SIDE SEAM ACROSS THE BASE",
  "HANDLE DROP": "TOP OF HANDLE TO TOP EDGE OF BAG AT CENTRE, HANDLE UPRIGHT",
  "HANDLE LENGTH": "END TO END ALONG THE HANDLE, INCL. TABS",
  "HANDLE WIDTH": "EDGE TO EDGE AT THE WIDEST POINT",
  "STRAP TOTAL LENGTH": "END TO END INCL. HARDWARE, LAID FLAT, AT LONGEST SETTING",
  "STRAP DROP": "TOP OF STRAP TO TOP EDGE OF BAG, STRAP UPRIGHT",
  "STRAP WIDTH": "EDGE TO EDGE, LAID FLAT",
  "FLAP HEIGHT": "FOLD LINE TO FLAP EDGE AT CENTRE",
  "FLAP OVERHANG": "FLAP EDGE TO BASE SEAM AT CENTRE FRONT",
  "GUSSET WIDTH": "SEAM TO SEAM ACROSS THE GUSSET AT THE BASE",
  "ZIP OPENING": "TOP STOP TO BOTTOM STOP",
  "POCKET WIDTH": "EDGE TO EDGE AT THE POCKET OPENING",
  "POCKET HEIGHT": "OPENING TO POCKET BASE AT CENTRE",
  "LOGO OFFSET": "LOGO EDGE TO REFERENCE EDGE AT CENTRE",
};

const COMMON = ["TOTAL HEIGHT", "TOTAL WIDTH", "TOTAL DEPTH"];
const TEMPLATES: Record<string, string[]> = {
  HANDBAG: [...COMMON, "TOP WIDTH", "HANDLE DROP", "HANDLE WIDTH", "STRAP TOTAL LENGTH", "STRAP DROP", "STRAP WIDTH", "FLAP HEIGHT", "FLAP OVERHANG", "GUSSET WIDTH", "LOGO OFFSET"],
  TOTE: [...COMMON, "TOP WIDTH", "HANDLE DROP", "HANDLE LENGTH", "HANDLE WIDTH", "GUSSET WIDTH", "LOGO OFFSET"],
  SLG: ["TOTAL HEIGHT", "TOTAL WIDTH", "TOTAL DEPTH", "ZIP OPENING", "POCKET WIDTH"],
  LUGGAGE: [...COMMON, "HANDLE LENGTH", "ZIP OPENING"],
  DUFFEL: [...COMMON, "HANDLE DROP", "HANDLE LENGTH", "STRAP TOTAL LENGTH", "STRAP WIDTH", "ZIP OPENING"],
  COSMETIC: [...COMMON, "ZIP OPENING", "HANDLE LENGTH", "HANDLE WIDTH"],
  COOLER: [...COMMON, "HANDLE DROP", "STRAP TOTAL LENGTH", "STRAP WIDTH", "ZIP OPENING"],
  DEFAULT: COMMON,
};

export function templateKey(category: Category, a: AnswerMap): keyof typeof TEMPLATES {
  if (category === "Handbags") return a["hb.silhouette"] === "TOTE" ? "TOTE" : "HANDBAG";
  if (category === "SLGs") return "SLG";
  if (category === "Hardside luggage" || category === "Softside luggage") return "LUGGAGE";
  if (category === "Duffels" || category === "Rolling duffels") return "DUFFEL";
  if (category === "Cosmetic bags" || category === "Toiletry kits") return "COSMETIC";
  if (category === "Men's bags") return a["men.type"] === "DOPP KIT" ? "COSMETIC" : a["men.type"] === "TOTE" ? "TOTE" : "HANDBAG";
  if (category === "Coolers / insulated") return "COOLER";
  return "DEFAULT";
}

/** Value already answered elsewhere in the pack for a point of measure (never estimated). */
export function answeredValue(point: string, a: AnswerMap): number | undefined {
  const n = (k: string) => (typeof a[k] === "number" ? (a[k] as number) : undefined);
  const first = (...ks: string[]) => ks.map(n).find((v) => v !== undefined);
  const inches = a["dims.unit"] === "INCHES";
  switch (point) {
    case "TOTAL HEIGHT":
      return first("dims.h", "duf.size_h", "rduf.size_h");
    case "TOTAL WIDTH":
      return first("dims.w", "duf.size_l", "rduf.size_l");
    case "TOTAL DEPTH":
    case "GUSSET WIDTH":
      return first("dims.d", "duf.size_w", "rduf.size_w");
    case "HANDLE DROP":
      return first("hb.top_handle.drop", "duf.handle_drop", "rduf.handle_drop", "cool.handle_drop", "men.handle_drop");
    case "HANDLE LENGTH":
      return first("duf.handle_length", "rduf.handle_length");
    case "HANDLE WIDTH":
      return first("hb.top_handle.width");
    case "STRAP TOTAL LENGTH":
      return first("hb.strap.length", "duf.strap.length", "rduf.strap.length", "men.strap.length", "cool.strap.length");
    case "STRAP DROP":
      return first("hb.strap.drop", "duf.strap.drop", "men.strap.drop", "cool.strap.drop");
    case "STRAP WIDTH":
      return first("hb.strap.width", "duf.strap.width", "men.strap.width", "cool.strap.width");
    case "FLAP HEIGHT":
      return first("hb.flap_height");
    case "FLAP OVERHANG":
      return first("hb.flap_overhang");
    case "LOGO OFFSET": {
      const mm = n("branding.offset");
      return mm === undefined ? undefined : Math.round((inches ? mm / 25.4 : mm / 10) * 100) / 100;
    }
    default:
      return undefined;
  }
}

/** Template rows for this silhouette, with values copied from answers where they exist. Existing rows are kept. */
export function pomFromTemplate(category: Category, a: AnswerMap, existing: PomRow[] = []): PomRow[] {
  const have = new Set(existing.map((r) => r.point));
  const added = TEMPLATES[templateKey(category, a)]
    .filter((p) => !have.has(p))
    .map((point) => ({ point, value: answeredValue(point, a), how: HOW_TO_MEASURE[point] ?? "" }));
  return [...existing, ...added];
}

/**
 * Icon house tolerances (cm; inches converted). Applied only when the designer clicks, and only to
 * blank tolerance cells.
 */
export function standardTolerance(point: string, value: number | undefined, inches: boolean): number {
  const cm = (() => {
    if (point === "STRAP TOTAL LENGTH" || point === "HANDLE LENGTH") return 1.5;
    if (point === "HANDLE DROP" || point === "STRAP DROP") return 1;
    if (["HANDLE WIDTH", "STRAP WIDTH", "FLAP HEIGHT", "FLAP OVERHANG", "LOGO OFFSET", "POCKET WIDTH", "POCKET HEIGHT", "ZIP OPENING"].includes(point)) return 0.3;
    const v = value === undefined ? 0 : inches ? value * 2.54 : value;
    return v > 40 ? 1 : 0.5;
  })();
  return inches ? Math.round((cm / 2.54) * 8) / 8 : cm;
}

export function applyStandardTolerances(rows: PomRow[], inches: boolean): PomRow[] {
  return rows.map((r) => (r.tol == null ? { ...r, tol: standardTolerance(r.point, r.value, inches) } : r));
}

/* ------------------------------------------------------------------ */
/* Bill of materials                                                   */
/* ------------------------------------------------------------------ */

export type BomRow = { component: string; description: string; qty?: number; unit: string; placement?: string; colour?: string };

/** Builds BOM rows from the answers; existing rows with the same description are kept as they are. */
export function bomFromAnswers(a: AnswerMap, existing: BomRow[] = []): BomRow[] {
  const rows: BomRow[] = [];
  const mats = (a["materials.list"] as MaterialEntry[] | undefined) ?? [];
  const matrix = (a["materials.matrix"] as MatrixValue | undefined) ?? {};
  const cw = Object.keys(matrix)[0];
  for (const m of mats) {
    const cell = cw ? matrix[cw]?.[`mat_${m.callout}`] : undefined;
    rows.push({
      component: m.callout === 1 ? "MAIN MATERIAL" : "TRIM",
      description: `#${m.callout} ${m.name}`,
      unit: "FTY TO CONFIRM",
      placement: m.locations.join(", "),
      colour: cell?.lib || cell?.text ? "SEE MATERIAL / COLOUR BREAKDOWN" : "",
    });
  }
  const lining = (a["interior.lining_material"] as LibValue | undefined)?.label ?? (a["interior.lining_print"] as LibValue | undefined)?.label;
  if (a["interior.lined"] === true) rows.push({ component: "LINING", description: lining ?? "LINING", unit: "FTY TO CONFIRM", placement: "INTERIOR", colour: "SEE BREAKDOWN" });
  if (a["edge.treatment"] === "EDGE PAINT") rows.push({ component: "EDGE PAINT", description: "EDGE PAINT", unit: "FTY TO CONFIRM", placement: "ALL RAW EDGES", colour: String(a["edge.paint_colour"] ?? "") });
  rows.push({ component: "THREAD", description: "SEWING THREAD", unit: "FTY TO CONFIRM", colour: String(a["construction.thread_colour"] ?? "DTM") });
  if (a["interior.base_board"] === true)
    rows.push({ component: "BOARD", description: `${a["interior.base_board_material"] ?? "BASE BOARD"}${a["interior.base_board_mm"] ? ` ${a["interior.base_board_mm"]}MM` : ""}`, qty: 1, unit: "PC", placement: "BASE" });
  if (a["cos.padding"] === true) rows.push({ component: "FOAM / PADDING", description: `${a["cos.padding_mm"] ?? ""}MM PADDING`.trim(), unit: "FTY TO CONFIRM", placement: String(a["cos.padding_where"] ?? "") });
  for (const z of (a["zippers.list"] as Record<string, unknown>[] | undefined) ?? [])
    rows.push({ component: "ZIPPER", description: `${z.size ?? ""} ${z.type ?? ""} ${z.ends ?? ""} ${z.slider ?? ""}`.replace(/\s+/g, " ").trim(), qty: 1, unit: "PC", placement: String(z.position ?? ""), colour: `${z.tape ?? ""} TAPE / ${z.teeth ?? ""} TEETH` });
  for (const h of (a["hardware.items"] as { item?: LibValue; qty?: number; placement?: string }[] | undefined) ?? [])
    if (h.item) rows.push({ component: "HARDWARE", description: h.item.label, qty: h.qty ?? 1, unit: "PC", placement: h.placement ?? "", colour: String(a["hardware.finish"] ?? "") });
  const label = a["interior.label"] as LibValue | undefined;
  if (label) rows.push({ component: "LABEL", description: label.label, qty: 1, unit: "PC", placement: "INTERIOR" });
  for (const p of (a["opt.packaging.items"] as string[] | undefined) ?? []) rows.push({ component: "PACKAGING", description: p, qty: 1, unit: "PC" });
  const seen = new Set(existing.map((r) => r.description));
  return [...existing, ...rows.filter((r) => !seen.has(r.description))];
}

/* ------------------------------------------------------------------ */
/* Content label text from the material library                        */
/* ------------------------------------------------------------------ */

export type CompositionLookup = (libId: string) => string | undefined;

/** "EXTERIOR: 50% TPU 50% COTTON / LINING: 100% POLYESTER" per colourway, from the library compositions. */
export function contentLabel(a: AnswerMap, colorways: string[], composition: CompositionLookup): Record<string, { text: string; missing: string[] }> {
  const mats = (a["materials.list"] as MaterialEntry[] | undefined) ?? [];
  const matrix = (a["materials.matrix"] as MatrixValue | undefined) ?? {};
  const out: Record<string, { text: string; missing: string[] }> = {};
  for (const cw of colorways) {
    const parts: string[] = [];
    const missing: string[] = [];
    const ext = new Set<string>();
    for (const m of mats) {
      const id = matrix[cw]?.[`mat_${m.callout}`]?.lib?.id;
      const comp = id ? composition(id) : undefined;
      if (comp) ext.add(comp);
      else if (id || !matrix[cw]?.[`mat_${m.callout}`]?.text) missing.push(m.name);
    }
    if (ext.size) parts.push(`EXTERIOR: ${[...ext].join(" / ")}`);
    const liningId = (a["interior.lining_material"] as LibValue | undefined)?.id ?? matrix[cw]?.lining?.lib?.id;
    if (a["interior.lined"] === true) {
      const comp = liningId ? composition(liningId) : undefined;
      if (comp) parts.push(`LINING: ${comp}`);
      else missing.push("LINING");
    }
    out[cw] = { text: parts.join("  ·  "), missing };
  }
  return out;
}
