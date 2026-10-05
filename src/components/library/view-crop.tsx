"use client";

import { useRef, useState } from "react";
import { Drawer } from "@/components/drawer";
import { Button } from "@/components/ui";
import type { ViewCrop } from "@/db/schema";

/**
 * Crop a hardware view to the part itself (golden run 1 #15). A 100% view prints at the part's
 * stated size, so the image must hold the part only — dimension arrows and notes around it would
 * shrink it. Drag across the image to draw the box.
 */
export function ViewCropDrawer({ src, label, crop, open, onClose, onSave }: { src: string; label: string; crop: ViewCrop | null; open: boolean; onClose: () => void; onSave: (c: ViewCrop | null) => void }) {
  const [box, setBox] = useState<ViewCrop | null>(crop);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const b = box ?? { x: 0, y: 0, w: 1, h: 1 };
  return (
    <Drawer open={open} onClose={onClose} wide eyebrow={label} title="Crop to the part">
      <div className="space-y-6">
        <p className="text-[12px] text-taupe">The 100% view prints at the part&apos;s stated size. Draw the box tight around the part — leave dimension lines and notes outside.</p>
        <div
          className="relative bg-white border border-hairline cursor-crosshair select-none touch-none"
          data-testid="view-crop-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = at(e);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const p = at(e),
              s = drag.current;
            setBox({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
          }}
          onPointerUp={() => {
            drag.current = null;
            setBox((v) => (v && v.w > 0.02 && v.h > 0.02 ? v : crop));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="block w-full h-auto pointer-events-none" draggable={false} />
          <span className="absolute border-2 border-signal pointer-events-none" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />
        </div>
        <div className="flex gap-3">
          <Button onClick={() => onSave(box ?? { x: 0, y: 0, w: 1, h: 1 })} data-testid="view-crop-save">
            Save crop
          </Button>
          <Button variant="ghost" onClick={() => onSave({ x: 0, y: 0, w: 1, h: 1 })}>
            Already tight — use the whole image
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
