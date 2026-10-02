/**
 * The REVIEW screen (V2 brief §3 step 3): one compact spec sheet instead of the 22-section scroll.
 * Answers are grouped Body / Closure / Handles & straps / Pockets & zips / Branding / Hardware /
 * Interior / Materials & colours; within a group, rows that need attention (conflicts, low
 * confidence, unconfirmed) come first. Pure, so it is unit-tested.
 */
import type { AnswerStatus } from "@/db/schema";

export const REVIEW_GROUPS = ["Body", "Closure", "Handles & straps", "Pockets & zips", "Branding", "Hardware", "Interior", "Materials & colours", "Other"] as const;
export type ReviewGroup = (typeof REVIEW_GROUPS)[number];

export function groupOf(qid: string): ReviewGroup {
  if (/^branding\./.test(qid)) return "Branding";
  if (/^(hardware|placements)\./.test(qid) || /\.(feet|charm|id_tag|lock|wheels?|trolley)/.test(qid)) return "Hardware";
  if (/^interior\.|lining/.test(qid)) return "Interior";
  if (/^(materials|colorways|edge)\.|thread_colour/.test(qid)) return "Materials & colours";
  if (/pocket|^zippers\.|zip/.test(qid)) return "Pockets & zips";
  if (/handle|strap|grab|carry/.test(qid)) return "Handles & straps";
  if (/closure|flap|snap|turnlock|magnet/.test(qid)) return "Closure";
  if (/^dims\.|silhouette|shape|gusset|base|structure|quilt|size|capacity|panel/.test(qid)) return "Body";
  return "Other";
}

export type ReviewRow = { id: string; group: ReviewGroup; status?: AnswerStatus; confidence?: string; conflict: boolean; answered: boolean; required: boolean };

/** Needs a look first: a conflict, then low confidence, then anything unconfirmed. */
export function attention(r: ReviewRow): number {
  if (r.conflict) return 3;
  if (r.status && r.status !== "confirmed" && r.confidence === "low") return 2;
  if (r.status && r.status !== "confirmed") return 1;
  if (r.required && !r.answered) return 1;
  return 0;
}

export function orderRows(rows: ReviewRow[]): ReviewRow[] {
  const byGroup = (g: ReviewGroup) => REVIEW_GROUPS.indexOf(g);
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => byGroup(a.r.group) - byGroup(b.r.group) || attention(b.r) - attention(a.r) || a.i - b.i)
    .map((x) => x.r);
}

/**
 * Which rows a bulk confirm may settle. Conflicts and low-confidence rows are never bulk-confirmed.
 * "All visible" takes only values read from the render itself (status ai — not EST or INFERRED, not
 * an upload) whose confidence is high (or not given, until AI v2 reports confidence on every value).
 */
export function bulkConfirmable(rows: ReviewRow[], scope: { group?: ReviewGroup; allVisible?: boolean }, sourceOf: (id: string) => string = () => ""): string[] {
  return rows
    .filter((r) => r.status && r.status !== "confirmed" && !r.conflict && r.confidence !== "low")
    .filter((r) => (scope.group ? r.group === scope.group : true))
    .filter((r) => (scope.allVisible ? r.status === "ai" && !sourceOf(r.id) && (r.confidence === "high" || !r.confidence) : true))
    .map((r) => r.id);
}
