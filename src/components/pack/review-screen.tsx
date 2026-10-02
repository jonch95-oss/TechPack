"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnswerStatus } from "@/db/schema";
import type { EvalContext, Question } from "@/lib/questions";
import { ORIGIN_LABEL, type Origin } from "@/lib/answer-source";
import { REVIEW_GROUPS, bulkConfirmable, groupOf, orderRows, type ReviewGroup, type ReviewRow } from "@/lib/review";
import { Badge, cx } from "@/components/ui";
import { QuestionField } from "./question-field";

type Meta = { aiNote: string; source?: string; origin?: Origin; conflict?: { origin: string; source: string; value: unknown } | null; confidence?: string };

/**
 * REVIEW (V2 brief §3 step 3): the render on the left, a compact spec sheet on the right — one line
 * per answer with its value, source tag and what the AI saw. Bulk "✓ Looks right" per group and
 * "✓ All visible"; conflicts and low-confidence rows are never bulk-confirmed and sit at the top.
 *
 * Keyboard: J / K move · Enter confirms · 1–9 pick the nth option · E edits · O edits (Other) ·
 * / searches · ? shows the shortcuts · Esc closes.
 */
export function ReviewScreen({
  questions,
  answers,
  statuses,
  meta,
  renderUrl,
  ctx,
  colorways,
  unitLabel,
  canEdit,
  onCommit,
  onConfirm,
  onConflict,
  display,
}: {
  questions: Question[];
  answers: Record<string, unknown>;
  statuses: Record<string, AnswerStatus>;
  meta: Record<string, Meta>;
  renderUrl: string | null;
  ctx: EvalContext;
  colorways: string[];
  unitLabel: (u: string) => string;
  canEdit: boolean;
  onCommit: (qid: string, v: unknown) => void;
  onConfirm: (ids: string[]) => void;
  onConflict: (qid: string, choice: "keep" | "switch") => void;
  display: (v: unknown) => string;
}) {
  // The cursor follows a row, not a position: confirming re-sorts the group (attention first).
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const rows: ReviewRow[] = useMemo(() => {
    const all = questions
      .filter((q) => q.kind !== "derived")
      .map((q) => ({
        id: q.id,
        group: groupOf(q.id),
        status: answers[q.id] === undefined ? undefined : statuses[q.id],
        confidence: meta[q.id]?.confidence,
        conflict: !!meta[q.id]?.conflict,
        answered: answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== "",
        required: !!q.required,
      }))
      // Only what matters for this product: answered questions and required ones still open.
      .filter((r) => r.answered || r.required);
    const t = query.trim().toUpperCase();
    const shown = t ? all.filter((r) => `${byId.get(r.id)?.label ?? ""} ${display(answers[r.id])}`.toUpperCase().includes(t)) : all;
    return orderRows(shown);
  }, [questions, answers, statuses, meta, query, byId, display]);
  const cursor = Math.max(0, rows.findIndex((r) => r.id === cursorId));
  const current = rows[cursor];
  const move = (d: number) => {
    const next = rows[Math.min(rows.length - 1, Math.max(0, cursor + d))];
    if (next) setCursorId(next.id);
  };
  const sourceOf = (id: string) => meta[id]?.source ?? "";
  const allVisible = bulkConfirmable(rows, { allVisible: true }, sourceOf);

  // Keep the cursor's row in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${current?.id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable;
      if (e.key === "Escape") {
        setEditing(null);
        setHelp(false);
        if (typing) target.blur();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const q = current ? byId.get(current.id) : undefined;
      if (e.key === "j" || e.key === "ArrowDown") move(1);
      else if (e.key === "k" || e.key === "ArrowUp") move(-1);
      else if (e.key === "Enter" && current && canEdit && statuses[current.id] && statuses[current.id] !== "confirmed") onConfirm([current.id]);
      else if ((e.key === "e" || e.key === "o") && current && canEdit) setEditing(current.id);
      else if (e.key === "/") searchRef.current?.focus();
      else if (e.key === "?") setHelp((h) => !h);
      else if (/^[1-9]$/.test(e.key) && q && canEdit) {
        const n = Number(e.key) - 1;
        if (q.kind === "chips" && q.options[n]) onCommit(q.id, q.options[n]);
        else if (q.kind === "toggle" && n < 2) onCommit(q.id, n === 0);
        else return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, move, byId, canEdit, statuses, onConfirm, onCommit]);

  return (
    <div className={cx("grid gap-10", renderUrl && "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]")} data-testid="review-screen">
      <div className={cx("hidden", renderUrl && "lg:block")}>
        <div className="sticky top-28 bg-white border border-hairline aspect-[4/3] flex items-center justify-center">
          {renderUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={renderUrl} alt="Render" className="w-full h-full object-contain" />
          ) : (
            <span className="italic text-taupe text-[12px]">No render yet</span>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursorId(null);
            }}
            placeholder="Search  /"
            aria-label="Search answers"
            className="h-9 px-3 border border-hairline-strong bg-paper text-[12px] w-56 focus:outline-none focus:border-ink"
          />
          {canEdit && allVisible.length > 0 && (
            <button type="button" onClick={() => onConfirm(allVisible)} data-testid="review-confirm-visible" className="h-9 px-4 border border-ink text-[10px] tracking-[0.18em] uppercase hover:bg-ink hover:text-ivory">
              ✓ All visible · {allVisible.length}
            </button>
          )}
          <button type="button" onClick={() => setHelp((h) => !h)} className="ml-auto eyebrow hover:text-ink" aria-label="Keyboard shortcuts">
            ? Shortcuts
          </button>
        </div>
        {help && (
          <div className="mb-4 border border-hairline bg-paper p-4 text-[11.5px] grid grid-cols-2 gap-x-6 gap-y-1" data-testid="review-help">
            {[
              ["J / K", "Next / previous row"],
              ["Enter", "Confirm the row"],
              ["1–9", "Pick the nth option"],
              ["E", "Edit"],
              ["O", "Edit — type Other"],
              ["/", "Search"],
              ["Esc", "Close"],
              ["?", "These shortcuts"],
            ].map(([k, v]) => (
              <div key={k}>
                <span className="font-semibold mr-2">{k}</span>
                {v}
              </div>
            ))}
          </div>
        )}
        <div ref={listRef} className="space-y-8">
          {REVIEW_GROUPS.map((g) => {
            const mine = rows.filter((r) => r.group === g);
            if (!mine.length) return null;
            const groupIds = bulkConfirmable(mine, { group: g as ReviewGroup });
            return (
              <section key={g} data-testid={`review-group-${g}`}>
                <div className="flex items-baseline justify-between border-b border-hairline pb-2 mb-1">
                  <h3 className="display text-[22px]">{g}</h3>
                  {canEdit && groupIds.length > 0 && (
                    <button type="button" onClick={() => onConfirm(groupIds)} data-testid={`review-looks-right-${g}`} className="text-[10px] tracking-[0.18em] uppercase text-gold hover:text-ink">
                      ✓ Looks right · {groupIds.length}
                    </button>
                  )}
                </div>
                <ul>
                  {mine.map((r) => {
                    const q = byId.get(r.id)!;
                    const m = meta[r.id];
                    const active = current?.id === r.id;
                    const pending = r.status && r.status !== "confirmed";
                    return (
                      <li
                        key={r.id}
                        data-row={r.id}
                        data-testid={`review-row-${r.id}`}
                        aria-current={active}
                        onClick={() => setCursorId(r.id)}
                        className={cx(
                          "px-3 py-2 border-l-2 cursor-default",
                          active ? "border-ink bg-ivory" : "border-transparent",
                          r.conflict ? "bg-signal/5" : pending && r.confidence === "low" ? "bg-gold-soft/40" : pending ? "bg-gold-soft/15" : "",
                        )}
                        title={m?.aiNote ? `Saw: ${m.aiNote}` : undefined}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-baseline gap-4">
                          <span className="text-[12.5px] text-ink-soft truncate">
                            {q.label}
                            {q.required && <span className="text-signal ml-1">★</span>}
                          </span>
                          <span className="text-[12.5px] tracking-[0.04em] truncate" data-testid={`review-value-${r.id}`}>
                            {r.answered ? display(answers[r.id]) : <span className="italic text-signal">needed</span>}
                          </span>
                          <span className="flex items-center gap-2">
                            {r.conflict ? (
                              <Badge tone="signal">Conflict</Badge>
                            ) : pending ? (
                              <Badge tone={r.status === "est" ? "est" : r.status === "inferred" ? "inferred" : "ai"}>{r.status === "est" ? "EST" : r.status === "inferred" ? "Inferred" : r.confidence === "low" ? "Low confidence" : "AI"}</Badge>
                            ) : m?.origin && m.origin !== "DESIGNER" ? (
                              <span className="text-[9.5px] tracking-[0.14em] uppercase text-taupe">{m.source || ORIGIN_LABEL[m.origin]}</span>
                            ) : null}
                            {canEdit && pending && !r.conflict && (
                              <button type="button" onClick={() => onConfirm([r.id])} className="h-[20px] px-1.5 border border-ink text-[9px] tracking-[0.14em] uppercase hover:bg-ink hover:text-ivory" data-testid={`review-confirm-${r.id}`}>
                                ✓
                              </button>
                            )}
                          </span>
                        </div>
                        {r.conflict && m?.conflict && (
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-signal">
                            {m.conflict.source || (m.conflict.origin === "AI" ? "The render" : m.conflict.origin)} reads {display(m.conflict.value)}
                            {canEdit && (
                              <>
                                <button type="button" className="underline" onClick={() => onConflict(r.id, "switch")}>Switch</button>
                                <button type="button" className="underline text-taupe" onClick={() => onConflict(r.id, "keep")}>Keep</button>
                              </>
                            )}
                          </div>
                        )}
                        {editing === r.id && (
                          <div className="mt-3 mb-1" onClick={(e) => e.stopPropagation()} data-testid={`review-edit-${r.id}`}>
                            <QuestionField
                              q={q}
                              value={answers[r.id]}
                              onChange={(v) => onCommit(r.id, v)}
                              ctx={ctx}
                              colorways={colorways}
                              disabled={!canEdit}
                              unitLabel={unitLabel}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {!rows.length && <p className="italic text-taupe text-[12px]">Nothing matches.</p>}
        </div>
      </div>
    </div>
  );
}
