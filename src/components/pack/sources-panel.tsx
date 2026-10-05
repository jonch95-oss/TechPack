"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PackFile } from "@/db/schema";
import { addPackFile, removePackFile } from "@/app/actions/packs";
import { uploadFile } from "@/lib/client/upload";
import { pollJob, startJobRequest, type JobState } from "@/components/use-job";
import { cx } from "@/components/ui";

type Kind = "spec_sheet" | "view_photo" | "scale_photo" | "swatch_photo" | "hardware_sheet";

const SLOTS: { kind: Kind; title: string; hint: string; accept: string; testid: string }[] = [
  { kind: "spec_sheet", title: "Spec sheet / measurement chart", hint: "PDF, photo or Excel. Every measurement goes into points of measure and the size fields.", accept: ".pdf,image/*,.xlsx,.csv", testid: "source-spec_sheet" },
  { kind: "view_photo", title: "Back, side, top or interior photo", hint: "Answers what the front render can't show (marked inferred).", accept: "image/*", testid: "source-view_photo" },
  { kind: "scale_photo", title: "Sample photo with a ruler or tape", hint: "Measurements are estimated from the scale (EST — confirm).", accept: "image/*", testid: "source-scale_photo" },
  { kind: "swatch_photo", title: "Swatch card photo", hint: "Matched to the material library, or added to it, and put in the breakdown.", accept: "image/*", testid: "source-swatch_photo" },
  { kind: "hardware_sheet", title: "Hardware photo / supplier sheet", hint: "Each part matched to the hardware library or added with its size and the next free code.", accept: ".pdf,image/*,.xlsx,.csv", testid: "source-hardware_sheet" },
];
const VIEWS = ["BACK", "SIDE", "TOP", "INTERIOR"];

type Status = { state: "uploading" | "reading" | "done" | "error"; text: string };

/**
 * Optional uploads the AI reads to pre-fill the pack — each answer it writes is marked "From <source> —
 * confirm". Reading runs as a background job; the list shows what each upload added.
 */
export function SourcesPanel({
  packId,
  files,
  canEdit,
  materials,
  colorways,
  highlight,
}: {
  packId: string;
  files: PackFile[];
  canEdit: boolean;
  materials: { callout: number; name: string }[];
  colorways: string[];
  highlight?: Kind | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [view, setView] = useState("BACK");
  const [swatchFor, setSwatchFor] = useState(`${materials[0]?.callout ?? 1}|${colorways[0] ?? "-A"}`);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const set = (key: string, s: Status) => alive.current && setStatus((m) => ({ ...m, [key]: s }));

  const read = async (fileId: string) => {
    set(fileId, { state: "reading", text: "Reading…" });
    const job = await startJobRequest(packId, { kind: "source", fileId });
    if (typeof job === "string") return set(fileId, { state: "error", text: job });
    const done = await pollJob(packId, job, (j: JobState) => set(fileId, { state: "reading", text: j.step ? `${j.step}…` : "Reading…" }), () => alive.current);
    if (done.status === "ERROR") set(fileId, { state: "error", text: done.error ?? "Reading didn't work this time. Try again." });
    else if (done.status === "DONE") {
      const r = (done.result ?? {}) as { answered?: number; created?: string[]; linked?: string[]; boardNotes?: string[] };
      set(fileId, {
        state: "done",
        text: [
          `${r.answered ?? 0} answer${r.answered === 1 ? "" : "s"} filled — confirm each one`,
          r.created?.length ? `added to library: ${r.created.join(", ")}` : "",
          r.linked?.length ? `linked: ${r.linked.join(", ")}` : "",
          r.boardNotes?.length ? `notes on the sheet: ${r.boardNotes.join("; ")}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
      router.refresh();
    }
  };

  const add = async (kind: Kind, file: File) => {
    const key = `new-${kind}`;
    set(key, { state: "uploading", text: `Uploading ${file.name}…` });
    try {
      const url = await uploadFile(file, "specs");
      const tag = kind === "view_photo" ? view : kind === "swatch_photo" ? swatchFor : "";
      const res = await addPackFile(packId, { kind, url, name: file.name, tag });
      if (!res.ok || !res.id) throw new Error(res.ok ? "Upload failed" : res.error);
      setStatus((m) => {
        const n = { ...m };
        delete n[key];
        return n;
      });
      router.refresh();
      await read(res.id);
    } catch (e) {
      set(key, { state: "error", text: (e as Error).message });
    }
  };

  return (
    <div className="space-y-6" data-testid="sources-panel">
      <div>
        <div className="eyebrow text-ink-soft">Help the AI — more sources</div>
        <p className="text-[11px] text-taupe mt-1 leading-relaxed">Optional. Each upload is read and pre-fills the pack; every answer is marked with where it came from, to confirm.</p>
      </div>
      {SLOTS.map((slot) => {
        const list = files.filter((f) => f.kind === slot.kind);
        const pending = status[`new-${slot.kind}`];
        return (
          <div key={slot.kind} className={cx("border-t border-hairline pt-4", highlight === slot.kind && "bg-gold-soft/40 -mx-3 px-3 pb-3 border border-gold")} data-testid={`slot-${slot.kind}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[13px]">{slot.title}</div>
                <div className="text-[11px] text-taupe mt-0.5 leading-relaxed">{slot.hint}</div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 shrink-0">
                  {slot.kind === "view_photo" && (
                    <select aria-label="Which view" value={view} onChange={(e) => setView(e.target.value)} className="text-[11px] bg-transparent border border-hairline-strong h-8 px-1">
                      {VIEWS.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  )}
                  {slot.kind === "swatch_photo" && (
                    <select aria-label="Swatch for" value={swatchFor} onChange={(e) => setSwatchFor(e.target.value)} className="text-[11px] bg-transparent border border-hairline-strong h-8 px-1 max-w-44">
                      {(materials.length ? materials : [{ callout: 1, name: "MATERIAL 1" }]).flatMap((m) =>
                        colorways.map((c) => (
                          <option key={`${m.callout}|${c}`} value={`${m.callout}|${c}`}>
                            {m.callout} {m.name} · {c}
                          </option>
                        )),
                      )}
                    </select>
                  )}
                  <label className={cx("cursor-pointer inline-flex h-8 px-4 items-center border border-ink text-[10px] tracking-[0.18em] uppercase hover:bg-ink hover:text-ivory transition-colors", pending?.state === "uploading" && "opacity-50 pointer-events-none")}>
                    Upload
                    <input
                      type="file"
                      accept={slot.accept}
                      className="sr-only"
                      data-testid={slot.testid}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void add(slot.kind, f);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
            {pending && <p className={cx("text-[11px] mt-2", pending.state === "error" ? "text-signal" : "text-taupe")} role="status">{pending.text}</p>}
            {list.length > 0 && (
              <ul className="mt-3 space-y-2">
                {list.map((f) => {
                  const s = status[f.id];
                  return (
                    <li key={f.id} className="flex items-start justify-between gap-3 text-[11.5px]" data-testid={`source-file-${f.kind}`}>
                      <div className="min-w-0">
                        <a href={f.url} target="_blank" rel="noreferrer" className="underline decoration-hairline-strong underline-offset-2 truncate inline-block max-w-72 align-bottom">
                          {f.name}
                        </a>
                        {f.tag && <span className="text-taupe ml-2">{f.kind === "swatch_photo" ? `MATERIAL ${f.tag.replace("|", " · ")}` : f.tag}</span>}
                        <div className={cx("mt-0.5", s?.state === "error" ? "text-signal" : s?.state === "done" ? "text-ok" : "text-taupe")} data-testid="source-status">
                          {s ? s.text : f.note ? f.note.toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "Not read yet"}
                        </div>
                      </div>
                      {canEdit && (
                        <span className="flex gap-3 shrink-0">
                          <button type="button" className="eyebrow hover:text-ink" disabled={s?.state === "reading"} onClick={() => void read(f.id)}>
                            {s?.state === "reading" ? "Reading…" : "Read again"}
                          </button>
                          <button
                            type="button"
                            className="text-taupe hover:text-signal"
                            aria-label={`Remove ${f.name}`}
                            onClick={async () => {
                              await removePackFile(packId, f.id);
                              router.refresh();
                            }}
                          >
                            ✕
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
