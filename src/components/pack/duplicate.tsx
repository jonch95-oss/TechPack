"use client";

import { useActionState, useState } from "react";
import { duplicatePack } from "@/app/actions/workflow";
import { Drawer } from "@/components/drawer";
import { Button, Label, TextInput } from "@/components/ui";

/** Carry-over: start a new style, colourway or season from this pack. */
export function DuplicatePack({ packId, styleNo, styleName }: { packId: string; styleNo: string; styleName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(duplicatePack, undefined);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="eyebrow hover:text-ink" data-testid="duplicate-open">
        Duplicate
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} eyebrow={`From ${styleNo}`} title="Duplicate this pack">
        <form action={action} className="space-y-8">
          <input type="hidden" name="sourceId" value={packId} />
          <p className="text-[12px] text-taupe leading-relaxed">
            Every answer, library link and page setting comes across. The due date is cleared. The new pack starts as a draft that you then change — nothing is sent anywhere.
          </p>
          <div>
            <Label htmlFor="dup-style" required>New style #</Label>
            <TextInput id="dup-style" name="styleNo" placeholder={styleNo.replace(/\d+$/, (d) => String(Number(d) + 1).padStart(d.length, "0"))} className="uppercase" />
          </div>
          <div>
            <Label htmlFor="dup-name" required>Style name</Label>
            <TextInput id="dup-name" name="styleName" defaultValue={styleName} className="uppercase" />
          </div>
          <label className="flex items-center gap-3 text-[13px]">
            <input type="checkbox" name="keepFiles" defaultChecked className="accent-ink w-4 h-4" /> Keep render, colourway renders and reference photos
          </label>
          <label className="flex items-center gap-3 text-[13px]">
            <input type="checkbox" name="keepComments" className="accent-ink w-4 h-4" /> Keep comments (A, B, C…)
          </label>
          {state?.error && <p className="text-signal text-[12px]" role="alert">{state.error}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Duplicating…" : "Create the copy"}</Button>
        </form>
      </Drawer>
    </>
  );
}
