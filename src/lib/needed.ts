import { allQuestions, bodyMaterials, isEmpty, type AnswerMap, type Category, type LibValue, type MaterialEntry, type MatrixValue } from "@/lib/questions";

/**
 * "Needed from you": after pre-fill, one line for every fact the factory needs that the render can't
 * give — built from what the AI saw (its pocket, hardware and zipper rows), each pointing at the
 * field (and row) to fill. Counts per group drive the summary.
 */
export type NeededItem = { group: "measurement" | "material" | "hardware"; label: string; questionId: string; row?: number };

type Row = Record<string, unknown>;
const ROW_POSITION: Record<string, string> = { FRONT: "FRONT POCKET", BACK: "BACK POCKET", SIDE: "SIDE", "UNDER FLAP": "FRONT POCKET" };

/** A value is still needed when it's missing or only an AI estimate / inference. */
const open = (v: unknown, st?: string) => isEmpty(v) || st === "est" || st === "inferred" || st === "ai";

/** What size a part needs, from its type (buckle → inner width, ring → inner size …). */
export function sizeNeeded(text: string): string | null {
  const t = text.toUpperCase();
  if (/PULL|PULLER/.test(t)) return null; // zip pulls come with their library drawing
  if (/BUCKLE/.test(t)) return "INNER WIDTH";
  if (/RING|LOOP/.test(t)) return "INNER SIZE (W × H)";
  if (/EYELET|GROMMET|RIVET|SNAP|STUD/.test(t)) return "DIAMETER";
  if (/PLATE|LOGO|BADGE|PATCH|TAG/.test(t)) return "W × H";
  if (/HOOK|CLASP|SLIDER|TURNLOCK|FEET|CHAIN/.test(t)) return "SIZE";
  return "SIZE";
}

export function neededFromYou(opts: {
  category: Category;
  answers: AnswerMap;
  statuses: Record<string, string>;
  colorways: string[];
  /** Library part id → its dims (mm), so linked parts with a size don't ask again. */
  hardwareDims?: Record<string, string>;
}): { items: NeededItem[]; counts: Record<NeededItem["group"], number> } {
  const { answers: a, statuses: st } = opts;
  const qs = allQuestions(opts.category);
  const has = (id: string) => qs.some((q) => q.id === id);
  const items: NeededItem[] = [];
  const push = (group: NeededItem["group"], label: string, questionId: string, row?: number) => items.push({ group, label, questionId, ...(row !== undefined ? { row } : {}) });

  // Overall size.
  if (has("dims.h")) {
    const missing = (["h", "w", "d"] as const).filter((k) => open(a[`dims.${k}`], st[`dims.${k}`]));
    if (missing.length) push("measurement", `OVERALL SIZE — ${missing.map((k) => k.toUpperCase()).join(" × ")}`, `dims.${missing[0]}`);
  }

  // Exterior pockets: pocket size, and the zip opening for each zip pocket.
  const pocketQ = qs.find((q) => q.id.endsWith(".ext_pockets") && q.kind === "rows")?.id;
  const pockets = (pocketQ ? (a[pocketQ] as Row[] | undefined) : undefined) ?? [];
  const zips = (a["zippers.list"] as Row[] | undefined) ?? [];
  const usedZip = new Set<number>();
  const seenPos: Record<string, number> = {};
  pockets.forEach((p, i) => {
    const pos = String(p.position ?? "").toUpperCase();
    const type = String(p.type ?? "POCKET").toUpperCase();
    seenPos[pos] = (seenPos[pos] ?? 0) + 1;
    const name = `${pos ? `${pos} ` : ""}${type}${pockets.filter((x) => x.position === p.position && x.type === p.type).length > 1 ? ` ${seenPos[pos]}` : ""}`;
    if (isEmpty(p.w) || isEmpty(p.h)) push("measurement", `${name} — POCKET SIZE (W × H)`, pocketQ!, i);
    if (/ZIP/.test(type)) {
      const want = ROW_POSITION[pos] ?? "FRONT POCKET";
      const j = zips.findIndex((z, k) => !usedZip.has(k) && String(z.position ?? "") === want);
      if (j >= 0) usedZip.add(j);
      if (j < 0 || isEmpty(zips[j].length)) push("measurement", `${name} — ZIP OPENING LENGTH`, has("zippers.list") ? "zippers.list" : pocketQ!, j >= 0 ? j : undefined);
    }
  });
  // Other zippers (main closure …) without a length.
  zips.forEach((z, j) => {
    if (!usedZip.has(j) && isEmpty(z.length)) push("measurement", `${String(z.position ?? "ZIPPER")} ZIP — OPENING LENGTH`, "zippers.list", j);
  });

  // Hardware: each part needs its library part and its size.
  const hw = (a["hardware.items"] as Row[] | undefined) ?? [];
  hw.forEach((r, i) => {
    const item = r.item as LibValue | undefined;
    const name = String(r.seen || item?.label || `PART ${i + 1}`).toUpperCase();
    if (!item) push("hardware", `${name} — PICK OR ADD THE LIBRARY PART`, "hardware.items", i);
    const what = sizeNeeded(`${r.seen ?? ""} ${item?.label ?? ""}`);
    const libDims = item ? opts.hardwareDims?.[item.id] : "";
    if (what && isEmpty(r.size) && !libDims) push("measurement", `${name} — ${what}`, "hardware.items", i);
  });

  // Strap: width, length, adjustment range.
  const strap = qs.find((q) => q.id.endsWith(".strap") && q.kind === "toggle")?.id;
  if (strap && a[strap] === true) {
    const p = strap;
    if (open(a[`${p}.width`], st[`${p}.width`])) push("measurement", "STRAP WIDTH", `${p}.width`);
    if (open(a[`${p}.length`], st[`${p}.length`])) push("measurement", "STRAP TOTAL LENGTH", `${p}.length`);
    if (a[`${p}.adjustable`] !== false && (open(a[`${p}.adjust_min`], st[`${p}.adjust_min`]) || open(a[`${p}.adjust_max`], st[`${p}.adjust_max`])))
      push("measurement", "STRAP ADJUSTMENT RANGE (SHORTEST – LONGEST)", a[`${p}.adjustable`] === true ? `${p}.adjust_min` : `${p}.adjustable`);
  }

  // Materials: a swatch for every material in every colourway, and the lining.
  const mats = bodyMaterials(a["materials.list"] as MaterialEntry[] | undefined);
  const matrix = (a["materials.matrix"] as MatrixValue | undefined) ?? {};
  for (const m of mats)
    for (const cw of opts.colorways) {
      const cell = matrix[cw]?.[`mat_${m.callout}`];
      if (!cell?.lib && !cell?.text) push("material", `${m.name} (${cw}) — SWATCH / MATERIAL`, "materials.matrix");
    }
  if (a["interior.lined"] === true && has("interior.lining_material") && isEmpty(a["interior.lining_material"])) push("material", "LINING MATERIAL", "interior.lining_material");

  const counts = { measurement: 0, material: 0, hardware: 0 };
  for (const i of items) counts[i.group]++;
  return { items, counts };
}
