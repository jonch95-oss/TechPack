import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { hardware, materials, prints } from "@/db/schema";
import { materialLabel, type LoadedPack } from "@/lib/data";
import {
  completeness,
  derivedValue,
  findQuestion,
  isEmpty,
  matrixColumns,
  sectionsFor,
  type Dims2Value,
  type LibValue,
  type MaterialEntry,
  type MatrixValue,
} from "@/lib/questions";

const SUB_CATEGORY_KEY: Record<string, string> = {
  Handbags: "hb.silhouette",
  SLGs: "slg.type",
  "Men's bags": "men.type",
  "Cosmetic bags": "cos.shape",
  "Toiletry kits": "cos.shape",
  "Coolers / insulated": "cool.type",
  "Neck pillows": "neck.shape",
  Hardware: "hw.type",
  "Hardside luggage": "lug.size",
  "Softside luggage": "slug.size",
};

/**
 * Builds the TechPack JSON (BRIEF Part 2.1) from the captured answers. This is the
 * hand-off to Phase 2 (PDF) and the object the Phase 1 acceptance test checks.
 */
export async function buildTechPackJson(p: LoadedPack) {
  const a = p.answers;
  const ctx = { category: p.pack.category, answers: a, brand: p.brand };
  const unit = a["dims.unit"] === "INCHES" ? "in" : "cm";
  const lib = (v: unknown) => v as LibValue | undefined;

  // Resolve every library reference once.
  const ids = new Set<string>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(walk);
    const o = v as Record<string, unknown>;
    if (typeof o.id === "string" && /^[0-9a-f-]{36}$/i.test(o.id)) ids.add(o.id);
    Object.values(o).forEach(walk);
  };
  Object.values(a).forEach(walk);
  const idList = [...ids];
  const [hw, mats, prs] = idList.length
    ? await Promise.all([
        db.select().from(hardware).where(inArray(hardware.id, idList)),
        db.select().from(materials).where(inArray(materials.id, idList)),
        db.select().from(prints).where(inArray(prints.id, idList)),
      ])
    : [[], [], []];
  const hwById = new Map(hw.map((h) => [h.id, h]));
  const matById = new Map(mats.map((m) => [m.id, m]));
  const printById = new Map(prs.map((x) => [x.id, x]));

  const dimStatus = ["dims.h", "dims.w", "dims.d"].every((k) => p.statuses[k] === "confirmed") ? "confirmed" : "est";
  const extra: { label: string; value: number }[] = [];
  const addExtra = (label: string, key: string) => {
    if (typeof a[key] === "number") extra.push({ label, value: a[key] as number });
  };
  addExtra("TOP HANDLE DROP", "hb.top_handle.drop");
  addExtra("FLAP HEIGHT", "hb.flap_height");
  addExtra("FLAP OVERHANG", "hb.flap_overhang");
  addExtra("STRAP TOTAL LENGTH", "hb.strap.length");
  addExtra("STRAP WIDTH", "hb.strap.width");
  addExtra("STRAP DROP", "hb.strap.drop");
  addExtra("HANDLE WIDTH", "hb.top_handle.width");

  const matList = (a["materials.list"] as MaterialEntry[] | undefined) ?? [];
  const matrix = (a["materials.matrix"] as MatrixValue | undefined) ?? {};
  const names = (a["colorways.names"] as Record<string, string> | undefined) ?? {};
  const cols = matrixColumns(ctx);

  const hardwareItems: {
    code: string;
    type: string;
    qty: number;
    dims_mm: string;
    finish: string;
    placement: string;
    new: boolean;
  }[] = [];
  const pushHw = (v: LibValue | undefined, qty: number, placement: string) => {
    if (!v) return;
    const h = hwById.get(v.id);
    hardwareItems.push({
      code: h?.code ?? v.label,
      type: h?.type ?? "",
      qty,
      dims_mm: h?.dimsMm ?? "",
      finish: h?.finish || (a["hardware.finish"] as string) || "",
      placement,
      new: h ? h.createdAt.getTime() > p.pack.createdAt.getTime() : false,
    });
  };
  for (const r of (a["hardware.items"] as { item?: LibValue; qty?: number; placement?: string }[] | undefined) ?? [])
    pushHw(r.item, r.qty ?? 1, r.placement ?? "");
  const listed = new Set(hardwareItems.map((h) => h.code));
  if (lib(a["hb.charm.code"]) && !listed.has(lib(a["hb.charm.code"])!.label)) pushHw(lib(a["hb.charm.code"]), 1, "KEYCHAIN / CHARM");
  if (lib(a["branding.logo_code"]) && !listed.has(lib(a["branding.logo_code"])!.label)) pushHw(lib(a["branding.logo_code"]), 1, "LOGO");
  if (lib(a["interior.label"]) && !listed.has(lib(a["interior.label"])!.label)) pushHw(lib(a["interior.label"]), 1, "INTERIOR LABEL");

  const logoSize = a["branding.logo_size"] as Dims2Value | undefined;
  const branding = isEmpty(a["branding.logo_type"])
    ? []
    : [
        {
          type: a["branding.logo_type"] as string,
          code: lib(a["branding.logo_code"])?.label ?? "",
          size_mm: logoSize && logoSize.w != null ? `${logoSize.w} X ${logoSize.h}` : "",
          placement: (a["branding.placement"] as string) ?? "",
          position_ref: [a["branding.offset"] != null ? `${a["branding.offset"]} MM` : "", (a["branding.offset_edge"] as string) ?? ""]
            .filter(Boolean)
            .join(" FROM "),
          finish: (a["branding.finish"] as string) ?? (a["hardware.finish"] as string) ?? "",
        },
      ];

  // Category block → construction (key: value with units).
  const construction: Record<string, unknown> = {};
  const catSections = sectionsFor(p.pack.category).filter((s) => !["header", "dims", "colorways", "materials", "branding", "edge", "hardware", "interior", "comments"].includes(s.id) && !s.optional);
  for (const s of catSections)
    for (const q of s.questions) {
      if (q.kind === "derived") {
        construction[q.id] = derivedValue(q, ctx);
        continue;
      }
      if (!isEmpty(a[q.id]) || a[q.id] === false) construction[q.id] = displayValue(a[q.id], q.kind === "stepper" || q.kind === "dims2" ? unitOf(q, unit) : "");
    }
  construction["edge.treatment"] = a["edge.treatment"] ?? null;
  construction["edge.paint_colour"] = a["edge.paint_colour"] ?? null;

  const liningPrint = printById.get(lib(a["interior.lining_print"])?.id ?? "");
  const interior = {
    lined: a["interior.lined"] ?? null,
    lining_material: (() => {
      const m = matById.get(lib(a["interior.lining_material"])?.id ?? "");
      return m ? materialLabel(m) : null;
    })(),
    lining_artwork: a["interior.lining_artwork_type"] ?? null,
    lining_print: liningPrint?.name ?? null,
    lining_pantone: a["interior.lining_pantone"] ?? null,
    pockets: ((a["interior.pockets"] as Record<string, unknown>[] | undefined) ?? []).map((r) => ({ ...r, unit })),
    pocket_edge: a["interior.pocket_edge"] ?? null,
    label: lib(a["interior.label"])
      ? {
          code: lib(a["interior.label"])!.label,
          type: hwById.get(lib(a["interior.label"])!.id)?.type ?? "",
          size: a["interior.label_size"] ?? null,
          offset_below_pocket_top: a["interior.label_offset"] ?? null,
          centered: a["interior.label_centered"] ?? null,
          unit,
        }
      : null,
    seam_binding: a["interior.seam_binding"] ?? null,
    compartments: a["interior.compartments"] ?? null,
  };

  const artworkPrints = new Map<string, (typeof prs)[number]>();
  if (liningPrint) artworkPrints.set(liningPrint.id, liningPrint);
  const artPrint = printById.get(lib(a["art.print"])?.id ?? "");
  if (artPrint) artworkPrints.set(artPrint.id, artPrint);
  for (const row of Object.values(matrix)) {
    const id = row?.lining?.lib?.id;
    if (id && printById.has(id)) artworkPrints.set(id, printById.get(id)!);
  }
  const artwork = [...artworkPrints.values()].map((x) => ({
    name: x.name,
    motif: x.motif,
    repeat: x.repeatType,
    tile: `${x.tileW} X ${x.tileH} ${x.tileUnit.toUpperCase()}`,
    colours: x.colours.map((c) => c.code),
    application: x.application,
    base_fabric: x.baseFabricId && matById.get(x.baseFabricId) ? materialLabel(matById.get(x.baseFabricId)!) : x.baseFabricText,
  }));

  const comments = ((a["comments.list"] as { text?: string }[] | undefined) ?? []).map((c, i) => ({
    letter: String.fromCharCode(65 + i),
    text: c.text ?? "",
    pages: [] as number[],
  }));
  const refs = p.files.filter((f) => f.kind === "reference" || f.kind === "construction").map((f) => ({ letter: f.tag, name: f.name, note: f.note }));

  const issues = completeness(ctx, p.statuses, p.pack.colorways);

  return {
    header: {
      brand: p.brand.name.toUpperCase(),
      style_no: p.pack.styleNo,
      style_name: p.pack.styleName,
      description: (a["header.description"] as string) ?? "",
      category: p.pack.category.toUpperCase(),
      sub_category: (a[SUB_CATEGORY_KEY[p.pack.category] ?? ""] as string) ?? "",
      retailer: (a["header.retailer"] as string) ?? "",
      season: (a["header.season"] as string) ?? "",
      attn: "FTY",
      sent_by: p.sentBy,
      original_date: "",
      revisions: [] as { r: string; date: string; by: string; changes: string[] }[],
      due_date: (a["header.due_date"] as string) ?? "",
      reference_sample: (a["header.reference_sample"] as string) ?? "",
      physical_sample_to_follow: a["header.physical_sample"] === true,
      proto_colorways: p.pack.colorways,
      licensor: a["header.licensor"]
        ? { licensor: a["header.licensor"], submission: a["header.licensor_submission"] ?? "", status: a["header.licensor_status"] ?? "" }
        : undefined,
    },
    dimensions: {
      unit,
      height: (a["dims.h"] as number) ?? 0,
      width: (a["dims.w"] as number) ?? 0,
      depth: (a["dims.d"] as number) ?? 0,
      extra,
      status: dimStatus,
    },
    materials: matList.map((m) => ({ callout: m.callout, name: m.name, locations: m.locations })),
    colorways: p.pack.colorways.map((code) => {
      const row = matrix[code] ?? {};
      const cells: Record<string, unknown> = {};
      for (const c of cols) {
        const cell = row[c.key];
        if (c.key.startsWith("mat_")) {
          const m = cell?.lib ? matById.get(cell.lib.id) : undefined;
          cells[c.key] = { library_id: cell?.lib?.id ?? "", text: m ? materialLabel(m) : cell?.text ?? cell?.lib?.label ?? "" };
        } else {
          cells[c.key] = cell?.lib?.label ?? cell?.text ?? "";
        }
      }
      return { code, name: names[code] ?? "", cells };
    }),
    hardware: hardwareItems,
    branding,
    construction,
    interior,
    artwork,
    comments,
    reference_photos: refs,
    product_features: [] as string[],
    optional_sections: Object.fromEntries(
      sectionsFor(p.pack.category)
        .filter((s) => s.optional)
        .map((s) => [s.id.replace("opt.", ""), a[`optional.${s.id}`] === true ? Object.fromEntries(s.questions.map((q) => [q.id, a[q.id] ?? null])) : null]),
    ),
    validation: issues.map((i) => ({ rule: `★ ${i.label}`, status: "fail" as const, fix: `${i.problem} — ${i.questionId}` })),
    answer_status: p.statuses,
    agent_notes: p.pack.aiAnalysis?.agent_notes ?? "",
  };
}

function unitOf(q: { kind: string; unit?: string } | undefined, packUnit: string) {
  if (!q || !("unit" in q)) return "";
  if (q.unit === "dim") return packUnit;
  if (q.unit === "qty") return "";
  return q.unit ?? "";
}

function displayValue(v: unknown, unit: string): unknown {
  if (typeof v === "number") return unit ? `${v} ${unit.toUpperCase()}` : v;
  if (v && typeof v === "object" && "w" in (v as object)) {
    const d = v as Dims2Value;
    return `${d.w} X ${d.h}${unit ? ` ${unit.toUpperCase()}` : ""}`;
  }
  if (v && typeof v === "object" && "label" in (v as object)) return (v as LibValue).label;
  return v;
}

export { findQuestion };
