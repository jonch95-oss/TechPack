"use client";

import { useRef, useState } from "react";
import type { ChipBox } from "@/db/schema";

/** Card photo with a red box around the colour chip. Drag on the photo to draw / redraw the box. */
export function ChipBoxEditor({
  src,
  box,
  onChange,
  readOnly,
}: {
  src: string;
  box: ChipBox | null;
  onChange?: (b: ChipBox | null) => void;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ChipBox | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const shown = draft ?? box;

  return (
    <div className="space-y-2">
      <div
        ref={ref}
        className={`relative overflow-hidden select-none bg-white border border-hairline ${readOnly ? "" : "cursor-crosshair"}`}
        onPointerDown={(e) => {
          if (readOnly) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          start.current = pos(e);
          setDraft({ ...start.current, w: 0, h: 0 });
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const p = pos(e);
          const s = start.current;
          setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
        }}
        onPointerUp={() => {
          if (!start.current) return;
          start.current = null;
          if (draft && draft.w > 0.01 && draft.h > 0.01) onChange?.(draft);
          setDraft(null);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Swatch card" className="w-full h-auto block pointer-events-none" draggable={false} />
        {shown && (
          <div
            className="absolute border-[3px] border-signal shadow-[0_0_0_9999px_rgba(21,19,15,0.18)]"
            style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.w * 100}%`, height: `${shown.h * 100}%` }}
          />
        )}
      </div>
      {!readOnly && (
        <div className="flex items-center justify-between text-[11px] text-taupe">
          <span>Drag across the chip to draw the red box.</span>
          {box && (
            <button type="button" className="uppercase tracking-[0.18em] text-[10px] hover:text-ink" onClick={() => onChange?.(null)}>
              Clear box
            </button>
          )}
        </div>
      )}
    </div>
  );
}
