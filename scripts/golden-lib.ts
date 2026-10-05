/**
 * Golden-set loading shared by `npm run golden` and `npm run golden:pdf`: the seven real packs from the
 * study files in reference/real-packs/ (gitignored) and PINK013 / TB25_ACC0023 from the e2e database.
 * Nothing confidential lives here: it reads those files at run time only.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { findQuestion, CATEGORIES, type AnswerMap, type Category, type Question } from "../src/lib/questions";
import { allQuestions } from "../src/lib/questions";
import { isReference, type ReferenceAnswer } from "../src/lib/reference-answer";

export const ROOT = process.cwd();
export const REAL = path.join(ROOT, "reference", "real-packs");
export const OUT = path.join(ROOT, ".data", "golden");

export type Hw = { id: string; code: string; type: string; dimsMm: string; finish: string; approval?: string };
/** A library part the study describes (pack G): seeded into the hardware library by golden:pdf. */
export type LibPart = { code: string; type: string; name: string; dimsMm: string; detailDims: { label: string; mm?: number | null }[]; material: string; finish: string; logoTreatment: string };
/** A print the study's lining sheet records (V2.1 §7: a lining sheet is a print record + an interior layout). */
export type GoldenPrint = { name: string; motif: string; repeatType: string; tileW: string; tileH: string; tileUnit: string; colours: { system: "C" | "TCX" | "OTHER"; code: string }[]; application: string; baseFabricText: string };
export type GoldenPack = { library?: LibPart[]; prints?: GoldenPrint[]; colorwayStyles?: Record<string, string> } & { label: string; brand: string; category: Category; colorways: string[]; answers: Record<string, unknown>; extra: string[]; hardware?: Hw[] };

/* ------------------------------ loading ------------------------------ */

/**
 * Ids the studies proposed that now exist in the bank, with how their study shape maps onto the
 * question (so they count as entered facts, no longer as proposed ones).
 */
const ADOPTED: Record<string, { id: string; map: (v: unknown) => unknown; also?: (v: unknown, answers: Record<string, unknown>) => void }> = {
  // { "-A": { "PIPING": "SELF FABRIC", … } } → trim columns + their cells in the breakdown.
  "materials.matrix_trims": {
    id: "materials.trims",
    map: (v) => {
      const names = [...new Set(Object.values((v ?? {}) as Record<string, Record<string, unknown>>).flatMap((row) => Object.keys(row ?? {})))];
      return names.map((name) => ({ name }));
    },
    also: (v, answers) => {
      const rows = (v ?? {}) as Record<string, Record<string, unknown>>;
      const names = [...new Set(Object.values(rows).flatMap((row) => Object.keys(row ?? {})))];
      const m = ((answers["materials.matrix"] as Record<string, Record<string, unknown>>) ?? {}) as Record<string, Record<string, unknown>>;
      for (const [cw, row] of Object.entries(rows)) {
        m[cw] = { ...(m[cw] ?? {}) };
        names.forEach((n, i) => {
          const x = (row ?? {})[n];
          if (x != null && String(x).trim()) m[cw][`trim_${i + 1}`] = typeof x === "string" ? x : String(x);
        });
      }
      answers["materials.matrix"] = m;
    },
  },
  "branding.items": {
    id: "branding.items",
    map: (v) =>
      Array.isArray(v)
        ? v.map((r) => {
            const o = (r ?? {}) as Record<string, unknown>;
            const inch = typeof o.width_in === "number" ? o.width_in : null;
            return { method: o.type ?? o.method, w: inch != null ? Math.round(inch * 25.4 * 10) / 10 : o.w, colour: o.colour, placement: o.placement };
          })
        : v,
  },
};

const jsonBlock = (file: string) => {
  const m = /```json\n([\s\S]*?)```/.exec(readFileSync(file, "utf8"));
  if (!m) throw new Error(`${path.basename(file)}: no JSON block`);
  return JSON.parse(m[1]) as Record<string, unknown>;
};

/** {v, src, …} → v; "OTHER: X" → X. */
function unwrap(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v) && "v" in (v as object)) return unwrap((v as { v: unknown }).v);
  if (typeof v === "string") return v.replace(/^OTHER:\s*/i, "");
  if (Array.isArray(v)) return v.map(unwrap);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unwrap(x)]));
  return v;
}

const CATEGORY_ALIASES: Record<string, Category> = { "PACKING CUBES": "Packing cubes", "MEN'S BAGS": "Men's bags", "HARDSIDE LUGGAGE": "Hardside luggage", "COSMETIC BAGS": "Cosmetic bags" };
function category(raw: unknown): Category {
  const s = String(raw ?? "").trim();
  const hit = CATEGORIES.find((c) => c.toLowerCase() === s.toLowerCase()) ?? CATEGORY_ALIASES[s.toUpperCase()];
  if (!hit) {
    const loose = CATEGORIES.find((c) => s.toLowerCase().includes(c.toLowerCase().replace(/s$/, "")));
    if (loose) return loose;
    throw new Error(`Unknown category "${s}"`);
  }
  return hit;
}

/** Multi-style packs: [{suffix, styleNo}] → { "-A": style, … } (V2.1 §4). */
function stylesOf(raw: unknown): Record<string, string> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = Object.fromEntries(raw.filter((c) => c && typeof c === "object" && (c as { styleNo?: unknown }).styleNo).map((c) => [String((c as { suffix?: unknown }).suffix ?? "").trim(), String((c as { styleNo: unknown }).styleNo).trim().toUpperCase()]));
  return Object.keys(out).length ? out : undefined;
}

function colorwaysOf(raw: unknown, names: unknown, matrix?: unknown): string[] {
  // The breakdown's own colourway keys are what its cells are checked against.
  if (matrix && typeof matrix === "object" && Object.keys(matrix).length) return Object.keys(matrix as object);
  if (Array.isArray(raw) && raw.length) return raw.map((c) => (typeof c === "string" ? c : String((c as { suffix?: string }).suffix ?? "")).trim()).filter(Boolean);
  if (raw && typeof raw === "object") return Object.keys(raw as object);
  if (names && typeof names === "object") return Object.keys(names as object);
  return ["-A"];
}

export function fromStudy(file: string): GoldenPack[] {
  const d = jsonBlock(file);
  const label = path.basename(file, ".md");
  const e = (d.expected ?? d) as Record<string, unknown>;
  // Format 1: a flat map ("pack.brand", question ids, "_new.*" proposed ids).
  if ("pack.brand" in e) {
    const answers: Record<string, unknown> = {};
    const extra: string[] = [];
    const later: (() => void)[] = [];
    for (const [k, v] of Object.entries(e)) {
      if (k.startsWith("pack.")) continue;
      if (k.startsWith("_new.") && ADOPTED[k.slice(5)] && v !== null) {
        const ad = ADOPTED[k.slice(5)];
        answers[ad.id] = ad.map(unwrap(v));
        later.push(() => ad.also?.(unwrap(v), answers));
      }
      else if (k.startsWith("_new.")) extra.push(k.slice(5));
      else if (v !== null) answers[k] = unwrap(v);
    }
    later.forEach((f) => f());
    return [{ label, brand: String(e["pack.brand"]), category: category(e["pack.category"]), colorways: colorwaysOf(e["pack.colorways"], answers["colorways.names"], answers["materials.matrix"]), answers, extra }];
  }
  // Format 2: {brand, category, pack, answers, proposed_new}.
  if ("answers" in e && "brand" in e) {
    const answers = Object.fromEntries(Object.entries(e.answers as object).filter(([, v]) => v !== null && unwrap(v) !== null).map(([k, v]) => [k, unwrap(v)]));
    const pack = (e.pack ?? {}) as Record<string, unknown>;
    return [{ label, brand: String(e.brand), category: category(e.category), colorways: colorwaysOf(pack.colorways, answers["colorways.names"], answers["materials.matrix"]), answers, extra: Object.keys((e.proposed_new ?? {}) as object), colorwayStyles: stylesOf(pack.colorways) }];
  }
  // Format 3: a style pack + its component sheets (pack F + pack G).
  if ("hardware_library" in d) {
    const pack = d.pack as Record<string, unknown>;
    const answers = Object.fromEntries(Object.entries(d.answers as object).filter(([, v]) => v !== null && unwrap(v) !== null).map(([k, v]) => [k, unwrap(v)]));
    const style: GoldenPack = { label: `${label} (style pack)`, brand: String(pack.brand), category: category(pack.category), colorways: colorwaysOf(pack.colorways, answers["colorways.names"], answers["materials.matrix"]), answers, extra: Object.keys((d.proposed_ids ?? {}) as object) };
    const str = (v: unknown) => (typeof unwrap(v) === "string" ? String(unwrap(v)) : "");
    const library: LibPart[] = (d.hardware_library as Record<string, unknown>[]).map((h) => ({
      code: String(h.code ?? ""),
      type: str(h.type),
      name: str(h.name),
      dimsMm: str(h.dimsMm),
      detailDims: Array.isArray(h.detailDims) ? (h.detailDims as { label?: unknown; mm?: unknown }[]).filter((x) => x && x.label).map((x) => ({ label: String(x.label), mm: typeof x.mm === "number" ? x.mm : null })) : [],
      material: str(h.material),
      finish: str(h.finish),
      logoTreatment: str(h.logoTreatment),
    }));
    style.library = library;
    // A lining sheet isn't a part: its print record goes to the print library and its interior layout
    // (the features called out on the open case) to the style pack's interior.
    const lining = (d.hardware_library as Record<string, unknown>[]).filter((h) => h.print_record && typeof h.print_record === "object" && !Array.isArray(h.print_record));
    for (const h of lining) {
      const pr = h.print_record as Record<string, unknown>;
      const name = str(pr.name);
      if (name) {
        const colours = Array.isArray(pr.colours) ? (unwrap(pr.colours) as { system?: string; code?: string }[]).filter((c) => c?.code).map((c) => ({ system: (["C", "TCX"].includes(String(c.system)) ? c.system : "OTHER") as "C" | "TCX" | "OTHER", code: String(c.code) })) : [];
        const txt = (v: unknown) => (unwrap(v) == null ? "" : String(unwrap(v)));
        (style.prints ??= []).push({ name, motif: txt(pr.motif), repeatType: txt(pr.repeatType), tileW: txt(pr.tileW), tileH: txt(pr.tileH), tileUnit: String((pr.tileW as { unit?: string } | null)?.unit ?? (pr.tileH as { unit?: string } | null)?.unit ?? "cm").toLowerCase(), colours, application: txt(pr.application), baseFabricText: txt(pr.baseFabric) });
        style.answers["interior.lining_print"] = { id: "", label: name };
      }
      const il = (h.interior_layout ?? {}) as { callouts?: unknown[] };
      const rows = (il.callouts ?? []).map((c) => ({ feature: String(unwrap(c) ?? "").toUpperCase() })).filter((r) => r.feature);
      if (rows.length) style.answers["interior.layout"] = rows;
    }
    style.library = library.filter((_, i) => !lining.includes((d.hardware_library as Record<string, unknown>[])[i]));
    // Each component sheet as a Hardware-category pack: the hw.* answers its sheet states.
    const sheets = (d.hardware_library as Record<string, unknown>[]).flatMap((h, i): GoldenPack[] => {
      if (lining.includes(h)) return [];
      const dims = String(h.dimsMm ?? "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      // Reliefs the study marks by kind (RELIEF_DOWN / RELIEF_UP) are treatments, not detail dimensions (V2.1 §7).
      const dd = Array.isArray(h.detailDims) ? (h.detailDims as { label?: string; mm?: number; kind?: string }[]) : [];
      const dimRows = dd.filter((x) => !/^RELIEF/.test(x.kind ?? ""));
      const relief = dd.filter((x) => /^RELIEF/.test(x.kind ?? "")).map((x) => {
        const label = String(x.label ?? "").replace(/\s*—\s*(UP|DOWN)$/i, "");
        const t = label.match(/^(BEVELL?ED EMBOSSED|DEBOSSED|EMBOSSED|ENGRAVED)\s+/i)?.[1];
        return { treatment: (t ?? (x.kind === "RELIEF_DOWN" ? "DEBOSSED" : "EMBOSSED")).toUpperCase().replace("BEVELED", "BEVELLED"), mm: typeof x.mm === "number" ? x.mm : undefined, location: t ? label.slice(t.length).trim() : label };
      });
      const usage = Array.isArray(h.usage) ? (h.usage as Record<string, unknown>[]).map((u) => ({ style: str(u.style), qty: typeof unwrap(u.qty) === "number" ? unwrap(u.qty) : undefined, location: str(u.location) })).filter((u) => u.style) : [];
      const a: Record<string, unknown> = {
        "hw.type": unwrap(h.type),
        "hw.component": { id: `golden-${i}`, label: String(h.code ?? "") },
        "hw.views": Array.isArray(h.views) ? (h.views as unknown[]).map((v) => String(typeof v === "string" ? v : (v as { view?: string }).view ?? "").toUpperCase()).filter(Boolean) : undefined,
        "hw.scale": "100%",
        "hw.overall_w": dims[0],
        "hw.overall_h": dims[1],
        "hw.overall_d": dims[2],
        "hw.detail_dims": dimRows.length ? dimRows : undefined,
        "hw.relief": relief.length ? relief : undefined,
        "hw.colour": str(h.colour) || undefined,
        "hw.attachment": str(h.mounting) || undefined,
        "hw.orientation": str(h.logo_orientation) || undefined,
        "hw.parent": str(h.parent) ? { id: "", label: str(h.parent) } : undefined,
        "hw.usage": usage.length ? usage : undefined,
        "hw.material": unwrap(h.material),
        "hw.finish": unwrap(h.finish),
        "hw.logo_treatment": unwrap(h.logoTreatment) || undefined,
      };
      for (const k of Object.keys(a)) if (a[k] === undefined || a[k] === null || a[k] === "") delete a[k];
      return [{ label: `${label} component ${i + 1}`, brand: String(h.brand ?? pack.brand), category: "Hardware", colorways: ["-A"], answers: a, extra: [], library: [library[i]] }];
    });
    return [style, ...sheets];
  }
  throw new Error(`${label}: unknown study format`);
}

export async function fromDb(styleNo: string): Promise<GoldenPack | null> {
  const snap = path.join(OUT, "packs", `${styleNo}.json`);
  const url = process.env.GOLDEN_DB ?? "postgres://postgres@localhost:5433/techpack_test";
  try {
    const sql = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 3 });
    const [p] = await sql<{ id: string; category: string; colorways: string[]; brand: string }[]>`select p.id, p.category, p.colorways, b.name as brand from packs p join brands b on b.id = p.brand_id where p.style_no = ${styleNo}`;
    if (p) {
      const rows = await sql<{ question_id: string; value: unknown }[]>`select question_id, value from pack_answers where pack_id = ${p.id}`;
      const hw = await sql<{ id: string; code: string; type: string; dims_mm: string; finish: string; approval: { status?: string } }[]>`select id, code, type, dims_mm, finish, approval from hardware`;
      await sql.end();
      const answers = Object.fromEntries(rows.map((r) => [r.question_id, r.value]));
      const used = JSON.stringify(answers);
      const hardware = hw.filter((h) => used.includes(h.id)).map((h) => ({ id: h.id, code: h.code, type: h.type, dimsMm: h.dims_mm, finish: h.finish, approval: h.approval?.status }));
      const pack: GoldenPack = { label: styleNo, brand: p.brand, category: p.category as Category, colorways: p.colorways, answers, extra: [], hardware };
      mkdirSync(path.dirname(snap), { recursive: true });
      writeFileSync(snap, JSON.stringify(pack));
      return pack;
    }
    await sql.end();
  } catch {
    /* fall back to the snapshot */
  }
  return existsSync(snap) ? (JSON.parse(readFileSync(snap, "utf8")) as GoldenPack) : null;
}

/* ------------------------------ checks ------------------------------ */

/**
 * The value as the studio takes it, or undefined when it can't be entered as stated. Library parts
 * named in words become descriptions (V2.1 §1.3), breakdown text becomes cell text, partial sizes are
 * allowed (V2.1 §5), and any reference answer is accepted.
 */
export function enterAs(q: Question, v: unknown): unknown {
  if (isReference(v)) return v;
  const asLib = (x: unknown) => (typeof x === "string" && x.trim() ? { id: "", label: x.trim().toUpperCase() } : x && typeof x === "object" && "id" in (x as object) ? x : undefined);
  switch (q.kind) {
    case "chips":
      return typeof v === "string" && (!q.noOther || q.options.includes(v)) ? v : undefined;
    case "multi":
      return Array.isArray(v) && v.every((x) => typeof x === "string") ? v : undefined;
    case "toggle":
      return typeof v === "boolean" ? v : undefined;
    case "stepper":
      return typeof v === "number" ? v : undefined;
    case "dims2":
      return v && typeof v === "object" && ["w", "h"].some((k) => typeof (v as Record<string, unknown>)[k] === "number") ? v : undefined;
    case "lib":
      return asLib(v);
    case "text":
    case "comment":
    case "date_asap":
      return typeof v === "string" ? v : Array.isArray(v) ? v.join("; ") : undefined;
    case "rows": {
      if (!Array.isArray(v)) return undefined;
      const textCol = q.columns.find((c) => c.key === "text" || c.kind === "text")?.key;
      const rows = v.map((r) => {
        if (typeof r === "string" && textCol) return { [textCol]: r.toUpperCase() };
        if (!r || typeof r !== "object") return null;
        // A key the study proposed ("_new.piece") is the column it proposed, once the column exists.
        const out: Record<string, unknown> = Object.fromEntries(Object.entries(r as object).map(([k, x]) => [k.startsWith("_new.") && q.columns.some((c) => c.key === k.slice(5)) ? k.slice(5) : k, x]));
        for (const c of q.columns) if (c.kind === "lib" && out[c.key] != null) out[c.key] = asLib(out[c.key]) ?? null;
        return out;
      });
      return rows.every(Boolean) ? rows : undefined;
    }
    case "materials":
      return Array.isArray(v) ? v : undefined;
    case "colorway_matrix": {
      if (!v || typeof v !== "object") return undefined;
      const out: Record<string, Record<string, unknown>> = {};
      for (const [cw, row] of Object.entries(v as object)) {
        out[cw] = {};
        for (const [k, c] of Object.entries((row ?? {}) as object)) if (c != null) out[cw][k] = typeof c === "string" ? { text: c.toUpperCase() } : c;
      }
      return out;
    }
    case "per_colorway_text":
      return v && typeof v === "object" ? v : undefined;
    default:
      return v;
  }
}


/** Every golden pack: the study packs (with the reference answers from golden-entry.json) and PINK013 / TB25. */
export async function loadGolden(): Promise<GoldenPack[]> {
  const packs: GoldenPack[] = [];
  if (existsSync(REAL)) for (const f of readdirSync(REAL).filter((f) => f.endsWith(".md") && f !== "README.md").sort()) packs.push(...fromStudy(path.join(REAL, f)));
  else console.log("reference/real-packs/ not present — the seven real packs are skipped.");
  for (const s of ["PINK013", "TB25_ACC0023"]) {
    const p = await fromDb(s);
    if (p) packs.push(p);
    else console.log(`${s}: not in the e2e database and no snapshot — run the e2e suite once.`);
  }
  // Entries authored from the study notes (gitignored, beside them): the fields each original answers
  // by reference ("SAME AS …", "PLEASE FOLLOW SAMPLE IMAGES FOR …"), and facts the expected block files
  // under a proposed id that an existing question already takes as written.
  const refsFile = path.join(REAL, "golden-entry.json");
  const refs = existsSync(refsFile) ? (JSON.parse(readFileSync(refsFile, "utf8")) as Record<string, Record<string, ReferenceAnswer | unknown>>) : {};
  for (const p of packs) for (const [qid, r] of Object.entries(refs[p.label] ?? {})) if (p.answers[qid] == null) p.answers[qid] = r;
  return packs;
}

/** The answers as the studio takes them: only questions that exist and values that fit. */
export function entered(p: GoldenPack): { answers: AnswerMap; notFitting: string[]; notInBank: string[] } {
  const known = new Set(allQuestions(p.category).map((q) => q.id));
  const answers: AnswerMap = {};
  const notFitting: string[] = [];
  const notInBank: string[] = [];
  for (const [k, v] of Object.entries(p.answers)) {
    if (k.startsWith("optional.")) {
      answers[k] = v;
      continue;
    }
    const q = known.has(k) ? findQuestion(p.category, k) : undefined;
    const value = q ? enterAs(q, v) : undefined;
    if (!q) notInBank.push(k);
    else if (value === undefined) notFitting.push(k);
    else answers[k] = value;
  }
  return { answers, notFitting, notInBank };
}

export { mkdirSync, writeFileSync, isReference };
