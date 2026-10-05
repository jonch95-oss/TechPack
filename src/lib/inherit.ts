/**
 * "New from…" / "Start from…" (V2 §3 step 2, §8): which answers a new pack inherits from a base
 * style, by group, and how a new colourway is seeded from an existing one. Pure.
 */
import type { AnswerMap } from "@/lib/questions";

export const INHERIT_GROUPS = [
  { id: "BODY", label: "Body, closure, handles & straps", prefixes: [] as string[] },
  { id: "DIMENSIONS", label: "Size, measurements & points of measure", prefixes: ["dims.", "pom.", "measure."] },
  { id: "MATERIALS", label: "Materials, colours & trims", prefixes: ["materials.", "colorways."] },
  { id: "HARDWARE", label: "Hardware, placements & zips", prefixes: ["hardware.", "placements.", "zippers."] },
  { id: "BRANDING", label: "Logos & embellishments", prefixes: ["branding."] },
  { id: "INTERIOR", label: "Interior & lining", prefixes: ["interior."] },
  { id: "CONSTRUCTION", label: "Construction, edges & stitching", prefixes: ["construction.", "edge.", "opt.stitching.", "opt.reinforcement.", "optional.opt.stitching", "optional.opt.reinforcement"] },
  { id: "BOM", label: "Bill of materials", prefixes: ["bom."] },
  { id: "PACKAGING", label: "Packaging, labels & compliance", prefixes: ["pkg.", "optional.pkg.", "opt.labels.", "opt.packaging.", "opt.testing.", "optional.opt.labels", "optional.opt.packaging", "optional.opt.testing"] },
  { id: "PAGES", label: "Page settings & product features", prefixes: ["pages."] },
  { id: "HEADER", label: "Header (retailer, season, reference sample)", prefixes: ["header."] },
  { id: "COMMENTS", label: "Comments (A, B, C…)", prefixes: ["comments."] },
] as const;
export type InheritGroup = (typeof INHERIT_GROUPS)[number]["id"];

/** Never carried over: the date is the new pack's own. */
const NEVER = new Set(["header.due_date", "header.pack_date"]);

/** The group a question belongs to; everything category-specific (hb.*, lug.* …) is BODY. */
export function inheritGroupOf(questionId: string): InheritGroup {
  for (const g of INHERIT_GROUPS) if (g.prefixes.some((p) => questionId.startsWith(p))) return g.id;
  return "BODY";
}

/** By default every group but the comments comes across. */
export const DEFAULT_GROUPS: InheritGroup[] = INHERIT_GROUPS.map((g) => g.id).filter((g) => g !== "COMMENTS");

export function inherits(questionId: string, groups: readonly string[]): boolean {
  return !NEVER.has(questionId) && groups.includes(inheritGroupOf(questionId));
}

/**
 * A new colourway pack from an existing style: the colourway rows of the breakdown are seeded from
 * the chosen source colourway (same materials, finishes and trims — the designer changes the colour),
 * and the colourway names / per-colourway files are re-keyed. Anything keyed by the old colourways
 * that has no new counterpart is dropped.
 */
export function reseedColourways(answers: AnswerMap, from: string, to: { code: string; name?: string }[]): AnswerMap {
  const out: AnswerMap = { ...answers };
  const matrix = answers["materials.matrix"] as Record<string, Record<string, unknown>> | undefined;
  if (matrix) out["materials.matrix"] = Object.fromEntries(to.map((c) => [c.code, structuredClone(matrix[from] ?? {})]));
  const names = Object.fromEntries(to.filter((c) => c.name).map((c) => [c.code, c.name!.toUpperCase()]));
  if (Object.keys(names).length) out["colorways.names"] = names;
  else delete out["colorways.names"];
  // Per-colourway text answers follow the same rule: seeded from the source colourway.
  for (const k of ["colorways.pantone", "colorways.print_file"]) {
    const v = answers[k] as Record<string, unknown> | undefined;
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = Object.fromEntries(to.map((c) => [c.code, v[from]]).filter(([, x]) => x != null));
  }
  return out;
}
