"use client";

import type { Column, LibValue, MaterialEntry, MatrixCell, MatrixValue, RowsQ } from "@/lib/questions/types";
import { matrixColumns, type EvalContext } from "@/lib/questions";
import { HARDWARE_FINISHES } from "@/lib/questions/common";
import { ChipRow, MultiChips, Stepper, Toggle } from "@/components/chips";
import { CalloutDot, cx } from "@/components/ui";
import { LibraryPicker } from "./library-picker";
import { CommitText } from "@/components/commit-text";

/* ------------------------------------------------------------------ */
/* Repeating rows (pockets, hardware items, comments …)                 */
/* ------------------------------------------------------------------ */

export function RowsEditor({
  q,
  value,
  onChange,
  disabled,
  unitLabel,
}: {
  q: RowsQ;
  value: Record<string, unknown>[] | undefined;
  onChange: (v: Record<string, unknown>[]) => void;
  disabled?: boolean;
  unitLabel: (u: string) => string;
}) {
  const rows = value ?? [];
  const setCell = (i: number, key: string, v: unknown) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const isComments = q.id === "comments.list";
  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <div key={i} className="relative border border-hairline bg-ivory/60 p-5 pr-14 fade-up" data-testid={`${q.id}-row-${i}`}>
          <div className="flex items-center gap-3 mb-4">
            {isComments ? (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-signal text-ivory text-[11px] font-semibold">{String.fromCharCode(65 + i)}</span>
            ) : (
              <span className="eyebrow">No. {i + 1}</span>
            )}
          </div>
          <div className={cx("grid gap-x-8 gap-y-5", isComments ? "" : "md:grid-cols-2")}>
            {q.columns.map((c) => {
              if (c.showIf && !c.showIf.in.includes(String(r[c.showIf.key] ?? ""))) return null;
              return (
                <div key={c.key} className={cx(c.kind === "chips" && c.options.length > 4 && "md:col-span-2")}>
                  <div className="eyebrow mb-2">
                    {c.label}
                    {c.required && <span className="text-signal ml-1">★</span>}
                  </div>
                  <Cell c={c} v={r[c.key]} onChange={(v) => setCell(i, c.key, v)} disabled={disabled} unitLabel={unitLabel} />
                </div>
              );
            })}
          </div>
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove row ${i + 1}`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="absolute top-4 right-4 w-8 h-8 text-taupe hover:text-signal hover:bg-signal-soft transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          data-testid={`${q.id}-add`}
          onClick={() => onChange([...rows, {}])}
          className="w-full h-12 border border-dashed border-hairline-strong text-[10.5px] tracking-[0.22em] uppercase text-taupe hover:text-ink hover:border-ink transition-colors"
        >
          + {q.addLabel ?? "Add"}
        </button>
      )}
    </div>
  );
}

function Cell({ c, v, onChange, disabled, unitLabel }: { c: Column; v: unknown; onChange: (v: unknown) => void; disabled?: boolean; unitLabel: (u: string) => string }) {
  switch (c.kind) {
    case "chips":
      return <ChipRow options={c.options} value={v as string} onChange={onChange} disabled={disabled} allowOther={!c.noOther} />;
    case "multi":
      return <MultiChips options={c.options} value={v as string[]} onChange={onChange} disabled={disabled} allowOther={!c.noOther} />;
    case "stepper":
      return <Stepper value={v as number} onChange={onChange} unit={unitLabel(c.unit)} step={c.unit === "qty" ? 1 : 0.25} disabled={disabled} ariaLabel={c.label} />;
    case "toggle":
      return <Toggle value={v as boolean} onChange={onChange} disabled={disabled} />;
    case "text":
      return <CommitText value={(v as string) ?? ""} onCommit={onChange} disabled={disabled} multiline={c.key === "text"} />;
    case "lib":
      return <LibraryPicker kind={c.lib} value={v as LibValue} onChange={onChange} hardwareTypes={c.hardwareTypes} disabled={disabled} />;
  }
}

/* ------------------------------------------------------------------ */
/* Materials list — each distinct material gets a yellow callout number */
/* ------------------------------------------------------------------ */

const DIRECTIONS = ["VERTICAL", "HORIZONTAL", "ONE-WAY (NAP / PRINT UP)", "ANY"];
const MATCHING = ["NONE", "MATCH CHECKS AT SEAMS", "MATCH STRIPES AT SEAMS", "CENTRE MOTIF ON PANEL", "MIRROR ACROSS CENTRE"];
const LOCATIONS = ["FRONT", "BACK", "FLAP", "GUSSET", "STRAP", "HANDLE", "BASE", "TRIM", "PIPING", "TAB", "LINING"];

export function MaterialsEditor({ value, onChange, disabled }: { value: unknown; onChange: (v: MaterialEntry[]) => void; disabled?: boolean }) {
  const list = (value as MaterialEntry[]) ?? [];
  const renumber = (l: MaterialEntry[]) => l.map((m, i) => ({ ...m, callout: i + 1 }));
  return (
    <div className="space-y-4">
      {list.map((m, i) => (
        <div key={i} className="flex gap-5 border border-hairline bg-ivory/60 p-5 fade-up">
          <CalloutDot n={m.callout} size={30} />
          <div className="flex-1 min-w-0 space-y-4">
            <CommitText value={m.name} onCommit={(t) => onChange(list.map((x, j) => (j === i ? { ...x, name: t } : x)))} disabled={disabled} placeholder="MAIN BODY MTL" />
            <MultiChips options={LOCATIONS} value={m.locations} onChange={(locs) => onChange(list.map((x, j) => (j === i ? { ...x, locations: locs } : x)))} disabled={disabled} />
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <div className="eyebrow mb-1.5">Direction on the panels</div>
                <ChipRow options={DIRECTIONS} value={m.direction} onChange={(v) => onChange(list.map((x, j) => (j === i ? { ...x, direction: v } : x)))} disabled={disabled} />
              </div>
              <div>
                <div className="eyebrow mb-1.5">Pattern matching</div>
                <ChipRow options={MATCHING} value={m.matching} onChange={(v) => onChange(list.map((x, j) => (j === i ? { ...x, matching: v } : x)))} disabled={disabled} />
              </div>
            </div>
          </div>
          {!disabled && (
            <button type="button" aria-label={`Remove material ${m.callout}`} onClick={() => onChange(renumber(list.filter((_, j) => j !== i)))} className="self-start w-8 h-8 text-taupe hover:text-signal">
              ✕
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          data-testid="materials-add"
          onClick={() => onChange(renumber([...list, { callout: list.length + 1, name: list.length ? "" : "MAIN BODY MTL", locations: [] }]))}
          className="w-full h-12 border border-dashed border-hairline-strong text-[10.5px] tracking-[0.22em] uppercase text-taupe hover:text-ink hover:border-ink transition-colors"
        >
          + Add material
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Material / colour breakdown matrix                                  */
/* ------------------------------------------------------------------ */

const QUICK = ["DTM", "N/A"];

/** Values the rest of the answers already imply; used to fill blank cells in one click. */
export function impliedCells(ctx: EvalContext): Record<string, MatrixCell> {
  const a = ctx.answers;
  const out: Record<string, MatrixCell> = {};
  if (a["edge.treatment"] === "EDGE PAINT" && a["edge.paint_colour"])
    out.edge_paint = { text: a["edge.paint_colour"] === "CONTRAST" ? String(a["edge.contrast_colour"] ?? "CONTRAST") : String(a["edge.paint_colour"]) };
  else if (a["edge.treatment"]) out.edge_paint = { text: "N/A" };
  if (a["hardware.finish"]) out.hardware_finish = { text: String(a["hardware.finish"]) };
  const logo = [a["branding.logo_type"], (a["branding.logo_code"] as LibValue | undefined)?.label && `REF TO ${(a["branding.logo_code"] as LibValue).label}`, a["branding.finish"] ?? a["hardware.finish"]]
    .filter(Boolean)
    .join(" ");
  if (logo) out.logo = { text: logo };
  if (a["interior.lining_artwork_type"] === "PRINT (LIBRARY)" && a["interior.lining_print"]) out.lining = { lib: a["interior.lining_print"] as LibValue };
  else if (a["interior.lining_material"]) out.lining = { lib: a["interior.lining_material"] as LibValue };
  else if (a["interior.lined"] === false) out.lining = { text: "N/A" };
  if (a["cos.zip_tape"] || a["cos.zip_teeth"]) out.zipper = { text: [a["cos.zip_size"], a["cos.zip_type"], a["cos.zip_tape"] && `${a["cos.zip_tape"]} TAPE`, a["cos.zip_teeth"] && `${a["cos.zip_teeth"]} TEETH`].filter(Boolean).join(" ") };
  return out;
}

export function MatrixEditor({
  value,
  onChange,
  ctx,
  colorways,
  disabled,
}: {
  value: unknown;
  onChange: (v: MatrixValue) => void;
  ctx: EvalContext;
  colorways: string[];
  disabled?: boolean;
}) {
  const m = (value as MatrixValue) ?? {};
  const cols = matrixColumns(ctx);
  const setCell = (cw: string, key: string, cell: MatrixCell | null) => {
    const row = { ...(m[cw] ?? {}) };
    if (cell) row[key] = cell;
    else delete row[key];
    onChange({ ...m, [cw]: row });
  };
  const implied = impliedCells(ctx);
  const fillable = colorways.flatMap((cw) => Object.keys(implied).filter((k) => cols.some((c) => c.key === k) && !m[cw]?.[k]).map((k) => [cw, k]));

  if (!cols.some((c) => c.key.startsWith("mat_")))
    return <p className="text-taupe italic">Add materials above first — each becomes a column here.</p>;

  return (
    <div className="space-y-4">
      {!disabled && fillable.length > 0 && (
        <button
          type="button"
          data-testid="matrix-autofill"
          onClick={() => {
            const next: MatrixValue = { ...m };
            for (const [cw, k] of fillable) next[cw] = { ...(next[cw] ?? {}), [k]: implied[k] };
            onChange(next);
          }}
          className="text-[10.5px] tracking-[0.2em] uppercase text-gold hover:text-ink transition-colors"
        >
          ✦ Fill {fillable.length} blank cell{fillable.length > 1 ? "s" : ""} from your answers
        </button>
      )}
      <div className="space-y-6">
        {colorways.map((cw) => {
          const cwName = ((ctx.answers["colorways.names"] as Record<string, string> | undefined) ?? {})[cw];
          const open = cols.filter((c) => {
            const cell = m[cw]?.[c.key];
            return !cell || (!cell.lib && !cell.text);
          }).length;
          return (
            <div key={cw} className="border border-hairline bg-paper" data-testid={`matrix-${cw}`}>
              <div className="flex items-baseline justify-between gap-4 px-6 py-4 border-b border-hairline">
                <div className="flex items-baseline gap-4">
                  <span className="display text-[30px] leading-none">{cw}</span>
                  <span className="text-[11px] tracking-[0.16em] uppercase text-taupe">{cwName || "Colorway"}</span>
                </div>
                {open > 0 ? <span className="text-[10px] tracking-[0.18em] uppercase text-signal">{open} blank</span> : <span className="text-[10px] tracking-[0.18em] uppercase text-ok">Complete ✓</span>}
              </div>
              <div className="divide-y divide-hairline">
                {cols.map((c) => {
                  const cell = m[cw]?.[c.key];
                  const blank = !cell || (!cell.lib && !cell.text);
                  return (
                    <div key={c.key} className={cx("grid sm:grid-cols-[190px_minmax(0,1fr)] items-center gap-x-6 gap-y-2 px-6 py-3", blank && "bg-signal-soft/30")} data-testid={`cell-${cw}-${c.key}`}>
                      <div className="flex items-center gap-2 text-[10.5px] tracking-[0.18em] uppercase text-ink-soft">
                        {c.callout && <CalloutDot n={c.callout} size={20} />}
                        <span className="truncate">{c.label}</span>
                      </div>
                      <div className={cx("flex items-center gap-2 min-w-0", c.lib ? "flex-nowrap" : "flex-wrap")}>
                        {c.lib && (
                          <LibraryPicker
                            compact
                            kind={c.lib === "print" ? "print" : "material"}
                            kinds={c.key === "lining" ? ["print", "material"] : undefined}
                            value={cell?.lib}
                            onChange={(v) => setCell(cw, c.key, v ? { lib: v } : null)}
                            disabled={disabled}
                          />
                        )}
                        {c.key === "hardware_finish" ? (
                          <ChipSelect options={[...HARDWARE_FINISHES, "N/A"]} value={cell?.text} onChange={(t) => setCell(cw, c.key, t ? { text: t } : null)} disabled={disabled} />
                        ) : (
                          <>
                            {QUICK.map((qv) => (
                              <button
                                key={qv}
                                type="button"
                                disabled={disabled}
                                onClick={() => setCell(cw, c.key, cell?.text === qv ? null : { text: qv })}
                                className={cx("h-9 px-3 border text-[10px] tracking-[0.14em]", cell?.text === qv ? "bg-ink text-ivory border-ink" : "border-hairline-strong hover:border-ink")}
                              >
                                {qv}
                              </button>
                            ))}
                            {!c.lib && (
                              <div className="flex-1 min-w-48">
                                <CommitText
                                  value={cell?.text && !QUICK.includes(cell.text) ? cell.text : ""}
                                  onCommit={(t) => setCell(cw, c.key, t ? { text: t } : null)}
                                  disabled={disabled}
                                  placeholder="Other…"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-taupe">Never leave a cell blank — choose a swatch, DTM or N/A. Highlighted cells still need a value.</p>
    </div>
  );
}

function ChipSelect({ options, value, onChange, disabled }: { options: string[]; value?: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 min-w-64 bg-paper border border-hairline-strong px-2 text-[11px] tracking-[0.08em] focus:outline-none focus:border-ink"
    >
      <option value="">—</option>
      {[...options, ...(value && !options.includes(value) ? [value] : [])].map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
