"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { approveArchiveImport, listArchiveImports, registerArchiveFiles, rejectArchiveImport, runArchiveImports, type ArchiveRow } from "@/app/actions/archive";
import { uploadFile } from "@/lib/client/upload";
import { Badge, Button } from "@/components/ui";

export function ArchiveImport({ initial }: { initial: ArchiveRow[] }) {
  const [rows, setRows] = useState(initial);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const ready = rows.filter((r) => r.status === "READY");
  const cost = Math.round(ready.reduce((t, r) => t + r.costUsd, 0) * 100) / 100;
  const refresh = async () => setRows(await listArchiveImports());

  return (
    <div className="space-y-8 max-w-5xl" data-testid="archive">
      <div className="flex flex-wrap items-center gap-6">
        <input
          type="file"
          multiple
          accept="application/pdf,.pdf"
          aria-label="Tech pack PDFs"
          className="text-[13px]"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (!files.length) return;
            start(async () => {
              const uploaded = await Promise.all(files.map(async (f) => ({ name: f.name, url: await uploadFile(f, "archive") })));
              const r = await registerArchiveFiles(uploaded);
              if (r.ok && r.rows) setRows(r.rows);
            });
          }}
        />
        <Button
          type="button"
          disabled={pending || !ready.length}
          onClick={() =>
            start(async () => {
              const r = await runArchiveImports(ready.map((x) => x.id));
              setMsg(r.ok ? r.message ?? "" : r.error);
              await refresh();
            })
          }
        >
          {`Read ${ready.length} file${ready.length === 1 ? "" : "s"}${ready.length ? ` · ${ready.reduce((t, r) => t + r.pages, 0)} pages · ≈ $${cost}` : ""}`}
        </Button>
        <button type="button" className="eyebrow hover:text-ink" onClick={() => start(refresh)}>
          Refresh
        </button>
        {msg && <span className="text-[12px] text-ink-soft" role="status">{msg}</span>}
      </div>
      {rows.length > 0 && (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left eyebrow">
              <th className="py-2">File</th>
              <th>Pages</th>
              <th>Status</th>
              <th>Proposed style</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-hairline align-top">
                <td className="py-2">{r.name}</td>
                <td>{r.pages}</td>
                <td>
                  <Badge tone={r.status === "APPROVED" ? "ok" : r.status === "ERROR" || r.status === "REJECTED" ? "signal" : r.status === "PROPOSED" ? "ai" : "neutral"}>{r.status}</Badge>
                  {r.error && <div className="text-signal mt-1">{r.error}</div>}
                </td>
                <td>{r.packId ? <Link href={`/packs/${r.packId}`} className="underline underline-offset-4">{r.styleNo}</Link> : "—"}</td>
                <td className="text-right whitespace-nowrap">
                  {r.status === "PROPOSED" && (
                    <span className="flex gap-4 justify-end">
                      <button type="button" className="eyebrow hover:text-ink" disabled={pending} onClick={() => start(async () => { const x = await approveArchiveImport(r.id); setMsg(x.ok ? x.message ?? "" : x.error); await refresh(); })}>
                        Approve
                      </button>
                      <button type="button" className="eyebrow hover:text-signal" disabled={pending} onClick={() => start(async () => { await rejectArchiveImport(r.id); await refresh(); })}>
                        Reject
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
