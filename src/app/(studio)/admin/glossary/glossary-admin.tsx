"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTerm, importTerms, saveTerm } from "@/app/actions/glossary";
import { Button, cx } from "@/components/ui";

type Term = { id: string; en: string; zh: string };

export function GlossaryAdmin({ terms }: { terms: Term[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState({ en: "", zh: "" });
  const [bulk, setBulk] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const shown = useMemo(() => terms.filter((t) => !q || t.en.includes(q.toUpperCase()) || t.zh.includes(q)), [terms, q]);
  const run = (p: Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await p;
      setMsg(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error ?? "Failed." });
      if (r.ok) after?.();
      router.refresh();
    });

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-12">
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search glossary" className="h-9 w-64 bg-transparent border-0 border-b border-hairline-strong text-[13px] focus:outline-none focus:border-ink" />
          <span className="eyebrow">{terms.length} terms</span>
        </div>
        <table className="w-full text-[13px]" data-testid="glossary">
          <thead>
            <tr className="border-b border-hairline text-left">
              <th className="eyebrow py-2 font-normal">English</th>
              <th className="eyebrow py-2 font-normal">中文</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id} className="border-b border-hairline">
                <td className="py-2 tracking-[0.04em]">{t.en}</td>
                <td className="py-2">
                  <input
                    defaultValue={t.zh}
                    aria-label={`Chinese for ${t.en}`}
                    onBlur={(e) => e.target.value !== t.zh && run(saveTerm({ id: t.id, en: t.en, zh: e.target.value }))}
                    className="w-full h-8 bg-transparent border-0 border-b border-transparent hover:border-hairline-strong focus:border-ink focus:outline-none"
                  />
                </td>
                <td className="py-2 text-right">
                  <button type="button" onClick={() => run(deleteTerm(t.id))} className="text-taupe hover:text-signal" aria-label={`Delete ${t.en}`}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="space-y-10">
        {msg && <p className={cx("text-[12px]", msg.ok ? "text-ok" : "text-signal")} role="status">{msg.text}</p>}
        <div className="space-y-3">
          <div className="eyebrow">Add a term</div>
          <input value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value.toUpperCase() })} placeholder="EDGE PAINT" aria-label="English term" className="w-full h-9 bg-transparent border-0 border-b border-hairline-strong text-[13px] focus:outline-none focus:border-ink" />
          <input value={draft.zh} onChange={(e) => setDraft({ ...draft, zh: e.target.value })} placeholder="边油" aria-label="Chinese term" className="w-full h-9 bg-transparent border-0 border-b border-hairline-strong text-[13px] focus:outline-none focus:border-ink" />
          <Button size="sm" disabled={pending || !draft.en || !draft.zh} onClick={() => run(saveTerm(draft), () => setDraft({ en: "", zh: "" }))} data-testid="add-term">Add</Button>
        </div>
        <div className="space-y-3">
          <div className="eyebrow">Paste many</div>
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={6} placeholder={"EDGE PAINT = 边油\nMAGNETIC SNAP\t磁扣"} aria-label="Paste terms" className="w-full border border-hairline-strong bg-paper p-3 text-[12px] focus:outline-none focus:border-ink" />
          <p className="text-[11px] text-taupe">One per line: English = 中文, or two columns copied from a spreadsheet.</p>
          <Button size="sm" variant="secondary" disabled={pending || !bulk.trim()} onClick={() => run(importTerms(bulk), () => setBulk(""))}>Import</Button>
        </div>
      </aside>
    </div>
  );
}
