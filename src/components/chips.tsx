"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

const chip = (on: boolean, disabled?: boolean) =>
  cx(
    "h-9 px-4 border text-[11px] tracking-[0.12em] uppercase transition-all duration-150 whitespace-nowrap",
    on ? "bg-ink text-ivory border-ink" : "border-hairline-strong text-ink-soft hover:border-ink hover:text-ink",
    disabled && "pointer-events-none opacity-60",
  );

/**
 * Single-select chips. Every chip set ends with "Other…" (unless allowOther=false): the typed
 * text becomes the value. Clicking the selected chip clears it.
 */
export function ChipRow({
  options,
  value,
  onChange,
  disabled,
  allowOther = true,
  testId,
}: {
  options: string[];
  value: string | undefined | null;
  onChange: (v: string) => void;
  disabled?: boolean;
  allowOther?: boolean;
  testId?: string;
}) {
  const isOther = !!value && !options.includes(value);
  const [otherOpen, setOtherOpen] = useState(isOther);
  const [draft, setDraft] = useState(isOther ? value! : "");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (otherOpen) inputRef.current?.focus();
  }, [otherOpen]);

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" data-testid={testId}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          className={chip(value === o, disabled)}
          onClick={() => {
            setOtherOpen(false);
            onChange(value === o ? "" : o);
          }}
        >
          {o}
        </button>
      ))}
      {allowOther &&
        (otherOpen ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = draft.trim().toUpperCase();
              if (t) onChange(t);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              aria-label="Other"
              onChange={(e) => setDraft(e.target.value.toUpperCase())}
              onBlur={() => {
                const t = draft.trim().toUpperCase();
                if (t && t !== value) onChange(t);
                if (!t) setOtherOpen(false);
              }}
              placeholder="OTHER…"
              className={cx("h-9 px-3 border text-[11px] tracking-[0.12em] uppercase bg-paper focus:outline-none w-52", isOther ? "border-ink" : "border-hairline-strong")}
            />
          </form>
        ) : (
          <button type="button" className={chip(false, disabled) + " italic normal-case tracking-normal"} onClick={() => setOtherOpen(true)}>
            Other…
          </button>
        ))}
    </div>
  );
}

/** Multi-select chips, also ending with "Other…". */
export function MultiChips({
  options,
  value,
  onChange,
  disabled,
  allowOther = true,
}: {
  options: string[];
  value: string[] | undefined | null;
  onChange: (v: string[]) => void;
  disabled?: boolean;
  allowOther?: boolean;
}) {
  const vals = value ?? [];
  const extras = vals.filter((v) => !options.includes(v));
  const [draft, setDraft] = useState("");
  const toggle = (o: string) => onChange(vals.includes(o) ? vals.filter((x) => x !== o) : [...vals, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {[...options, ...extras].map((o) => (
        <button key={o} type="button" role="checkbox" aria-checked={vals.includes(o)} className={chip(vals.includes(o), disabled)} onClick={() => toggle(o)}>
          {vals.includes(o) && <span className="mr-2">✓</span>}
          {o}
        </button>
      ))}
      {allowOther && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = draft.trim().toUpperCase();
            if (t && !vals.includes(t)) onChange([...vals, t]);
            setDraft("");
          }}
        >
          <input
            value={draft}
            aria-label="Other"
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            placeholder="OTHER… ↵"
            className="h-9 px-3 border border-hairline-strong text-[11px] tracking-[0.12em] uppercase bg-paper focus:outline-none focus:border-ink w-40"
          />
        </form>
      )}
    </div>
  );
}

export function Toggle({ value, onChange, disabled, testId }: { value: boolean | undefined | null; onChange: (v: boolean) => void; disabled?: boolean; testId?: string }) {
  return (
    <div className="inline-flex border border-hairline-strong" role="radiogroup" data-testid={testId}>
      {[true, false].map((b) => (
        <button
          key={String(b)}
          type="button"
          role="radio"
          aria-checked={value === b}
          disabled={disabled}
          onClick={() => onChange(b)}
          className={cx(
            "h-9 w-20 text-[11px] tracking-[0.18em] uppercase transition-colors",
            value === b ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink",
          )}
        >
          {b ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

/** Number with unit; commits on blur / Enter and on the ± buttons. */
export function Stepper({
  value,
  onChange,
  unit,
  step = 0.5,
  disabled,
  ariaLabel,
  compact,
}: {
  value: number | undefined | null;
  onChange: (v: number | null) => void;
  unit: string;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value == null ? "" : String(value));
  }
  const commit = (s: string) => {
    const t = s.trim();
    if (!t) return onChange(null);
    const n = Number(t.replace(",", "."));
    if (Number.isFinite(n) && n >= 0) onChange(Math.round(n * 1000) / 1000);
    else setDraft(value == null ? "" : String(value));
  };
  const bump = (d: number) => {
    const n = Math.max(0, Math.round(((value ?? 0) + d) * 1000) / 1000);
    setDraft(String(n));
    onChange(n);
  };
  return (
    <div className="inline-flex items-stretch border border-hairline-strong h-9 bg-paper">
      <button type="button" disabled={disabled} className="w-9 text-ink-soft hover:bg-ink hover:text-ivory transition-colors" onClick={() => bump(-step)} aria-label="Decrease">
        −
      </button>
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={disabled}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className={cx("text-center bg-transparent border-x border-hairline-strong focus:outline-none text-[14px]", compact ? "w-14" : "w-20")}
      />
      <button type="button" disabled={disabled} className="w-9 text-ink-soft hover:bg-ink hover:text-ivory transition-colors" onClick={() => bump(step)} aria-label="Increase">
        +
      </button>
      {unit && <span className="px-3 flex items-center text-[11px] tracking-[0.14em] uppercase text-taupe border-l border-hairline-strong">{unit}</span>}
    </div>
  );
}
