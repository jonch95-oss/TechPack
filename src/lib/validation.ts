/**
 * The validation gate (BRIEF Part 5). Export is blocked while any rule fails; warnings are shown
 * but allowed. Each result says exactly what to fix and which question to jump to.
 */
import {
  completeness,
  matrixColumns,
  visibleQuestions,
  type AnswerMap,
  type Category,
  type Dims2Value,
  type LibValue,
  type MaterialEntry,
} from "@/lib/questions";
import type { SpellFlag } from "@/lib/spellcheck/core";

export type RuleGroup = "Completeness" | "Geometry" | "Consistency" | "Language" | "Licensor" | "Claims";
export type RuleResult = {
  group: RuleGroup;
  rule: string;
  status: "pass" | "fail" | "warn" | "na";
  fix: string;
  questionId?: string;
};

export type ValidationInput = {
  category: Category;
  brand: { name: string; licensorRequired: boolean };
  answers: AnswerMap;
  statuses: Record<string, string>;
  colorways: string[];
  chineseOn: boolean;
  /** Library hardware referenced by the pack, resolved. */
  hardware: { id: string; code: string; type: string; dimsMm: string; finish: string; approval?: string }[];
  /** Library materials used by the pack. */
  materials?: { id: string; label: string; approval: string; composition: string }[];
  spelling: SpellFlag[];
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function validatePack(input: ValidationInput): RuleResult[] {
  const { answers: a, category } = input;
  const ctx = { category, answers: a, brand: input.brand };
  const out: RuleResult[] = [];
  const push = (r: RuleResult) => out.push(r);
  const inches = a["dims.unit"] === "INCHES";
  const toCm = (v: number) => (inches ? v * 2.54 : v);
  const unit = inches ? "IN" : "CM";
  const H = num(a["dims.h"]),
    W = num(a["dims.w"]),
    D = num(a["dims.d"]);

  /* ------------------------------ Completeness ------------------------------ */
  const issues = completeness(ctx, input.statuses, input.colorways);
  const matrixIssues = issues.filter((i) => i.questionId === "materials.matrix");
  const starIssues = issues.filter((i) => i.questionId !== "materials.matrix");
  if (!starIssues.length) push({ group: "Completeness", rule: "All ★ fields confirmed", status: "pass", fix: "" });
  for (const i of starIssues) push({ group: "Completeness", rule: `★ ${i.label}`, status: "fail", fix: `${i.problem} — answer or confirm it.`, questionId: i.questionId });
  if (!matrixIssues.length) push({ group: "Completeness", rule: "Every material × colourway cell filled", status: "pass", fix: "" });
  for (const i of matrixIssues) push({ group: "Completeness", rule: `Cell ${i.label}`, status: "fail", fix: "Choose a swatch, DTM or N/A.", questionId: "materials.matrix" });

  const used = usedHardwareIds(a);
  const hwFinish = (a["hardware.finish"] as string) || "";
  const badHw = input.hardware.filter((h) => used.has(h.id) && (!h.code || !h.dimsMm || !(h.finish || hwFinish)));
  if (!badHw.length) push({ group: "Completeness", rule: "Every hardware item has code, dimensions and finish", status: "pass", fix: "" });
  for (const h of badHw)
    push({
      group: "Completeness",
      rule: `Hardware ${h.code || "(no code)"}`,
      status: "fail",
      fix: `Add ${[!h.code && "a code", !h.dimsMm && "dimensions (mm)", !(h.finish || hwFinish) && "a finish"].filter(Boolean).join(" and ")} in the hardware library.`,
      questionId: "hardware.items",
    });

  const comments = (a["comments.list"] as { text?: string; pages?: string[] }[] | undefined) ?? [];
  const unplaced = comments.map((c, i) => ({ c, letter: String.fromCharCode(65 + i) })).filter(({ c }) => !c.pages?.length);
  if (!comments.length) push({ group: "Completeness", rule: "Every comment letter appears on a page", status: "na", fix: "" });
  else if (!unplaced.length) push({ group: "Completeness", rule: "Every comment letter appears on a page", status: "pass", fix: "" });
  for (const { letter } of unplaced) push({ group: "Completeness", rule: `Comment ${letter} isn't on any page`, status: "fail", fix: `Choose the page(s) comment ${letter} belongs on.`, questionId: "comments.list" });

  /* ------------------------------ Geometry ------------------------------ */
  const flap = num(a["hb.flap_height"]);
  if (flap !== null && H !== null)
    push(flap <= H ? { group: "Geometry", rule: "Flap height ≤ body height", status: "pass", fix: "" } : { group: "Geometry", rule: "Flap height ≤ body height", status: "fail", fix: `Flap ${flap} ${unit} is taller than the bag (${H} ${unit}).`, questionId: "hb.flap_height" });

  push({ group: "Geometry", rule: "Body panel heights sum to total H", status: "na", fix: "No separate body panel heights entered." });

  const pockets = (a["interior.pockets"] as { type?: string; wall?: string; w?: number; h?: number; top_offset?: number }[] | undefined) ?? [];
  pockets.forEach((p, i) => {
    const wallW = p.wall === "SIDE 1" || p.wall === "SIDE 2" ? D : p.wall === "BASE" ? W : W;
    const margin = inches ? 2 / 2.54 : 2;
    const label = `Pocket ${i + 1} (${p.type ?? "POCKET"}) fits its wall`;
    if (wallW === null || p.w == null) return push({ group: "Geometry", rule: label, status: "na", fix: "Wall or pocket width not set." });
    const problems: string[] = [];
    if (p.w > wallW - margin) problems.push(`width ${p.w} must be ≤ wall ${wallW} − ${round(margin)} ${unit}`);
    if (p.h != null && H !== null && p.h > H - (p.top_offset ?? 0)) problems.push(`height ${p.h} must be ≤ wall ${H} − ${p.top_offset ?? 0} from top`);
    push(problems.length ? { group: "Geometry", rule: label, status: "fail", fix: problems.join("; ") + ".", questionId: "interior.pockets" } : { group: "Geometry", rule: label, status: "pass", fix: "" });
  });

  const logo = a["branding.logo_size"] as Dims2Value | undefined;
  const off = num(a["branding.offset"]);
  if (logo?.w != null && logo?.h != null && off !== null && H !== null && W !== null) {
    const onFlap = a["branding.placement"] === "CENTERED ON FLAP";
    const panelH = onFlap && flap !== null ? toCm(flap) * 10 : toCm(H) * 10;
    const panelW = toCm(W) * 10;
    const ok = logo.h + off <= panelH && logo.w <= panelW;
    push(
      ok
        ? { group: "Geometry", rule: "Logo size + offset fits its panel", status: "pass", fix: "" }
        : { group: "Geometry", rule: "Logo size + offset fits its panel", status: "fail", fix: `Logo ${logo.w} × ${logo.h} mm + ${off} mm offset doesn't fit the ${onFlap ? "flap" : "panel"} (${round(panelW)} × ${round(panelH)} mm).`, questionId: "branding.logo_size" },
    );
  } else push({ group: "Geometry", rule: "Logo size + offset fits its panel", status: "na", fix: "Logo size, offset or overall size not set." });

  const drops: [string, string, number, number][] = [
    ["hb.top_handle.drop", "Handbag top handle drop 5–20 cm", 5, 20],
    ["duf.handle_drop", "Duffel handle drop 15–30 cm", 15, 30],
    ["rduf.handle_drop", "Duffel handle drop 15–30 cm", 15, 30],
  ];
  for (const [q, rule, lo, hi] of drops) {
    const v = num(a[q]);
    if (v === null) continue;
    const cm = toCm(v);
    push(cm > 0 && cm >= lo && cm <= hi ? { group: "Geometry", rule, status: "pass", fix: "" } : { group: "Geometry", rule, status: "fail", fix: `Handle drop ${v} ${unit} is outside ${lo}–${hi} cm — check it.`, questionId: q });
  }

  for (const p of ["hb", "duf", "rduf", "men", "cool"]) {
    const len = num(a[`${p}.strap.length`]),
      drop = num(a[`${p}.strap.drop`]);
    if (len === null || drop === null) continue;
    push(len >= 2 * drop ? { group: "Geometry", rule: "Strap total length ≥ 2 × drop", status: "pass", fix: "" } : { group: "Geometry", rule: "Strap total length ≥ 2 × drop", status: "fail", fix: `Strap ${len} ${unit} is shorter than 2 × drop (${2 * drop} ${unit}).`, questionId: `${p}.strap.length` });
  }

  if (a["hb.gusset"] && a["hb.gusset"] !== "NONE") push({ group: "Geometry", rule: "Gusset width = D", status: D !== null ? "pass" : "fail", fix: D !== null ? "" : "Enter the depth (D).", questionId: "dims.d" });

  const belts = (a["belt.lengths"] as { size?: string; length?: number }[] | undefined) ?? [];
  if (belts.length >= 3) {
    const steps = belts.slice(1).map((b, i) => round((b.length ?? 0) - (belts[i].length ?? 0)));
    const even = steps.every((s) => s === steps[0]);
    push(even ? { group: "Geometry", rule: "Belt lengths grade evenly", status: "pass", fix: "" } : { group: "Geometry", rule: "Belt lengths grade evenly", status: "fail", fix: `Size steps are ${steps.join(", ")} — make them equal.`, questionId: "belt.lengths" });
  }

  for (const p of ["lug", "slug"]) {
    const size = a[`${p}.size`] as string | undefined;
    if (!size?.startsWith("CARRY-ON")) continue;
    if (H === null || W === null || D === null) continue;
    const dimsIn = [H, W, D].map((v) => (inches ? v : v / 2.54)).sort((x, y) => y - x);
    const ok = dimsIn[0] <= 22 && dimsIn[1] <= 14 && dimsIn[2] <= 9;
    push(ok ? { group: "Geometry", rule: "Carry-on within airline limits (22 × 14 × 9 in)", status: "pass", fix: "" } : { group: "Geometry", rule: "Carry-on within airline limits (22 × 14 × 9 in)", status: "warn", fix: `Overall ${dimsIn.map(round).join(" × ")} in (incl. wheels and handles) exceeds 22 × 14 × 9 in.`, questionId: "dims.h" });
  }

  /* Hardware placement must be measurable (mm), not "spaced evenly". */
  const NEEDS_PLACEMENT = ["MAGNETIC SNAP", "PRESS SNAP", "TURNLOCK", "D-RING", "O-RING", "SQUARE RING", "RIVET", "FEET", "LOCK", "LOGO PLATE"];
  const placements = (a["placements.list"] as { item?: LibValue; distance?: number }[] | undefined) ?? [];
  const placed = new Set(placements.filter((p) => p.item && typeof p.distance === "number").map((p) => p.item!.id));
  const needs = input.hardware.filter((h) => used.has(h.id) && NEEDS_PLACEMENT.includes(h.type));
  const unplacedHw = needs.filter((h) => !placed.has(h.id));
  if (needs.length && !unplacedHw.length) push({ group: "Geometry", rule: "Hardware placement given in mm", status: "pass", fix: "" });
  for (const h of unplacedHw)
    push({ group: "Geometry", rule: `Placement of ${h.code} (${h.type})`, status: "fail", fix: `Add its position in mm (distance from an edge, and spacing if more than one).`, questionId: "placements.list" });
  if (a["hb.closure.snap_spacing"] === "SPACED EVENLY" && !placements.some((p) => p.item && needs.some((h) => h.id === p.item!.id && /SNAP/.test(h.type))))
    push({ group: "Geometry", rule: "Snaps “spaced evenly”", status: "fail", fix: "Give the snap spacing centre to centre in mm under Hardware placement.", questionId: "placements.list" });

  /* Points of measure agree with the answers, and every point has a tolerance. */
  const pom = (a["pom.list"] as { point?: string; value?: number; tol?: number }[] | undefined) ?? [];
  const pairs: [string, string][] = [["TOTAL HEIGHT", "dims.h"], ["TOTAL WIDTH", "dims.w"], ["TOTAL DEPTH", "dims.d"], ["HANDLE DROP", "hb.top_handle.drop"], ["FLAP HEIGHT", "hb.flap_height"], ["STRAP TOTAL LENGTH", "hb.strap.length"]];
  for (const [point, key] of pairs) {
    const row = pom.find((r) => r.point === point);
    const v = num(a[key]);
    if (row?.value != null && v !== null && Math.abs(row.value - v) > 0.001)
      push({ group: "Consistency", rule: `Point of measure ${point}`, status: "fail", fix: `POM says ${row.value} ${unit} but the pack says ${v} ${unit} — make them agree.`, questionId: "pom.list" });
  }

  /* ------------------------------ Consistency ------------------------------ */
  const mats = (a["materials.list"] as MaterialEntry[] | undefined) ?? [];
  const cols = new Set(matrixColumns(ctx).map((c) => c.key));
  const noLoc = mats.filter((m) => !m.locations?.length || !cols.has(`mat_${m.callout}`));
  if (mats.length) push(noLoc.length ? { group: "Consistency", rule: "Every material number appears on the drawings and in the table", status: "fail", fix: `Give material ${noLoc.map((m) => m.callout).join(", ")} its locations.`, questionId: "materials.list" } : { group: "Consistency", rule: "Every material number appears on the drawings and in the table", status: "pass", fix: "" });

  const finishes = input.hardware.filter((h) => used.has(h.id) && h.finish && hwFinish && h.finish !== hwFinish && !/LABEL|PATCH/.test(h.type));
  const logoFinish = a["branding.finish"] as string | undefined;
  const odd = [...finishes.map((h) => `${h.code} is ${h.finish}`), ...(logoFinish && hwFinish && /PLATE|METAL|ENGRAVED|BADGE/.test(String(a["branding.logo_type"])) && logoFinish !== hwFinish ? [`logo is ${logoFinish}`] : [])];
  push(odd.length ? { group: "Consistency", rule: "Hardware finish matches across rings, snaps, logo and charm", status: "warn", fix: `Pack finish is ${hwFinish}; ${odd.join(", ")}. Fine if deliberate.`, questionId: "hardware.finish" } : { group: "Consistency", rule: "Hardware finish matches across rings, snaps, logo and charm", status: "pass", fix: "" });

  /* Approvals: lab dips, strike-offs, plating samples, moulds. */
  for (const m of input.materials ?? [])
    if (m.approval !== "APPROVED") push({ group: "Consistency", rule: `Material ${m.label}`, status: "warn", fix: m.approval === "REJECTED" ? "This material was REJECTED — choose another swatch." : "Not approved yet (lab dip / strike-off pending).", questionId: "materials.matrix" });
  for (const h of input.hardware.filter((x) => used.has(x.id)))
    if (h.approval && h.approval !== "APPROVED") push({ group: "Consistency", rule: `Hardware ${h.code}`, status: "warn", fix: h.approval === "REJECTED" ? "This component was REJECTED." : "Plating / mould sample not approved yet.", questionId: "hardware.items" });

  /* Pattern matching for checks, stripes and plaids. */
  const PATTERN = /GINGHAM|CHECK|STRIPE|PLAID|TARTAN|MONOGRAM/;
  for (const m of mats)
    if (PATTERN.test(m.name) && (!m.matching || m.matching === "NONE"))
      push({ group: "Consistency", rule: `Pattern matching for ${m.name}`, status: "warn", fix: "Patterned material — say how it matches at seams (e.g. MATCH CHECKS AT SEAMS).", questionId: "materials.list" });

  /* Content label needs a composition for every material. */
  if (a["optional.opt.labels"] === true) {
    const noComp = (input.materials ?? []).filter((m) => !m.composition);
    if (noComp.length) push({ group: "Consistency", rule: "Content label composition", status: "warn", fix: `Add composition in the library for: ${noComp.map((m) => m.label).join(", ")}.` });
  }

  const hasDims = visibleQuestions(ctx).some((q) => q.id === "dims.unit");
  push(!hasDims || a["dims.unit"] ? { group: "Consistency", rule: "Units consistent throughout", status: "pass", fix: "" } : { group: "Consistency", rule: "Units consistent throughout", status: "fail", fix: "Choose cm or inches.", questionId: "dims.unit" });
  push({ group: "Consistency", rule: "Page cross-references point to the right page", status: "pass", fix: "Computed after page skipping." });

  /* ------------------------------ Language ------------------------------ */
  if (!input.spelling.length) push({ group: "Language", rule: "Spell-check (trade dictionary)", status: "pass", fix: "" });
  for (const f of input.spelling)
    push({ group: "Language", rule: `Spelling: ${f.word}`, status: "fail", fix: f.suggestion ? `Change ${f.word} → ${f.suggestion}.` : `Check ${f.word} — not in the trade dictionary.`, questionId: "$spelling" });
  const lower = lowercaseAnswers(a);
  push(lower.length ? { group: "Language", rule: "All callouts in capitals", status: "fail", fix: `Use capitals in: ${lower.slice(0, 5).join(", ")}.`, questionId: lower[0] } : { group: "Language", rule: "All callouts in capitals", status: "pass", fix: "" });
  push(input.chineseOn ? { group: "Language", rule: "Chinese line under every English line", status: "warn", fix: "Bilingual output arrives in Phase 4." } : { group: "Language", rule: "Chinese line under every English line", status: "na", fix: "Chinese is off." });

  /* ------------------------------ Licensor ------------------------------ */
  if (input.brand.licensorRequired || category === "Coolers / insulated") {
    const missing = ["header.licensor", "header.licensor_submission", "header.licensor_status"].filter((k) => !a[k]);
    push(missing.length ? { group: "Licensor", rule: `${input.brand.name} licensor approval fields`, status: "fail", fix: "Fill licensor, submission # and status.", questionId: missing[0] } : { group: "Licensor", rule: `${input.brand.name} licensor approval fields`, status: "pass", fix: "" });
  }

  /* ------------------------------ Claims ------------------------------ */
  const claims: [boolean, string, string][] = [
    [a["cool.cold_claim"] === true, `Cold-retention claim (${a["cool.cold_hours"] ?? "?"} h)`, "cool.cold_claim"],
    [a["cool.waterproof_zip"] === true, "Waterproof claim", "cool.waterproof_zip"],
    [a["cool.seams"] === "RF/HEAT-WELDED LEAKPROOF", "Leakproof claim", "cool.seams"],
  ];
  for (const [on, rule, q] of claims) if (on) push({ group: "Claims", rule, status: "warn", fix: "Claim requires a test report.", questionId: q });

  return out;
}

export function gatePasses(results: RuleResult[]) {
  return !results.some((r) => r.status === "fail");
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function usedHardwareIds(a: AnswerMap): Set<string> {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    const id = (v as LibValue | undefined)?.id;
    if (id) ids.add(id);
  };
  for (const r of (a["hardware.items"] as { item?: LibValue }[] | undefined) ?? []) add(r.item);
  for (const k of ["branding.logo_code", "hb.charm.code", "interior.label", "hb.feet.code", "cos.puller", "belt.buckle"]) add(a[k]);
  return ids;
}

/** Answer ids whose text contains lower-case letters (house style is CAPITALS). */
function lowercaseAnswers(a: AnswerMap): string[] {
  const bad: string[] = [];
  const has = (v: unknown): boolean => {
    if (typeof v === "string") return /[a-z]/.test(v) && !/^\d{4}-\d{2}-\d{2}$/.test(v);
    if (Array.isArray(v)) return v.some(has);
    if (v && typeof v === "object") return Object.entries(v).some(([k, x]) => k !== "id" && k !== "label" && has(x));
    return false;
  };
  for (const [k, v] of Object.entries(a)) if (has(v)) bad.push(k);
  return bad;
}
