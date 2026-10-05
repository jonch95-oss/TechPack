"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFactoryQuestion, answerFactoryQuestion } from "@/app/actions/workflow";
import { Button, cx } from "@/components/ui";

type Q = { id: string; askedBy: string; question: string; answer: string; answeredByName: string | null; createdAt: string; answeredAt: string | null };

/** Factory questions and our answers — so the next designer can see why something changed. */
export function FactoryQA({ packId, questions, canEdit, factory }: { packId: string; questions: Q[]; canEdit: boolean; factory: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [who, setWho] = useState(factory);
  const [, start] = useTransition();
  const open = questions.filter((x) => !x.answer).length;
  return (
    <div className="space-y-4" data-testid="factory-qa">
      {questions.length === 0 && <p className="text-taupe text-[12px] italic">No questions from the factory yet.</p>}
      {questions.map((x, i) => (
        <div key={x.id} className={cx("border p-5 bg-paper", x.answer ? "border-hairline" : "border-gold/60")}>
          <div className="flex items-baseline justify-between gap-4">
            <div className="text-[13px]"><span className="eyebrow mr-2">Q{i + 1}</span>{x.question}</div>
            <span className="text-[10px] tracking-[0.16em] uppercase text-taupe whitespace-nowrap">{x.askedBy || "FACTORY"} · {new Date(x.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
          </div>
          {x.answer ? (
            <div className="mt-3 text-[13px] text-ok"><span className="eyebrow mr-2 text-ok">A</span>{x.answer} <span className="text-[10px] text-taupe ml-2">— {x.answeredByName}</span></div>
          ) : (
            canEdit && (
              <input
                placeholder="Type the answer and press Enter…"
                aria-label={`Answer to question ${i + 1}`}
                className="mt-3 w-full h-9 bg-transparent border-0 border-b border-hairline-strong text-[13px] uppercase focus:outline-none focus:border-ink placeholder:normal-case placeholder:text-mist"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const v = (e.target as HTMLInputElement).value;
                  if (v.trim()) start(async () => { await answerFactoryQuestion(packId, x.id, v); router.refresh(); });
                }}
              />
            )
          )}
        </div>
      ))}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-3 pt-2">
          <input value={who} onChange={(e) => setWho(e.target.value.toUpperCase())} placeholder="FACTORY" aria-label="Asked by" className="w-40 h-9 bg-transparent border-0 border-b border-hairline-strong text-[12px] focus:outline-none focus:border-ink" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="The factory's question…" aria-label="Factory question" className="flex-1 min-w-64 h-9 bg-transparent border-0 border-b border-hairline-strong text-[13px] uppercase focus:outline-none focus:border-ink placeholder:normal-case placeholder:text-mist" />
          <Button size="sm" variant="secondary" disabled={!q.trim()} onClick={() => start(async () => { await addFactoryQuestion(packId, who, q); setQ(""); router.refresh(); })}>
            Log question
          </Button>
        </div>
      )}
      {open > 0 && <p className="text-[11px] text-gold">{open} unanswered</p>}
    </div>
  );
}
