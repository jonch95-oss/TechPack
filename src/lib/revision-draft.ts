/**
 * Revisions inbox (V2 §9): factory comments (pasted text or an email) drafted by the AI into proposed
 * answer changes, each linked to the comment it came from. The designer approves item by item; an
 * approved change is an ordinary answer change, so the next export issues R(n) with *UPDATED* flags.
 * Pure: schema, instructions and clean-up.
 */
import { findQuestion, type AnswerMap } from "@/lib/questions";
import type { Category } from "@/lib/questions/types";
import { visibleQuestions } from "@/lib/questions";

export const DRAFT_REVISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["changes", "unmapped", "agent_notes"],
  properties: {
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["comment", "question_id", "value_json", "note"],
        properties: {
          comment: { type: "string", description: "The factory comment this change answers, quoted as written." },
          question_id: { type: "string" },
          value_json: { type: "string", description: "The new value as JSON, in the question's own form." },
          note: { type: "string", description: "Why, in CAPITALS (e.g. PER FACTORY: STRAP TOO SHORT)." },
        },
      },
    },
    unmapped: { type: "array", items: { type: "string" }, description: "Comments that change nothing in the pack's answers (questions to the factory, praise, logistics)." },
    agent_notes: { type: "string" },
  },
} as const;

export type DraftRevisionOutput = {
  changes: { comment: string; question_id: string; value_json: string; note: string }[];
  unmapped: string[];
  agent_notes: string;
};

export function buildDraftInstructions(category: Category, answers: AnswerMap, text: string): string {
  const qs = visibleQuestions({ category, answers }).map((q) => ({ id: q.id, label: q.label, kind: q.kind, ...("options" in q ? { options: q.options } : {}), current: answers[q.id] ?? null }));
  return [
    "Factory comments on a sample are below. Draft the changes they ask for as answer changes to this tech pack.",
    "Rules: one change per question; quote the comment it comes from; never invent a measurement the comment doesn't give (\"MAKE STRAP LONGER\" with no number is unmapped, not a guess); keep option strings exactly as given.",
    "Comments that ask a question, praise the sample or are about logistics go in unmapped.",
    "",
    "FACTORY COMMENTS:",
    text,
    "",
    "QUESTIONS (with the current answer):",
    JSON.stringify(qs),
  ].join("\n");
}

export type Proposal = { comment: string; questionId: string; value: unknown; note: string };

/** Changes kept only for questions the pack asks, with a value that parses and differs from today's. */
export function normaliseDraft(category: Category, answers: AnswerMap, out: DraftRevisionOutput): { proposals: Proposal[]; unmapped: string[]; dropped: string[] } {
  const proposals: Proposal[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();
  for (const c of out.changes ?? []) {
    if (!findQuestion(category, c.question_id) || seen.has(c.question_id)) {
      dropped.push(c.question_id);
      continue;
    }
    let value: unknown;
    try {
      value = JSON.parse(c.value_json);
    } catch {
      dropped.push(c.question_id);
      continue;
    }
    if (value == null || JSON.stringify(value) === JSON.stringify(answers[c.question_id])) continue;
    seen.add(c.question_id);
    proposals.push({ comment: String(c.comment ?? "").trim().toUpperCase(), questionId: c.question_id, value: typeof value === "string" ? value.toUpperCase() : value, note: String(c.note ?? "").trim().toUpperCase() });
  }
  return { proposals, unmapped: (out.unmapped ?? []).map((u) => String(u).trim().toUpperCase()).filter(Boolean), dropped };
}
