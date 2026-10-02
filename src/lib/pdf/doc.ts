import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { flats as flatsTable, hardware, materials, packs, prints, sampleComments, sampleRounds, users, type Hardware, type Material, type FileMarks, type Print } from "@/db/schema";
import sharp from "sharp";
import { calloutsOn, inlineFlat } from "@/lib/lineart/geometry";
import { pantoneHex, repeatTileSvg, svgDataUri } from "./artwork";
import { normalizePage, type PageSection } from "@/lib/page-names";
import { changeLine, revisionState } from "@/lib/revisions";
import { materialLabel, type LoadedPack } from "@/lib/data";
import { readStoredFile } from "@/lib/storage";
import { intoCrop, readCroppedFile } from "@/lib/crop";
import { spellcheckParts } from "@/lib/spellcheck";
import { validatePack, type RuleResult } from "@/lib/validation";
import { bodyMaterials, contentLabel, findQuestion, isEmpty, matrixColumns, sectionsFor, evalCondition, type AnswerMap, type BomRow, type Dims2Value, type LibValue, type MaterialEntry, type MatrixValue, type PomRow } from "@/lib/questions";
import { planPages, type Plan } from "./plan";
import { refText, splitReferences } from "@/lib/reference-answer";

export type Img = { src: string; w: number; h: number } | null;

export type PackDoc = Awaited<ReturnType<typeof buildPackDoc>>;

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

export async function buildPackDoc(p: LoadedPack, opts: { images?: boolean; stage?: "PROTO" | "PRODUCTION" } = {}) {
  const withImages = opts.images !== false;
  // Templates read plain values; reference answers ("SAME AS …", "FOLLOW REFERENCE IMAGE") print as written.
  const { values: a, refs: refAnswers } = splitReferences(p.answers);
  const refNotes = Object.entries(refAnswers).map(([qid, r]) => ({ questionId: qid, label: (findQuestion(p.pack.category, qid)?.label ?? qid).toUpperCase(), text: refText(r) }));
  // Parts identified by a description (no library item yet, V2.1 §1.3) print as written too.
  for (const r of (p.answers["hardware.items"] as { item?: LibValue; qty?: number; placement?: string }[] | undefined) ?? [])
    if (r.item && !r.item.id && r.item.label)
      refNotes.push({ questionId: "hardware.items", label: "HARDWARE", text: `${r.item.label}${(r.qty ?? 1) > 1 ? ` ×${r.qty}` : ""}${r.placement ? ` — ${r.placement}` : ""}`.toUpperCase() });
  const ctx = { category: p.pack.category, answers: a, brand: p.brand };
  const unit = a["dims.unit"] === "INCHES" ? "in" : "cm";
  const U = unit === "in" ? '"' : " CM";
  const fmt = (v: unknown) => (typeof v === "number" ? `${trim(v)}${U}` : "");

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
      const meta = await sharp(f.data).metadata().catch(() => ({ width: 1, height: 1 }));
      const v = { src: `data:${f.contentType};base64,${f.data.toString("base64")}`, w: meta.width ?? 1, h: meta.height ?? 1 };
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
  const comments = ((a["comments.list"] as { text?: string; pages?: string[] }[] | undefined) ?? []).map((c, i) => ({
    letter: String.fromCharCode(65 + i),
    text: c.text ?? "",
    pages: (c.pages ?? []).map(normalizePage),
  }));

  /* ---------- materials & swatches ---------- */
  const matList = bodyMaterials(a["materials.list"] as MaterialEntry[] | undefined);
  const matrix = (a["materials.matrix"] as MatrixValue | undefined) ?? {};
  const cols = matrixColumns(ctx);
  const names = (a["colorways.names"] as Record<string, string> | undefined) ?? {};
  const swatches: { colorway: string; materialCallout: number; material: Material; materialName: string }[] = [];
  for (const cw of p.pack.colorways)
    for (const m of matList) {
      const id = matrix[cw]?.[`mat_${m.callout}`]?.lib?.id;
      const mat = id ? matById.get(id) : undefined;
      if (mat?.cardPhotoUrl) swatches.push({ colorway: cw, materialCallout: m.callout, material: mat, materialName: m.name });
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
  if (p.pack.category === "Hardware") {
    const base = hwById.get(lib(a["hw.component"])?.id ?? "");
    const n = (k: string) => (typeof a[k] === "number" ? (a[k] as number) : null);
    const size = [n("hw.overall_w"), n("hw.overall_h"), n("hw.overall_d")].filter((x): x is number => x != null);
    const wanted = new Set(((a["hw.views"] as string[] | undefined) ?? ["FRONT", "SIDE", "REAR", "TOP"]).map((v) => v.toLowerCase()));
    const views = Object.fromEntries(Object.entries(base?.views ?? {}).filter(([k]) => wanted.has(k)));
    const rows = ((a["hw.detail_dims"] as { label?: string; mm?: number }[] | undefined) ?? []).filter((r) => r.label);
    const extras = [a["hw.hollow"] === true && `HOLLOW${a["hw.hollow_where"] ? `: ${a["hw.hollow_where"]}` : ""}`, a["hw.edge"] && `${a["hw.edge"]} EDGE`, a["hw.etched_sides"] === true && "ETCHED SIDE PATTERN", a["hw.attachment"] && `ATTACHMENT: ${a["hw.attachment"]}`].filter(Boolean);
    const own = {
      ...(base ?? ({ id: "pack", code: p.pack.styleNo, name: p.pack.styleName, photoUrl: null, finishSpec: {}, approval: { status: "PENDING" }, construction: "", enamelPantone: "", notes: "" } as unknown as Hardware)),
      type: String(a["hw.type"] ?? base?.type ?? ""),
      dimsMm: size.length ? size.join(" X ") : (base?.dimsMm ?? ""),
      material: String(a["hw.material"] ?? base?.material ?? ""),
      finish: String(a["hw.finish"] ?? base?.finish ?? ""),
      logoTreatment: String(a["hw.logo_treatment"] ?? base?.logoTreatment ?? ""),
      enamelPantone: String(a["hw.enamel_colour"] ?? base?.enamelPantone ?? ""),
      notes: [base?.notes, ...extras].filter(Boolean).join(" · "),
      detailDims: rows.length ? rows.map((r) => ({ label: String(r.label), mm: typeof r.mm === "number" ? r.mm : null })) : (base?.detailDims ?? []),
      views,
    } as Hardware;
    detail = [own, ...detail.filter((h) => h.id !== own.id)];
  }
  const logoSize = a["branding.logo_size"] as Dims2Value | undefined;
  const logoHw = hwById.get(lib(a["branding.logo_code"])?.id ?? "");
  const logoPanel = logoSize?.w != null && logoSize?.h != null && /PATCH|DEBOSS|EMBOSS/.test(String(a["branding.logo_type"] ?? "")) ? { w: logoSize.w, h: logoSize.h, photo: logoHw?.photoUrl ?? null } : null;

  /* ---------- lining artwork ---------- */
  const liningPrintId = lib(a["interior.lining_print"])?.id ?? Object.values(matrix).map((r) => r?.lining?.lib?.id).find((id) => id && printById.has(id));
  const liningPrint = liningPrintId ? printById.get(liningPrintId) ?? null : null;
  const hasInterior = sectionsFor(p.pack.category).some((s) => s.id === "interior" && evalCondition(s.showIf, ctx)) && (a["interior.lined"] === true || !isEmpty(a["interior.pockets"]));

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
  if (typeof a["branding.offset"] === "number") measures.push({ key: "branding.offset", label: `LOGO ${a["branding.offset_edge"] ? `ABOVE ${a["branding.offset_edge"]}` : "OFFSET"}`, value: `${trim(Number(a["branding.offset"]) / (unit === "in" ? 25.4 : 10))}${U}` });

  /* ---------- points of measure, placements, zippers, construction, BOM ---------- */
  const pom = ((a["pom.list"] as PomRow[] | undefined) ?? []).filter((r) => r.point);
  const placements = ((a["placements.list"] as { item?: LibValue; qty?: number; from?: string; distance?: number; spacing?: number; note?: string }[] | undefined) ?? []).map((r) => {
    const h = r.item ? hwById.get(r.item.id) : undefined;
    return { code: h?.code ?? r.item?.label ?? "", type: h?.type ?? "", qty: r.qty, from: r.from ?? "", distance: r.distance, spacing: r.spacing, note: r.note ?? "" };
  });
  const zippers = ((a["zippers.list"] as Record<string, unknown>[] | undefined) ?? []).map((z) => ({
    position: String(z.position ?? ""),
    size: String(z.size ?? ""),
    type: String(z.type ?? ""),
    length: typeof z.length === "number" ? `${trim(z.length)}${U}` : "",
    ends: String(z.ends ?? ""),
    slider: String(z.slider ?? ""),
    puller: (z.puller as LibValue | undefined)?.label ?? "",
    attachment: String(z.attachment ?? ""),
    tape: String(z.tape ?? ""),
    teeth: String(z.teeth ?? ""),
  }));
  const construction = ((a["construction.list"] as Record<string, unknown>[] | undefined) ?? []).map((c) => ({
    area: String(c.area ?? ""),
    edge: String(c.edge ?? ""),
    stitch: String(c.stitch ?? ""),
    spi: typeof c.spi === "number" ? String(c.spi) : "",
    thread: String(c.thread ?? ""),
    allowance: typeof c.allowance === "number" ? `${c.allowance} MM` : "",
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
  // colour of their main material (sampled from the swatch card's chip).
  const indicative: { colorway: string; fill: string }[] = [];
  if (flatOf("FRONT") && withImages && matList.length) {
    for (const cw of p.pack.colorways) {
      if (cwRenders.some((f) => f!.tag === cw)) continue;
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

  const features = a["pages.product_features"] === false ? [] : ((a["pages.features"] as { text?: string }[] | undefined) ?? []).map((f) => f.text ?? "").filter(Boolean);
  const plan: Plan = planPages({
    hasInterior,
    hasColourways: p.pack.colorways.length > 0 && (cols.length > 0 || matList.length > 0),
    hasExtraMeasurements: measures.length > 0 || pom.length > 0 || placements.length > 0 || !!flatOf("FRONT"),
    colorwayRenderCount: cwRenders.length + indicative.length,
    referencePhotoCount: refs.filter((r) => placeOf(r, comments) === "REFERENCE IMAGES").length,
    hasLiningArtwork: !!liningPrint,
    liningArtworkOnInterior: a["pages.lining_artwork"] === "ON INTERIOR PAGE",
    detailPanelCount: detail.length + (logoPanel ? 1 : 0),
    swatches: swatches.map((s) => ({ colorway: s.colorway, materialCallout: s.materialCallout })),
    swatchesOnOnePage: a["pages.swatches"] === "ALL ON ONE PAGE",
    revisionCount: changeLog.length,
    hasConstruction: construction.length > 0,
    hasBom: bom.length > 0 || zippers.length > 0,
    hasSampleComments: roundComments.length > 0,
  });

  /* ---------- validation ---------- */
  // "Same as <style # / code>" resolves when that pack or library item exists in the studio.
  const knownCodes = Object.keys(refAnswers).length
    ? new Set([...(await db.select({ c: packs.styleNo }).from(packs)).map((r) => r.c), ...(await db.select({ c: hardware.code }).from(hardware)).map((r) => r.c)].map((c) => c.toUpperCase()))
    : new Set<string>();
  const team = (await db.select({ name: users.name }).from(users)).flatMap((u) => u.name.split(/\s+/));
  const spelling = spellcheckParts(answerTexts(a), [...team, p.brand.name, p.pack.styleName, ...p.brand.name.split(/\s+/)]);
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
    spelling,
  });

  /* ---------- matrix rows ---------- */
  const rows = p.pack.colorways.map((cw) => ({
    code: cw,
    name: names[cw] ?? "",
    cells: cols.map((c) => {
      const cell = matrix[cw]?.[c.key];
      const mat = cell?.lib ? matById.get(cell.lib.id) : undefined;
      const pr = cell?.lib ? printById.get(cell.lib.id) : undefined;
      let text = cell?.text ?? "";
      let ref: string | null = null;
      if (mat) {
        text = materialLabel(mat);
        ref = c.callout ? plan.swatchRef(cw, c.callout) : null;
      }
      if (pr) {
        text = `${pr.application || "PRINT"} ${pr.name.includes("CUSTOM") ? "" : "CUSTOM ARTWORK"}`.trim();
        ref = plan.artworkRef();
      }
      return { key: c.key, text, ref, refKind: mat ? "swatch" : pr ? "artwork" : null };
    }),
  }));

  return {
    refNotes,
    /** Every style # in the pack (one today; multi-style packs come with V2.1 §4). */
    styleCodes: [p.pack.styleNo],
    pack: p.pack,
    brand: { name: p.brand.name, logo: await img(p.brand.logoUrl) },
    unit,
    U,
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
      licensor: a["header.licensor"] ? `${a["header.licensor"]} · ${a["header.licensor_submission"] ?? ""} · ${a["header.licensor_status"] ?? ""}` : "",
    },
    dims: { h: a["dims.h"] as number | undefined, w: a["dims.w"] as number | undefined, d: a["dims.d"] as number | undefined },
    // Overall size on one line, from whatever the product gives (V2.1 §5: a flat bag has no depth).
    sizeText: (["h", "w", "d"] as const)
      .filter((k) => typeof a[`dims.${k}`] === "number")
      .map((k) => `${trim(a[`dims.${k}`] as number)}${U} ${k.toUpperCase()}`)
      .join(" X ")
      .replace(/ CM/g, " cm"),
    render: await cropped(render),
    colorwayRenders: await Promise.all(cwRenders.map(async (f) => ({ colorway: f!.tag, img: await cropped(f) }))),
    references: await Promise.all(
      refs.map(async (r) => {
        const page = placeOf(r, comments);
        return { letter: r.tag, note: r.note, img: await img(r.url), page, zoom: r.marks?.zoom ?? null, dot: r.marks?.dot ?? null, role: r.marks?.role ?? null, onMeasurements: page === "MEASUREMENTS" && r.marks?.role !== "SIDE_VIEW" };
      }),
    ),
    /** Where the LOGO label's leader line points on the render (marked, or from the placement). */
    logoPoint: render?.marks?.dot ? intoCrop(render.marks.dot, render.marks.crop) : defaultLogoPoint(String(a["branding.placement"] ?? "")),
    comments,
    materials: matList,
    matrixColumns: cols,
    rows,
    hardwareFinish: (a["hardware.finish"] as string) ?? "",
    charm: lib(a["hb.charm.code"]) ? { code: lib(a["hb.charm.code"])!.label, photo: await img(hwById.get(lib(a["hb.charm.code"])!.id)?.photoUrl) } : null,
    logo: {
      type: (a["branding.logo_type"] as string) ?? "",
      code: lib(a["branding.logo_code"])?.label ?? "",
      placement: (a["branding.placement"] as string) ?? "",
      panel: logoPanel ? { ...logoPanel, photo: await img(logoPanel.photo) } : null,
      fill: (a["branding.fill"] as string) ?? "",
    },
    measures,
    closure: closureText(a),
    gussetNote: a["hb.gusset"] ? `SIDE HAS ${String(a["hb.gusset"]).replace("STANDARD (NO PLEATS)", "STANDARD GUSSET, NO EXTRA PLEATS")}` : "",
    strapNote: a["hb.strap"] === true ? `SHOULDER STRAP ${a["hb.strap.removable"] === "FIXED" ? "IS NOT REMOVABLE" : "IS REMOVABLE"}${(a["hb.strap.attachment"] as string[] | undefined)?.length ? ` — ATTACHED WITH ${(a["hb.strap.attachment"] as string[]).join(" + ")}` : ""}` : "",
    features,
    interior: {
      label: lib(a["interior.label"]) ? { code: lib(a["interior.label"])!.label, name: hwById.get(lib(a["interior.label"])!.id)?.name ?? "", type: hwById.get(lib(a["interior.label"])!.id)?.type ?? "", photo: await img(hwById.get(lib(a["interior.label"])!.id)?.photoUrl) } : null,
      labelSize: a["interior.label_size"] as Dims2Value | undefined,
      labelOffset: a["interior.label_offset"] as number | undefined,
      labelCentered: a["interior.label_centered"] === true,
      pockets: (a["interior.pockets"] as { type?: string; wall?: string; w?: number; h?: number; top_offset?: number; centered?: boolean; zip_size?: string; qty?: number }[] | undefined) ?? [],
      pocketEdge: (a["interior.pocket_edge"] as string) ?? "",
      seamBinding: a["interior.seam_binding"] === true,
      padding: a["cos.padding"] === true ? `${a["cos.padding_mm"] ?? ""}MM PADDING ${a["cos.padding_where"] ?? ""}`.trim() : "",
    },
    /** The wall the interior page is about (the first pocket's, else the back wall). */
    interiorWall: (((a["interior.pockets"] as { wall?: string }[] | undefined) ?? []).find((x) => x.wall === "BACK WALL")?.wall ?? ((a["interior.pockets"] as { wall?: string }[] | undefined) ?? [])[0]?.wall ?? "BACK WALL") as string,
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
        detailDims: h.detailDims ?? [],
        finishSpec: h.finishSpec ?? {},
        approval: h.approval?.status ?? "PENDING",
        views: { front: await img(h.views.front), side: await img(h.views.side), rear: await img(h.views.rear), top: await img(h.views.top) },
        photo: await img(h.photoUrl),
      })),
    ),
    swatches: await Promise.all(
      swatches.map(async (s) => ({
        colorway: s.colorway,
        callout: s.materialCallout,
        materialName: s.materialName,
        supplier: s.material.supplier,
        articleNo: s.material.articleNo,
        article: [s.material.articleName, s.material.colourNo && `/ ${s.material.colourNo}`].filter(Boolean).join(" "),
        colourName: s.material.colourName,
        photo: await img(s.material.cardPhotoUrl),
        chipBox: s.material.chipBox,
      })),
    ),
    pom,
    placements,
    zippers,
    construction,
    threadColour: (a["construction.thread_colour"] as string) ?? "",
    materialLayout: matList.filter((m) => m.direction || m.matching).map((m) => ({ callout: m.callout, name: m.name, direction: m.direction ?? "", matching: m.matching ?? "" })),
    bom,
    contentLabels: labels,
    tooling: {
      artwork: (a["branding.artwork"] as { name?: string } | undefined)?.name ?? "",
      depth: typeof a["branding.tool_depth"] === "number" ? `${a["branding.tool_depth"]} MM` : "",
      newTooling: a["branding.new_tooling"] === true,
    },
    baseBoard: a["interior.base_board"] === true ? [a["interior.base_board_material"], a["interior.base_board_mm"] && `${a["interior.base_board_mm"]}MM`].filter(Boolean).join(" ") || "BASE BOARD" : "",
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

function defaultLogoPoint(placement: string) {
  if (/FLAP/.test(placement)) return { x: 0.5, y: 0.42 };
  if (/BASE|BOTTOM/.test(placement)) return { x: 0.5, y: 0.82 };
  return { x: 0.5, y: 0.58 };
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
