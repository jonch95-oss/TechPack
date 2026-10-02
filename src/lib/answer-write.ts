import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { packAnswers, type AnswerStatus } from "@/db/schema";
import { arrivalStatus, resolve, type Conflict, type Incoming, type Origin, type Resolution, type StoredAnswer } from "@/lib/answer-source";

/**
 * The one way answers are written (designer saves, AI pre-fill, uploads, base style). Applies the
 * §2 priority rules from lib/answer-source and records every change in answer_history — each write
 * is a single SQL statement (the answer row and its history line together).
 */
export type CurrentRow = StoredAnswer & { aiValue?: unknown; updatedAt?: Date; updatedBy?: string | null };

export type WriteInput = {
  packId: string;
  questionId: string;
  value: unknown;
  origin: Origin;
  /** Requested status; settled origins arrive "confirmed" unless an estimate status is given. */
  status?: AnswerStatus;
  source?: string;
  note?: string;
  confidence?: string;
  userId: string | null;
  /** The caller merged into the current composite value (hardware rows, breakdown cells). */
  merge?: boolean;
};

export async function currentAnswer(packId: string, questionId: string): Promise<CurrentRow | null> {
  const [row] = await db
    .select({ value: packAnswers.value, origin: packAnswers.origin, status: packAnswers.status, aiValue: packAnswers.aiValue, updatedAt: packAnswers.updatedAt, updatedBy: packAnswers.updatedBy })
    .from(packAnswers)
    .where(and(eq(packAnswers.packId, packId), eq(packAnswers.questionId, questionId)));
  return row ?? null;
}

const j = (v: unknown) => sql`${JSON.stringify(v ?? null)}::jsonb`;
const ts = (d: Date) => sql`${d.toISOString()}::timestamptz`;

/**
 * Writes one answer under the priority rules. Pass `current` when the caller already loaded it
 * (saves a query); undefined = look it up. Returns what happened.
 */
export async function writeAnswer(w: WriteInput, current?: CurrentRow | null): Promise<Resolution["action"] | "clear"> {
  const cur = current === undefined ? await currentAnswer(w.packId, w.questionId) : current;
  const incoming: Incoming = { value: w.value, origin: w.origin, status: arrivalStatus(w.origin, w.status), source: w.source, note: w.note };
  const now = new Date();
  const user = w.userId;

  // A person clearing a value deletes it (history keeps the last one).
  if (w.origin === "DESIGNER" && isBlank(w.value)) {
    if (!cur) return "skip";
    await db.execute(sql`
      WITH gone AS (DELETE FROM pack_answers WHERE pack_id = ${w.packId} AND question_id = ${w.questionId} RETURNING value, origin, status, source)
      INSERT INTO answer_history (pack_id, question_id, value, origin, status, source, action, user_id, at)
      SELECT ${w.packId}, ${w.questionId}, value, origin, status, source, 'clear', ${user}, ${ts(now)} FROM gone`);
    return "clear";
  }

  const r = resolve(cur, incoming, { merge: w.merge });
  if (r.action === "skip") return "skip";

  if (r.action === "conflict") {
    const c: Conflict = { ...r.conflict, at: now.toISOString() };
    await db.execute(sql`
      WITH up AS (UPDATE pack_answers SET conflict = ${j(c)} WHERE pack_id = ${w.packId} AND question_id = ${w.questionId} RETURNING 1)
      INSERT INTO answer_history (pack_id, question_id, value, origin, status, source, action, user_id, at)
      SELECT ${w.packId}, ${w.questionId}, ${j(w.value)}, ${w.origin}::answer_origin, ${incoming.status}::answer_status, ${w.source ?? ""}, 'conflict', ${user}, ${ts(now)} FROM up`);
    return "conflict";
  }

  if (r.action === "upgrade") {
    await db.execute(sql`
      WITH up AS (
        UPDATE pack_answers SET origin = ${w.origin}::answer_origin, status = ${incoming.status}::answer_status, source = ${w.source ?? ""},
          conflict = NULL, updated_by = ${user}, updated_at = ${ts(now)}
        WHERE pack_id = ${w.packId} AND question_id = ${w.questionId} RETURNING value)
      INSERT INTO answer_history (pack_id, question_id, value, origin, status, source, action, user_id, at)
      SELECT ${w.packId}, ${w.questionId}, value, ${w.origin}::answer_origin, ${incoming.status}::answer_status, ${w.source ?? ""}, 'upgrade', ${user}, ${ts(now)} FROM up`);
    return "upgrade";
  }

  // write: a person overriding an AI suggestion keeps what the AI first said (aiValue).
  const fromAi = w.origin === "AI" || w.origin === "TEMPLATE" || w.origin === "SPEC";
  const aiValue = fromAi ? w.value : cur && cur.status !== "confirmed" ? cur.value : (cur?.aiValue ?? null);
  const note = w.origin === "DESIGNER" || w.origin === "DERIVED" ? null : (w.note ?? "");
  await db.execute(sql`
    WITH up AS (
      INSERT INTO pack_answers (pack_id, question_id, value, status, origin, source, ai_note, ai_value, confidence, conflict, updated_by, updated_at)
      VALUES (${w.packId}, ${w.questionId}, ${j(w.value)}, ${incoming.status}::answer_status, ${w.origin}::answer_origin, ${w.source ?? ""},
        ${note ?? ""}, ${j(aiValue)}, ${w.confidence ?? ""}, NULL, ${user}, ${ts(now)})
      ON CONFLICT (pack_id, question_id) DO UPDATE SET value = EXCLUDED.value, status = EXCLUDED.status, origin = EXCLUDED.origin,
        source = EXCLUDED.source, ai_note = ${note === null ? sql`pack_answers.ai_note` : sql`EXCLUDED.ai_note`}, ai_value = EXCLUDED.ai_value,
        confidence = EXCLUDED.confidence, conflict = NULL, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
      RETURNING value)
    INSERT INTO answer_history (pack_id, question_id, value, origin, status, source, action, user_id, at)
    SELECT ${w.packId}, ${w.questionId}, value, ${w.origin}::answer_origin, ${incoming.status}::answer_status, ${w.source ?? ""}, 'write', ${user}, ${ts(now)} FROM up`);
  return "write";
}

/** Keep the current value: the conflict chip goes away. */
export async function keepCurrent(packId: string, questionId: string, userId: string) {
  const now = new Date();
  await db.execute(sql`
    WITH up AS (UPDATE pack_answers SET conflict = NULL WHERE pack_id = ${packId} AND question_id = ${questionId} AND conflict IS NOT NULL RETURNING value, origin, status, source)
    INSERT INTO answer_history (pack_id, question_id, value, origin, status, source, action, user_id, at)
    SELECT ${packId}, ${questionId}, value, origin, status, source, 'keep', ${userId}, ${ts(now)} FROM up`);
}

/** Switch to the conflicting value: a person chose it, so it is settled (and keeps its origin tag). */
export async function switchToConflict(packId: string, questionId: string, userId: string): Promise<boolean> {
  const now = new Date();
  const rows = await db.execute(sql`
    WITH up AS (
      UPDATE pack_answers SET value = conflict->'value', origin = (conflict->>'origin')::answer_origin, source = coalesce(conflict->>'source', ''),
        ai_note = coalesce(conflict->>'note', ''), status = 'confirmed', conflict = NULL, updated_by = ${userId}, updated_at = ${ts(now)}
      WHERE pack_id = ${packId} AND question_id = ${questionId} AND conflict IS NOT NULL RETURNING value, origin, source)
    INSERT INTO answer_history (pack_id, question_id, value, origin, status, source, action, user_id, at)
    SELECT ${packId}, ${questionId}, value, origin, 'confirmed', source, 'switch', ${userId}, ${ts(now)} FROM up RETURNING 1`);
  return rows.length > 0;
}

/** Settles answers (one, a group, or everything from one upload): status → confirmed. */
export async function confirmAnswers(packId: string, questionIds: string[], userId: string): Promise<string[]> {
  if (!questionIds.length) return [];
  const now = new Date();
  const ids = sql.join(questionIds.map((q) => sql`${q}`), sql`, `);
  const rows = await db.execute<{ question_id: string }>(sql`
    WITH up AS (
      UPDATE pack_answers SET status = 'confirmed', updated_by = ${userId}, updated_at = ${ts(now)}
      WHERE pack_id = ${packId} AND question_id IN (${ids}) AND status <> 'confirmed' RETURNING question_id, value, origin, source)
    INSERT INTO answer_history (pack_id, question_id, value, origin, status, source, action, user_id, at)
    SELECT ${packId}, question_id, value, origin, 'confirmed', source, 'confirm', ${userId}, ${ts(now)} FROM up RETURNING question_id`);
  return rows.map((r) => r.question_id);
}

function isBlank(v: unknown) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
}
