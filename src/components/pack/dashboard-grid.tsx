"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkArchive, bulkAssign, bulkSetStage, bulkUndo, type BulkUndo } from "@/app/actions/bulk";
import { Badge, Thumb } from "@/components/ui";
import { STATUS_LABEL, statusTone } from "@/lib/status";
import { PIPELINE } from "@/lib/dashboard";
import type { PackStatus } from "@/db/schema";

export type DashPack = {
  id: string;
  styleNo: string;
  styleName: string;
  category: string;
  colorways: string[];
  colorwayStyles: Record<string, string>;
  updatedAt: string;
  brand: string;
  by: string | null;
  status: PackStatus;
  stage: "PROTO" | "PRODUCTION";
  due: string | null;
  render: string | null;
  pending: number;
  revision: number;
  assignee: string | null;
};

/** Pack cards (grid or pipeline columns) with selection and bulk actions: export, stage, assign, archive — each undoable. */
export function PackGrid({ packs, view, canEdit, isAdmin, designers, archivedView }: { packs: DashPack[]; view: "grid" | "pipeline"; canEdit: boolean; isAdmin: boolean; designers: { id: string; name: string }[]; archivedView: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const [undo, setUndo] = useState<BulkUndo | null>(null);
  const [pending, start] = useTransition();
  const ids = [...picked];
  const toggle = (id: string) => setPicked((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string; undo?: BulkUndo }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? r.message ?? "" : r.error ?? "");
      setUndo(r.ok ? r.undo ?? null : null);
      if (r.ok) router.refresh();
    });

  const card = (r: DashPack, compact = false) => (
    <div key={r.id} className="relative group">
      {canEdit && (
        <input type="checkbox" aria-label={`Select ${r.styleNo}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="absolute z-10 left-2 top-2 accent-ink w-4 h-4" data-testid={`pick-${r.styleNo}`} />
      )}
      <Link href={`/packs/${r.id}`} className="block">
        {!compact && (
          <div className="aspect-[4/3] bg-white border border-hairline overflow-hidden flex items-center justify-center">
            {r.render ? <Thumb src={r.render} alt={r.styleNo} className="w-full h-full border-0 group-hover:scale-[1.03] transition-transform duration-700" /> : <span className="display italic text-mist text-lg">Awaiting render</span>}
          </div>
        )}
        <div className={`${compact ? "pl-7 py-2" : "pt-4"} flex items-start justify-between gap-3`}>
          <div className="min-w-0">
            <div className="eyebrow">{r.brand}</div>
            <div className={`display ${compact ? "text-[16px]" : "text-[24px]"} leading-tight mt-1 group-hover:text-gold transition-colors`}>
              {r.styleNo} <span className="italic text-ink-soft">{r.styleName}</span>
            </div>
            {Object.values(r.colorwayStyles ?? {}).filter((x) => x !== r.styleNo).length > 0 && (
              <div className="text-[11px] text-ink-soft mt-1 tracking-wide" data-testid="pack-styles">
                + {Object.values(r.colorwayStyles).filter((x) => x !== r.styleNo).join(" · ")}
              </div>
            )}
            <div className="text-[11px] text-taupe mt-1 tracking-wide">
              {r.category} · {r.colorways.join(" ")} · {r.stage}
              {r.revision > 1 ? ` · R${r.revision - 1}` : ""}
            </div>
          </div>
          {!compact && (
            <div className="flex flex-col items-end gap-1.5">
              <Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status]}</Badge>
              {r.pending > 0 && <Badge tone="ai">{r.pending} to confirm</Badge>}
            </div>
          )}
        </div>
        <div className={`${compact ? "pl-7" : "mt-3 pt-3 border-t border-hairline"} text-[10px] tracking-[0.18em] uppercase text-mist`}>
          {r.due ? <span className={r.due === "ASAP" ? "text-signal" : "text-ink-soft"}>DUE {r.due} · </span> : null}
          {r.assignee ? `${r.assignee} · ` : r.by ? `${r.by} · ` : ""}
          {new Date(r.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      </Link>
    </div>
  );

  return (
    <>
      {canEdit && picked.size > 0 && (
        <div className="sticky top-0 z-20 mb-8 flex flex-wrap items-center gap-5 border border-hairline bg-paper px-5 py-3 text-[12px]" data-testid="bulk-bar">
          <span className="eyebrow">{picked.size} selected</span>
          <a href={`/api/packs/export?ids=${ids.join(",")}`} className="eyebrow hover:text-ink">Export ZIP</a>
          <button type="button" className="eyebrow hover:text-ink" disabled={pending} onClick={() => run(() => bulkSetStage(ids, "PROTO"))}>Stage → Proto</button>
          <button type="button" className="eyebrow hover:text-ink" disabled={pending} onClick={() => run(() => bulkSetStage(ids, "PRODUCTION"))}>Stage → Production</button>
          <select aria-label="Assign to" defaultValue="" disabled={pending} onChange={(e) => e.target.value && run(() => bulkAssign(ids, e.target.value === "-" ? null : e.target.value))} className="border-b border-hairline-strong bg-transparent text-[11px] uppercase">
            <option value="">Assign to…</option>
            <option value="-">Nobody</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {isAdmin && (
            <button type="button" className="eyebrow hover:text-signal" disabled={pending} onClick={() => run(() => bulkArchive(ids, !archivedView))}>
              {archivedView ? "Restore" : "Archive"}
            </button>
          )}
          <button type="button" className="eyebrow hover:text-ink ml-auto" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}
      {(msg || undo) && (
        <p className="mb-6 text-[12px] text-ink-soft" role="status">
          {msg}{" "}
          {undo && (
            <button type="button" className="eyebrow hover:text-ink ml-3" onClick={() => run(async () => ({ ...(await bulkUndo(undo)), undo: undefined }))}>
              Undo
            </button>
          )}
        </p>
      )}
      {view === "pipeline" ? (
        <div className="grid gap-6 grid-cols-[repeat(6,minmax(200px,1fr))] overflow-x-auto" data-testid="pipeline">
          {PIPELINE.map((s) => (
            <section key={s}>
              <h2 className="eyebrow mb-3 pb-2 border-b border-hairline">
                {STATUS_LABEL[s]} <span className="text-mist">{packs.filter((p) => p.status === s).length}</span>
              </h2>
              <div className="space-y-3">{packs.filter((p) => p.status === s).map((p) => <div key={p.id} className="border border-hairline bg-white">{card(p, true)}</div>)}</div>
            </section>
          ))}
        </div>
      ) : packs.length === 0 ? (
        <p className="text-[13px] text-taupe">No packs match these filters.</p>
      ) : (
        <ul className="grid gap-x-8 gap-y-12 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          {packs.map((r, i) => (
            <li key={r.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              {card(r)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
