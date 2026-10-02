"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePack, setPackArchived } from "@/app/actions/workflow";
import { Drawer } from "@/components/drawer";
import { Button, Label, TextInput } from "@/components/ui";

/** Admin only: archive / restore a pack, or delete it for good (type the style # to confirm). */
export function PackAdmin({ packId, styleNo, archived }: { packId: string; styleNo: string; archived: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const archive = () =>
    start(async () => {
      const res = await setPackArchived(packId, !archived);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  return (
    <>
      <button type="button" onClick={archive} disabled={pending} className="eyebrow hover:text-ink" data-testid="archive-pack">
        {archived ? "Restore" : "Archive"}
      </button>
      <button type="button" onClick={() => setOpen(true)} className="eyebrow text-signal hover:text-ink" data-testid="delete-pack-open">
        Delete
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} eyebrow={styleNo} title="Delete this pack">
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const res = await deletePack(packId, confirm);
              if (res && !res.ok) setError(res.error);
            });
          }}
        >
          <p className="text-[12px] text-taupe leading-relaxed">
            Deletes the pack and everything in it — answers, photos, line art, revisions, sample rounds and factory Q&amp;A. This can&apos;t be undone. To keep it out of
            sight but recoverable, archive it instead.
          </p>
          <div>
            <Label htmlFor="del-confirm" required>Type {styleNo} to confirm</Label>
            <TextInput id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="uppercase" autoComplete="off" />
          </div>
          {error && <p className="text-signal text-[12px]" role="alert">{error}</p>}
          <Button type="submit" disabled={pending || confirm.trim().toUpperCase() !== styleNo} data-testid="delete-pack">
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </form>
      </Drawer>
    </>
  );
}
