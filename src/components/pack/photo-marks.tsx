"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePackFile } from "@/app/actions/packs";
import type { FileMarks } from "@/db/schema";
import { normalizePage } from "@/lib/page-names";
import { Drawer } from "@/components/drawer";
import { Button, cx } from "@/components/ui";
import { calloutPoint } from "@/lib/pdf/hints";

/** Where a reference photo prints: its own template page, or a slot on one. Value = "PAGE|ROLE". */
export const PLACEMENTS: { value: string; label: string }[] = [
  { value: "", label: "Auto — from its comment" },
  { value: "OVERVIEW|BACK", label: "Overview — back view (beside the front)" },
  { value: "OVERVIEW|SIDE", label: "Overview — side view (beside the front)" },
  { value: "MEASUREMENTS|SIDE_VIEW", label: "Measurements — side view" },
  { value: "MEASUREMENTS|", label: "Measurements — detail photo" },
  { value: "REFERENCE IMAGES|", label: "Reference images" },
  { value: "COLOURWAYS|", label: "Colourways" },
  { value: "INTERIOR & LINING|", label: "Interior & lining" },
  { value: "LINING / PRINT ARTWORK|APPLICATION", label: "Lining artwork — application photo" },
  { value: "TRIMS & HARDWARE|", label: "Trims & hardware" },
];

export function placementValue(page: string | null, marks: FileMarks) {
  return page ? `${normalizePage(page)}|${marks.role ?? ""}` : "";
}

/**
 * Mark-up for one photo: a circular zoom crop (prints inside a thick red ring) and/or a red dot that
 * a leader line points to. On the render, the dot marks the logo.
 */
export function PhotoMarks({
  packId,
  file,
  mode = "photo",
  trigger,
  materials = [],
}: {
  packId: string;
  file: { id: string; url: string; name: string; marks: FileMarks };
  mode?: "photo" | "logo";
  trigger: (open: () => void) => React.ReactNode;
  /** On the render: the numbered materials, whose yellow callouts are placed here too (golden run 1 #12). */
  materials?: { callout: number; name: string; locations?: string[] }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState<FileMarks>(file.marks ?? {});
  const [tool, setTool] = useState<string>(mode === "logo" ? "dot" : marks.zoom ? "zoom" : "dot");
  // Suggested callout spots are fractions of the cropped product; the drawer shows the whole image.
  const crop = marks.crop ?? null;
  const whole = (p: { x: number; y: number }) => (crop ? { x: crop.x + p.x * crop.w, y: crop.y + p.y * crop.h } : p);
  const [pending, start] = useTransition();
  const [aspect, setAspect] = useState(1); // width / height of the photo
  const save = () =>
    start(async () => {
      await updatePackFile(packId, file.id, { marks });
      setOpen(false);
      router.refresh();
    });
  return (
    <>
      {trigger(() => setOpen(true))}
      <Drawer open={open} onClose={() => setOpen(false)} wide title={mode === "logo" ? "Where is the logo?" : "Mark up photo"} eyebrow={file.name}>
        <div className="space-y-6">
          {mode === "logo" && materials.length > 0 && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What to place">
              {[{ id: "dot", label: "Logo" }, ...materials.map((m) => ({ id: `m${m.callout}`, label: `${m.callout} ${m.name}` }))].map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={tool === t.id} onClick={() => setTool(t.id)} data-testid={`marks-tool-${t.id}`} className={cx("h-9 px-4 border text-[11px] tracking-[0.14em] uppercase", tool === t.id ? "bg-ink text-ivory border-ink" : "border-hairline-strong")}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {mode === "photo" && (
            <div className="flex gap-2" role="radiogroup">
              {(["zoom", "dot"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tool === t} onClick={() => setTool(t)} className={cx("h-9 px-4 border text-[11px] tracking-[0.14em] uppercase", tool === t ? "bg-ink text-ivory border-ink" : "border-hairline-strong")}>
                  {t === "zoom" ? "Zoom circle" : "Red dot"}
                </button>
              ))}
            </div>
          )}
          <p className="text-[12px] text-taupe">
            {mode === "logo" ? (tool.startsWith("m") ? "Click where this material's numbered callout goes. Dashed circles are suggestions from its locations." : "Click the logo. The LOGO label's red leader line points here.") : tool === "zoom" ? "Click the centre of the detail, then size the circle. It prints as a round zoom in a thick red ring." : "Click the spot the caption's leader line should point to."}
          </p>
          <div
            className="relative bg-white border border-hairline cursor-crosshair select-none"
            data-testid="marks-canvas"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - r.left) / r.width,
                y = (e.clientY - r.top) / r.height;
              if (tool === "zoom") setMarks((m) => ({ ...m, zoom: { x, y, r: m.zoom?.r ?? 0.2 } }));
              else if (tool.startsWith("m")) setMarks((m) => ({ ...m, callouts: { ...(m.callouts ?? {}), [tool.slice(1)]: { x, y } } }));
              else setMarks((m) => ({ ...m, dot: { x, y } }));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.url} alt="" className="block w-full h-auto pointer-events-none" draggable={false} onLoad={(e) => setAspect(e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight))} />
            {marks.zoom && (
              <span
                className="absolute rounded-full border-[5px] border-signal pointer-events-none"
                style={{ left: `${(marks.zoom.x - marks.zoom.r) * 100}%`, top: `${(marks.zoom.y - marks.zoom.r * aspect) * 100}%`, width: `${marks.zoom.r * 200}%`, aspectRatio: "1" }}
              />
            )}
            {marks.dot && <span className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-signal pointer-events-none" style={{ left: `${marks.dot.x * 100}%`, top: `${marks.dot.y * 100}%` }} />}
            {mode === "logo" &&
              materials.map((m, k) => {
                const placed = marks.callouts?.[String(m.callout)];
                const p = placed ?? whole(calloutPoint(m, k));
                return (
                  <span
                    key={m.callout}
                    className={cx("absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-[12px] font-bold pointer-events-none", placed ? "bg-[#f7e400] border-2 border-ink" : "border-2 border-dashed border-ink/60 bg-[#f7e400]/40")}
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                    data-testid={`marks-callout-${m.callout}`}
                    data-placed={placed ? "1" : "0"}
                  >
                    {m.callout}
                  </span>
                );
              })}
          </div>
          {tool === "zoom" && marks.zoom && (
            <label className="flex items-center gap-4 text-[12px]">
              Circle size
              <input type="range" min={3} max={50} value={Math.round(marks.zoom.r * 100)} onChange={(e) => setMarks((m) => ({ ...m, zoom: { ...m.zoom!, r: Number(e.target.value) / 100 } }))} aria-label="Zoom circle size" />
            </label>
          )}
          <div className="flex gap-3">
            <Button onClick={save} disabled={pending} data-testid="marks-save">Save</Button>
            <Button variant="ghost" onClick={() => setMarks(mode === "logo" ? { ...marks, dot: null } : {})}>Clear</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
