"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { applySpelling } from "@/app/actions/packs";
import type { RuleResult } from "@/lib/validation";
import { buttonClass, cx } from "@/components/ui";

type Result = { passes: boolean; rules: RuleResult[]; spelling: { word: string; suggestion: string | null; count: number }[]; pages: { n: number; section: string }[] };

/**
 * The validation gate (Part 5) in the workspace: re-checks after edits, lists exactly what to fix
 * with a jump to the field, offers one-click spelling corrections, and unlocks the PDF when clean.
 */
export function ExportPanel({ packId, version, onJump, canEdit }: { packId: string; version: number; onJump: (qid: string) => void; canEdit: boolean }) {
  const router = useRouter();
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/packs/${packId}/validation`, { cache: "no-store" });
      if (r.ok) setRes(await r.json());
    } finally {
      setLoading(false);
    }
  }, [packId]);

  // Re-check shortly after the designer stops editing.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(check, version === 0 ? 0 : 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [version, check]);

  const fails = res?.rules.filter((r) => r.status === "fail") ?? [];
  const warns = res?.rules.filter((r) => r.status === "warn") ?? [];
  const passed = res?.rules.filter((r) => r.status === "pass").length ?? 0;

  return (
    <div className="border-t border-hairline" data-testid="export-panel">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 pt-5 pb-3">
        <span className="eyebrow">Validation gate</span>
        <span className={cx("text-[10px] tracking-[0.18em] uppercase", !res ? "text-mist" : res.passes ? "text-ok" : "text-signal")} data-testid="gate-status">
          {loading && !res ? "Checking…" : !res ? "" : res.passes ? "Ready to export" : `${fails.length} to fix`}
        </span>
      </button>
      {open && res && (
        <div className="px-6 pb-4 space-y-3 max-h-[34vh] overflow-y-auto">
          <div className="text-[11px] text-taupe">
            {passed} rules pass{warns.length ? ` · ${warns.length} warning${warns.length > 1 ? "s" : ""}` : ""} · {res.pages.length} pages
          </div>
          {res.spelling.length > 0 && (
            <div className="space-y-1.5" data-testid="spelling">
              <div className="text-[9.5px] tracking-[0.18em] uppercase text-signal">Spelling</div>
              {res.spelling.map((s) => (
                <div key={s.word} className="flex items-center justify-between gap-2 text-[12px]">
                  <span>
                    <s className="text-signal">{s.word}</s>
                    {s.suggestion && <span> → {s.suggestion}</span>}
                  </span>
                  {canEdit && s.suggestion && (
                    <button
                      type="button"
                      className="h-6 px-2 border border-ink text-[9.5px] tracking-[0.14em] uppercase hover:bg-ink hover:text-ivory"
                      onClick={async () => {
                        await applySpelling(packId, s.word, s.suggestion!);
                        router.refresh();
                        check();
                      }}
                    >
                      Accept
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {fails
            .filter((r) => r.group !== "Language" || !r.rule.startsWith("Spelling"))
            .map((r, i) => (
              <button key={`${r.rule}-${i}`} type="button" onClick={() => r.questionId && !r.questionId.startsWith("$") && onJump(r.questionId)} className="block w-full text-left hover:bg-ivory -mx-2 px-2 py-1">
                <div className="text-[12px] leading-snug">{r.rule}</div>
                <div className="text-[10.5px] text-signal leading-snug">{r.fix}</div>
              </button>
            ))}
          {warns.map((r, i) => (
            <button key={`w-${i}`} type="button" onClick={() => r.questionId && onJump(r.questionId)} className="block w-full text-left hover:bg-ivory -mx-2 px-2 py-1">
              <div className="text-[12px] leading-snug">{r.rule}</div>
              <div className="text-[10.5px] text-gold leading-snug">{r.fix}</div>
            </button>
          ))}
        </div>
      )}
      <div className="px-6 pb-6 pt-2 space-y-2">
        {res?.passes ? (
          <a href={`/api/packs/${packId}/pdf`} target="_blank" className={cx(buttonClass("primary"), "w-full")} data-testid="export-pdf">
            Export PDF · {res.pages.length} pages
          </a>
        ) : (
          <button className={cx(buttonClass("primary"), "w-full")} disabled title="Fix the items above to unlock">
            Export PDF — {fails.length || "…"} to fix
          </button>
        )}
        <a href={`/api/packs/${packId}/pdf?draft=1`} target="_blank" className={cx(buttonClass("secondary", "sm"), "w-full")} data-testid="draft-pdf">
          Draft PDF (watermarked)
        </a>
      </div>
    </div>
  );
}
