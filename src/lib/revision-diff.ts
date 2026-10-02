/**
 * Revisions (BRIEF 1.9): the automatic change log between two snapshots of a pack, and which
 * template pages each change appears on (for the red *UPDATED* flags). Pure — no database.
 */
import { findQuestion, unitLabel, type AnswerMap, type Category, type Question } from "@/lib/questions";
import type { PageSection } from "@/lib/page-names";
import type { RevisionChange } from "@/db/schema";

export type Snapshot = { answers: AnswerMap; flats: Record<string, string> };

/** Questions the change log never reports (internal toggles, page plumbing). */
const IGNORE = /^(optional\.|pages\.features$|header\.due_date$)/;

/** Which pages show a question's value. */
export function sectionsForQuestion(qid: string, a: AnswerMap = {}): PageSection[] {
  const p = (...s: PageSection[]) => s;
  if (qid.startsWith("flat:")) return qid === "flat:SIDE" ? p("MEASUREMENTS SHEET") : qid === "flat:BACK" ? p("MATERIALS / HARDWARE") : p("MATERIALS / HARDWARE", "MEASUREMENTS SHEET");
  if (qid.startsWith("dims.")) return p("MATERIALS / HARDWARE", "PRODUCT FEATURES", "MEASUREMENTS SHEET");
  if (qid.startsWith("header.") || qid.startsWith("colorways.")) return p("MATERIALS / HARDWARE");
  if (qid.startsWith("branding.")) {
    if (qid === "branding.offset" || qid === "branding.offset_edge") return p("MEASUREMENTS SHEET");
    if (qid === "branding.logo_size" || qid === "branding.tool_depth" || qid === "branding.artwork" || qid === "branding.new_tooling") return p("HARDWARE / BRANDING DETAIL");
    return p("MATERIALS / HARDWARE", "MEASUREMENTS SHEET");
  }
  if (qid.startsWith("materials.")) return p("MATERIALS / HARDWARE", "SWATCH CARDS");
  if (qid.startsWith("hardware.")) return p("MATERIALS / HARDWARE", "HARDWARE / BRANDING DETAIL");
  if (qid.startsWith("edge.")) return p("MATERIALS / HARDWARE", "CONSTRUCTION DETAILS");
  if (qid.startsWith("construction.")) return p("CONSTRUCTION DETAILS");
  if (qid.startsWith("interior.")) return p("INTERIOR & LINING");
  if (qid.startsWith("pom.") || qid.startsWith("placements.")) return p("MEASUREMENTS SHEET");
  if (qid.startsWith("zippers.") || qid.startsWith("bom.") || qid.startsWith("opt.labels")) return p("BILL OF MATERIALS");
  if (qid === "comments.list") {
    const pages = ((a["comments.list"] as { pages?: string[] }[] | undefined) ?? []).flatMap((c) => c.pages ?? []);
    return [...new Set(pages)] as PageSection[];
  }
  if (/\.(drop|flap_height|flap_overhang|gusset|closure|strap|top_handle|handle_length|handle_drop|size_)/.test(qid) || /\.strap\.|\.top_handle\./.test(qid)) return p("MEASUREMENTS SHEET", "MATERIALS / HARDWARE");
  return p("MATERIALS / HARDWARE");
}

const isLib = (v: unknown): v is { id: string; label: string } => !!v && typeof v === "object" && "label" in (v as object) && "id" in (v as object);

/** A value as it would read on the pack (CAPITALS, units). */
export function formatValue(v: unknown, q?: Question, a: AnswerMap = {}): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "YES" : "NO";
  if (typeof v === "number") {
    const unit = q && "unit" in q ? unitLabel(String(q.unit), a) : "";
    return `${Math.round(v * 100) / 100}${unit ? ` ${unit.toUpperCase()}` : ""}`;
  }
  if (typeof v === "string") return v.toUpperCase();
  if (isLib(v)) return v.label.toUpperCase();
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" && x && !isLib(x) ? "…" : formatValue(x))).join(", ") : "—";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("w" in o || "h" in o) return `${formatValue(o.w)} × ${formatValue(o.h)}${q && "unit" in q ? ` ${unitLabel(String(q.unit), a).toUpperCase()}` : ""}`;
    if ("url" in o) return String(o.name ?? "FILE").toUpperCase();
  }
  return JSON.stringify(v).toUpperCase();
}

const same = (x: unknown, y: unknown) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);

/** The change log from `before` to `after`, one entry per changed value (row-level for tables). */
export function diffSnapshots(before: Snapshot, after: Snapshot, category: Category): RevisionChange[] {
  const out: RevisionChange[] = [];
  const a0 = before.answers,
    a1 = after.answers;
  const keys = [...new Set([...Object.keys(a0), ...Object.keys(a1)])].filter((k) => !IGNORE.test(k)).sort();
  for (const k of keys) {
    if (same(a0[k], a1[k])) continue;
    const q = findQuestion(category, k);
    const label = (q?.label ?? k).replace(/^★\s*/, "").toUpperCase();
    const sections = sectionsForQuestion(k, a1);
    const v0 = a0[k],
      v1 = a1[k];
    if (Array.isArray(v0) || Array.isArray(v1)) {
      const r0 = (v0 as unknown[] | undefined) ?? [],
        r1 = (v1 as unknown[] | undefined) ?? [];
      if (r0.every((x) => typeof x !== "object" || isLib(x)) && r1.every((x) => typeof x !== "object" || isLib(x))) {
        out.push({ questionId: k, label, before: formatValue(v0, q, a0), after: formatValue(v1, q, a1), sections });
        continue;
      }
      const cols = q && q.kind === "rows" ? q.columns : [];
      for (let i = 0; i < Math.max(r0.length, r1.length); i++) {
        const x = r0[i] as Record<string, unknown> | undefined,
          y = r1[i] as Record<string, unknown> | undefined;
        if (same(x, y)) continue;
        const name = `${label} ${i + 1}`;
        if (!x) out.push({ questionId: k, label: name, before: "—", after: "ADDED", sections });
        else if (!y) out.push({ questionId: k, label: name, before: "", after: "REMOVED", sections });
        else
          for (const f of [...new Set([...Object.keys(x), ...Object.keys(y)])]) {
            if (same(x[f], y[f])) continue;
            const col = cols.find((c) => c.key === f);
            const cq = col && col.kind === "stepper" ? ({ unit: col.unit } as Question) : undefined;
            out.push({ questionId: k, label: `${name} ${(col?.label ?? f).toUpperCase()}`, before: formatValue(x[f], cq, a0), after: formatValue(y[f], cq, a1), sections });
          }
      }
      continue;
    }
    if (k === "materials.matrix" && v0 && v1 && typeof v0 === "object" && typeof v1 === "object") {
      const m0 = v0 as Record<string, Record<string, { lib?: { label: string }; text?: string }>>,
        m1 = v1 as typeof m0;
      for (const cw of [...new Set([...Object.keys(m0), ...Object.keys(m1)])])
        for (const col of [...new Set([...Object.keys(m0[cw] ?? {}), ...Object.keys(m1[cw] ?? {})])]) {
          const c0 = m0[cw]?.[col],
            c1 = m1[cw]?.[col];
          if (same(c0, c1)) continue;
          const txt = (c?: { lib?: { label: string }; text?: string }) => (c?.lib?.label ?? c?.text ?? "—").toUpperCase();
          out.push({ questionId: k, label: `${cw} ${col.replace(/^mat_/, "MATERIAL #").replace(/_/g, " ").toUpperCase()}`, before: txt(c0), after: txt(c1), sections });
        }
      continue;
    }
    out.push({ questionId: k, label, before: formatValue(v0, q, a0), after: formatValue(v1, q, a1), sections });
  }
  for (const view of [...new Set([...Object.keys(before.flats), ...Object.keys(after.flats)])].sort()) {
    if (before.flats[view] === after.flats[view]) continue;
    out.push({ questionId: `flat:${view}`, label: `${view} VIEW FLAT`, before: before.flats[view] ? "" : "—", after: after.flats[view] ? (before.flats[view] ? "REDRAWN" : "ADDED") : "REMOVED", sections: sectionsForQuestion(`flat:${view}`) });
  }
  return out;
}

/** One change-log line, e.g. "STRAP TOTAL LENGTH: 120 CM → 125 CM". */
export function changeLine(c: RevisionChange) {
  if (c.after === "ADDED" || c.after === "REMOVED" || c.after === "REDRAWN") return `${c.label} ${c.after}`;
  return `${c.label}: ${c.before} → ${c.after}`;
}
