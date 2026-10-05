"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyProposalTo, decideProposal, draftChanges, listProposals, relatedPacks, type ProposalView } from "@/app/actions/inbox";
import { Button } from "@/components/ui";

const show = (v: unknown) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/**
 * Factory comments inbox (V2 §9): paste the factory's comments or email; the AI drafts each change,
 * linked to its comment; approve item by item; an approved fix can go to every pack with the same base
 * style or library item as a batch revision.
 */
export function FactoryInbox({ packId, canEdit }: { packId: string; canEdit: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [items, setItems] = useState<ProposalView[]>([]);
  const [msg, setMsg] = useState("");
  const [related, setRelated] = useState<{ proposal: string; packs: { id: string; styleNo: string; reason: string }[] } | null>(null);
  const [pending, start] = useTransition();
  const reload = async () => setItems(await listProposals(packId));
  useEffect(() => {
    let live = true;
    listProposals(packId).then((x) => live && setItems(x));
    return () => {
      live = false;
    };
  }, [packId]);
  const open = items.filter((i) => i.status === "PROPOSED");
  return (
    <section className="mt-10" data-testid="factory-inbox">
      <div className="eyebrow mb-3">Factory comments</div>
      {canEdit && (
        <div className="space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Paste the factory's comments or email…" aria-label="Factory comments" className="w-full border border-hairline bg-white p-3 text-[13px]" />
          <Button
            type="button"
            disabled={pending || !text.trim()}
            onClick={() =>
              start(async () => {
                const r = await draftChanges(packId, text);
                setMsg(r.ok ? [r.message, ...(r.unmapped ?? []).map((u) => `NO CHANGE: ${u}`)].filter(Boolean).join(" · ") : r.error);
                if (r.ok) setText("");
                await reload();
              })
            }
          >
            {pending ? "Drafting…" : "Draft the changes"}
          </Button>
          {msg && <p className="text-[12px] text-ink-soft" role="status">{msg}</p>}
        </div>
      )}
      {items.length > 0 && (
        <ul className="mt-5 divide-y divide-hairline border-y border-hairline text-[12px]">
          {items.map((i) => (
            <li key={i.id} className="py-3 flex flex-wrap items-start justify-between gap-4" data-testid="proposal">
              <div className="min-w-0 flex-1">
                <div className="text-taupe">“{i.comment}”</div>
                <div className="mt-1">
                  <span className="eyebrow">{i.label}</span>: <span className="line-through text-mist">{show(i.current)}</span> → <span className="text-signal">{show(i.value)}</span>
                </div>
                {i.note && <div className="text-mist mt-0.5">{i.note}</div>}
              </div>
              <div className="flex gap-4 items-center">
                {i.status !== "PROPOSED" ? (
                  <>
                    <span className={i.status === "APPROVED" ? "text-ok" : "text-mist"}>{i.status}</span>
                    {canEdit && i.status === "APPROVED" && (
                      <button type="button" className="eyebrow hover:text-ink" onClick={() => start(async () => setRelated({ proposal: i.id, packs: await relatedPacks(i.id) }))}>
                        Also apply to…
                      </button>
                    )}
                  </>
                ) : (
                  canEdit && (
                    <>
                      <button type="button" className="eyebrow hover:text-ink" disabled={pending} onClick={() => start(async () => { await decideProposal(i.id, true); await reload(); router.refresh(); })}>
                        Approve
                      </button>
                      <button type="button" className="eyebrow hover:text-signal" disabled={pending} onClick={() => start(async () => { await decideProposal(i.id, false); await reload(); })}>
                        Reject
                      </button>
                    </>
                  )
                )}
              </div>
              {related?.proposal === i.id && (
                <div className="w-full mt-2 border border-hairline bg-paper p-3">
                  {related.packs.length ? (
                    <>
                      <div className="mb-2">{related.packs.map((p) => `${p.styleNo} (${p.reason})`).join(" · ")}</div>
                      <button type="button" className="eyebrow hover:text-ink" onClick={() => start(async () => { const r = await applyProposalTo(i.id, related.packs.map((p) => p.id)); setMsg(r.ok ? r.message ?? "" : r.error); setRelated(null); })}>
                        Apply to all {related.packs.length}
                      </button>
                    </>
                  ) : (
                    <span className="text-mist">No other pack shares this base style or library item.</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {open.length > 0 && <p className="mt-2 text-[11px] text-taupe">{open.length} change(s) waiting. Approved changes print *UPDATED* in the next revision.</p>}
    </section>
  );
}
