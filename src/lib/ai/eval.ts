/**
 * Scoring for the golden AI eval (V2.1 §11–12, golden run 2 P2): the AI read of a pack's render
 * against the pack's expected answers. The headline number is CONFIDENT-WRONG on the fields a render
 * can't settle — a wrong value the studio would show as a plain AI suggestion rather than INFERRED.
 * It must be zero. Invented measurements (a number where the original gives none) are counted too.
 */
import type { NormalisedAnswer } from "./analyse-render";
import { renderUnsettled } from "./analyse-render";

export type EvalScore = {
  read: number;
  correct: number;
  wrong: string[];
  /** Wrong and shown as a confident AI suggestion (status "ai") on a render-unsettled field. */
  confidentWrong: string[];
  /** A measurement the original doesn't state. */
  invented: string[];
  /** Not in the original: nothing to score against. */
  unscored: number;
};

const norm = (v: unknown): unknown => {
  if (typeof v === "string") return v.trim().toUpperCase().replace(/\s+/g, " ");
  if (Array.isArray(v)) return v.map(norm).map(String).sort();
  if (v && typeof v === "object" && "label" in (v as object)) return norm((v as { label: unknown }).label);
  return v;
};

/** Same answer? Text ignoring case/spacing, sets ignoring order, numbers within 10 %. */
export function sameAnswer(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= Math.max(0.1 * Math.abs(b), 0.01);
  if (a && b && typeof a === "object" && typeof b === "object" && "w" in (a as object) && "w" in (b as object)) {
    const x = a as { w?: number; h?: number },
      y = b as { w?: number; h?: number };
    return sameAnswer(x.w, y.w) && sameAnswer(x.h, y.h);
  }
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export function scoreRead(read: NormalisedAnswer[], expected: Record<string, unknown>): EvalScore {
  const s: EvalScore = { read: read.length, correct: 0, wrong: [], confidentWrong: [], invented: [], unscored: 0 };
  for (const a of read) {
    const want = expected[a.questionId];
    if (want === undefined || want === null) {
      if (typeof a.value === "number" || (a.value && typeof a.value === "object" && "w" in (a.value as object))) s.invented.push(a.questionId);
      else s.unscored++;
      continue;
    }
    if (sameAnswer(a.value, want)) s.correct++;
    else {
      s.wrong.push(a.questionId);
      if (a.status === "ai" && renderUnsettled(a.questionId)) s.confidentWrong.push(a.questionId);
    }
  }
  return s;
}
