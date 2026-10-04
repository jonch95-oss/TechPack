"use client";

import { useState } from "react";
import { REF_KINDS, REF_LABEL, isReference, refText, type RefKind, type ReferenceAnswer } from "@/lib/reference-answer";
import { cx } from "@/components/ui";

/**
 * Answer any question with a reference instead of a value (V2.1 §1): "follow reference image 2",
 * "same as <style #>", "from previous development", "factory standard", "scale to CAD",
 * "open to options", "to be provided". Settled at PROTO; printed as written.
 */
export function ReferenceControl({ qid, value, onChange, disabled }: { qid: string; value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
  const current = isReference(value) ? value : null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReferenceAnswer>(current ?? { ref: "PER_IMAGE" });
  if (disabled && !current) return null;
  return (
    <div className="mt-2" data-testid={`ref-${qid}`}>
      {current && !open ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 border border-signal/50 px-2 h-6 text-[10.5px] tracking-[0.06em] text-signal" data-testid={`ref-value-${qid}`}>
            ↪ {refText(current)}
          </span>
          {!disabled && (
            <>
              <button type="button" className="text-[10px] tracking-[0.14em] uppercase text-taupe hover:text-ink" onClick={() => (setDraft(current), setOpen(true))}>
                Edit
              </button>
              <button type="button" className="text-[10px] tracking-[0.14em] uppercase text-taupe hover:text-signal" onClick={() => onChange(null)} data-testid={`ref-clear-${qid}`}>
                Clear
              </button>
            </>
          )}
        </div>
      ) : !open ? (
        <button type="button" className="text-[10px] tracking-[0.18em] uppercase text-taupe hover:text-ink" onClick={() => setOpen(true)} data-testid={`ref-open-${qid}`}>
          ↪ Answer by reference
        </button>
      ) : (
        <div className="border border-hairline bg-paper p-3 space-y-2 max-w-md">
          <div className="flex flex-wrap gap-1">
            {REF_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDraft({ ...draft, ref: k as RefKind })}
                data-testid={`ref-kind-${k}`}
                className={cx("h-7 px-2 border text-[9.5px] tracking-[0.12em] uppercase", draft.ref === k ? "bg-ink text-ivory border-ink" : "border-hairline-strong text-ink-soft hover:border-ink")}
              >
                {REF_LABEL[k as RefKind]}
              </button>
            ))}
          </div>
          {draft.ref === "SAME_AS" && (
            <div className="flex gap-2">
              <input aria-label="Same as style #" data-testid={`ref-style-${qid}`} placeholder="STYLE # / CODE" value={draft.styleNo ?? ""} onChange={(e) => setDraft({ ...draft, styleNo: e.target.value.toUpperCase() })} className="h-8 px-2 border border-hairline-strong bg-ivory text-[12px] w-40 uppercase" />
              <input aria-label="Which part" placeholder="PART (OPTIONAL)" value={draft.part ?? ""} onChange={(e) => setDraft({ ...draft, part: e.target.value.toUpperCase() })} className="h-8 px-2 border border-hairline-strong bg-ivory text-[12px] flex-1 uppercase" />
            </div>
          )}
          {draft.ref === "PER_IMAGE" && (
            <input aria-label="Reference image" placeholder="IMAGE # / LETTER (OPTIONAL)" value={draft.image ?? ""} onChange={(e) => setDraft({ ...draft, image: e.target.value.toUpperCase() })} className="h-8 px-2 border border-hairline-strong bg-ivory text-[12px] w-56 uppercase" />
          )}
          <input
            aria-label="Instruction as written"
            data-testid={`ref-text-${qid}`}
            placeholder="AS WRITTEN (OPTIONAL) — E.G. PLEASE FOLLOW SAMPLE IMAGES FOR HANDLE CONSTRUCTION"
            value={draft.text ?? ""}
            onChange={(e) => setDraft({ ...draft, text: e.target.value.toUpperCase() })}
            className="h-8 px-2 border border-hairline-strong bg-ivory text-[12px] w-full uppercase"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid={`ref-save-${qid}`}
              disabled={draft.ref === "SAME_AS" && !draft.styleNo}
              className="h-7 px-3 border border-ink text-[10px] tracking-[0.16em] uppercase hover:bg-ink hover:text-ivory disabled:opacity-40"
              onClick={() => {
                const clean = Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== "" && v != null)) as ReferenceAnswer;
                onChange(clean);
                setOpen(false);
              }}
            >
              Use reference
            </button>
            <button type="button" className="text-[10px] tracking-[0.14em] uppercase text-taupe" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <span className="text-[10.5px] text-taupe truncate">{refText(draft)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
