"use client";

import type { Approval } from "@/db/schema";
import { ChipRow } from "@/components/chips";
import { Badge } from "@/components/ui";

export const EMPTY_APPROVAL: Approval = { status: "PENDING", type: "", date: "", note: "" };

export function approvalTone(s?: string) {
  return s === "APPROVED" ? "ok" : s === "REJECTED" ? "signal" : "ai";
}

/** Lab dip / strike-off / plating / mould approval. Packs using anything not APPROVED get a warning. */
export function ApprovalBlock({ value, onChange, types, disabled }: { value: Approval; onChange: (a: Approval) => void; types: string[]; disabled?: boolean }) {
  return (
    <div className="border border-hairline bg-paper p-5 space-y-4" data-testid="approval">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Approval</span>
        <Badge tone={approvalTone(value.status)}>{value.status}</Badge>
      </div>
      <ChipRow options={["PENDING", "APPROVED", "REJECTED"]} value={value.status} allowOther={false} disabled={disabled} onChange={(v) => v && onChange({ ...value, status: v as Approval["status"] })} testId="approval-status" />
      <ChipRow options={types} value={value.type} disabled={disabled} onChange={(v) => onChange({ ...value, type: v })} />
      <div className="flex flex-wrap gap-4">
        <input type="date" value={value.date} disabled={disabled} onChange={(e) => onChange({ ...value, date: e.target.value })} className="h-9 px-3 border border-hairline-strong bg-ivory text-[12px]" aria-label="Approval date" />
        <input
          value={value.note}
          disabled={disabled}
          placeholder="Note, e.g. LAB DIP B APPROVED — SLIGHTLY WARMER"
          onChange={(e) => onChange({ ...value, note: e.target.value.toUpperCase() })}
          className="flex-1 min-w-48 h-9 bg-transparent border-0 border-b border-hairline-strong text-[12px] focus:outline-none focus:border-ink placeholder:normal-case placeholder:text-mist"
          aria-label="Approval note"
        />
      </div>
    </div>
  );
}
