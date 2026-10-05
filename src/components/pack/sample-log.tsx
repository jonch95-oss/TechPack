"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSampleComment, createRound, deleteSampleComment, updateRound, updateSampleComment } from "@/app/actions/samples";
import type { Markup } from "@/db/schema";
import { uploadFile } from "@/lib/client/upload";
import { ChipRow } from "@/components/chips";
import { CommitText } from "@/components/commit-text";
import { Badge, Button, Empty, cx } from "@/components/ui";
import { FileButton } from "@/components/library/hardware-form";
import { studioDay } from "@/lib/dates";

type Comment = { id: string; letter: string; text: string; photoUrl: string | null; markup: Markup; status: string; carried: boolean };
type Round = { id: string; stage: "PROTO" | "SMS" | "PP" | "TOP"; number: number; receivedAt: string; factory: string; verdict: string; notes: string; comments: Comment[] };

const STAGE_NAME: Record<Round["stage"], string> = { PROTO: "Proto", SMS: "Salesman sample", PP: "Pre-production", TOP: "Top of production" };
const NEXT_STAGE: Record<Round["stage"], Round["stage"]> = { PROTO: "SMS", SMS: "PP", PP: "TOP", TOP: "TOP" };

export function SampleLog({ packId, rounds, factory, canEdit }: { packId: string; rounds: Round[]; factory: string; canEdit: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState(rounds.at(-1)?.id ?? "");
  const [creating, setCreating] = useState(rounds.length === 0);
  const [draft, setDraft] = useState({ stage: (rounds.length ? NEXT_STAGE[rounds.at(-1)!.stage] : "PROTO") as Round["stage"], receivedAt: studioDay(), factory });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const round = rounds.find((r) => r.id === sel) ?? rounds.at(-1);

  const newRound = () =>
    start(async () => {
      const r = await createRound(packId, draft);
      if (r.ok && r.id) {
        setSel(r.id);
        setCreating(false);
        setMsg(r.message ?? null);
      } else if (!r.ok) setMsg(r.error);
      router.refresh();
    });

  return (
    <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-12">
      <aside className="space-y-2">
        <div className="eyebrow mb-3">Rounds</div>
        {rounds.map((r) => {
          const open = r.comments.filter((c) => c.status !== "ACCEPTED").length;
          return (
            <button
              key={r.id}
              onClick={() => {
                setSel(r.id);
                setCreating(false);
              }}
              className={cx("w-full text-left border px-4 py-3 transition-colors", round?.id === r.id && !creating ? "border-ink bg-paper" : "border-hairline hover:border-ink")}
            >
              <div className="display text-[20px] leading-tight">{STAGE_NAME[r.stage]}{r.number > 1 ? ` #${r.number}` : ""}</div>
              <div className="text-[10.5px] tracking-[0.14em] uppercase text-taupe mt-1">
                {r.receivedAt || "—"} · {r.verdict}
                {open > 0 && <span className="text-signal"> · {open} open</span>}
              </div>
            </button>
          );
        })}
        {canEdit && (
          <button
            onClick={() => {
              const last = rounds.at(-1);
              setDraft({ ...draft, stage: last ? NEXT_STAGE[last.stage] : "PROTO", factory: last?.factory || draft.factory });
              setCreating(true);
            }}
            className="w-full h-11 border border-dashed border-hairline-strong eyebrow hover:text-ink hover:border-ink" data-testid="new-round">
            + New round
          </button>
        )}
      </aside>

      <div className="min-w-0">
        {msg && <p className="mb-6 text-[12px] text-ok" role="status">{msg}</p>}
        {creating ? (
          <div className="border border-hairline bg-paper p-8 space-y-6 max-w-2xl">
            <div className="display text-2xl">New sample round</div>
            <div>
              <div className="eyebrow mb-2">Stage</div>
              <ChipRow options={["PROTO", "SMS", "PP", "TOP"]} value={draft.stage} onChange={(v) => v && setDraft({ ...draft, stage: v as Round["stage"] })} allowOther={false} testId="round-stage" />
              <p className="text-[11px] text-taupe mt-2">SMS = salesman sample · PP = pre-production · TOP = top of production</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              <label className="block">
                <span className="eyebrow block mb-2">Received</span>
                <input type="date" value={draft.receivedAt} onChange={(e) => setDraft({ ...draft, receivedAt: e.target.value })} className="h-9 px-3 border border-hairline-strong bg-paper text-[13px]" />
              </label>
              <label className="block">
                <span className="eyebrow block mb-2">Factory</span>
                <input value={draft.factory} onChange={(e) => setDraft({ ...draft, factory: e.target.value.toUpperCase() })} className="w-full h-9 bg-transparent border-0 border-b border-hairline-strong text-[13px] focus:outline-none focus:border-ink" />
              </label>
            </div>
            {rounds.length > 0 && <p className="text-[12px] text-taupe">Comments still OPEN or REVISE from the last round come across automatically.</p>}
            <Button onClick={newRound} disabled={pending} data-testid="create-round">Start round</Button>
          </div>
        ) : !round ? (
          <Empty title="No samples logged yet" />
        ) : (
          <RoundView packId={packId} round={round} canEdit={canEdit} />
        )}
      </div>
    </div>
  );
}

function RoundView({ packId, round, canEdit }: { packId: string; round: Round; canEdit: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [, start] = useTransition();
  const act = (p: Promise<unknown>) => start(async () => { await p; router.refresh(); });

  return (
    <div className="space-y-10" data-testid="round">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-hairline pb-6">
        <div>
          <div className="eyebrow">{round.factory || "Factory"} · received {round.receivedAt || "—"}</div>
          <div className="display text-[36px] leading-tight mt-1">{STAGE_NAME[round.stage]}{round.number > 1 ? ` #${round.number}` : ""}</div>
        </div>
        <div>
          <div className="eyebrow mb-2">Verdict</div>
          <ChipRow
            options={["PENDING", "APPROVED", "APPROVED W/ COMMENTS", "REJECTED"]}
            value={round.verdict}
            allowOther={false}
            disabled={!canEdit}
            onChange={(v) => v && act(updateRound(packId, round.id, { verdict: v }))}
            testId="round-verdict"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
        {round.comments.map((c) => (
          <div key={c.id} className="border border-hairline bg-paper" data-testid="sample-comment">
            {c.photoUrl ? (
              <MarkupPhoto src={c.photoUrl} markup={c.markup} letter={c.letter} readOnly={!canEdit} onChange={(m) => act(updateSampleComment(packId, c.id, { markup: m }))} />
            ) : (
              canEdit && (
                <div className="p-4 border-b border-hairline">
                  <FileButton label="Add photo" onFile={async (f) => act(updateSampleComment(packId, c.id, { photoUrl: await uploadFile(f, "references") }))} />
                </div>
              )
            )}
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-signal text-ivory text-[12px] font-semibold shrink-0">{c.letter}</span>
                <div className="flex-1 min-w-0">
                  <CommitText value={c.text} onCommit={(t) => act(updateSampleComment(packId, c.id, { text: t }))} disabled={!canEdit} multiline />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <ChipRow options={["OPEN", "REVISE", "ACCEPTED"]} value={c.status} allowOther={false} disabled={!canEdit} onChange={(v) => v && act(updateSampleComment(packId, c.id, { status: v }))} />
                {canEdit && (
                  <button className="text-taupe hover:text-signal text-[12px]" aria-label={`Delete comment ${c.letter}`} onClick={() => act(deleteSampleComment(packId, c.id))}>✕</button>
                )}
              </div>
              {c.carried && <Badge tone="gold">Carried from last round</Badge>}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="border border-dashed border-hairline-strong p-6 space-y-4" data-testid="add-sample-comment">
          <div className="eyebrow">Add a comment</div>
          <div className="flex flex-wrap items-center gap-4">
            <FileButton label={photo ? "Photo added ✓" : "Photo (optional)"} onFile={async (f) => setPhoto(await uploadFile(f, "references"))} testId="sample-photo" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="One instruction, e.g. MOVE SNAP 5MM TOWARDS CENTRE" aria-label="Sample comment" className="flex-1 min-w-72 h-10 bg-transparent border-0 border-b border-hairline-strong text-[13px] uppercase focus:outline-none focus:border-ink placeholder:normal-case placeholder:text-mist" />
            <Button
              size="sm"
              disabled={!text.trim()}
              onClick={() => {
                const t = text;
                setText("");
                const ph = photo;
                setPhoto(null);
                act(addSampleComment(packId, round.id, { text: t, photoUrl: ph }));
              }}
            >
              Add comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Click the photo to drop a red circle with the comment's letter; click a circle to remove it. */
function MarkupPhoto({ src, markup, letter, onChange, readOnly }: { src: string; markup: Markup; letter: string; onChange: (m: Markup) => void; readOnly?: boolean }) {
  return (
    <div
      className={cx("relative bg-white border-b border-hairline overflow-hidden", !readOnly && "cursor-crosshair")}
      onClick={(e) => {
        if (readOnly) return;
        const r = e.currentTarget.getBoundingClientRect();
        onChange([...markup, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r: 0.07, letter }]);
      }}
      data-testid="markup-photo"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="w-full h-64 object-contain pointer-events-none" draggable={false} />
      {markup.map((m, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Remove circle ${i + 1}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!readOnly) onChange(markup.filter((_, j) => j !== i));
          }}
          className="absolute rounded-full border-[3px] border-signal"
          style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.r * 200}%`, aspectRatio: "1", transform: "translate(-50%,-50%)" }}
        >
          <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-signal text-ivory text-[11px] font-semibold flex items-center justify-center">{m.letter}</span>
        </button>
      ))}
      {!readOnly && markup.length === 0 && <span className="absolute bottom-2 left-2 text-[10px] tracking-[0.14em] uppercase bg-ivory/90 px-2 py-1">Click to circle the issue</span>}
    </div>
  );
}
