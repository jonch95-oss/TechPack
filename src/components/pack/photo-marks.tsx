"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePackFile } from "@/app/actions/packs";
import type { FileMarks } from "@/db/schema";
import { normalizePage } from "@/lib/page-names";
import { Drawer } from "@/components/drawer";
import { Button, cx } from "@/components/ui";

/** Where a reference photo prints: its own template page, or a slot on one. Value = "PAGE|ROLE". */
export const PLACEMENTS: { value: string; label: string }[] = [
  { value: "", label: "Auto — from its comment" },
  { value: "MEASUREMENTS|SIDE_VIEW", label: "Measurements — side view" },
  { value: "MEASUREMENTS|", label: "Measurements — detail photo" },
  { value: "REFERENCE IMAGES|", label: "Reference images" },
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
export function PhotoMarks({ packId, file, mode = "photo", trigger }: { packId: string; file: { id: string; url: string; name: string; marks: FileMarks }; mode?: "photo" | "logo"; trigger: (open: () => void) => React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState<FileMarks>(file.marks ?? {});
  const [tool, setTool] = useState<"zoom" | "dot">(mode === "logo" ? "dot" : marks.zoom ? "zoom" : "dot");
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
            {mode === "logo" ? "Click the logo. The LOGO label's red leader line points here." : tool === "zoom" ? "Click the centre of the detail, then size the circle. It prints as a round zoom in a thick red ring." : "Click the spot the caption's leader line should point to."}
          </p>
          <div
            className="relative bg-white border border-hairline cursor-crosshair select-none"
            data-testid="marks-canvas"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - r.left) / r.width,
                y = (e.clientY - r.top) / r.height;
              if (tool === "zoom") setMarks((m) => ({ ...m, zoom: { x, y, r: m.zoom?.r ?? 0.2 } }));
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
