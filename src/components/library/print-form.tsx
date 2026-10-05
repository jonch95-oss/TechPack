"use client";

import { useState, useTransition } from "react";
import type { PantoneColour, Print } from "@/db/schema";
import { savePrint, type PrintInput } from "@/app/actions/library";
import { uploadFile } from "@/lib/client/upload";
import { Button, Label, TextInput, Thumb, cx } from "@/components/ui";
import { ChipRow } from "@/components/chips";
import { FileButton } from "./hardware-form";

const REPEATS = ["STRAIGHT", "HALF-DROP", "BRICK", "DIAGONAL", "MIRROR", "TOSSED"];
const APPLICATIONS = ["DIGITAL PRINT", "SCREEN PRINT", "HEAT TRANSFER", "TONAL HEAT STAMP", "FOIL STAMP", "JACQUARD", "DEBOSS", "EMBOSS"];

export function PrintForm({
  item,
  brands,
  materials,
  canEdit,
  defaultBrandId,
  onSaved,
  usedIn,
}: {
  item: Print | null;
  brands: { id: string; name: string }[];
  materials: { id: string; label: string }[];
  canEdit: boolean;
  defaultBrandId?: string;
  onSaved?: (p: { id: string; label: string }) => void;
  usedIn?: string[];
}) {
  const [v, setV] = useState<PrintInput>({
    id: item?.id,
    name: item?.name ?? "",
    brandId: item?.brandId ?? defaultBrandId ?? null,
    motif: item?.motif ?? "",
    motifUrl: item?.motifUrl ?? null,
    repeatType: item?.repeatType ?? "",
    tileW: item?.tileW ?? "",
    tileH: item?.tileH ?? "",
    tileUnit: item?.tileUnit ?? "cm",
    colours: item?.colours?.length ? item.colours : [{ system: "C", code: "" }],
    application: item?.application ?? "",
    baseFabricId: item?.baseFabricId ?? null,
    baseFabricText: item?.baseFabricText ?? "",
    sourceFiles: item?.sourceFiles ?? [],
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof PrintInput>(k: K, val: PrintInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const setColour = (i: number, c: Partial<PantoneColour>) => set("colours", v.colours.map((x, j) => (j === i ? { ...x, ...c } : x)));

  return (
    <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-12">
      <div className="space-y-9">
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
          <div>
            <Label htmlFor="p-name" required>Name</Label>
            <TextInput id="p-name" value={v.name} disabled={!canEdit} placeholder="PINK TONAL HEAT STAMP REPEAT" onChange={(e) => set("name", e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Brand</Label>
            <select
              className="w-full h-10 bg-transparent border-0 border-b border-hairline-strong focus:outline-none focus:border-ink"
              value={v.brandId ?? ""}
              disabled={!canEdit}
              onChange={(e) => set("brandId", e.target.value || null)}
            >
              <option value="">—</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="p-motif">Motif</Label>
            <TextInput id="p-motif" value={v.motif} disabled={!canEdit} placeholder="PINK WORDMARK" onChange={(e) => set("motif", e.target.value.toUpperCase())} />
          </div>
        </div>
        <div>
          <Label required>Repeat type</Label>
          <ChipRow options={REPEATS} value={v.repeatType} onChange={(x) => set("repeatType", x)} disabled={!canEdit} />
        </div>
        <div>
          <Label required>Tile size (W × H)</Label>
          <div className="flex items-center gap-3">
            <TextInput aria-label="Tile width" className="w-24 text-center" value={v.tileW} disabled={!canEdit} onChange={(e) => set("tileW", e.target.value)} />
            <span className="text-taupe">×</span>
            <TextInput aria-label="Tile height" className="w-24 text-center" value={v.tileH} disabled={!canEdit} onChange={(e) => set("tileH", e.target.value)} />
            <ChipRow options={["cm", "mm", "in"]} value={v.tileUnit} onChange={(x) => set("tileUnit", x || "cm")} allowOther={false} disabled={!canEdit} />
          </div>
        </div>
        <div>
          <Label required>Colours (Pantone C / TCX)</Label>
          <div className="space-y-3">
            {v.colours.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <ChipRow options={["C", "TCX"]} value={c.system} onChange={(x) => setColour(i, { system: (x || "C") as PantoneColour["system"] })} allowOther={false} disabled={!canEdit} />
                <TextInput
                  aria-label={`Colour ${i + 1}`}
                  className="max-w-xs"
                  value={c.code}
                  disabled={!canEdit}
                  placeholder={c.system === "TCX" ? "17-3914 TCX SHARKSKIN" : "PANTONE 203 C"}
                  onChange={(e) => setColour(i, { code: e.target.value.toUpperCase() })}
                />
                {canEdit && v.colours.length > 1 && (
                  <button type="button" className="text-taupe hover:text-signal text-[18px]" onClick={() => set("colours", v.colours.filter((_, j) => j !== i))} aria-label="Remove colour">
                    ×
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <button type="button" className="eyebrow hover:text-ink" onClick={() => set("colours", [...v.colours, { system: "C", code: "" }])}>
                + Add colour
              </button>
            )}
          </div>
        </div>
        <div>
          <Label required>Application method</Label>
          <ChipRow options={APPLICATIONS} value={v.application} onChange={(x) => set("application", x)} disabled={!canEdit} />
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
          <div>
            <Label>Base fabric (library)</Label>
            <select
              className="w-full h-10 bg-transparent border-0 border-b border-hairline-strong focus:outline-none focus:border-ink"
              value={v.baseFabricId ?? ""}
              disabled={!canEdit}
              onChange={(e) => set("baseFabricId", e.target.value || null)}
            >
              <option value="">—</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>…or base fabric</Label>
            <TextInput value={v.baseFabricText} disabled={!canEdit} placeholder="190D POLY HEAT SEAL TEXTURE" onChange={(e) => set("baseFabricText", e.target.value.toUpperCase())} />
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <div className="eyebrow mb-3">Motif / repeat preview</div>
          <Thumb src={v.motifUrl} alt="Motif" className="w-full aspect-square" />
          {canEdit && (
            <FileButton
              label={v.motifUrl ? "Replace image" : "Upload motif / tile"}
              onFile={async (f) => {
                try {
                  set("motifUrl", await uploadFile(f, "prints"));
                } catch (e) {
                  setMsg({ ok: false, text: (e as Error).message });
                }
              }}
            />
          )}
        </div>
        <div>
          <div className="eyebrow mb-3">Source files (AI / EPS / PSD)</div>
          <ul className="space-y-2 text-[13px]">
            {v.sourceFiles.map((f, i) => (
              <li key={f.url} className="flex justify-between border-b border-hairline pb-2">
                <a href={f.url} className="underline decoration-hairline-strong underline-offset-4 hover:decoration-ink">{f.name}</a>
                {canEdit && (
                  <button type="button" className="text-taupe hover:text-signal" onClick={() => set("sourceFiles", v.sourceFiles.filter((_, j) => j !== i))} aria-label="Remove file">
                    ×
                  </button>
                )}
              </li>
            ))}
            {!v.sourceFiles.length && <li className="text-mist">None yet</li>}
          </ul>
          {canEdit && (
            <FileButton
              label="Add source file"
              accept=".ai,.eps,.psd,.svg,.pdf"
              onFile={async (f) => {
                try {
                  const url = await uploadFile(f, "prints");
                  set("sourceFiles", [...v.sourceFiles, { name: f.name, url }]);
                } catch (e) {
                  setMsg({ ok: false, text: (e as Error).message });
                }
              }}
            />
          )}
        </div>
        {usedIn && (
          <div>
            <div className="eyebrow mb-2">Used in</div>
            <div className="text-[13px]">{usedIn.length ? usedIn.join(" · ") : <span className="text-mist">Not used in any pack yet</span>}</div>
          </div>
        )}
        {canEdit && (
          <div className="flex items-center gap-4">
            <Button
              type="button"
              disabled={pending || !v.name}
              onClick={() =>
                start(async () => {
                  const res = await savePrint(v);
                  if (!res.ok) return setMsg({ ok: false, text: res.error });
                  setMsg({ ok: true, text: res.message ?? "Saved." });
                  if (res.id) {
                    setV((x) => ({ ...x, id: res.id }));
                    onSaved?.({ id: res.id, label: `PRINT: ${v.name.toUpperCase()}` });
                  }
                })
              }
            >
              {pending ? "Saving…" : "Save artwork"}
            </Button>
            {msg && <span className={cx("text-[12px]", msg.ok ? "text-ok" : "text-signal")} role="status">{msg.text}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
