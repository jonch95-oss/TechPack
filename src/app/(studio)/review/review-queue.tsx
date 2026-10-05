"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approvePack, sendBack } from "@/app/actions/workflow";
import { Button, Thumb } from "@/components/ui";

type Item = { id: string; styleNo: string; styleName: string; category: string; stage: string; brand: string; requestedBy: string | null; render: string | null };

export function ReviewQueue({ items }: { items: Item[] }) {
  const router = useRouter();
  const [list, setList] = useState(items);
  const [i, setI] = useState(0);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const cur = list[Math.min(i, list.length - 1)];

  const done = (ok: boolean, text: string) => {
    setMsg(text);
    if (ok) {
      setList((l) => l.filter((x) => x.id !== cur.id));
      setNote("");
      router.refresh();
    }
  };
  const approve = () => cur && start(async () => { const r = await approvePack(cur.id); done(r.ok, r.ok ? `${cur.styleNo}: ${r.message ?? "signed off"}` : `${cur.styleNo}: ${r.error}`); });
  const back = () => cur && note.trim() && start(async () => { const r = await sendBack(cur.id, note); done(r.ok, r.ok ? `${cur.styleNo} sent back.` : `${cur.styleNo}: ${r.error}`); });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "j") setI((x) => Math.min(x + 1, list.length - 1));
      else if (e.key === "k") setI((x) => Math.max(x - 1, 0));
      else if (e.key === "a") approve();
      else if (e.key === "c") {
        e.preventDefault();
        noteRef.current?.focus();
      } else if (e.key === "o" && cur) router.push(`/packs/${cur.id}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!list.length) return <p className="text-[13px] text-taupe" data-testid="review-empty">Nothing waiting for review.{msg && ` ${msg}`}</p>;
  return (
    <div className="grid md:grid-cols-[1fr_1.2fr] gap-10" data-testid="review-queue">
      <ol className="space-y-1 text-[13px]">
        {list.map((x, k) => (
          <li key={x.id}>
            <button type="button" onClick={() => setI(k)} className={`w-full text-left px-3 py-2 border ${k === i ? "border-ink" : "border-transparent hover:border-hairline"}`}>
              <span className="tracking-wide">{x.styleNo}</span> <span className="italic text-ink-soft">{x.styleName}</span>
              <span className="block text-[11px] text-taupe">
                {x.brand} · {x.category} · {x.stage}
                {x.requestedBy ? ` · asked by ${x.requestedBy}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {cur && (
        <div className="space-y-5">
          <div className="aspect-[4/3] bg-white border border-hairline flex items-center justify-center">{cur.render ? <Thumb src={cur.render} alt={cur.styleNo} className="w-full h-full border-0" /> : <span className="display italic text-mist">No render</span>}</div>
          <div className="flex flex-wrap gap-5 items-center">
            <Button type="button" onClick={approve} disabled={pending} data-testid="queue-approve">Sign off (A)</Button>
            <a href={`/api/packs/${cur.id}/pdf?draft=1`} className="eyebrow hover:text-ink" target="_blank" rel="noreferrer">Draft PDF</a>
            <Link href={`/packs/${cur.id}`} className="eyebrow hover:text-ink">Open (O)</Link>
          </div>
          <div>
            <textarea ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) back(); }} rows={3} placeholder="Comment (C) — what to fix; ⌘/Ctrl + Enter sends it back" aria-label="Review comment" className="w-full border border-hairline bg-white p-3 text-[13px]" />
            <button type="button" className="eyebrow hover:text-signal" disabled={pending || !note.trim()} onClick={back}>Send back with comment</button>
          </div>
          {msg && <p className="text-[12px] text-ink-soft" role="status">{msg}</p>}
        </div>
      )}
    </div>
  );
}
