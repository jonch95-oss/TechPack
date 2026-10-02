/**
 * V2 brief §2: every answer has an ORIGIN (where it came from) and a STATUS (whether it is settled),
 * as separate fields. Origins are resolved in priority order, highest first:
 *
 *   DESIGNER > SPEC > BASE STYLE > LIBRARY > HOUSE > TEMPLATE > AI > DERIVED
 *
 * - Settled by origin: DESIGNER, SPEC, BASE_STYLE, LIBRARY, HOUSE, DERIVED (and TEMPLATE structure).
 * - Needs confirming: AI, TEMPLATE numbers and every estimate (status ai / est / inferred / sourced).
 * - A higher-priority value replaces a lower one. A lower-priority AI or SPEC value that disagrees
 *   becomes a CONFLICT (red chip: keep or switch with one click) — it never silently replaces it.
 * - Nothing replaces a DESIGNER value; a value a person confirmed counts as the designer's.
 *
 * Pure (no DB) so the rules are unit-tested; lib/answer-write applies them.
 */
import type { AnswerStatus } from "@/db/schema";

export const ORIGINS = ["DESIGNER", "SPEC", "BASE_STYLE", "LIBRARY", "HOUSE", "TEMPLATE", "AI", "DERIVED"] as const;
export type Origin = (typeof ORIGINS)[number];

const RANK: Record<Origin, number> = { DESIGNER: 8, SPEC: 7, BASE_STYLE: 6, LIBRARY: 5, HOUSE: 4, TEMPLATE: 3, AI: 2, DERIVED: 1 };

/** Short tag shown next to an answer. */
export const ORIGIN_LABEL: Record<Origin, string> = {
  DESIGNER: "Designer",
  SPEC: "Spec",
  BASE_STYLE: "Base style",
  LIBRARY: "Library",
  HOUSE: "House",
  TEMPLATE: "Template",
  AI: "AI",
  DERIVED: "Derived",
};

/** Origins whose values are settled on arrival (no confirm), unless written with an estimate status. */
export const SETTLED_ORIGINS: ReadonlySet<Origin> = new Set(["DESIGNER", "SPEC", "BASE_STYLE", "LIBRARY", "HOUSE", "DERIVED"]);

export type Conflict = { origin: Origin; source: string; value: unknown; note: string; at: string };
export type StoredAnswer = { value: unknown; origin: Origin; status: AnswerStatus };
export type Incoming = { value: unknown; origin: Origin; status: AnswerStatus; source?: string; note?: string };

export const isSettled = (status: AnswerStatus) => status === "confirmed";

/** A needs-confirm value a person has confirmed is theirs: it ranks as DESIGNER. */
export function effectiveRank(a: StoredAnswer) {
  if (a.origin === "DESIGNER") return RANK.DESIGNER;
  if (isSettled(a.status) && !SETTLED_ORIGINS.has(a.origin)) return RANK.DESIGNER;
  return RANK[a.origin];
}

export const rankOf = (o: Origin) => RANK[o];

const empty = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** Order-insensitive for object keys, so a re-read with keys in another order is "the same". */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "string" && typeof b === "string") return a.trim().toUpperCase() === b.trim().toUpperCase();
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object).filter((k) => !empty((a as Record<string, unknown>)[k]));
    const kb = Object.keys(b as object).filter((k) => !empty((b as Record<string, unknown>)[k]));
    return ka.length === kb.length && ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

export type Resolution =
  /** store the incoming value */
  | { action: "write" }
  /** same value, better origin: keep the value, take the incoming origin / status (an AI value a spec proves is settled) */
  | { action: "upgrade" }
  /** keep the current value; record the incoming one as a conflict chip */
  | { action: "conflict"; conflict: Omit<Conflict, "at"> }
  /** nothing to do */
  | { action: "skip" };

/**
 * What to do with an incoming value. `merge` is for composite answers the caller merged itself from
 * the current value (hardware rows, breakdown cells): those keep every designer row and can be written.
 */
export function resolve(current: StoredAnswer | null, incoming: Incoming, opts: { merge?: boolean } = {}): Resolution {
  if (incoming.origin === "DESIGNER") return { action: "write" };
  if (!current || empty(current.value)) return empty(incoming.value) ? { action: "skip" } : { action: "write" };
  if (empty(incoming.value)) return { action: "skip" };
  const have = effectiveRank(current);
  const want = RANK[incoming.origin];
  if (sameValue(current.value, incoming.value)) {
    const upgrades = want > have || (want === have && !isSettled(current.status) && isSettled(incoming.status));
    return upgrades ? { action: "upgrade" } : { action: "skip" };
  }
  if (opts.merge) return { action: "write" }; // the caller merged into the current rows and kept the designer's own
  // Same origin re-read (a newer AI read, a re-uploaded spec): the newer value wins unless a person settled it.
  if (want > have || (want === have && have < RANK.DESIGNER)) return { action: "write" };
  // Lower priority and different: only AI and SPEC reads raise a conflict; defaults never nag.
  if (incoming.origin === "AI" || incoming.origin === "SPEC")
    return { action: "conflict", conflict: { origin: incoming.origin, source: incoming.source ?? "", value: incoming.value, note: incoming.note ?? "" } };
  return { action: "skip" };
}

/** The status an origin arrives with when the writer didn't ask for an estimate. */
export function arrivalStatus(origin: Origin, requested?: AnswerStatus): AnswerStatus {
  if (requested && requested !== "confirmed") return requested; // EST / INFERRED / AI stay needs-confirm
  return SETTLED_ORIGINS.has(origin) ? "confirmed" : origin === "TEMPLATE" ? "est" : "ai";
}
