"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteFlat } from "@/app/actions/flats";
import { Badge, Button, Empty, cx } from "@/components/ui";
import { FileButton } from "@/components/library/hardware-form";
import { FlatEditor, type FlatData } from "./flat-editor";

const VIEWS = ["FRONT", "BACK", "SIDE", "TOP"] as const;
const VIEW_NOTE: Record<(typeof VIEWS)[number], string> = {
  FRONT: "Generated first, from the render.",
  BACK: "Inferred — labelled INFERRED — CONFIRM until approved.",
  SIDE: "On request: gusset depth and strap attachment.",
  TOP: "On request: opening and depth.",
};

/** View tabs, generation (image API / own drawing) and the editor for the chosen view. */
export function FlatStudio({ packId, flats, canEdit, hasRender, dims, initialView }: { packId: string; flats: FlatData[]; canEdit: boolean; hasRender: boolean; dims: string; initialView?: string }) {
  const router = useRouter();
  const [list, setList] = useState(flats);
  const [view, setView] = useState<string>(initialView && VIEWS.includes(initialView as never) ? initialView : (flats[0]?.view ?? "FRONT"));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flat = list.find((f) => f.view === view);

  const generate = async (v: string, file?: File) => {
    setBusy(v);
    setMsg(null);
    try {
      const res = file
        ? await fetch(`/api/packs/${packId}/flats`, { method: "POST", body: (() => { const fd = new FormData(); fd.append("view", v); fd.append("file", file); return fd; })() })
        : await fetch(`/api/packs/${packId}/flats`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ view: v }) });
      const json = (await res.json().catch(() => ({}))) as { flat?: FlatData; note?: string; error?: string };
      if (!res.ok || !json.flat) throw new Error(json.error ?? `Failed (${res.status})`);
      setList((l) => [...l.filter((f) => f.view !== v), json.flat!]);
      setView(v);
      setMsg({ ok: true, text: json.note || `${v.toLowerCase()} view ready.` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline">
        <div className="flex gap-1" role="tablist">
          {VIEWS.map((v) => {
            const f = list.find((x) => x.view === v);
            return (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cx("px-5 h-11 text-[11px] tracking-[0.18em] uppercase border-b-2 -mb-px transition-colors", view === v ? "border-ink text-ink" : "border-transparent text-taupe hover:text-ink")}
                data-testid={`view-${v}`}
              >
                {v}
                {f && <span className={cx("ml-2 inline-block w-1.5 h-1.5 rounded-full align-middle", f.status === "INFERRED" ? "bg-signal" : f.status === "CONFIRMED" ? "bg-ok" : "bg-gold")} />}
              </button>
            );
          })}
        </div>
        {flat && (
          <div className="flex items-center gap-3 pb-2">
            <Badge tone={flat.status === "INFERRED" ? "signal" : flat.status === "CONFIRMED" ? "ok" : "ai"}>{flat.status === "INFERRED" ? "Inferred — confirm" : flat.status === "CONFIRMED" ? "Approved" : "Draft"}</Badge>
            {(["svg", "ai", "eps"] as const).map((x) => (
              <a key={x} href={`/api/packs/${packId}/flats/${flat.view.toLowerCase()}.${x}`} className="eyebrow hover:text-ink" download data-testid={`download-${x}`}>
                {x.toUpperCase()}
              </a>
            ))}
          </div>
        )}
      </div>

      {msg && <p className={cx("text-[12px]", msg.ok ? "text-ok" : "text-signal")} role="status" data-testid="flat-msg">{msg.text}</p>}

      {flat ? (
        <>
          <FlatEditor key={`${flat.id}-${flat.updatedAt}-${flat.status}`} flat={flat} canEdit={canEdit} onChange={(f) => setList((l) => l.map((x) => (x.id === f.id ? { ...x, status: f.status, svg: f.svg } : x)))} />
          {canEdit && (
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-hairline">
              <Button size="sm" variant="ghost" disabled={!!busy || !hasRender} onClick={() => confirm(`Generate the ${view.toLowerCase()} view again? Your edits to it are replaced.`) && generate(view)}>
                {busy === view ? "Generating…" : "Generate again"}
              </Button>
              <FileButton label="Trace my own drawing" onFile={(f) => generate(view, f)} small />
              <button
                className="eyebrow hover:text-signal ml-auto"
                onClick={async () => {
                  if (!confirm(`Delete the ${view.toLowerCase()} view?`)) return;
                  const r = await deleteFlat(flat.id);
                  if (r.ok) setList((l) => l.filter((x) => x.id !== flat.id));
                }}
              >
                Delete view
              </button>
            </div>
          )}
        </>
      ) : (
        <Empty
          title={`No ${view.toLowerCase()} view yet`}
          action={
            canEdit ? (
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button onClick={() => generate(view)} disabled={!!busy || !hasRender} data-testid="generate-flat">
                  {busy === view ? "Generating… (up to a minute)" : `Generate ${view.toLowerCase()} view`}
                </Button>
                <FileButton label="Or trace my own drawing" onFile={(f) => generate(view, f)} testId="upload-flat" />
              </div>
            ) : undefined
          }
        >
          {VIEW_NOTE[view as (typeof VIEWS)[number]]} {dims ? `Scaled to ${dims}.` : "Enter H × W × D first so it can be scaled."}
          {!hasRender && <span className="block text-signal mt-2">Upload the render on the pack first.</span>}
        </Empty>
      )}
    </div>
  );
}
