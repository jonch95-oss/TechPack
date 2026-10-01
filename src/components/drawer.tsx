"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Right-hand slide-over used for library pickers and "+ New" forms. Esc or the scrim closes it. */
export function Drawer({ open, onClose, title, eyebrow, children, wide }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative h-full bg-ivory border-l border-hairline shadow-2xl overflow-y-auto fade-up ${wide ? "w-[min(1100px,96vw)]" : "w-[min(620px,96vw)]"}`}>
        <div className="sticky top-0 z-10 bg-ivory/95 backdrop-blur border-b border-hairline px-10 py-6 flex items-start justify-between gap-6">
          <div>
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            <div className="display text-[28px] leading-tight">{title}</div>
          </div>
          <button onClick={onClose} className="text-[10px] tracking-[0.22em] uppercase text-taupe hover:text-ink mt-2" aria-label="Close">
            Close ✕
          </button>
        </div>
        <div className="px-10 py-8">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
