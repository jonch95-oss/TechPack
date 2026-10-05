"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { similarPacks, startFromBase } from "@/app/actions/workflow";

/**
 * "Start from…" (V2 §3 step 2): the three packs most like this one. One click inherits a base
 * style's settled answers (as BASE STYLE) into the blanks; "Fresh" hides the panel.
 */
export function StartFrom({ packId }: { packId: string }) {
  const router = useRouter();
  const [list, setList] = useState<{ id: string; styleNo: string; styleName: string; category: string }[] | null>(null);
  const [msg, setMsg] = useState("");
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    let live = true;
    similarPacks(packId).then((l) => live && setList(l));
    return () => {
      live = false;
    };
  }, [packId]);
  if (hidden || !list?.length) return null;
  return (
    <div className="mt-8 border border-hairline bg-paper p-5" data-testid="start-from">
      <div className="eyebrow mb-3">Start from…</div>
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 text-[13px]">
            <span>
              <span className="tracking-wide">{c.styleNo}</span> <span className="italic text-ink-soft">{c.styleName}</span>
              <span className="text-taupe text-[11px]"> · {c.category}</span>
            </span>
            <button
              type="button"
              disabled={pending}
              className="eyebrow hover:text-ink"
              onClick={() =>
                start(async () => {
                  const r = await startFromBase(packId, c.id);
                  setMsg(r.ok ? r.message ?? "" : r.error ?? "");
                  if (r.ok) router.refresh();
                })
              }
            >
              Use as base
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" className="eyebrow hover:text-ink" onClick={() => setHidden(true)}>
          Fresh
        </button>
        {msg && <span className="text-[12px] text-ink-soft" role="status">{msg}</span>}
      </div>
    </div>
  );
}
