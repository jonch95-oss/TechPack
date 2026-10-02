"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { LibraryOptions } from "@/lib/data";
import type { LibKind, LibValue } from "@/lib/questions/types";
import { Drawer } from "@/components/drawer";
import { MaterialForm } from "@/components/library/material-form";
import { HardwareForm } from "@/components/library/hardware-form";
import { PrintForm } from "@/components/library/print-form";
import { Button, SwatchThumb, cx } from "@/components/ui";

type Opt = { id: string; label: string; sub: string; photo: string | null; type?: string; brandId?: string | null; chipBox?: { x: number; y: number; w: number; h: number } | null; composition?: string; approval?: string };

type Ctx = {
  options: Record<LibKind, Opt[]>;
  brands: LibraryOptions["brands"];
  brandId: string;
  add: (kind: LibKind, o: Opt) => void;
};
const LibraryCtx = createContext<Ctx | null>(null);

export function LibraryProvider({ initial, brandId, children }: { initial: LibraryOptions; brandId: string; children: ReactNode }) {
  const [options, setOptions] = useState<Record<LibKind, Opt[]>>({
    material: initial.materials,
    hardware: initial.hardware,
    print: initial.prints,
  });
  const value = useMemo<Ctx>(
    () => ({
      options,
      brands: initial.brands,
      brandId,
      add: (kind, o) => setOptions((x) => ({ ...x, [kind]: [...x[kind].filter((y) => y.id !== o.id), o] })),
    }),
    [options, initial.brands, brandId],
  );
  return <LibraryCtx.Provider value={value}>{children}</LibraryCtx.Provider>;
}

export function useLibrary() {
  const c = useContext(LibraryCtx);
  if (!c) throw new Error("LibraryProvider missing");
  return c;
}

const KIND_NAME: Record<LibKind, string> = { material: "Material / swatch card", hardware: "Hardware / trim", print: "Print artwork" };

/** Library picker with search and "+ New". */
export function LibraryPicker({
  kind,
  kinds,
  value,
  onChange,
  hardwareTypes,
  disabled,
  testId,
  compact,
}: {
  kind: LibKind;
  /** Allow choosing from several libraries (e.g. lining = material or print). */
  kinds?: LibKind[];
  value: LibValue | undefined | null;
  onChange: (v: LibValue | null) => void;
  hardwareTypes?: string[];
  disabled?: boolean;
  testId?: string;
  compact?: boolean;
}) {
  const lib = useLibrary();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<LibKind>(kind);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const all = kinds ?? [kind];
  const current = value ? Object.values(lib.options).flat().find((o) => o.id === value.id) : null;

  const list = lib.options[tab]
    .filter((o) => !q || `${o.label} ${o.sub}`.toUpperCase().includes(q.toUpperCase()))
    .sort((a, b) => {
      // this brand's hardware first, then matching types
      const score = (o: Opt) => (o.brandId === lib.brandId ? 0 : 1) + (hardwareTypes?.length && o.type && !hardwareTypes.includes(o.type) ? 2 : 0);
      return score(a) - score(b) || a.label.localeCompare(b.label);
    });

  const pick = (o: { id: string; label: string }) => {
    onChange({ id: o.id, label: o.label });
    setOpen(false);
    setCreating(false);
    setQ("");
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          data-testid={testId}
          onClick={() => {
            setTab(kind);
            setOpen(true);
          }}
          className={cx(
            "group flex items-center gap-3 border text-left transition-colors bg-paper",
            compact ? "h-9 px-3 min-w-44 max-w-[24rem]" : "h-14 pl-2 pr-5 min-w-72 max-w-full",
            value ? "border-ink" : "border-dashed border-hairline-strong hover:border-ink",
          )}
        >
          {!compact && <SwatchThumb src={current?.photo} box={current?.chipBox} alt="" className="w-10 h-10 shrink-0" />}
          {compact && current?.chipBox && <SwatchThumb src={current.photo} box={current.chipBox} alt="" className="w-6 h-6 shrink-0" />}
          <span className="min-w-0 overflow-hidden">
            <span className={cx("block truncate", compact ? "text-[11px] tracking-[0.08em]" : "text-[13px] tracking-[0.06em]", !value && "text-taupe italic")}>
              {value?.label ?? "Choose from library…"}
            </span>
            {!compact && current?.sub && <span className="block text-[10.5px] text-taupe truncate max-w-72">{current.sub}</span>}
          </span>
        </button>
        {value && !disabled && (
          <button type="button" className="text-taupe hover:text-signal text-[11px] tracking-[0.18em] uppercase" onClick={() => onChange(null)} aria-label="Clear">
            ×
          </button>
        )}
      </div>

      <Drawer open={open} onClose={() => { setOpen(false); setCreating(false); }} eyebrow="Library" title={creating ? `New ${KIND_NAME[tab].toLowerCase()}` : KIND_NAME[tab]} wide={creating}>
        {creating ? (
          <div>
            <button type="button" className="eyebrow mb-8 hover:text-ink" onClick={() => setCreating(false)}>← Back to library</button>
            {tab === "material" && (
              <MaterialForm
                material={null}
                canEdit
                onSaved={(m) => {
                  lib.add("material", { ...m, sub: "", photo: null });
                  pick(m);
                }}
              />
            )}
            {tab === "hardware" && (
              <HardwareForm
                item={null}
                brands={lib.brands}
                canEdit
                defaultBrandId={lib.brandId}
                defaultType={hardwareTypes?.[0]}
                onSaved={(h) => {
                  lib.add("hardware", { ...h, sub: "NEW", photo: null, brandId: lib.brandId });
                  pick(h);
                }}
              />
            )}
            {tab === "print" && (
              <PrintForm
                item={null}
                brands={lib.brands}
                materials={lib.options.material}
                canEdit
                defaultBrandId={lib.brandId}
                onSaved={(p) => {
                  lib.add("print", { ...p, sub: "", photo: null });
                  pick(p);
                }}
              />
            )}
          </div>
        ) : (
          <div>
            {all.length > 1 && (
              <div className="flex gap-6 mb-6 border-b border-hairline">
                {all.map((k) => (
                  <button key={k} type="button" onClick={() => setTab(k)} className={cx("pb-3 -mb-px text-[10.5px] tracking-[0.22em] uppercase", tab === k ? "border-b border-ink text-ink" : "text-taupe")}>
                    {KIND_NAME[k]}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mb-6">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search code, supplier, colour…"
                className="flex-1 h-11 bg-transparent border-b border-hairline-strong focus:border-ink focus:outline-none text-[14px]"
                aria-label="Search library"
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => setCreating(true)}>
                + New
              </Button>
            </div>
            <ul className="divide-y divide-hairline border-y border-hairline">
              {list.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => pick(o)}
                    className={cx("w-full flex items-center gap-4 py-3 px-2 text-left hover:bg-paper transition-colors", value?.id === o.id && "bg-paper")}
                  >
                    <SwatchThumb src={o.photo} box={o.chipBox} alt="" className="w-12 h-12 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] tracking-[0.06em] truncate">{o.label}</span>
                      <span className="block text-[11px] text-taupe truncate">{o.sub}</span>
                    </span>
                    {value?.id === o.id && <span className="eyebrow text-ink">Selected</span>}
                  </button>
                </li>
              ))}
              {!list.length && <li className="py-10 text-center text-taupe display italic text-lg">Nothing matches — use + New.</li>}
            </ul>
          </div>
        )}
      </Drawer>
    </>
  );
}
