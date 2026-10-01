"use client";

import type { Dims2Value, LibValue, Question } from "@/lib/questions/types";
import { ChipRow, MultiChips, Stepper, Toggle } from "@/components/chips";
import { LibraryPicker } from "./library-picker";
import { MaterialsEditor, MatrixEditor, RowsEditor } from "./editors";
import type { EvalContext } from "@/lib/questions";
import { cx } from "@/components/ui";
import { CommitText } from "@/components/commit-text";

export type FieldProps = {
  q: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  ctx: EvalContext;
  colorways: string[];
  disabled?: boolean;
  unitLabel: (u: string) => string;
  derived?: string;
};

/** Renders the control for one question. Everything is a chip, toggle, stepper or library picker; free text only in Other and Comments. */
export function QuestionField({ q, value, onChange, ctx, colorways, disabled, unitLabel, derived }: FieldProps) {
  const tid = `q-input-${q.id}`;
  switch (q.kind) {
    case "chips":
      return <ChipRow options={q.options} value={value as string} onChange={onChange} disabled={disabled} allowOther={!q.noOther} testId={tid} />;
    case "multi":
      return <MultiChips options={q.options} value={value as string[]} onChange={onChange} disabled={disabled} allowOther={!q.noOther} />;
    case "toggle":
      return <Toggle value={value as boolean} onChange={onChange} disabled={disabled} testId={tid} />;
    case "stepper":
      return (
        <Stepper
          value={value as number}
          onChange={(v) => onChange(v)}
          unit={unitLabel(q.unit)}
          step={q.step ?? (q.unit === "qty" ? 1 : q.unit === "mm" ? 0.5 : 0.25)}
          disabled={disabled}
          ariaLabel={q.label}
        />
      );
    case "dims2": {
      const d = (value as Dims2Value) ?? { w: null, h: null };
      const st = q.unit === "mm" ? 0.5 : 0.25;
      return (
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="eyebrow">W</span>
          <Stepper compact value={d.w} onChange={(w) => onChange({ ...d, w })} unit="" step={st} disabled={disabled} ariaLabel={`${q.label} width`} />
          <span className="text-taupe display text-xl">×</span>
          <span className="eyebrow">H</span>
          <Stepper compact value={d.h} onChange={(h) => onChange({ ...d, h })} unit={unitLabel(q.unit)} step={st} disabled={disabled} ariaLabel={`${q.label} height`} />
        </div>
      );
    }
    case "lib":
      return <LibraryPicker kind={q.lib} value={value as LibValue} onChange={onChange} hardwareTypes={q.hardwareTypes} disabled={disabled} testId={tid} />;
    case "text":
      return <CommitText value={(value as string) ?? ""} onCommit={onChange} disabled={disabled} placeholder={q.placeholder} testId={tid} />;
    case "comment":
      return <CommitText value={(value as string) ?? ""} onCommit={onChange} disabled={disabled} multiline testId={tid} />;
    case "date_asap": {
      const v = (value as string) ?? "";
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={cx("h-9 px-4 border text-[11px] tracking-[0.14em] uppercase", v === "ASAP" ? "bg-ink text-ivory border-ink" : "border-hairline-strong hover:border-ink")}
            onClick={() => onChange(v === "ASAP" ? "" : "ASAP")}
            disabled={disabled}
            data-testid={tid}
          >
            ASAP
          </button>
          <span className="text-taupe italic text-[12px]">or</span>
          <input
            type="date"
            value={v && v !== "ASAP" ? v : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-9 px-3 border border-hairline-strong bg-paper text-[13px] focus:outline-none focus:border-ink"
            aria-label="Due date"
          />
        </div>
      );
    }
    case "derived":
      return <div className="h-9 flex items-center display text-xl">{derived}</div>;
    case "rows":
      return <RowsEditor q={q} value={value as Record<string, unknown>[]} onChange={onChange} disabled={disabled} unitLabel={unitLabel} />;
    case "materials":
      return <MaterialsEditor value={value} onChange={onChange} disabled={disabled} />;
    case "colorway_matrix":
      return <MatrixEditor value={value} onChange={onChange} ctx={ctx} colorways={colorways} disabled={disabled} />;
    case "per_colorway_text": {
      const m = (value as Record<string, string>) ?? {};
      return (
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
          {colorways.map((c) => (
            <div key={c} className="flex items-center gap-4">
              <span className="display text-xl w-12">{c}</span>
              <CommitText value={m[c] ?? ""} onCommit={(t) => onChange({ ...m, [c]: t })} disabled={disabled} placeholder="COLORWAY NAME" />
            </div>
          ))}
        </div>
      );
    }
  }
}

