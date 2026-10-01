import { COMMON_SECTIONS } from "./common";
import { CATEGORY_SECTIONS } from "./categories";
import type {
  AnswerMap,
  Category,
  Condition,
  Dims2Value,
  MaterialEntry,
  MatrixValue,
  Question,
  RowsQ,
  Section,
} from "./types";

export * from "./types";

export type EvalContext = {
  category: Category;
  answers: AnswerMap;
  brand?: { licensorRequired: boolean } | null;
};

/** Sections for a category: common header/dims/colorways/materials… then category block, then comments + optional. */
export function sectionsFor(category: Category): Section[] {
  const common = COMMON_SECTIONS;
  const head = common.filter((s) => ["header", "dims", "colorways"].includes(s.id));
  const body = common.filter((s) => ["materials", "branding", "edge", "hardware", "interior"].includes(s.id));
  const tail = common.filter((s) => !["header", "dims", "colorways", "materials", "branding", "edge", "hardware", "interior"].includes(s.id));
  return [...head, ...CATEGORY_SECTIONS[category], ...body, ...tail];
}

export function allQuestions(category: Category): Question[] {
  return sectionsFor(category).flatMap((s) => s.questions);
}

export function findQuestion(category: Category, id: string): Question | undefined {
  return allQuestions(category).find((q) => q.id === id);
}

export function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("w" in o && "h" in o) return o.w == null && o.h == null;
    return Object.keys(o).length === 0;
  }
  return false;
}

function answerOf(ctx: EvalContext, q: string): unknown {
  if (q === "$brand.licensorRequired") return ctx.brand?.licensorRequired ?? false;
  return ctx.answers[q];
}

export function evalCondition(c: Condition | undefined, ctx: EvalContext): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every((x) => evalCondition(x, ctx));
  if ("any" in c) return c.any.some((x) => evalCondition(x, ctx));
  if ("category" in c) return c.category.includes(ctx.category);
  const v = answerOf(ctx, c.q);
  if ("eq" in c) return v === c.eq;
  if ("in" in c) return c.in.includes(v);
  if ("truthy" in c) return !isEmpty(v) && v !== false && v !== "NONE";
  if ("includes" in c) return Array.isArray(v) && v.includes(c.includes);
  return true;
}

export function optionalToggleId(sectionId: string) {
  return `optional.${sectionId}`;
}

export function sectionVisible(s: Section, ctx: EvalContext) {
  if (s.optional && ctx.answers[optionalToggleId(s.id)] !== true) return false;
  return evalCondition(s.showIf, ctx);
}

/**
 * A question is visible when its section and its own condition pass, and every question it
 * depends on (its parent in the chain) is itself visible.
 */
export function visibleQuestions(ctx: EvalContext): Question[] {
  const out: Question[] = [];
  const visibleIds = new Set<string>();
  for (const s of sectionsFor(ctx.category)) {
    if (!sectionVisible(s, ctx)) continue;
    for (const q of s.questions) {
      const parent = q.showIf && "q" in q.showIf ? q.showIf.q : null;
      if (parent && !parent.startsWith("$") && !visibleIds.has(parent) && allQuestionIds(ctx.category).has(parent)) continue;
      if (!evalCondition(q.showIf, ctx)) continue;
      visibleIds.add(q.id);
      out.push(q);
    }
  }
  return out;
}

const idCache = new Map<Category, Set<string>>();
function allQuestionIds(category: Category) {
  let s = idCache.get(category);
  if (!s) {
    s = new Set(allQuestions(category).map((q) => q.id));
    idCache.set(category, s);
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Colorway matrix                                                     */
/* ------------------------------------------------------------------ */

export type MatrixColumn = { key: string; label: string; lib?: "material" | "print"; callout?: number };

export function hasZipper(ctx: EvalContext): boolean {
  const a = ctx.answers;
  if (a["hb.closure"] === "TOP ZIP") return true;
  if (!isEmpty(a["cos.zip_size"])) return true;
  if (!isEmpty(a["duf.zip_size"]) || !isEmpty(a["rduf.zip_size"])) return true;
  if (["Hardside luggage", "Softside luggage", "Duffels", "Rolling duffels", "Cosmetic bags", "Toiletry kits", "Packing cubes"].includes(ctx.category))
    return true;
  const items = (a["hardware.items"] as { item?: { label?: string } }[] | undefined) ?? [];
  return items.some((r) => /ZIPPER(?! PULL)/i.test(r.item?.label ?? ""));
}

export function matrixColumns(ctx: EvalContext): MatrixColumn[] {
  const mats = (ctx.answers["materials.list"] as MaterialEntry[] | undefined) ?? [];
  const cols: MatrixColumn[] = mats.map((m) => ({ key: `mat_${m.callout}`, label: m.name || `MATERIAL ${m.callout}`, lib: "material", callout: m.callout }));
  const interior = sectionsFor(ctx.category).some((s) => s.id === "interior" && evalCondition(s.showIf, ctx));
  if (interior) cols.push({ key: "lining", label: "LINING", lib: "print" });
  cols.push({ key: "edge_paint", label: "EDGE PAINT" });
  if (hasZipper(ctx)) cols.push({ key: "zipper", label: "ZIPPER (TAPE + TEETH)" });
  cols.push({ key: "hardware_finish", label: "HARDWARE & SNAP" });
  cols.push({ key: "logo", label: "LOGO" });
  return cols;
}

/* ------------------------------------------------------------------ */
/* Completeness (★ fields) — the Phase 1 slice of the Part 5 gate       */
/* ------------------------------------------------------------------ */

export type Issue = { questionId: string; label: string; problem: string };

export function completeness(
  ctx: EvalContext,
  statuses: Record<string, string>,
  colorways: string[],
): Issue[] {
  const issues: Issue[] = [];
  for (const q of visibleQuestions(ctx)) {
    const v = ctx.answers[q.id];
    const st = statuses[q.id];
    if (q.kind === "derived") continue;
    if (!q.required) {
      if (!isEmpty(v) && st && st !== "confirmed") issues.push({ questionId: q.id, label: q.label, problem: statusProblem(st) });
      continue;
    }
    if (q.kind === "toggle") {
      if (v === undefined || v === null) issues.push({ questionId: q.id, label: q.label, problem: "NOT ANSWERED" });
      else if (st && st !== "confirmed") issues.push({ questionId: q.id, label: q.label, problem: statusProblem(st) });
      continue;
    }
    if (isEmpty(v)) {
      issues.push({ questionId: q.id, label: q.label, problem: "MISSING" });
      continue;
    }
    if (st && st !== "confirmed") {
      issues.push({ questionId: q.id, label: q.label, problem: statusProblem(st) });
      continue;
    }
    if (q.kind === "dims2") {
      const d = v as Dims2Value;
      if (d.w == null || d.h == null) issues.push({ questionId: q.id, label: q.label, problem: "W AND H BOTH REQUIRED" });
    }
    if (q.kind === "rows") {
      const rows = (v as Record<string, unknown>[]) ?? [];
      rows.forEach((r, i) => {
        for (const c of (q as RowsQ).columns) {
          if (!c.required) continue;
          if (c.showIf && !c.showIf.in.includes(String(r[c.showIf.key] ?? ""))) continue;
          if (isEmpty(r[c.key])) issues.push({ questionId: q.id, label: `${q.label} — row ${i + 1}`, problem: `${c.label.toUpperCase()} MISSING` });
        }
      });
    }
    if (q.kind === "colorway_matrix") {
      const m = (v as MatrixValue) ?? {};
      for (const cw of colorways) {
        for (const col of matrixColumns(ctx)) {
          const cell = m[cw]?.[col.key];
          if (!cell || (isEmpty(cell.text) && !cell.lib))
            issues.push({ questionId: q.id, label: `${cw} × ${col.label}`, problem: "CELL BLANK — USE DTM, N/A OR A SWATCH" });
        }
      }
    }
  }
  return issues;
}

function statusProblem(st: string) {
  if (st === "ai") return "AI-SUGGESTED — CONFIRM";
  if (st === "est") return "EST — CONFIRM";
  if (st === "inferred") return "INFERRED — CONFIRM";
  return "UNCONFIRMED";
}

/* ------------------------------------------------------------------ */
/* Derived values                                                      */
/* ------------------------------------------------------------------ */

export function derivedValue(q: Question, ctx: EvalContext): string {
  if (q.kind !== "derived") return "";
  const a = ctx.answers;
  if (q.from === "$capacity") {
    const p = q.id.split(".")[0];
    const l = Number(a[`${p}.size_l`]),
      w = Number(a[`${p}.size_w`]),
      h = Number(a[`${p}.size_h`]);
    if (!l || !w || !h) return "—";
    const unit = a["dims.unit"] === "INCHES" ? "in" : "cm";
    const cm3 = unit === "in" ? l * w * h * 16.387064 : l * w * h;
    return `${(cm3 / 1000).toFixed(1)} L`;
  }
  if (q.from === "$nesting") {
    const rows = (a["cube.set"] as { size?: string; l?: number; w?: number; h?: number }[]) ?? [];
    return rows
      .slice()
      .sort((x, y) => (y.l ?? 0) * (y.w ?? 0) * (y.h ?? 0) - (x.l ?? 0) * (x.w ?? 0) * (x.h ?? 0))
      .map((r) => r.size)
      .join(" > ");
  }
  const v = a[q.from];
  return isEmpty(v) ? "—" : `${v} ${unitLabel(q.unit, a)}`;
}

export function unitLabel(unit: string, answers: AnswerMap): string {
  if (unit === "dim") return answers["dims.unit"] === "INCHES" ? "in" : "cm";
  if (unit === "qty") return "";
  return unit;
}

/* ------------------------------------------------------------------ */
/* Auto-drafted description                                            */
/* ------------------------------------------------------------------ */

export function draftDescription(category: Category, a: AnswerMap): string {
  const parts: string[] = [];
  if (category === "Handbags") {
    const sil = (a["hb.silhouette"] as string) ?? "";
    const strap = a["hb.strap"] === true;
    const lead = strap && sil && !["SHOULDER", "CROSSBODY"].includes(sil) ? `SHOULDER BAG ${sil}` : sil || "HANDBAG";
    parts.push(lead);
    const closure = (a["hb.closure"] as string) ?? "";
    if (closure.startsWith("FLAP")) parts.push("W/ FLAP");
    else if (closure === "TOP ZIP") parts.push("W/ TOP ZIP");
    if (strap) parts.push(parts.length > 1 ? "& LONG SHOULDER STRAP" : "W/ LONG SHOULDER STRAP");
    return parts.join(" ");
  }
  const typeKey: Partial<Record<Category, string>> = {
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
  const k = typeKey[category];
  const t = k ? (a[k] as string) : "";
  return [t, category.toUpperCase()].filter(Boolean).join(" ");
}
