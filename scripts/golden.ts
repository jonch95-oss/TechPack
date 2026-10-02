/**
 * Golden-set check (docs/V2.1-REAL-PACKS.md §12) over the nine golden packs:
 *  - the seven real packs, from the study files in reference/real-packs/ (gitignored) — their
 *    "expected" JSON, keyed to question ids;
 *  - PINK013 and TB25_ACC0023, from the e2e database after a full run (snapshotted to .data/golden/).
 *
 * For each pack it reports:
 *  1. ENTRY — how many of the original's facts the studio can take as they are stated: answers whose
 *     question exists in the category and whose value fits the question, vs facts that need a new
 *     question / reference answer / text in a library field (listed by id, never by value);
 *  2. PROTO GATE — blockers when the pack is entered exactly as the original states it.
 * Nothing confidential is printed or committed: only counts and question ids. The full report goes to
 * .data/golden/<date>.json (gitignored).
 *
 *   npm run golden            (GOLDEN_DB defaults to the e2e database)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { allQuestions, findQuestion, CATEGORIES, type AnswerMap, type Category, type Question } from "../src/lib/questions";
import { validatePack, type RuleResult } from "../src/lib/validation";
import { isReference, type ReferenceAnswer } from "../src/lib/reference-answer";

const ROOT = process.cwd();
const REAL = path.join(ROOT, "reference", "real-packs");
const OUT = path.join(ROOT, ".data", "golden");

type Hw = { id: string; code: string; type: string; dimsMm: string; finish: string; approval?: string };
type GoldenPack = { label: string; brand: string; category: Category; colorways: string[]; answers: Record<string, unknown>; extra: string[]; hardware?: Hw[] };

/* ------------------------------ loading ------------------------------ */

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

function colorwaysOf(raw: unknown, names: unknown, matrix?: unknown): string[] {
  // The breakdown's own colourway keys are what its cells are checked against.
  if (matrix && typeof matrix === "object" && Object.keys(matrix).length) return Object.keys(matrix as object);
  if (Array.isArray(raw) && raw.length) return raw.map((c) => (typeof c === "string" ? c : String((c as { suffix?: string }).suffix ?? "")).trim()).filter(Boolean);
  if (raw && typeof raw === "object") return Object.keys(raw as object);
  if (names && typeof names === "object") return Object.keys(names as object);
  return ["-A"];
}

function fromStudy(file: string): GoldenPack[] {
  const d = jsonBlock(file);
  const label = path.basename(file, ".md");
  const e = (d.expected ?? d) as Record<string, unknown>;
  // Format 1: a flat map ("pack.brand", question ids, "_new.*" proposed ids).
  if ("pack.brand" in e) {
    const answers: Record<string, unknown> = {};
    const extra: string[] = [];
    for (const [k, v] of Object.entries(e)) {
      if (k.startsWith("pack.")) continue;
      if (k.startsWith("_new.")) extra.push(k.slice(5));
      else if (v !== null) answers[k] = unwrap(v);
    }
    return [{ label, brand: String(e["pack.brand"]), category: category(e["pack.category"]), colorways: colorwaysOf(e["pack.colorways"], answers["colorways.names"], answers["materials.matrix"]), answers, extra }];
  }
  // Format 2: {brand, category, pack, answers, proposed_new}.
  if ("answers" in e && "brand" in e) {
    const answers = Object.fromEntries(Object.entries(e.answers as object).filter(([, v]) => v !== null && unwrap(v) !== null).map(([k, v]) => [k, unwrap(v)]));
    const pack = (e.pack ?? {}) as Record<string, unknown>;
    return [{ label, brand: String(e.brand), category: category(e.category), colorways: colorwaysOf(pack.colorways, answers["colorways.names"], answers["materials.matrix"]), answers, extra: Object.keys((e.proposed_new ?? {}) as object) }];
  }
  // Format 3: a style pack + its component sheets (pack F + pack G).
  if ("hardware_library" in d) {
    const pack = d.pack as Record<string, unknown>;
    const answers = Object.fromEntries(Object.entries(d.answers as object).filter(([, v]) => v !== null && unwrap(v) !== null).map(([k, v]) => [k, unwrap(v)]));
    const style: GoldenPack = { label: `${label} (style pack)`, brand: String(pack.brand), category: category(pack.category), colorways: colorwaysOf(pack.colorways, answers["colorways.names"], answers["materials.matrix"]), answers, extra: Object.keys((d.proposed_ids ?? {}) as object) };
    // Each component sheet as a Hardware-category pack: the hw.* answers its sheet states.
    const sheets = (d.hardware_library as Record<string, unknown>[]).map((h, i): GoldenPack => {
      const dims = String(h.dimsMm ?? "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      const a: Record<string, unknown> = {
        "hw.type": unwrap(h.type),
        "hw.component": { id: `golden-${i}`, label: String(h.code ?? "") },
        "hw.views": Array.isArray(h.views) ? (h.views as unknown[]).map((v) => String(typeof v === "string" ? v : (v as { view?: string }).view ?? "").toUpperCase()).filter(Boolean) : undefined,
        "hw.scale": "100%",
        "hw.overall_w": dims[0],
        "hw.overall_h": dims[1],
        "hw.overall_d": dims[2],
        "hw.detail_dims": Array.isArray(h.detailDims) ? h.detailDims : undefined,
        "hw.material": unwrap(h.material),
        "hw.finish": unwrap(h.finish),
        "hw.logo_treatment": unwrap(h.logoTreatment) || undefined,
      };
      for (const k of Object.keys(a)) if (a[k] === undefined || a[k] === null || a[k] === "") delete a[k];
      return { label: `${label} component ${i + 1}`, brand: String(h.brand ?? pack.brand), category: "Hardware", colorways: ["-A"], answers: a, extra: [] };
    });
    return [style, ...sheets];
  }
  throw new Error(`${label}: unknown study format`);
}

async function fromDb(styleNo: string): Promise<GoldenPack | null> {
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
function enterAs(q: Question, v: unknown): unknown {
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
        const out: Record<string, unknown> = { ...(r as object) };
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

type Report = {
  pack: string;
  category: string;
  facts: number;
  enterable: number;
  notFitting: string[];
  notInBank: string[];
  proposedNew: number;
  blockers: number;
  blockerIds: string[];
  warnings: number;
};

function check(p: GoldenPack): Report {
  const known = new Set(allQuestions(p.category).map((q) => q.id));
  const entered: AnswerMap = {};
  const notFitting: string[] = [];
  const notInBank: string[] = [];
  for (const [k, v] of Object.entries(p.answers)) {
    if (k.startsWith("optional.")) {
      entered[k] = v;
      continue;
    }
    const q = known.has(k) ? findQuestion(p.category, k) : undefined;
    const value = q ? enterAs(q, v) : undefined;
    if (!q) notInBank.push(k);
    else if (value === undefined) notFitting.push(k);
    else entered[k] = value;
  }
  const statuses = Object.fromEntries(Object.keys(entered).map((k) => [k, "confirmed"]));
  const brand = { name: p.brand, licensorRequired: /CHAMPION|TED BAKER/i.test(p.brand) };
  const rules: RuleResult[] = validatePack({ category: p.category, brand, answers: entered, statuses, colorways: p.colorways, chineseOn: false, stage: "PROTO", hardware: p.hardware ?? [], spelling: [] });
  const fails = rules.filter((r) => r.status === "fail");
  // validatePack already includes the stage's completeness (★ / Cell rules).
  const blockerIds = [...new Set(fails.map((r) => r.questionId ?? r.rule))];
  return {
    pack: p.label,
    category: p.category,
    facts: Object.keys(p.answers).length + p.extra.length,
    enterable: Object.keys(entered).length,
    notFitting,
    notInBank,
    proposedNew: p.extra.length,
    blockers: fails.length,
    blockerIds,
    warnings: rules.filter((r) => r.status === "warn").length,
  };
}

/* ------------------------------ run ------------------------------ */

async function main() {
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
  const reports = packs.map(check);
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(`\n${pad("PACK", 34)}${pad("CATEGORY", 20)}${pad("ENTERABLE", 12)}${pad("DOESN'T FIT", 13)}${pad("NO QUESTION", 13)}${pad("PROPOSED", 10)}${pad("PROTO BLOCKERS", 16)}WARN`);
  for (const r of reports)
    console.log(`${pad(r.pack, 34)}${pad(r.category, 20)}${pad(`${r.enterable}/${r.facts}`, 12)}${pad(r.notFitting.length, 13)}${pad(r.notInBank.length, 13)}${pad(r.proposedNew, 10)}${pad(r.blockerIds.length, 16)}${r.warnings}`);
  const clean = reports.filter((r) => r.blockerIds.length === 0).length;
  console.log(`\nPROTO gate: ${clean}/${reports.length} packs pass with zero blockers.`);
  for (const r of reports.filter((x) => x.blockerIds.length)) console.log(`  ${r.pack}: ${r.blockerIds.slice(0, 12).join(", ")}${r.blockerIds.length > 12 ? ` … +${r.blockerIds.length - 12}` : ""}`);
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(reports, null, 1));
  console.log(`\nFull report (ids only): ${path.relative(ROOT, file)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
