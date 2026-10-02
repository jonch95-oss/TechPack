"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approvePack, requestReview, sendBack, setFactory, setPackStatus } from "@/app/actions/workflow";
import type { PackStatus } from "@/db/schema";
import { Badge, Button, cx } from "@/components/ui";
import { STATUS_LABEL, statusTone } from "@/lib/status";

/** Status, second-designer sign-off and factory — the part of the rail that decides who can export. */
export function SignOff({
  packId,
  status,
  meId,
  requestedBy,
  reviewedBy,
  reviewedAt,
  factory,
  factoryStyleNo,
  canEdit,
}: {
  packId: string;
  status: PackStatus;
  meId: string;
  requestedBy: { id: string; name: string } | null;
  reviewedBy: { name: string } | null;
  reviewedAt: string | null;
  factory: string;
  factoryStyleNo: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [f, setF] = useState({ factory, factoryStyleNo });
  const run = (p: Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await p;
      setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error ?? "Failed." });
      router.refresh();
    });
  const mine = requestedBy?.id === meId;

  return (
    <div className="p-6 border-b border-hairline space-y-4" data-testid="signoff">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Status</span>
        <Badge tone={statusTone(status)}>{STATUS_LABEL[status]}</Badge>
      </div>
      {status === "IN_REVIEW" && requestedBy && <p className="text-[11px] text-taupe">Asked by {requestedBy.name}. A different designer signs it off.</p>}
      {reviewedBy && reviewedAt && <p className="text-[11px] text-ok">Signed off by {reviewedBy.name} · {new Date(reviewedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</p>}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(requestReview(packId))} data-testid="request-review">
              Ask for review
            </Button>
          )}
          {status === "IN_REVIEW" && !mine && (
            <>
              <Button size="sm" disabled={pending} onClick={() => run(approvePack(packId))} data-testid="approve">Sign off</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(sendBack(packId, ""))}>Send back</Button>
            </>
          )}
          {status === "IN_REVIEW" && mine && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(sendBack(packId, ""))}>Withdraw</Button>
          )}
          {status === "APPROVED" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(setPackStatus(packId, "SENT"))}>Mark sent to factory</Button>}
          {status === "SENT" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(setPackStatus(packId, "PROTO_RECEIVED"))}>Proto received</Button>}
          {status === "PROTO_RECEIVED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(setPackStatus(packId, "CLOSED"))}>Close</Button>}
        </div>
      )}
      {msg && <p className={cx("text-[11px]", msg.ok ? "text-ok" : "text-signal")} role="status">{msg.text}</p>}
      <div className="grid grid-cols-2 gap-3 pt-1 items-end">
        <label className="block">
          <span className="eyebrow block mb-1">Factory</span>
          <input
            value={f.factory}
            disabled={!canEdit}
            onChange={(e) => setF({ ...f, factory: e.target.value.toUpperCase() })}
            onBlur={() => f.factory !== factory && run(setFactory(packId, f.factory, f.factoryStyleNo))}
            className="w-full h-8 bg-transparent border-0 border-b border-hairline-strong text-[12px] focus:outline-none focus:border-ink"
            aria-label="Factory"
          />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1 whitespace-nowrap">Fty style #</span>
          <input
            value={f.factoryStyleNo}
            disabled={!canEdit}
            onChange={(e) => setF({ ...f, factoryStyleNo: e.target.value.toUpperCase() })}
            onBlur={() => f.factoryStyleNo !== factoryStyleNo && run(setFactory(packId, f.factory, f.factoryStyleNo))}
            className="w-full h-8 bg-transparent border-0 border-b border-hairline-strong text-[12px] focus:outline-none focus:border-ink"
            aria-label="Factory style number"
          />
        </label>
      </div>
    </div>
  );
}
