"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Hardware, HardwareRecord } from "@/db/schema";
import { checkHardwareCode, saveHardware, type HardwareInput } from "@/app/actions/library";
import type { CodeCheck } from "@/lib/codes";
import { HARDWARE_FINISHES, HARDWARE_MATERIALS, HARDWARE_TYPES, MOUNTINGS, NON_METAL, RELIEF_TREATMENTS } from "@/lib/questions/common";
import { uploadFile } from "@/lib/client/upload";
import { Badge, Button, Label, Select, TextInput, Thumb, cx } from "@/components/ui";
import { ChipRow, Toggle } from "@/components/chips";
import { ApprovalBlock, EMPTY_APPROVAL } from "./approval";
import { ViewCropDrawer } from "./view-crop";

const LOGO_TREATMENTS = ["ENGRAVED", "DEBOSSED GROOVE", "EMBOSSED", "ENAMEL INLAY", "LASER", "INKED METALLIC LOGO", "NONE"];

export function HardwareForm({
  item,
  brands,
  canEdit,
  defaultBrandId,
  defaultType,
  onSaved,
  usedIn,
  standards = [],
}: {
  item: Hardware | null;
  brands: { id: string; name: string }[];
  canEdit: boolean;
  defaultBrandId?: string;
  defaultType?: string;
  onSaved?: (h: { id: string; label: string }) => void;
  usedIn?: string[];
  /** FINISH STANDARD library items a part can point at. */
  standards?: { id: string; label: string }[];
}) {
  const [v, setV] = useState<HardwareInput>({
    id: item?.id,
    code: item?.code ?? "",
    brandId: item?.brandId ?? defaultBrandId ?? null,
    name: item?.name ?? "",
    type: item?.type ?? defaultType ?? "",
    dimsMm: item?.dimsMm ?? "",
    views: item?.views ?? {},
    viewCrops: item?.viewCrops ?? {},
    material: item?.material ?? "",
    finish: item?.finish ?? "",
    logoTreatment: item?.logoTreatment ?? "",
    enamelPantone: item?.enamelPantone ?? "",
    construction: item?.construction ?? "",
    photoUrl: item?.photoUrl ?? null,
    notes: item?.notes ?? "",
    finishSpec: item?.finishSpec ?? {},
    detailDims: item?.detailDims ?? [],
    approval: item?.approval ?? EMPTY_APPROVAL,
    record: item?.record ?? {},
  });
  // Finish an AI read took from the render (the sheet printed none): shown as a value, flagged until confirmed.
  const [finishAi, setFinishAi] = useState(item?.fieldStatus?.finish === "ai");
  const [check, setCheck] = useState<CodeCheck | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [cropping, setCropping] = useState<"front" | "side" | "rear" | null>(null);
  const set = <K extends keyof HardwareInput>(k: K, val: HardwareInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const rec = v.record ?? {};
  const setRec = (patch: Partial<HardwareRecord>) => setV((x) => ({ ...x, record: { ...(x.record ?? {}), ...patch } }));

  // Live code check (debounced): errors block saving, warnings are called out. A new component
  // gets the brand's next free code pre-filled; the designer can type over it.
  const autoCode = useRef<string | null>(null);
  useEffect(() => {
    if (!v.brandId) return;
    let live = true;
    const t = setTimeout(() => {
      checkHardwareCode(v.brandId, v.code ?? "", v.id).then((c) => {
        if (!live) return;
        setCheck(c);
        if (!item && c.suggestion && (!v.code || v.code === autoCode.current) && v.code !== c.suggestion) {
          autoCode.current = c.suggestion;
          setV((x) => ({ ...x, code: c.suggestion! }));
        }
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [v.brandId, v.code, v.id, item]);

  const upload = async (f: File, apply: (url: string) => void) => {
    try {
      apply(await uploadFile(f, "hardware"));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-12">
      <div className="space-y-9">
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
          <div>
            <Label required>Brand</Label>
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
          <div>
            <Label htmlFor="hw-code" required>Code</Label>
            <TextInput
              id="hw-code"
              value={v.code}
              disabled={!canEdit}
              placeholder={check?.suggestion ?? ""}
              className="display !text-[22px]"
              onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s+/g, ""))}
            />
            <div className="mt-2 space-y-1 text-[11px] leading-relaxed" data-testid="code-check" aria-live="polite">
              {check?.errors.map((m) => (
                <p key={m} className="text-signal">{m}</p>
              ))}
              {check?.warnings.map((m) => (
                <p key={m} className="text-gold">{m}</p>
              ))}
              {canEdit && check?.suggestion && v.code !== check.suggestion && !item && (
                <button type="button" className="eyebrow hover:text-ink" onClick={() => set("code", check.suggestion)}>
                  Use next free · {check.suggestion}
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <Label required>Type</Label>
          <ChipRow options={HARDWARE_TYPES} value={v.type} onChange={(x) => set("type", x)} disabled={!canEdit} />
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
          <div>
            <Label>Name / description</Label>
            <TextInput value={v.name} disabled={!canEdit} placeholder="PINK LONDON LOGO PLATE" onChange={(e) => set("name", e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Dimensions (mm)</Label>
            <TextInput value={v.dimsMm} disabled={!canEdit} placeholder="40 X 20 X 2" onChange={(e) => set("dimsMm", e.target.value.toUpperCase())} />
          </div>
        </div>
        <div>
          <Label>Material</Label>
          <ChipRow options={HARDWARE_MATERIALS} value={v.material} onChange={(x) => set("material", x)} disabled={!canEdit} allowOther />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label>Finish</Label>
            {finishAi && (
              <button type="button" className="mb-2" data-testid="finish-ai" title="Accept the finish taken from the render" disabled={!canEdit} onClick={() => setFinishAi(false)}>
                <Badge tone="ai">AI-suggested — confirm ✓</Badge>
              </button>
            )}
          </div>
          <ChipRow
            options={HARDWARE_FINISHES}
            value={v.finish}
            onChange={(x) => {
              set("finish", x);
              setFinishAi(false);
            }}
            disabled={!canEdit}
            allowOther
          />
        </div>
        <div>
          <Label>Logo treatment</Label>
          <ChipRow options={LOGO_TREATMENTS} value={v.logoTreatment} onChange={(x) => set("logoTreatment", x)} disabled={!canEdit} allowOther />
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
          <div>
            <Label>Enamel colour (Pantone)</Label>
            <TextInput value={v.enamelPantone} disabled={!canEdit} placeholder="PANTONE 203 C" onChange={(e) => set("enamelPantone", e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Hollow or solid</Label>
            <ChipRow options={["HOLLOW", "SOLID"]} value={v.construction} onChange={(x) => set("construction", x)} disabled={!canEdit} />
          </div>
        </div>
        <div className="space-y-3" data-testid="detail-dims">
          <div className="eyebrow">Detail dimensions — 100% drawing</div>
          <p className="text-[11px] text-taupe">Every measurement the factory needs on the drawing (e.g. TOP WIDTH 10, THICKNESS 2.4). Notes without a number (HOLLOW) are fine.</p>
          {(v.detailDims ?? []).map((d, k) => (
            <div key={k} className="flex items-end gap-3">
              <TextInput value={d.label} disabled={!canEdit} placeholder="TOP WIDTH" aria-label={`Detail ${k + 1} label`} className="flex-1 uppercase" onChange={(e) => set("detailDims", (v.detailDims ?? []).map((x, i) => (i === k ? { ...x, label: e.target.value.toUpperCase() } : x)))} />
              <TextInput value={d.mm ?? ""} disabled={!canEdit} placeholder="MM" inputMode="decimal" aria-label={`Detail ${k + 1} mm`} className="w-24" onChange={(e) => set("detailDims", (v.detailDims ?? []).map((x, i) => (i === k ? { ...x, mm: e.target.value === "" ? null : Number(e.target.value) } : x)))} />
              {canEdit && <button type="button" className="text-taupe hover:text-signal pb-2" aria-label={`Remove detail ${k + 1}`} onClick={() => set("detailDims", (v.detailDims ?? []).filter((_, i) => i !== k))}>✕</button>}
            </div>
          ))}
          {canEdit && <button type="button" className="eyebrow hover:text-ink" onClick={() => set("detailDims", [...(v.detailDims ?? []), { label: "", mm: null }])}>+ Add dimension</button>}
        </div>
        <div className="border border-hairline bg-paper p-5 space-y-5">
          <div className="eyebrow">Finish spec</div>
          <div>
            <div className="eyebrow mb-2 text-ink-soft">Plating</div>
            <ChipRow options={["ELECTROPLATE", "PVD", "ION PLATING", "POWDER COAT", "PAINT", "RAW"]} value={v.finishSpec?.plating} onChange={(x) => set("finishSpec", { ...v.finishSpec, plating: x })} disabled={!canEdit} />
          </div>
          <div>
            <div className="eyebrow mb-2 text-ink-soft">Coating</div>
            <ChipRow options={["LACQUER", "E-COAT", "NONE"]} value={v.finishSpec?.coating} onChange={(x) => set("finishSpec", { ...v.finishSpec, coating: x })} disabled={!canEdit} />
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            <div>
              <Label>Plating thickness</Label>
              <TextInput value={v.finishSpec?.platingThickness ?? ""} disabled={!canEdit} placeholder="0.5 MICRON" onChange={(e) => set("finishSpec", { ...v.finishSpec, platingThickness: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Mould no.</Label>
              <TextInput value={v.finishSpec?.mouldNo ?? ""} disabled={!canEdit} onChange={(e) => set("finishSpec", { ...v.finishSpec, mouldNo: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Nickel-free (EU)</Label>
              <Toggle value={v.finishSpec?.nickelFree ?? null} onChange={(x) => set("finishSpec", { ...v.finishSpec, nickelFree: x })} disabled={!canEdit} />
            </div>
            <div>
              <Label>New mould needed</Label>
              <Toggle value={v.finishSpec?.newMould ?? null} onChange={(x) => set("finishSpec", { ...v.finishSpec, newMould: x })} disabled={!canEdit} />
            </div>
          </div>
        </div>
        <div className="border border-hairline bg-paper p-5 space-y-5" data-testid="component-record">
          <div className="eyebrow">Component record</div>
          {(NON_METAL.includes(v.material) || v.finish === "PANTONE-MATCHED PLASTIC") && (
            <div>
              <Label>Colour / Pantone</Label>
              <TextInput value={rec.colour ?? ""} disabled={!canEdit} placeholder="PANTONE 19-4005 TCX" onChange={(e) => setRec({ colour: e.target.value.toUpperCase() })} />
            </div>
          )}
          <div>
            <Label>Mounting / attachment</Label>
            <ChipRow options={MOUNTINGS} value={rec.mounting} onChange={(x) => setRec({ mounting: x })} disabled={!canEdit} allowOther />
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            <div>
              <Label>Orientation</Label>
              <TextInput value={rec.orientation ?? ""} disabled={!canEdit} placeholder="LOGO READS UPRIGHT" onChange={(e) => setRec({ orientation: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Parent part</Label>
              <TextInput value={rec.parent ?? ""} disabled={!canEdit} placeholder="WHEEL" onChange={(e) => setRec({ parent: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <div>
            <Label>Finish standard (shared)</Label>
            <Select value={rec.finishStandardId ?? ""} disabled={!canEdit} onChange={(e) => setRec({ finishStandardId: e.target.value || null })}>
              <option value="">— none —</option>
              {standards.filter((x) => x.id !== v.id).map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-3">
            <div className="eyebrow text-ink-soft">Relief and surface treatments</div>
            {(rec.relief ?? []).map((r, k) => (
              <div key={k} className="space-y-2">
                <ChipRow options={RELIEF_TREATMENTS} value={r.treatment} onChange={(x) => setRec({ relief: (rec.relief ?? []).map((y, i) => (i === k ? { ...y, treatment: x ?? "" } : y)) })} disabled={!canEdit} allowOther />
                <div className="flex items-end gap-3">
                  <TextInput value={r.mm ?? ""} disabled={!canEdit} placeholder="MM" inputMode="decimal" aria-label={`Relief ${k + 1} mm`} className="w-24" onChange={(e) => setRec({ relief: (rec.relief ?? []).map((y, i) => (i === k ? { ...y, mm: e.target.value === "" ? null : Number(e.target.value) } : y)) })} />
                  <TextInput value={r.location} disabled={!canEdit} placeholder="LOGO ART" aria-label={`Relief ${k + 1} location`} className="flex-1 uppercase" onChange={(e) => setRec({ relief: (rec.relief ?? []).map((y, i) => (i === k ? { ...y, location: e.target.value.toUpperCase() } : y)) })} />
                  {canEdit && <button type="button" className="text-taupe hover:text-signal pb-2" aria-label={`Remove relief ${k + 1}`} onClick={() => setRec({ relief: (rec.relief ?? []).filter((_, i) => i !== k) })}>✕</button>}
                </div>
              </div>
            ))}
            {canEdit && <button type="button" className="eyebrow hover:text-ink" onClick={() => setRec({ relief: [...(rec.relief ?? []), { treatment: "", mm: null, location: "" }] })}>+ Add treatment</button>}
          </div>
          <div className="space-y-3">
            <div className="eyebrow text-ink-soft">Used on</div>
            {(rec.usage ?? []).map((u, k) => (
              <div key={k} className="flex items-end gap-3">
                <TextInput value={u.style} disabled={!canEdit} placeholder="STYLE #" aria-label={`Usage ${k + 1} style`} className="w-40 uppercase" onChange={(e) => setRec({ usage: (rec.usage ?? []).map((y, i) => (i === k ? { ...y, style: e.target.value.toUpperCase() } : y)) })} />
                <TextInput value={u.qty ?? ""} disabled={!canEdit} placeholder="QTY" inputMode="numeric" aria-label={`Usage ${k + 1} qty`} className="w-20" onChange={(e) => setRec({ usage: (rec.usage ?? []).map((y, i) => (i === k ? { ...y, qty: e.target.value === "" ? null : Number(e.target.value) } : y)) })} />
                <TextInput value={u.location} disabled={!canEdit} placeholder="LOCATION" aria-label={`Usage ${k + 1} location`} className="flex-1 uppercase" onChange={(e) => setRec({ usage: (rec.usage ?? []).map((y, i) => (i === k ? { ...y, location: e.target.value.toUpperCase() } : y)) })} />
                {canEdit && <button type="button" className="text-taupe hover:text-signal pb-2" aria-label={`Remove usage ${k + 1}`} onClick={() => setRec({ usage: (rec.usage ?? []).filter((_, i) => i !== k) })}>✕</button>}
              </div>
            ))}
            {canEdit && <button type="button" className="eyebrow hover:text-ink" onClick={() => setRec({ usage: [...(rec.usage ?? []), { style: "", qty: null, location: "" }] })}>+ Add style</button>}
          </div>
        </div>
        <ApprovalBlock value={v.approval ?? EMPTY_APPROVAL} onChange={(a) => set("approval", a)} types={["PLATING SAMPLE", "MOULD", "SAMPLE", "BULK"]} disabled={!canEdit} />
        <div>
          <Label>Notes</Label>
          <TextInput value={v.notes} disabled={!canEdit} onChange={(e) => set("notes", e.target.value.toUpperCase())} />
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <div className="eyebrow mb-3">Photo</div>
          <Thumb src={v.photoUrl} alt="Hardware photo" className="w-full aspect-square" />
          {canEdit && <FileButton label={v.photoUrl ? "Replace photo" : "Upload photo"} onFile={(f) => upload(f, (u) => set("photoUrl", u))} testId="hw-photo" />}
        </div>
        <div>
          <div className="eyebrow mb-3">Views at 100% scale</div>
          <div className="grid grid-cols-3 gap-3">
            {(["front", "side", "rear"] as const).map((k) => (
              <div key={k}>
                <Thumb src={v.views[k]} alt={`${k} view`} className="w-full aspect-square" />
                <div className="flex items-center justify-between mt-1">
                  <span className="eyebrow">{k}</span>
                  {canEdit && (
                    <FileButton
                      small
                      label="+"
                      onFile={(f) =>
                        upload(f, (u) => {
                          set("views", { ...v.views, [k]: u });
                          set("viewCrops", { ...(v.viewCrops ?? {}), [k]: null }); // a new image needs its own crop
                        })
                      }
                    />
                  )}
                </div>
                {v.views[k] && (
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setCropping(k)}
                    data-testid={`hw-crop-${k}`}
                    className={cx("mt-1 text-[10px] tracking-[0.12em] uppercase", v.viewCrops?.[k] ? "text-taupe" : "text-signal")}
                  >
                    {v.viewCrops?.[k] ? "Cropped ✓" : "Crop to the part"}
                  </button>
                )}
              </div>
            ))}
            {cropping && v.views[cropping] && (
              <ViewCropDrawer
                key={cropping}
                src={v.views[cropping]!}
                label={`${v.code || "Hardware"} · ${cropping} view`}
                crop={v.viewCrops?.[cropping] ?? null}
                open
                onClose={() => setCropping(null)}
                onSave={(c) => {
                  set("viewCrops", { ...(v.viewCrops ?? {}), [cropping]: c });
                  setCropping(null);
                }}
              />
            )}
          </div>
        </div>
        {usedIn && (
          <div>
            <div className="eyebrow mb-2">Used in</div>
            <div className="text-[13px]">{usedIn.length ? usedIn.join(" · ") : <span className="text-mist">Not used in any pack yet</span>}</div>
          </div>
        )}
        {canEdit && (
          <div className="flex items-center gap-4 pt-2">
            <Button
              type="button"
              disabled={pending || !v.type || !v.brandId || !v.code || !!check?.errors.length}
              onClick={() =>
                start(async () => {
                  const res = await saveHardware({ ...v, confirmFields: item?.fieldStatus?.finish === "ai" && !finishAi ? ["finish"] : [] });
                  if (!res.ok) return setMsg({ ok: false, text: res.error });
                  setMsg({ ok: true, text: res.message ?? "Saved." });
                  if (res.id) {
                    setV((x) => ({ ...x, id: res.id, code: res.code ?? x.code }));
                    onSaved?.({ id: res.id, label: res.code ?? v.code ?? "" });
                  }
                })
              }
            >
              {pending ? "Saving…" : item || v.id ? "Save component" : `Create ${v.code || "component"}`}
            </Button>
            {msg && <span className={cx("text-[12px]", msg.ok ? "text-ok" : "text-signal")} role="status">{msg.text}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function FileButton({ label, onFile, small, testId, accept = "image/*" }: { label: string; onFile: (f: File) => void | Promise<void>; small?: boolean; testId?: string; accept?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={cx("inline-flex cursor-pointer", busy && "opacity-50 pointer-events-none", !small && "mt-3")}>
      <span
        className={cx(
          "inline-flex items-center border border-ink uppercase hover:bg-ink hover:text-ivory transition-colors",
          small ? "h-6 px-2 text-[11px]" : "h-8 px-4 text-[10px] tracking-[0.18em]",
        )}
      >
        {busy ? "…" : label}
      </span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        data-testid={testId}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          await onFile(f);
          setBusy(false);
        }}
      />
    </label>
  );
}
