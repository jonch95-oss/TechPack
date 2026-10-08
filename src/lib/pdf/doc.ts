import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { flats as flatsTable, hardware, materials, packs, prints, sampleComments, sampleRounds, users, type Hardware, type HardwareRecord, type Material, type FileMarks, type Print } from "@/db/schema";
import sharp from "sharp";
import { calloutsOn, inlineFlat } from "@/lib/lineart/geometry";
import { pantoneHex, repeatTileSvg, svgDataUri } from "./artwork";
import { normalizePage, PAGE_SECTIONS, type PageSection } from "@/lib/page-names";
import { changeLine, revisionState } from "@/lib/revisions";
import { materialLabel, type LoadedPack } from "@/lib/data";
import { readStoredFile } from "@/lib/storage";
import { intoCrop, readCroppedFile } from "@/lib/crop";
import { spellcheckParts } from "@/lib/spellcheck";
import { validatePack, type RuleResult } from "@/lib/validation";
import { bodyMaterials, contentLabel, findQuestion, isEmpty, matrixColumns, optionalToggleId, sectionsFor, evalCondition, type AnswerMap, type BomRow, type Dims2Value, type LibValue, type MaterialEntry, type MatrixValue, type PomRow } from "@/lib/questions";
import { logoPanelWidth, logoRows, planPages, trimsLayout, type Plan, type PlanInput } from "./plan";
import { mmText, specItems, type SpecItem } from "./specs";
import { printableCardRegion } from "@/lib/privacy";
import { accentFindings, chipFindings, colourNameFindings, finishFindings, flatDimFindings, hiddenTextFindings, seeNextPageFindings, setPieceFindings, textureFindings, type Finding } from "@/lib/checks";
import { PACKAGING_PAGES } from "@/lib/questions/common";
import { caseHalves, logoPointFor, reliefCallout, styleCodesOf, wallName } from "./hints";
import { refText, splitReferences } from "@/lib/reference-answer";

export type Img = { src: string; w: number; h: number } | null;

export type PackDoc = Awaited<ReturnType<typeof buildDocData>>;

/**
 * Everything the PDF prints, with its final page plan: the answers the other pages don't already
 * show go in the SPECIFICATIONS block on page 1, and onto SPECIFICATIONS pages when page 1 is full.
 */
export async function buildPackDoc(p: LoadedPack, opts: { images?: boolean; stage?: "PROTO" | "PRODUCTION" } = {}): Promise<PackDoc> {
  const { paginateSpecs } = await import("./html");
  return paginateSpecs(await buildDocData(p, opts));
}

/** Collects every user-written string in the answers (for spell-check). */
export function answersText(a: AnswerMap): string {
  return answerTexts(a).join("\n");
}

/** The same strings, one chunk per answer (incremental spell-check caches each). */
export function answerTexts(a: AnswerMap): string[] {
  return Object.entries(a)
    .filter(([k]) => !k.startsWith("optional."))
    .map(([, v]) => stringsOf(v).join("\n"));
}

function stringsOf(v0: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key = "") => {
    if (typeof v === "string") {
      if (key !== "id" && key !== "label") out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  walk(v0);
  return out;
}

/** Pages a comment can be printed on (the swatch, sample and change-log pages have no comment area). */
const COMMENT_PAGES = new Set<string>(PAGE_SECTIONS.filter((s) => !["SWATCH CARDS", "SAMPLE COMMENTS", "CHANGE LOG"].includes(s)));
/** Photos a page places in its own layout; more than that go to REFERENCE IMAGES (golden run 1, P0.2). */
const PHOTO_CAPACITY: Record<string, number> = {
  OVERVIEW: 2,
  MEASUREMENTS: 2,
  "REFERENCE IMAGES": Infinity,
  COLOURWAYS: 3,
  "TRIMS & HARDWARE": 4,
  "INTERIOR & LINING": 3,
  "LINING / PRINT ARTWORK": 1,
};
const DUFFELS = ["Duffels", "Rolling duffels"];

async function buildDocData(p: LoadedPack, opts: { images?: boolean; stage?: "PROTO" | "PRODUCTION" } = {}) {
  const withImages = opts.images !== false;
  // Templates read plain values; reference answers ("SAME AS …", "FOLLOW REFERENCE IMAGE") print as written.
  const { values: a, refs: refAnswers } = splitReferences(p.answers);
  // A packaging page that prints carries its own artwork note, so page 1 doesn't repeat it. Where two
  // reference answers share a question label ("ARTWORK"), each says what it belongs to.
  const pkgByArtwork = new Map(PACKAGING_PAGES.map((pg) => [`${pg.id}.artwork`, pg]));
  const sectionTitle = (qid: string) => sectionsFor(p.pack.category).find((s) => s.questions.some((q) => q.id === qid))?.title ?? "";
  const refNotesRaw = Object.entries(refAnswers)
    .filter(([qid]) => !(pkgByArtwork.has(qid) && a[optionalToggleId(pkgByArtwork.get(qid)!.id)] === true))
    .map(([qid, r]) => ({ questionId: qid, label: (findQuestion(p.pack.category, qid)?.label ?? qid).toUpperCase(), text: refText(r) }));
  const labelUses = refNotesRaw.reduce<Record<string, number>>((m, n) => ((m[n.label] = (m[n.label] ?? 0) + 1), m), {});
  const refNotes = refNotesRaw.map((n) => (labelUses[n.label] > 1 ? { ...n, label: `${(pkgByArtwork.get(n.questionId)?.title ?? sectionTitle(n.questionId)).toUpperCase()} ${n.label}`.trim() } : n));
  // Parts identified by a description (no library item yet, V2.1 §1.3) print as written, with the
  // other hardware rows, in the SPECIFICATIONS block.
  const ctx = { category: p.pack.category, answers: a, brand: p.brand };
  const unit = a["dims.unit"] === "INCHES" ? "in" : "cm";
  const U = unit === "in" ? '"' : " CM";
  // "Show secondary unit in brackets": every pack dimension also in the other unit — 16 CM (6.3"), 6.25" (15.88 CM).
  const D = (v: number) => `${trim(v)}${U}${a["dims.show_secondary"] === true ? ` (${unit === "in" ? `${trim(v * 2.54)} CM` : `${trim(v / 2.54)}"`})` : ""}`;
  const fmt = (v: unknown) => (typeof v === "number" ? D(v) : "");
  const componentOnly = p.pack.category === "Hardware";

  /* ---------- resolve library items ---------- */
  const ids = new Set<string>();
  const collect = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(collect);
    const o = v as Record<string, unknown>;
    if (typeof o.id === "string" && /^[0-9a-f-]{36}$/i.test(o.id)) ids.add(o.id);
    Object.values(o).forEach(collect);
  };
  Object.values(a).forEach(collect);
  const idList = [...ids];
  const [hws, mats, prs] = idList.length
    ? await Promise.all([
        db.select().from(hardware).where(inArray(hardware.id, idList)),
        db.select().from(materials).where(inArray(materials.id, idList)),
        db.select().from(prints).where(inArray(prints.id, idList)),
      ])
    : [[] as Hardware[], [] as Material[], [] as Print[]];
  const hwById = new Map(hws.map((h) => [h.id, h]));
  // Finish standards the parts' records point at (V2.1 §7), and the one a component sheet picks.
  const stdIds = [...new Set([...hws.map((h) => h.record?.finishStandardId), (a["hw.finish_standard"] as LibValue | undefined)?.id].filter((x): x is string => !!x && !hwById.has(x)))];
  if (stdIds.length) for (const h of await db.select().from(hardware).where(inArray(hardware.id, stdIds))) hwById.set(h.id, h);
  const matById = new Map(mats.map((m) => [m.id, m]));
  const printById = new Map(prs.map((x) => [x.id, x]));
  const lib = (v: unknown) => v as LibValue | undefined;

  /* ---------- images → data URIs (self-contained HTML for the PDF renderer) ---------- */
  const cache = new Map<string, Img>();
  const img = async (url?: string | null): Promise<Img> => {
    if (!url || !withImages) return null;
    if (cache.has(url)) return cache.get(url)!;
    try {
      const f = await readStoredFile(url);
      const meta = await sharp(f.data).metadata().catch(() => ({ width: 1, height: 1, orientation: 1 }));
      // The browser shows the photo EXIF-rotated: size it the same way, so its frame hugs it (golden run 1 #6).
      const turned = (meta.orientation ?? 1) >= 5;
      const v = { src: `data:${f.contentType};base64,${f.data.toString("base64")}`, w: (turned ? meta.height : meta.width) ?? 1, h: (turned ? meta.width : meta.height) ?? 1 };
      cache.set(url, v);
      return v;
    } catch {
      cache.set(url, null);
      return null;
    }
  };

  /** A render / board as it prints: cropped to the product. */
  const cropped = async (f?: { url: string; marks?: FileMarks | null } | null): Promise<Img> => {
    if (!f || !withImages) return null;
    if (!f.marks?.crop) return img(f.url);
    const key = `${f.url}#${JSON.stringify(f.marks.crop)}`;
    if (cache.has(key)) return cache.get(key)!;
    try {
      const c = await readCroppedFile(f);
      const meta = await sharp(c.data).metadata();
      const v = { src: `data:${c.contentType};base64,${c.data.toString("base64")}`, w: meta.width ?? 1, h: meta.height ?? 1 };
      cache.set(key, v);
      return v;
    } catch {
      return img(f.url);
    }
  };

  const render = p.files.find((f) => f.kind === "render");
  const cwRenders = p.pack.colorways.map((cw) => p.files.find((f) => f.kind === "colorway_render" && f.tag === cw)).filter(Boolean);
  const refs = p.files.filter((f) => f.kind === "reference" || f.kind === "construction");
  const comments0 = ((a["comments.list"] as { text?: string; pages?: string[] }[] | undefined) ?? []).map((c, i) => ({
    letter: String.fromCharCode(65 + i),
    text: c.text ?? "",
    pages: (c.pages ?? []).map(normalizePage),
  }));

  /* ---------- size: each category's own size fields (golden run 1, P0.1) ---------- */
  const n = (k: string) => (typeof a[k] === "number" ? (a[k] as number) : undefined);
  const duffel = DUFFELS.includes(p.pack.category) ? (p.pack.category === "Duffels" ? "duf" : "rduf") : null;
  // On the front view a duffel's length runs across and its width is the depth.
  const dims = duffel ? { h: n(`${duffel}.size_h`) ?? n("dims.h"), w: n(`${duffel}.size_l`) ?? n("dims.w"), d: n(`${duffel}.size_w`) ?? n("dims.d") } : { h: n("dims.h"), w: n("dims.w"), d: n("dims.d") };
  const dimNames = duffel ? { h: "HEIGHT", w: "LENGTH", d: "WIDTH" } : { h: "HEIGHT", w: "WIDTH", d: "DEPTH" };
  const sizeLines: string[] = [];
  const hwd = (["h", "w", "d"] as const).filter((k) => typeof dims[k] === "number");
  const overall = duffel
    ? (["w", "d", "h"] as const).filter((k) => typeof dims[k] === "number").map((k) => `${D(dims[k]!)} ${dimNames[k][0]}`).join(" X ")
    : hwd.map((k) => `${D(dims[k]!)} ${k.toUpperCase()}`).join(" X ");
  const lugSize = typeof a["lug.size"] === "string" ? String(a["lug.size"]) : typeof a["softlug.size"] === "string" ? String(a["softlug.size"]) : "";
  const setSizes = ((a["lug.set_sizes"] ?? a["softlug.set_sizes"]) as string[] | undefined) ?? [];
  if (lugSize) sizeLines.push([lugSize === "SET" && setSizes.length ? `SET: ${setSizes.join(" / ")}` : lugSize, overall].filter(Boolean).join(" — "));
  else if (overall) sizeLines.push(overall);
  // A set: one line per piece, said with its type (CUBE L, POUCH M …) — a flat piece has no H.
  for (const r of (a["cube.set"] as { piece?: string; size?: string; qty?: number; l?: number; w?: number; h?: number }[] | undefined) ?? []) {
    const parts = (["l", "w", "h"] as const).filter((k) => typeof r[k] === "number").map((k) => `${D(r[k]!)} ${k.toUpperCase()}`);
    const name = [r.piece, r.size].filter(Boolean).join(" ");
    if (name || parts.length) sizeLines.push(`${name ? `${name}: ` : ""}${parts.join(" X ")}${(r.qty ?? 1) > 1 ? ` × ${r.qty}` : ""}`.trim());
  }

  /* ---------- materials & swatch cards (one page per card, golden run 1 #13) ---------- */
  const matList = bodyMaterials(a["materials.list"] as MaterialEntry[] | undefined);
  const matrix = (a["materials.matrix"] as MatrixValue | undefined) ?? {};
  const cols = matrixColumns(ctx);
  const names = (a["colorways.names"] as Record<string, string> | undefined) ?? {};
  type Chip = { materialId: string; colorways: string[]; callout: number; materialName: string; colourName: string; article: string; articleNo: string; box: Material["chipBox"] };
  const cards: { url: string; material: Material; chips: Chip[] }[] = [];
  const swatchUse: { colorway: string; materialCallout: number; card: number }[] = [];
  for (const cw of p.pack.colorways)
    for (const m of matList) {
      const id = matrix[cw]?.[`mat_${m.callout}`]?.lib?.id;
      const mat = id ? matById.get(id) : undefined;
      if (!mat?.cardPhotoUrl) continue;
      let k = cards.findIndex((c) => c.url === mat.cardPhotoUrl);
      if (k < 0) k = cards.push({ url: mat.cardPhotoUrl, material: mat, chips: [] }) - 1;
      const chip = cards[k].chips.find((c) => c.materialId === mat.id && c.callout === m.callout);
      if (chip) chip.colorways.push(cw);
      else
        cards[k].chips.push({
          materialId: mat.id,
          colorways: [cw],
          callout: m.callout,
          materialName: m.name,
          colourName: mat.colourName,
          article: [mat.articleName, mat.colourNo && `/ ${mat.colourNo}`].filter(Boolean).join(" "),
          articleNo: mat.articleNo,
          box: mat.chipBox,
        });
      swatchUse.push({ colorway: cw, materialCallout: m.callout, card: k });
    }

  /* ---------- hardware detail panels (components with 100% views) ---------- */
  const usedHw = new Map<string, Hardware>();
  const addHw = (v: unknown) => {
    const h = lib(v) && hwById.get(lib(v)!.id);
    if (h) usedHw.set(h.id, h);
  };
  for (const r of (a["hardware.items"] as { item?: LibValue }[] | undefined) ?? []) addHw(r.item);
  ["branding.logo_code", "hb.charm.code", "interior.label", "cos.puller", "belt.buckle", "hb.feet.code"].forEach((k) => addHw(a[k]));
  let detail = [...usedHw.values()].filter((h) => h.views.front || h.views.side || h.views.rear || h.views.top);
  // A Hardware-category pack IS the component: its panel comes from the pack's own hw.* answers
  // (overall size, detail dimensions, material, finish, logo treatment, views), over the library item.
  if (componentOnly) {
    const base = hwById.get(lib(a["hw.component"])?.id ?? "");
    const size = [n("hw.overall_w"), n("hw.overall_h"), n("hw.overall_d")].filter((x): x is number => x != null);
    const wanted = new Set(((a["hw.views"] as string[] | undefined) ?? ["FRONT", "SIDE", "REAR", "TOP"]).map((v) => v.toLowerCase()));
    const views = Object.fromEntries(Object.entries(base?.views ?? {}).filter(([k]) => wanted.has(k)));
    const rows = ((a["hw.detail_dims"] as { label?: string; mm?: number }[] | undefined) ?? []).filter((r) => r.label);
    const extras = [a["hw.hollow"] === true && `HOLLOW${a["hw.hollow_where"] ? `: ${a["hw.hollow_where"]}` : ""}`, a["hw.edge"] && `${a["hw.edge"]} EDGE`, a["hw.etched_sides"] === true && "ETCHED SIDE PATTERN"].filter(Boolean);
    // The pack's answers over the library record (V2.1 §7).
    const rec = base?.record ?? {};
    const rows2 = <T,>(k: string) => ((a[k] as T[] | undefined) ?? []).filter(Boolean);
    const relief = rows2<{ treatment?: string; mm?: number; location?: string }>("hw.relief").filter((r) => r.treatment);
    const usage = rows2<{ style?: string; qty?: number; location?: string }>("hw.usage").filter((r) => r.style);
    const record: HardwareRecord = {
      colour: (a["hw.colour"] as string | undefined) ?? rec.colour,
      relief: relief.length ? relief.map((r) => ({ treatment: String(r.treatment), mm: typeof r.mm === "number" ? r.mm : null, location: String(r.location ?? "") })) : rec.relief,
      orientation: (a["hw.orientation"] as string | undefined) ?? rec.orientation,
      mounting: (a["hw.attachment"] as string | undefined) ?? rec.mounting,
      parent: lib(a["hw.parent"])?.label || rec.parent,
      usage: usage.length ? usage.map((r) => ({ style: String(r.style), qty: typeof r.qty === "number" ? r.qty : null, location: String(r.location ?? "") })) : rec.usage,
      finishStandardId: lib(a["hw.finish_standard"])?.id || rec.finishStandardId,
    };
    const own = {
      ...(base ?? ({ id: "pack", code: lib(a["hw.component"])?.label || p.pack.styleNo, name: p.pack.styleName, photoUrl: null, finishSpec: {}, approval: { status: "PENDING" }, construction: "", enamelPantone: "", notes: "" } as unknown as Hardware)),
      type: String(a["hw.type"] ?? base?.type ?? ""),
      dimsMm: size.length ? size.join(" X ") : (base?.dimsMm ?? ""),
      material: String(a["hw.material"] ?? base?.material ?? ""),
      finish: String(a["hw.finish"] ?? base?.finish ?? ""),
      logoTreatment: String(a["hw.logo_treatment"] ?? base?.logoTreatment ?? ""),
      enamelPantone: String(a["hw.enamel_colour"] ?? base?.enamelPantone ?? ""),
      notes: [base?.notes, ...extras].filter(Boolean).join(" · "),
      detailDims: rows.length ? rows.map((r) => ({ label: String(r.label), mm: typeof r.mm === "number" ? r.mm : null })) : (base?.detailDims ?? []),
      views,
      record,
    } as Hardware;
    detail = [own, ...detail.filter((h) => h.id !== own.id)];
  }
  const logoSize = a["branding.logo_size"] as Dims2Value | undefined;
  const logoHw = hwById.get(lib(a["branding.logo_code"])?.id ?? "");
  /*
   * Logo / embellishment artwork panels (V2.1 §6): every logo and embellishment with a size, whatever
   * its method, drawn at its stated size. Logos made as hardware (a metal plate, plaque, badge or
   * lettering) are components: they print as their part's panel instead.
   */
  const MADE_AS_HARDWARE = /METAL (LOGO )?PLATE|METAL PLAQUE|ENAMEL BADGE|ENGRAVED HARDWARE|METAL LETTERING/;
  type LogoItem = { method?: string; artwork?: LibValue; file?: string; w?: number; h?: number; colour?: string; placement?: string; position?: string; relief?: number; orientation?: string; border?: string; count?: number; motif?: string; only?: string };
  const logoType = String(a["branding.logo_type"] ?? "");
  const sized = (w?: number | null, h?: number | null) => typeof w === "number" || typeof h === "number";
  const logoPanelsRaw = [
    ...(logoType && !MADE_AS_HARDWARE.test(logoType) && sized(logoSize?.w, logoSize?.h)
      ? [{ primary: true, title: `LOGO ${logoType.replace(" PATCH", "")}${a["branding.fill"] ? ` WITH ${a["branding.fill"]}` : ""}`, w: logoSize?.w ?? null, h: logoSize?.h ?? null, artId: lib(a["branding.artwork_print"])?.id, photoUrl: logoHw?.photoUrl ?? null, notes: [] as string[] }]
      : []),
    ...((a["branding.items"] as LogoItem[] | undefined) ?? [])
      .filter((i) => i.method && !MADE_AS_HARDWARE.test(i.method) && sized(i.w, i.h))
      .map((i) => ({
        primary: false,
        title: `${i.method}${i.colour ? ` — ${i.colour}` : ""}`,
        w: typeof i.w === "number" ? i.w : null,
        h: typeof i.h === "number" ? i.h : null,
        artId: i.artwork?.id,
        photoUrl: null as string | null,
        notes: [
          [i.placement, i.position].filter(Boolean).join(", "),
          i.border,
          typeof i.relief === "number" && `RELIEF ${mmText(i.relief, unit === "in")}`,
          i.orientation,
          typeof i.count === "number" && `${i.count} PCS`,
          i.motif && `MOTIF: ${i.motif}`,
          i.file && `FILE: ${i.file}`,
          i.only?.trim() && `${i.only.trim().toUpperCase()} ONLY`,
        ].filter((x): x is string => !!x),
      })),
  ];
  const logoPanelsN = logoPanelsRaw.length;

  /* ---------- lining artwork ---------- */
  const liningPrintId = lib(a["interior.lining_print"])?.id ?? Object.values(matrix).map((r) => r?.lining?.lib?.id).find((id) => id && printById.has(id));
  const liningPrint = liningPrintId ? printById.get(liningPrintId) ?? null : null;
  const hasInterior = sectionsFor(p.pack.category).some((s) => s.id === "interior" && evalCondition(s.showIf, ctx)) && (a["interior.lined"] === true || !isEmpty(a["interior.pockets"]) || a["interior.seam_binding"] === true || !isEmpty(a["interior.features"]) || !isEmpty(a["interior.layout"]));
  const artworkOnInterior = a["pages.lining_artwork"] === "ON INTERIOR PAGE";

  /* ---------- extra measurements (measurement sheet) ---------- */
  const measures: { label: string; value: string; key: string }[] = [];
  const m = (label: string, key: string) => typeof a[key] === "number" && measures.push({ label, value: fmt(a[key]), key });
  m("TOP HANDLE DROP HEIGHT", "hb.top_handle.drop");
  m("FLAP HEIGHT", "hb.flap_height");
  m("FLAP OVERHANG", "hb.flap_overhang");
  m("HANDLE WIDTH", "hb.top_handle.width");
  m("STRAP TOTAL LENGTH", "hb.strap.length");
  m("STRAP DROP", "hb.strap.drop");
  m("STRAP WIDTH", "hb.strap.width");
  for (const pfx of ["duf", "rduf"]) {
    m("HANDLE LENGTH", `${pfx}.handle_length`);
    m("HANDLE DROP", `${pfx}.handle_drop`);
    m("STRAP TOTAL LENGTH", `${pfx}.strap.length`);
  }
  if (typeof a["branding.offset"] === "number") measures.push({ key: "branding.offset", label: `LOGO ${a["branding.offset_edge"] ? `ABOVE ${a["branding.offset_edge"]}` : "OFFSET"}`, value: D(Number(a["branding.offset"]) / (unit === "in" ? 25.4 : 10)) });

  /* ---------- points of measure, placements, zippers, construction, BOM ---------- */
  const pom = ((a["pom.list"] as PomRow[] | undefined) ?? []).filter((r) => r.point);
  const placements = ((a["placements.list"] as { item?: LibValue; qty?: number; from?: string; distance?: number; spacing?: number; note?: string }[] | undefined) ?? []).map((r) => {
    const h = r.item ? hwById.get(r.item.id) : undefined;
    return { code: h?.code ?? r.item?.label ?? "", type: h?.type ?? "", qty: r.qty, from: r.from ?? "", distance: r.distance, spacing: r.spacing, note: r.note ?? "" };
  });
  const zipRows = (a["zippers.list"] as Record<string, unknown>[] | undefined) ?? [];
  const zippers = zipRows
    .map((z) => ({
      position: String(z.position ?? ""),
      size: String(z.size ?? ""),
      type: String(z.type ?? ""),
      length: typeof z.length === "number" ? D(z.length) : "",
      ends: String(z.ends ?? ""),
      slider: String(z.slider ?? ""),
      puller: (z.puller as LibValue | undefined)?.label ?? "",
      attachment: String(z.attachment ?? ""),
      tape: String(z.tape ?? ""),
      teeth: String(z.teeth ?? ""),
    }))
    // A row that carries nothing but its position says nothing to the factory (golden run 1 #16).
    .filter((z) => [z.size, z.type, z.length, z.ends, z.slider, z.puller, z.attachment, z.tape, z.teeth].some(Boolean));
  const construction = ((a["construction.list"] as Record<string, unknown>[] | undefined) ?? []).map((c) => ({
    area: String(c.area ?? ""),
    edge: String(c.edge ?? ""),
    stitch: String(c.stitch ?? ""),
    spi: typeof c.spi === "number" ? String(c.spi) : "",
    thread: String(c.thread ?? ""),
    allowance: typeof c.allowance === "number" ? mmText(c.allowance, unit === "in") : "",
  }));
  const bom = ((a["bom.list"] as BomRow[] | undefined) ?? []).filter((r) => r.component || r.description);
  const labels = contentLabel(a, p.pack.colorways, (id) => matById.get(id)?.composition || undefined);

  /* ---------- latest sample round ---------- */
  const [round] = await db.select().from(sampleRounds).where(eq(sampleRounds.packId, p.pack.id)).orderBy(desc(sampleRounds.createdAt)).limit(1);
  const roundComments = round ? await db.select().from(sampleComments).where(eq(sampleComments.roundId, round.id)).orderBy(asc(sampleComments.letter)) : [];

  /* ---------- line art (Phase 3) ---------- */
  const flatRows = await db.select().from(flatsTable).where(eq(flatsTable.packId, p.pack.id));
  const flatOf = (v: string) => flatRows.find((f) => f.view === v);
  const flat = (v: string) => {
    const f = flatOf(v);
    return f ? { svg: f.svg, inferred: f.status === "INFERRED", status: f.status } : null;
  };
  // COLOUR INDICATIVE: colourways without their own render get the front flat filled with the
  // colour of their main material (sampled from the swatch card's chip). The first colourway uses the
  // pack render when it has no colourway render of its own.
  const indicative: { colorway: string; fill: string }[] = [];
  if (flatOf("FRONT") && withImages && matList.length) {
    for (const [k, cw] of p.pack.colorways.entries()) {
      if (cwRenders.some((f) => f!.tag === cw) || (k === 0 && render)) continue;
      const id = matrix[cw]?.[`mat_${matList[0].callout}`]?.lib?.id;
      const mat = id ? matById.get(id) : undefined;
      const fill = mat ? await chipColour(mat) : null;
      if (fill) indicative.push({ colorway: cw, fill });
    }
  }

  /* ---------- revisions (Phase 4) ---------- */
  const rev = await revisionState(p);
  const issued = rev.list.filter((r) => r.number > 0);
  const changeLog = [
    ...issued.map((r) => ({ label: r.label, date: r.date, by: r.by, lines: r.changes.map(changeLine), sent: true })),
    ...(rev.latest && rev.pending.length ? [{ label: rev.flagLabel, date: "", by: "", lines: rev.pending.map(changeLine), sent: false }] : []),
  ];

  /* ---------- where comments and photos print (golden run 1, P0.2) ---------- */
  // A page a comment or photo is assigned to prints. One that can't (no lining artwork to show, the
  // swatch / sample / change-log pages) hands it on: comments to page 1, photos to REFERENCE IMAGES.
  const hostPage = componentOnly ? "TRIMS & HARDWARE" : "OVERVIEW";
  const usable = (s: string): string | null => {
    if (componentOnly) return "TRIMS & HARDWARE";
    if (s === "LINING / PRINT ARTWORK") return liningPrint ? (artworkOnInterior ? "INTERIOR & LINING" : s) : null;
    return COMMENT_PAGES.has(s) ? s : null;
  };
  const comments = comments0.map((c) => {
    const pages = [...new Set(c.pages.map(usable).filter((x): x is string => !!x))];
    return { ...c, pages: pages.length ? pages : [hostPage] };
  });
  const placed = new Map<string, number>();
  const photoPages = refs.map((r) => {
    let page = usable(placeOf(r, comments)) ?? "REFERENCE IMAGES";
    const role = r.marks?.role ?? null;
    // MEASUREMENTS holds one detail photo and one side view.
    const slot = page === "MEASUREMENTS" ? `${page}|${role === "SIDE_VIEW" ? "SIDE" : "DETAIL"}` : page;
    const cap = componentOnly ? Infinity : page === "MEASUREMENTS" ? 1 : (PHOTO_CAPACITY[page] ?? 0);
    if ((placed.get(slot) ?? 0) >= cap) page = "REFERENCE IMAGES";
    else placed.set(slot, (placed.get(slot) ?? 0) + 1);
    return page;
  });
  const forced = [...new Set([...comments.flatMap((c) => c.pages), ...photoPages])].filter((s) => s !== "OVERVIEW") as PageSection[];

  /* ---------- trims & hardware pages: panels that don't fit continue on the next page ---------- */
  const trimsPhotoCount = photoPages.filter((x) => x === "TRIMS & HARDWARE").length;
  const logoRowList = logoRows(logoPanelsRaw.map(logoPanelWidth));
  const trims = trimsLayout(detail.length, logoRowList.map((r) => r.reduce((t, i) => t + logoPanelWidth(logoPanelsRaw[i]) + 0.3, -0.3)), trimsPhotoCount > 0);

  // A feature one colourway has and the others don't prints "<STYLE #> ONLY" (V2.1 §4).
  const styleOf = (cw: string) => p.pack.colorwayStyles?.[cw] ?? (p.pack.colorways.length > 1 && cw.startsWith("-") ? `${p.pack.styleNo}${cw}` : cw);
  const onlyOn = (only: string) => {
    const t = only.trim().toUpperCase();
    return p.pack.colorways.includes(t) ? styleOf(t) : t;
  };
  const features =
    a["pages.product_features"] === false
      ? []
      : ((a["pages.features"] as { text?: string; only?: string }[] | undefined) ?? []).filter((f) => f.text).map((f) => `${f.text}${f.only?.trim() ? ` — ${onlyOn(f.only)} ONLY` : ""}`);
  /* ---------- packaging / label pages (V2.1 §8): only the ones switched on ---------- */
  const pkgSpecs = specItems(p.pack.category, p.answers, {});
  const packaging = await Promise.all(
    PACKAGING_PAGES.filter((pg) => a[optionalToggleId(pg.id)] === true).map(async (pg) => {
      const art = a[`${pg.id}.artwork`] as { url?: string; name?: string } | undefined;
      const artRef = refAnswers[`${pg.id}.artwork`];
      return {
        id: pg.id,
        title: pg.title,
        size: a[`${pg.id}.size`] as Dims2Value | undefined,
        items: pkgSpecs.filter((x) => x.qid.startsWith(`${pg.id}.`) && !x.qid.endsWith(".size")),
        artwork: art?.url ? await img(art.url) : null,
        artworkNote: artRef ? refText(artRef) : art?.url ? "" : "ARTWORK TO BE PROVIDED",
      };
    }),
  );
  const planInput: PlanInput = {
    hasInterior,
    hasColourways: p.pack.colorways.length > 0 && (cols.length > 0 || matList.length > 0),
    hasExtraMeasurements: measures.length > 0 || pom.length > 0 || placements.length > 0 || !!flatOf("FRONT"),
    colorwayRenderCount: cwRenders.length + indicative.length,
    referencePhotoCount: photoPages.filter((x) => x === "REFERENCE IMAGES").length,
    hasLiningArtwork: !!liningPrint,
    liningArtworkOnInterior: artworkOnInterior,
    detailPanelCount: detail.length + logoPanelsN,
    swatches: cards.map((c) => ({ colorway: c.chips[0].colorways[0], materialCallout: c.chips[0].callout })),
    swatchUse,
    swatchesOnOnePage: a["pages.swatches"] === "ALL ON ONE PAGE",
    revisionCount: changeLog.length,
    hasConstruction: construction.length > 0,
    hasBom: bom.length > 0 || zipRows.length > 0 || ((a["materials.quality_refs"] as unknown[] | undefined) ?? []).length > 0,
    hasSampleComments: roundComments.length > 0,
    forced,
    trimsPages: trims.length,
    componentOnly,
    packaging: packaging.map((x) => x.title),
  };
  const plan: Plan = planPages(planInput);

  /* ---------- validation ---------- */
  // "Same as <style # / code>" resolves when that pack or library item exists in the studio.
  const knownCodes = Object.keys(refAnswers).length
    ? new Set([...(await db.select({ c: packs.styleNo }).from(packs)).map((r) => r.c), ...(await db.select({ c: hardware.code }).from(hardware)).map((r) => r.c)].map((c) => c.toUpperCase()))
    : new Set<string>();
  const team = (await db.select({ name: users.name }).from(users)).flatMap((u) => u.name.split(/\s+/));
  // Spell-check everything the pack prints: the answers, and the text it takes from the library and
  // from its files (part records, card descriptions, photo captions) (V2.1 §11).
  const libraryTexts = [
    ...[...usedHw.values()].flatMap((h) => stringsOf({ name: h.name, notes: h.notes, finish: h.finish, logo: h.logoTreatment, record: h.record })),
    ...[...matById.values()].flatMap((m) => [m.articleName, m.colourName, m.finish, m.composition, m.backing].filter(Boolean)),
    ...p.files.map((f) => f.note).filter(Boolean),
  ];
  const spelling = spellcheckParts([...answerTexts(a), ...libraryTexts], [...team, p.brand.name, p.pack.styleName, ...p.brand.name.split(/\s+/)]);
  // Consistency checks from errors found in real packs (V2.1 §11).
  const lastPageOf = (pages: string[]) => Math.max(0, ...plan.pages.filter((x) => pages.includes(x.section)).map((x) => x.n)) || null;
  const trimList = ((a["materials.trims"] as { name?: string }[] | undefined) ?? []).map((t, i) => ({ name: t?.name ?? "", key: `trim_${i + 1}` })).filter((t) => t.name);
  const findings: Finding[] = [
    ...flatRows.flatMap((f) => [...flatDimFindings(f.view, f.svg, { w: n("dims.w"), h: n("dims.h"), d: n("dims.d") }), ...hiddenTextFindings(f.view, f.svg)]),
    ...seeNextPageFindings(comments.map((c) => ({ letter: c.letter, text: c.text, lastPage: lastPageOf(c.pages) })), plan.pages.length),
    ...colourNameFindings(answerTexts(a)),
    ...chipFindings(
      p.pack.colorways.flatMap((cw) =>
        matList.map((m) => {
          const cell = matrix[cw]?.[`mat_${m.callout}`];
          return { colorway: cw, column: `MATERIAL ${m.callout}`, text: cell?.text ?? "", cardShade: (cell?.lib && matById.get(cell.lib.id)?.colourNo) || null };
        }),
      ),
    ),
    ...setPieceFindings(a["cube.set"] as { piece?: string; size?: string; l?: number; w?: number }[] | undefined),
    ...finishFindings(String(a["hardware.finish"] ?? ""), [...usedHw.values()].map((h) => ({ code: h.code, finish: h.finish }))),
    ...textureFindings(
      matList.map((m) => {
        const id = p.pack.colorways.map((cw) => matrix[cw]?.[`mat_${m.callout}`]?.lib?.id).find((x) => x && matById.has(x));
        const card = id ? matById.get(id) : undefined;
        return { callout: m.callout, name: m.name ?? "", card: card ? [card.articleName, card.finish].join(" ") : "" };
      }),
    ),
    ...accentFindings(trimList.map((t) => ({ name: t.name, values: Object.fromEntries(p.pack.colorways.map((cw) => [cw, String(matrix[cw]?.[t.key]?.text ?? "")])) }))),
  ];
  const validation: RuleResult[] = validatePack({
    category: p.pack.category,
    brand: p.brand,
    answers: p.answers,
    statuses: p.statuses,
    colorways: p.pack.colorways,
    chineseOn: p.pack.chineseOn,
    stage: opts.stage ?? p.pack.stage,
    resolves: (code) => knownCodes.has(code.trim().toUpperCase()),
    hardware: [...hwById.values()].map((h) => ({ id: h.id, code: h.code, type: h.type, dimsMm: h.dimsMm, finish: h.finish, approval: h.approval?.status })),
    materials: [...matById.values()].map((m) => ({ id: m.id, label: materialLabel(m), approval: m.approval?.status ?? "PENDING", composition: m.composition })),
    flats: flatRows.map((f) => ({ view: f.view, status: f.status, materialCallouts: [...calloutsOn(f.svg).materials] })),
    logoMarked: !!render?.marks?.dot || !render || !a["branding.logo_type"] || !!logoPointFor(String(a["branding.placement"] ?? "")),
    photos: refs.map((r) => ({ letter: r.tag, note: r.note, actualWidthMm: r.marks?.actualWidthMm ?? null })),
    spelling,
    findings,
  });

  /* ---------- matrix rows (cross-references resolve against the final plan, in html) ---------- */
  const rows = p.pack.colorways.map((cw) => ({
    code: cw,
    name: names[cw] ?? "",
    cells: cols.map((c) => {
      const cell = matrix[cw]?.[c.key];
      const mat = cell?.lib ? matById.get(cell.lib.id) : undefined;
      const pr = cell?.lib ? printById.get(cell.lib.id) : undefined;
      let text = cell?.text ?? "";
      if (mat) text = materialLabel(mat);
      if (pr) text = `${pr.application || "PRINT"} ${pr.name.includes("CUSTOM") ? "" : "CUSTOM ARTWORK"}`.trim();
      // The colour the material comes in: its print artwork (by name) or the Pantone typed for a solid.
      const colourPrint = cell?.colour?.lib ? printById.get(cell.colour.lib.id) : undefined;
      const colour = colourPrint ? colourPrint.name : (cell?.colour?.text ?? cell?.colour?.lib?.label ?? "");
      return { key: c.key, text, colour, colourIsPrint: !!colourPrint, callout: c.callout ?? null, refKind: (mat && c.callout ? "swatch" : pr ? "artwork" : null) as "swatch" | "artwork" | null };
    }),
  }));
  const placementRef = refAnswers["branding.placement"] ? refText(refAnswers["branding.placement"]) : "";
  const strapNote = a["hb.strap"] === true ? `SHOULDER STRAP ${a["hb.strap.removable"] === "FIXED" ? "IS NOT REMOVABLE" : "IS REMOVABLE"}${(a["hb.strap.attachment"] as string[] | undefined)?.length ? ` — ATTACHED WITH ${(a["hb.strap.attachment"] as string[]).join(" + ")}` : ""}` : "";
  const gussetNote = a["hb.gusset"] ? `SIDE HAS ${String(a["hb.gusset"]).replace("STANDARD (NO PLEATS)", "STANDARD GUSSET, NO EXTRA PLEATS")}` : "";
  const closure = closureText(a);
  // Hardware rows: where each library part goes, printed on its panel.
  const hwUse = new Map<string, string[]>();
  for (const r of (a["hardware.items"] as { item?: LibValue; qty?: number; placement?: string }[] | undefined) ?? [])
    if (r.item?.id) hwUse.set(r.item.id, [...(hwUse.get(r.item.id) ?? []), [(r.qty ?? 1) > 1 ? `${r.qty} ×` : "", r.placement].filter(Boolean).join(" ")].filter(Boolean));
  // Answers a template prints in its own words: the words it prints (checked against the PDF text like any value).
  const printedAs: Record<string, string[]> = {
    "dims.unit": [U.trim()],
    ...(a["header.physical_sample"] === true ? { "header.physical_sample": ["YOU WILL RECEIVE A PHYSICAL SAMPLE"] } : {}),
    ...(closure ? { "hb.closure": [closure.split(" — ")[0]] } : {}),
    ...(strapNote ? { "hb.strap": [strapNote], "hb.strap.removable": [strapNote], "hb.strap.attachment": [strapNote] } : {}),
    ...(gussetNote ? { "hb.gusset": [gussetNote] } : {}),
    ...(lib(a["hb.charm.code"]) ? { "hb.charm": [`${lib(a["hb.charm.code"])!.label} INCLUDED`] } : {}),
    ...(String(a["branding.placement"] ?? "").includes("CENTER") ? { "branding.placement": ["(CENTERED)"] } : {}),
    ...(a["interior.label_centered"] === true ? { "interior.label_centered": ["(CENTERED)"] } : {}),
    ...(a["interior.seam_binding"] === true ? { "interior.seam_binding": ["ADD INTERIOR BINDING"] } : {}),
    ...(liningPrint ? { "interior.lining_print": [liningPrint.name], "interior.lining_artwork_type": [liningPrint.name] } : {}),
  };
  const logoBack = /BACK/.test(String(a["branding.placement"] ?? "").toUpperCase());

  return {
    refNotes,
    /** Every style # in the pack: one per colourway in a multi-style pack (V2.1 §4). */
    styleCodes: styleCodesOf(p.pack),
    colorwayStyles: p.pack.colorwayStyles ?? {},
    pack: p.pack,
    brand: { name: p.brand.name, logo: await img(p.brand.logoUrl) },
    unit,
    U,
    /** A dimension as printed: the pack's unit, plus the other in brackets when the pack asks for it. */
    dim: D,
    header: {
      description: (a["header.description"] as string) ?? "",
      retailer: (a["header.retailer"] as string) ?? "",
      season: (a["header.season"] as string) ?? "",
      referenceSample: (a["header.reference_sample"] as string) ?? "",
      sentBy: p.sentBy,
      dueDate: (a["header.due_date"] as string) ?? "",
      category: String(a["hb.silhouette"] ?? a["slg.type"] ?? a["men.type"] ?? a["cos.shape"] ?? a["cool.type"] ?? p.pack.category).toUpperCase(),
      physicalSample: a["header.physical_sample"] === true,
      instruction: (a["header.instruction"] as string) ?? "",
      sizeFamily: (a["header.size_family"] as string) ?? "",
      sampleSize: (a["header.sample_size"] as string) ?? "",
      // Empty parts print nothing — no stray separators (golden run 1, P0.5).
      licensor: a["header.licensor"] ? [a["header.licensor"], a["header.licensor_submission"], a["header.licensor_status"]].filter((x) => typeof x === "string" && x.trim()).join(" · ") : "",
    },
    dims,
    dimNames,
    /** Overall size, one line per piece for sets (V2.1 §5: a flat bag has no depth). */
    sizeLines: sizeLines.map((l) => l.replace(/ CM/g, " cm")),
    render: await cropped(render),
    colorwayRenders: await Promise.all(cwRenders.map(async (f) => ({ colorway: f!.tag, img: await cropped(f) }))),
    references: await Promise.all(
      refs.map(async (r, k) => {
        const page = photoPages[k];
        const im = await img(r.url);
        // Real width given: the photo prints at actual size (inches on paper).
        const actualIn = im && r.marks?.actualWidthMm ? { w: r.marks.actualWidthMm / 25.4, h: (r.marks.actualWidthMm / 25.4) * (im.h / im.w) } : null;
        return { letter: r.tag, note: r.note, img: im, page, zoom: r.marks?.zoom ?? null, dot: r.marks?.dot ?? null, role: r.marks?.role ?? null, onMeasurements: page === "MEASUREMENTS" && r.marks?.role !== "SIDE_VIEW", actualIn };
      }),
    ),
    /** Where the LOGO label's leader line points on the render (marked, or from the placement); null = unsure. */
    logoPoint: render?.marks?.dot ? intoCrop(render.marks.dot, render.marks.crop) : logoPointFor(String(a["branding.placement"] ?? "")),
    comments,
    // Callout positions placed on the render (stored in whole-image fractions) → the cropped product.
    materials: matList.map((m) => {
      const pt = render?.marks?.callouts?.[String(m.callout)];
      return { ...m, pos: pt ? intoCrop(pt, render?.marks?.crop) : null };
    }),
    matrixColumns: cols,
    rows,
    hardwareFinish: (a["hardware.finish"] as string) ?? "",
    printFiles: (a["colorways.print_file"] as Record<string, string> | undefined) ?? {},
    pantones: (a["colorways.pantone"] as Record<string, string> | undefined) ?? {},
    charm: lib(a["hb.charm.code"]) ? { code: lib(a["hb.charm.code"])!.label, photo: await img(hwById.get(lib(a["hb.charm.code"])!.id)?.photoUrl) } : null,
    logo: {
      type: (a["branding.logo_type"] as string) ?? "",
      code: lib(a["branding.logo_code"])?.label ?? "",
      placement: (a["branding.placement"] as string) ?? "",
      placementRef,
      onBack: logoBack,
      panels: await Promise.all(logoPanelsRaw.map(async (lp) => ({ ...lp, art: lp.artId && printById.get(lp.artId) ? await img(printById.get(lp.artId)!.motifUrl) : null, photo: await img(lp.photoUrl) }))),
      rows: logoRowList,
      fill: (a["branding.fill"] as string) ?? "",
    },
    measures,
    closure,
    gussetNote,
    strapNote,
    features,
    interior: {
      label: lib(a["interior.label"]) ? { code: lib(a["interior.label"])!.label, name: hwById.get(lib(a["interior.label"])!.id)?.name ?? "", type: hwById.get(lib(a["interior.label"])!.id)?.type ?? "", photo: await img(hwById.get(lib(a["interior.label"])!.id)?.photoUrl) } : null,
      labelSize: a["interior.label_size"] as Dims2Value | undefined,
      labelOffset: a["interior.label_offset"] as number | undefined,
      labelCentered: a["interior.label_centered"] === true,
      pockets: ((a["interior.pockets"] as { type?: string; wall?: string; w?: number; h?: number; top_offset?: number; centered?: boolean; zip_size?: string; qty?: number; construction?: string; note?: string }[] | undefined) ?? []).map((pk) => ({ ...pk, wall: wallName(pk.wall) })),
      pocketEdge: (a["interior.pocket_edge"] as string) ?? "",
      seamBinding: a["interior.seam_binding"] === true,
      /** "PP BINDING ON INTERIOR SEAMS, NEATLY SEWN" (V2.1 §9). */
      binding: a["interior.seam_binding"] === true && a["interior.binding"] ? [a["interior.binding"], a["interior.binding_where"] && `ON ${a["interior.binding_where"]}`].filter(Boolean).join(" ") : "",
      features: ((a["interior.features"] as string[] | undefined) ?? []).filter(Boolean),
      labelPosition: (a["interior.label_position"] as string | undefined) ?? "",
      lined: a["interior.lined"] === true,
      liningName: liningPrint?.name ?? lib(a["interior.lining_material"])?.label ?? "",
      /** A hardside case's interior by half (V2.1 §9): features without a half print under INTERIOR. */
      halves: caseHalves((a["interior.layout"] as { half?: string; feature?: string; qty?: number; note?: string }[] | undefined) ?? []),
      padding: a["cos.padding"] === true ? [typeof a["cos.padding_mm"] === "number" && mmText(a["cos.padding_mm"] as number, unit === "in"), "PADDING", a["cos.padding_where"]].filter(Boolean).join(" ") : "",
    },
    /** The wall the interior page is about (the first pocket's, else the back wall). */
    interiorWall: (((a["interior.pockets"] as { wall?: string }[] | undefined) ?? []).map((x) => wallName(x.wall)).find((w) => w === "BACK WALL") ?? wallName(((a["interior.pockets"] as { wall?: string }[] | undefined) ?? [])[0]?.wall) ?? "BACK WALL") as string,
    lining: liningPrint
      ? {
          name: liningPrint.name,
          motif: liningPrint.motif,
          application: liningPrint.application,
          repeat: liningPrint.repeatType,
          tileW: liningPrint.tileW,
          tileH: liningPrint.tileH,
          tileUnit: liningPrint.tileUnit,
          colours: liningPrint.colours.map((c) => c.code),
          baseFabric: liningPrint.baseFabricId && matById.get(liningPrint.baseFabricId) ? materialLabel(matById.get(liningPrint.baseFabricId)!) : liningPrint.baseFabricText,
          img: await img(liningPrint.motifUrl),
          // No artwork file: build the repeat from the motif text, colour and tile size.
          generated: liningPrint.motifUrl
            ? null
            : (() => {
                const t = repeatTileSvg({ motif: liningPrint.motif || liningPrint.name, brand: p.brand.name, colour: liningPrint.colours[0]?.code ?? "", tileW: Number(liningPrint.tileW) || 1, tileH: Number(liningPrint.tileH) || 1, repeat: liningPrint.repeatType });
                return { src: svgDataUri(t.svg), w: t.w, h: t.h };
              })(),
          colourHex: liningPrint.colours.map((c) => pantoneHex(c.code)),
        }
      : null,
    detail: await Promise.all(
      detail.map(async (h) => ({
        code: h.code,
        type: h.type,
        name: h.name,
        dimsMm: h.dimsMm,
        material: h.material,
        finish: h.finish,
        logoTreatment: h.logoTreatment,
        enamel: h.enamelPantone,
        construction: h.construction,
        notes: h.notes,
        /** Where the pack uses this part ("2 × UNDER FLAP, SPACED EVENLY"). */
        use: hwUse.get(h.id) ?? [],
        detailDims: h.detailDims ?? [],
        finishSpec: h.finishSpec ?? {},
        approval: h.approval?.status ?? "PENDING",
        views: {
          front: await cropped(h.views.front ? { url: h.views.front, marks: { crop: h.viewCrops?.front ?? null } } : null),
          side: await cropped(h.views.side ? { url: h.views.side, marks: { crop: h.viewCrops?.side ?? null } } : null),
          rear: await cropped(h.views.rear ? { url: h.views.rear, marks: { crop: h.viewCrops?.rear ?? null } } : null),
          top: await cropped(h.views.top ? { url: h.views.top, marks: { crop: h.viewCrops?.top ?? null } } : null),
        },
        photo: await img(h.photoUrl),
        ...(await componentRecord(h.record ?? {}, hwById, img)),
      })),
    ),
    trims,
    swatches: await Promise.all(
      cards.map(async (c) => {
        // Supplier headers (bank, phone, address) sit above the chips: the card prints from just above
        // its chips down (V2.1 §10), the chip boxes moved into the cropped image.
        const region = printableCardRegion(c.chips.map((x) => x.box));
        const m = c.material;
        return {
          supplier: m.supplier,
          articleNo: m.articleNo,
          iconCode: m.iconCode,
          spec: [m.threadCount, m.backing, m.width && `WIDTH ${m.width}`, m.thickness && `THICKNESS ${m.thickness}`, m.peelStrength && `PEEL ${m.peelStrength}`, m.rubFastness && `RUB FASTNESS ${m.rubFastness}`].filter(Boolean).join(" · "),
          photo: await cropped({ url: c.url, marks: { crop: region } as FileMarks }),
          chips: c.chips.map((x) => (x.box ? { ...x, box: { x: x.box.x, y: (x.box.y - region.y) / region.h, w: x.box.w, h: x.box.h / region.h } } : x)),
        };
      }),
    ),
    pom,
    placements,
    zippers,
    /** Zips stated by position only: listed under the zipper table instead of as empty rows. */
    zipPositions: zipRows.filter((z) => z.position && !zippers.some((x) => x.position === String(z.position))).map((z) => String(z.position)),
    construction,
    threadColour: (a["construction.thread_colour"] as string) ?? "",
    edgeTreatment: (a["edge.treatment"] as string) ?? "",
    materialLayout: matList.filter((m) => m.direction || m.matching).map((m) => ({ callout: m.callout, name: m.name, direction: m.direction ?? "", matching: m.matching ?? "" })),
    bom,
    contentLabels: labels,
    /** Cards linked for their quality only (V2.1 §10): never a colour. */
    qualityRefs: ((a["materials.quality_refs"] as { use?: string; material?: LibValue; note?: string }[] | undefined) ?? [])
      .filter((r) => r?.use || r?.material)
      .map((r) => {
        const m = r.material?.id ? matById.get(r.material.id) : undefined;
        return { use: r.use ?? "", card: m ? materialLabel({ ...m, qualityOnly: true }) : (r.material?.label ?? ""), note: r.note ?? "" };
      }),
    tooling: {
      artwork: (a["branding.artwork"] as { name?: string } | undefined)?.name ?? "",
      depth: typeof a["branding.tool_depth"] === "number" ? mmText(a["branding.tool_depth"] as number, unit === "in") : "",
      newTooling: a["branding.new_tooling"] === true,
    },
    baseBoard: a["interior.base_board"] === true ? [a["interior.base_board_material"], typeof a["interior.base_board_mm"] === "number" && mmText(a["interior.base_board_mm"] as number, unit === "in")].filter(Boolean).join(" ") || "BASE BOARD" : "",
    sampleRound: round
      ? {
          stage: round.stage,
          number: round.number,
          receivedAt: round.receivedAt,
          verdict: round.verdict,
          comments: await Promise.all(roundComments.map(async (c) => ({ letter: c.letter, text: c.text, status: c.status, markup: c.markup, carried: !!c.carriedFrom, img: await img(c.photoUrl) }))),
        }
      : null,
    revision: {
      original: rev.list[0]?.date ?? "",
      dates: rev.list.filter((r) => r.number > 0).map((r) => ({ label: r.label, date: r.date })),
      flags: rev.flags,
      flagLabel: rev.flagLabel,
      log: changeLog,
    },
    flats: {
      front: flat("FRONT"),
      back: flat("BACK"),
      side: flat("SIDE"),
      top: flat("TOP"),
      indicative: indicative.map((x) => ({ colorway: x.colorway, svg: inlineFlat(flatOf("FRONT")!.svg, { className: "flat flat-indicative", fill: x.fill }) })),
    },
    componentOnly,
    packaging,
    /** Every answered question with what it prints as (the SPECIFICATIONS block and the golden check). */
    specs: specItems(p.pack.category, p.answers, printedAs),
    /** [0] prints on page 1 (or the component sheet), the rest on SPECIFICATIONS pages — set by paginateSpecs. */
    specChunks: [] as SpecItem[][],
    /** Type scale of page 1's right column (1 = full size; shrunk so its comments and specs fit). */
    overviewScale: 1,
    planInput,
    plan,
    validation,
    spelling,
  };
}

/** Average colour of a swatch card's chip (the red-boxed area), as #rrggbb. */
async function chipColour(m: Material): Promise<string | null> {
  if (!m.cardPhotoUrl || !m.chipBox) return null;
  try {
    const f = await readStoredFile(m.cardPhotoUrl);
    const img = sharp(f.data);
    const meta = await img.metadata();
    const W = meta.width ?? 0,
      H = meta.height ?? 0;
    const b = m.chipBox;
    // Sample the middle of the chip so the red box / card edge don't tint it.
    const left = Math.round((b.x + b.w * 0.25) * W),
      top = Math.round((b.y + b.h * 0.25) * H);
    const width = Math.max(1, Math.round(b.w * 0.5 * W)),
      height = Math.max(1, Math.round(b.h * 0.5 * H));
    const { channels } = await sharp(f.data).extract({ left, top, width: Math.min(width, W - left), height: Math.min(height, H - top) }).stats();
    const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
    return `#${hex(channels[0].mean)}${hex(channels[1]?.mean ?? channels[0].mean)}${hex(channels[2]?.mean ?? channels[0].mean)}`;
  } catch {
    return null;
  }
}

function trim(n: number) {
  return String(Math.round(n * 100) / 100);
}

/** The page a reference photo prints on: set explicitly, or from its comment letter. */
function placeOf(r: { tag: string; page: string | null }, comments: { letter: string; pages: string[] }[]): PageSection {
  if (r.page) return normalizePage(r.page) as PageSection;
  return refOnMeasurements(r.tag, comments) ? "MEASUREMENTS" : "REFERENCE IMAGES";
}

function refOnMeasurements(letter: string, comments: { letter: string; pages: string[] }[]) {
  return comments.some((c) => c.letter === letter && c.pages.includes("MEASUREMENTS") && !c.pages.includes("REFERENCE IMAGES"));
}

function closureText(a: AnswerMap) {
  const c = a["hb.closure"] as string | undefined;
  if (!c || c === "NONE") return "";
  const snaps = typeof a["hb.closure.snap_qty"] === "number" ? `${a["hb.closure.snap_qty"]} SNAPS TOTAL${a["hb.closure.snap_spacing"] ? `, ${a["hb.closure.snap_spacing"]} UNDER FLAP` : ""}.` : "";
  const title = c.startsWith("FLAP") ? "FRONT FLAP SNAP CLOSURE" : `${c} CLOSURE`;
  return [title, snaps].filter(Boolean).join(" — ");
}

/** The component-record facts a panel prints, with the shared finish standard's photo (V2.1 §7). */
async function componentRecord(rec: HardwareRecord, hwById: Map<string, Hardware>, img: (url?: string | null) => Promise<Img>) {
  const std = rec.finishStandardId ? hwById.get(rec.finishStandardId) : undefined;
  return {
    colour: rec.colour ?? "",
    relief: (rec.relief ?? []).filter((r) => r.treatment).map(reliefCallout),
    orientation: rec.orientation ?? "",
    mounting: rec.mounting ?? "",
    parent: rec.parent ?? "",
    usage: (rec.usage ?? []).filter((u) => u.style).map((u) => `${u.style}${typeof u.qty === "number" ? ` × ${u.qty}` : ""}${u.location ? ` — ${u.location}` : ""}`.toUpperCase()),
    finishStandard: std ? { title: [std.finish || std.name, std.code].filter(Boolean).join(" · "), photo: await img(std.photoUrl), plating: std.finishSpec?.plating ?? "" } : null,
  };
}
