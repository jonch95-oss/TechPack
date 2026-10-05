"use client";

import { useState, useTransition } from "react";
import type { Material } from "@/db/schema";
import { getMaterial, readSwatchCard, saveMaterial, type MaterialInput } from "@/app/actions/library";
import { uploadFile } from "@/lib/client/upload";
import { ChipBoxEditor } from "@/components/chip-box";
import { Badge, Button, Label, TextInput, cx } from "@/components/ui";
import { ApprovalBlock, EMPTY_APPROVAL } from "./approval";

const FIELDS: { key: keyof MaterialInput & string; label: string; placeholder: string; required?: boolean }[] = [
  { key: "iconCode", label: "Icon fabric code (all brands)", placeholder: "F-0000" },
  { key: "supplier", label: "Supplier", placeholder: "JUNFA LEATHER", required: true },
  { key: "articleName", label: "Card / article name", placeholder: "SMOOTH PU" },
  { key: "articleNo", label: "Article no.", placeholder: "AH316HB-P" },
  { key: "colourNo", label: "Colour no.", placeholder: "#24", required: true },
  { key: "colourName", label: "Colour name", placeholder: "IRIDESCENT PINK" },
  { key: "composition", label: "Composition", placeholder: "50% TPU 50% COTTON" },
  { key: "thickness", label: "Thickness", placeholder: "0.85MM ±0.05" },
  { key: "width", label: "Width", placeholder: "138–140CM" },
  { key: "finish", label: "Finish / texture", placeholder: "MIRROR" },
  { key: "backing", label: "Backing / coating", placeholder: "PVC-BACKED" },
  { key: "threadCount", label: "Thread count", placeholder: "210T" },
  { key: "peelStrength", label: "Peel strength", placeholder: "≥ 20 N/3CM" },
  { key: "rubFastness", label: "Rub fastness", placeholder: "DRY 4 / WET 3" },
];

function toInput(m: Material | null): MaterialInput {
  return {
    id: m?.id,
    supplier: m?.supplier ?? "",
    articleName: m?.articleName ?? "",
    articleNo: m?.articleNo ?? "",
    colourNo: m?.colourNo ?? "",
    colourName: m?.colourName ?? "",
    composition: m?.composition ?? "",
    thickness: m?.thickness ?? "",
    width: m?.width ?? "",
    finish: m?.finish ?? "",
    iconCode: m?.iconCode ?? "",
    backing: m?.backing ?? "",
    threadCount: m?.threadCount ?? "",
    peelStrength: m?.peelStrength ?? "",
    rubFastness: m?.rubFastness ?? "",
    qualityOnly: m?.qualityOnly ?? false,
    cardPhotoUrl: m?.cardPhotoUrl ?? null,
    chipBox: m?.chipBox ?? null,
    approval: m?.approval ?? EMPTY_APPROVAL,
  };
}

export function MaterialForm({
  material,
  canEdit,
  onSaved,
  usedIn,
}: {
  material: Material | null;
  canEdit: boolean;
  onSaved?: (m: { id: string; label: string }) => void;
  usedIn?: string[];
}) {
  const [v, setV] = useState<MaterialInput>(toInput(material));
  const [status, setStatus] = useState<Record<string, string>>(material?.fieldStatus ?? {});
  const [notes, setNotes] = useState(material?.aiNotes ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof MaterialInput, val: unknown) => setV((x) => ({ ...x, [k]: val }));
  const pendingAi = Object.entries(status).filter(([, s]) => s === "ai").map(([k]) => k);

  const reload = async (id: string) => {
    const m = await getMaterial(id);
    if (m) {
      setV(toInput(m));
      setStatus(m.fieldStatus);
      setNotes(m.aiNotes);
    }
  };

  const save = (confirmFields?: string[]) =>
    start(async () => {
      const res = await saveMaterial({ ...v, confirmFields });
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      setMsg({ ok: true, text: res.message ?? "Saved." });
      if (res.id) {
        await reload(res.id);
        onSaved?.({ id: res.id, label: [v.supplier, v.articleName, v.colourNo && `/ ${v.colourNo}`, v.colourName].filter(Boolean).join(" ").toUpperCase() });
      }
    });

  const readCard = async () => {
    setReading(true);
    setMsg(null);
    let id = v.id;
    if (!id) {
      const res = await saveMaterial({ ...v, supplier: v.supplier || "UNKNOWN SUPPLIER", colourNo: v.colourNo || "?" });
      if (!res.ok || !res.id) {
        setReading(false);
        return setMsg({ ok: false, text: res.ok ? "Couldn't save." : res.error });
      }
      id = res.id;
    }
    const r = await readSwatchCard(id);
    await reload(id);
    setReading(false);
    setMsg(r.ok ? { ok: true, text: r.message ?? "Read." } : { ok: false, text: r.error });
  };

  return (
    <div className="grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-12">
      <div className="space-y-4 md:sticky md:top-28 self-start">
        <div className="eyebrow">Swatch card</div>
        {v.cardPhotoUrl ? (
          <ChipBoxEditor
            src={v.cardPhotoUrl}
            box={v.chipBox}
            readOnly={!canEdit}
            onChange={(b) => {
              set("chipBox", b);
              setStatus((s) => (s.chipBox === "ai" ? { ...s, chipBox: "confirmed" } : s));
            }}
          />
        ) : (
          <div className="aspect-[3/4] border border-dashed border-hairline-strong flex items-center justify-center text-taupe display italic text-lg">
            No card photo yet
          </div>
        )}
        {status.chipBox === "ai" && (
          <button type="button" title="Accept the chip box the AI found" onClick={() => setStatus((s) => ({ ...s, chipBox: "confirmed" }))}>
            <Badge tone="ai">AI-read — confirm chip ✓</Badge>
          </button>
        )}
        {canEdit && (
          <div className="flex flex-wrap gap-3">
            <label className={cx("cursor-pointer", uploading && "opacity-50 pointer-events-none")}>
              <span className="inline-flex h-8 px-4 items-center border border-ink text-[10px] tracking-[0.18em] uppercase hover:bg-ink hover:text-ivory transition-colors">
                {uploading ? "Uploading…" : v.cardPhotoUrl ? "Replace card photo" : "Upload card photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                data-testid="card-photo-input"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try {
                    set("cardPhotoUrl", await uploadFile(f, "swatches"));
                    set("chipBox", null);
                  } catch (err) {
                    setMsg({ ok: false, text: (err as Error).message });
                  }
                  setUploading(false);
                }}
              />
            </label>
            {v.cardPhotoUrl && (
              <Button type="button" variant="gold" size="sm" onClick={readCard} disabled={reading}>
                {reading ? <span className="shimmer px-2">Reading card…</span> : "Read card with AI"}
              </Button>
            )}
          </div>
        )}
        {notes && (
          <details className="text-[12px] text-taupe">
            <summary className="cursor-pointer eyebrow">Text read from the card</summary>
            <pre className="whitespace-pre-wrap font-sans mt-2 leading-relaxed">{notes}</pre>
          </details>
        )}
      </div>

      <div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`m-${f.key}`} required={f.required}>{f.label}</Label>
                {status[f.key] === "ai" && (
                  <button
                    type="button"
                    className="mb-2"
                    title="Accept the value read from the card"
                    onClick={() => setStatus((s) => ({ ...s, [f.key]: "confirmed" }))}
                  >
                    <Badge tone="ai">AI-read — confirm ✓</Badge>
                  </button>
                )}
              </div>
              <TextInput
                id={`m-${f.key}`}
                value={(v[f.key] as string) ?? ""}
                placeholder={f.placeholder}
                disabled={!canEdit}
                onChange={(e) => {
                  set(f.key, e.target.value.toUpperCase());
                  if (status[f.key] === "ai") setStatus((s) => ({ ...s, [f.key]: "confirmed" }));
                }}
              />
            </div>
          ))}
        </div>
        <label className="mt-7 flex items-center gap-3 text-[13px]" data-testid="quality-only">
          <input type="checkbox" checked={!!v.qualityOnly} disabled={!canEdit} onChange={(e) => set("qualityOnly", e.target.checked)} />
          <span>Quality reference only — linked for its quality, never for a colour</span>
        </label>
        <div className="mt-8">
          <ApprovalBlock value={v.approval ?? EMPTY_APPROVAL} onChange={(a) => set("approval", a)} types={["LAB DIP", "STRIKE-OFF", "SWATCH", "BULK"]} disabled={!canEdit} />
        </div>
        <p className="mt-6 text-[11px] text-taupe">No prices are stored — costing is left to the factory.</p>
        {usedIn && (
          <div className="mt-8">
            <div className="eyebrow mb-2">Used in</div>
            <div className="text-[13px]">{usedIn.length ? usedIn.join(" · ") : <span className="text-mist">Not used in any pack yet</span>}</div>
          </div>
        )}
        {canEdit && (
          <div className="mt-10 flex items-center gap-4">
            <Button
              type="button"
              onClick={() => save(Object.entries(status).filter(([, s]) => s === "confirmed").map(([k]) => k))}
              disabled={pending}
            >
              {pending ? "Saving…" : pendingAi.length ? `Save · ${pendingAi.length} to confirm` : "Save material"}
            </Button>
            {msg && <span className={cx("text-[12px]", msg.ok ? "text-ok" : "text-signal")} role="status">{msg.text}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
