"use client";

import { useActionState, useState } from "react";
import { duplicatePack } from "@/app/actions/workflow";
import { Drawer } from "@/components/drawer";
import { Button, Label, Select, TextInput } from "@/components/ui";
import { CATEGORIES, type Category } from "@/lib/questions/types";
import { DEFAULT_GROUPS, INHERIT_GROUPS } from "@/lib/inherit";

/**
 * "New from…" (V2 §8): a new style, or a new colourway of this style, from this pack. Choose which
 * groups come across; brand, category and colourways can change here; the style # is required.
 */
export function DuplicatePack({
  packId,
  styleNo,
  styleName,
  brandId,
  category,
  colorways,
  brands,
}: {
  packId: string;
  styleNo: string;
  styleName: string;
  brandId?: string;
  category?: Category;
  colorways?: string[];
  brands?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"style" | "colourway">("style");
  const [state, action, pending] = useActionState(duplicatePack, undefined);
  const next = styleNo.replace(/\d+$/, (d) => String(Number(d) + 1).padStart(d.length, "0"));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="eyebrow hover:text-ink" data-testid="duplicate-open">
        New from…
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} eyebrow={`From ${styleNo}`} title="New from this pack">
        <form action={action} className="space-y-7">
          <input type="hidden" name="sourceId" value={packId} />
          <input type="hidden" name="mode" value={mode} />
          <div className="flex gap-6 text-[13px]" role="radiogroup" aria-label="What to create">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "style"} onChange={() => setMode("style")} className="accent-ink" /> A new style
            </label>
            <label className="flex items-center gap-2" data-testid="mode-colourway">
              <input type="radio" checked={mode === "colourway"} onChange={() => setMode("colourway")} className="accent-ink" /> A new colourway of {styleNo}
            </label>
          </div>
          <p className="text-[12px] text-taupe leading-relaxed">
            Settled answers come across as BASE STYLE; the due date is cleared. The new pack starts as a draft — nothing is sent anywhere.
          </p>
          <div>
            <Label htmlFor="dup-style" required>New style #</Label>
            <TextInput id="dup-style" name="styleNo" autoFocus placeholder={mode === "colourway" ? `${styleNo}-C` : next} className="uppercase" />
          </div>
          <div>
            <Label htmlFor="dup-name" required>Style name</Label>
            <TextInput id="dup-name" name="styleName" defaultValue={styleName} className="uppercase" />
          </div>
          {mode === "colourway" ? (
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="dup-cws" required>New colourway(s)</Label>
                <TextInput id="dup-cws" name="colorways" placeholder="-A RED, -B NAVY" className="uppercase" />
              </div>
              <div>
                <Label htmlFor="dup-from">Seed from</Label>
                <Select id="dup-from" name="fromColorway" defaultValue={colorways?.[0]}>
                  {(colorways ?? []).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              {brands && brands.length > 0 && (
                <div>
                  <Label htmlFor="dup-brand">Brand</Label>
                  <Select id="dup-brand" name="brandId" defaultValue={brandId}>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="dup-cat">Category</Label>
                <Select id="dup-cat" name="category" defaultValue={category}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="dup-cws2">Colourways (blank = the same)</Label>
                <TextInput id="dup-cws2" name="colorways" placeholder={(colorways ?? []).join(", ")} className="uppercase" />
              </div>
            </div>
          )}
          <fieldset>
            <legend className="eyebrow mb-3">Inherit</legend>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {INHERIT_GROUPS.map((g) => (
                <label key={g.id} className="flex items-center gap-3 text-[13px]">
                  <input type="checkbox" name="group" value={g.id} defaultChecked={(DEFAULT_GROUPS as string[]).includes(g.id)} className="accent-ink w-4 h-4" /> {g.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 text-[13px]">
            <input type="checkbox" name="keepFiles" defaultChecked className="accent-ink w-4 h-4" /> Keep render, colourway renders and reference photos
          </label>
          {state?.error && <p className="text-signal text-[12px]" role="alert">{state.error}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create the copy"}</Button>
        </form>
      </Drawer>
    </>
  );
}
