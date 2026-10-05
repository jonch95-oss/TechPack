"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { detectCrop, updatePackFile } from "@/app/actions/packs";
import type { FileMarks } from "@/db/schema";
import { Drawer } from "@/components/drawer";
import { Button } from "@/components/ui";

type Box = { x: number; y: number; w: number; h: number };

/**
 * Crop a render or design board to the product. Opens with the auto-detected box; drag on the image
 * to draw a new one. The crop is what prints, what the AI reads and what line art traces — board text
 * such as "(REFER TO SPEC)" stays out. The parent remounts it (key) each time it opens.
 */
export function CropEditor({ packId, file, open, onClose }: { packId: string; file: { id: string; url: string; name: string; marks: FileMarks }; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [box, setBox] = useState<Box | null>(file.marks?.crop ?? null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const save = (crop: Box | null) =>
    start(async () => {
      const res = await updatePackFile(packId, file.id, { marks: { ...file.marks, crop } });
      if (!res.ok) return setMsg(res.error);
      onClose();
      router.refresh();
    });
  const b = box ?? { x: 0, y: 0, w: 1, h: 1 };
  return (
    <Drawer open={open} onClose={onClose} wide eyebrow={file.name} title="Crop to the product">
      <div className="space-y-6">
        <p className="text-[12px] text-taupe">
          Only what is inside the box prints, is read by the AI and is traced for line art. Drag across the image to redraw it. Leave board text, arrows and spec notes outside.
        </p>
        <div
          className="relative bg-white border border-hairline cursor-crosshair select-none touch-none"
          data-testid="crop-canvas"
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
            setBox((v) => (v && v.w > 0.02 && v.h > 0.02 ? v : (file.marks?.crop ?? null)));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.url} alt="" className="block w-full h-auto pointer-events-none" draggable={false} />
          {/* everything outside the crop is dimmed */}
          <span className="absolute inset-0 pointer-events-none" style={{ background: "rgba(20,20,20,0.45)", clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${b.x * 100}% ${b.y * 100}%,${b.x * 100}% ${(b.y + b.h) * 100}%,${(b.x + b.w) * 100}% ${(b.y + b.h) * 100}%,${(b.x + b.w) * 100}% ${b.y * 100}%,${b.x * 100}% ${b.y * 100}%)` }} />
          <span className="absolute border-2 border-signal pointer-events-none" data-testid="crop-box" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />
        </div>
        {msg && <p className="text-signal text-[12px]" role="alert">{msg}</p>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => save(box)} disabled={pending} data-testid="crop-save">Use this crop</Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await detectCrop(packId, file.id);
                if (r.ok) setBox(r.crop);
                setMsg(r.ok ? (r.crop ? null : "The product already fills the image.") : r.error);
              })
            }
          >
            Auto-detect
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => save(null)}>Use the whole image</Button>
        </div>
      </div>
    </Drawer>
  );
}
