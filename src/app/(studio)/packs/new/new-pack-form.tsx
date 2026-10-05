"use client";

import { useActionState, useState } from "react";
import { createPack } from "@/app/actions/packs";
import { CATEGORIES } from "@/lib/questions/types";
import { Button, Label, TextInput, cx } from "@/components/ui";
import { suffixesFor } from "@/lib/codes";

type B = { id: string; name: string; prefix: string; logo: string | null };

export function NewPackForm({ brands }: { brands: B[] }) {
  const [state, action, pending] = useActionState(createPack, undefined);
  const [brandId, setBrandId] = useState("");
  const [category, setCategory] = useState("");
  const [count, setCount] = useState(2);
  const [styleNo, setStyleNo] = useState("");
  const brand = brands.find((b) => b.id === brandId);

  return (
    <form action={action} className="grid lg:grid-cols-[1fr_340px] gap-16">
      <div className="space-y-14">
        <fieldset>
          <legend className="display text-2xl mb-1">I. Brand</legend>
          <p className="text-taupe text-[12px] mb-5">The logo in the masthead is the only visual differentiator.</p>
          <input type="hidden" name="brandId" value={brandId} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {brands.map((b) => (
              <button
                type="button"
                key={b.id}
                onClick={() => {
                  setBrandId(b.id);
                  if (!styleNo) setStyleNo(b.prefix);
                }}
                aria-pressed={brandId === b.id}
                className={cx(
                  "h-24 border flex flex-col items-center justify-center gap-2 px-3 transition-all duration-200",
                  brandId === b.id ? "border-ink bg-ink text-ivory" : "border-hairline-strong hover:border-ink bg-paper",
                )}
              >
                {b.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logo} alt="" className={cx("max-h-8 max-w-[80%] object-contain", brandId === b.id && "invert")} />
                ) : null}
                <span className="text-[10.5px] tracking-[0.2em] uppercase text-center">{b.name}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="display text-2xl mb-5">II. Category</legend>
          <input type="hidden" name="category" value={category} />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={cx(
                  "h-9 px-4 border text-[11px] tracking-[0.12em] uppercase transition-colors",
                  category === c ? "bg-ink text-ivory border-ink" : "border-hairline-strong hover:border-ink",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid md:grid-cols-2 gap-x-10 gap-y-8">
          <legend className="display text-2xl mb-5 col-span-full">III. Style</legend>
          <div>
            <Label htmlFor="styleNo" required>Style #</Label>
            <TextInput id="styleNo" name="styleNo" value={styleNo} onChange={(e) => setStyleNo(e.target.value.toUpperCase())} placeholder={brand ? `${brand.prefix}013` : "PINK013"} />
          </div>
          <div>
            <Label htmlFor="styleName" required>Style name</Label>
            <TextInput id="styleName" name="styleName" placeholder="JODIE" className="uppercase" />
          </div>
          <div>
            <Label required>Colorways</Label>
            <input type="hidden" name="colorways" value={count} />
            <div className="flex items-center gap-4 h-10">
              <button type="button" className="w-9 h-9 border border-hairline-strong hover:border-ink" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="Fewer colorways">−</button>
              <span className="display text-2xl w-6 text-center">{count}</span>
              <button type="button" className="w-9 h-9 border border-hairline-strong hover:border-ink" onClick={() => setCount((c) => Math.min(26, c + 1))} aria-label="More colorways">+</button>
              <span className="text-taupe text-[12px] tracking-[0.14em]">{suffixesFor(count).join("  ")}</span>
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-28 self-start border border-hairline bg-paper p-8">
        <div className="eyebrow mb-6">Summary</div>
        <dl className="space-y-4 text-[13px]">
          <Row k="Brand" v={brand?.name} />
          <Row k="Category" v={category} />
          <Row k="Style" v={styleNo} />
          <Row k="Proto" v={styleNo ? `${styleNo}${suffixesFor(count).map((s, i) => (i ? s.slice(1) : s)).join(", ")}` : ""} />
        </dl>
        {state?.error && <p className="mt-6 text-signal text-[12px]" role="alert">{state.error}</p>}
        <Button type="submit" className="w-full mt-8" disabled={pending || !brandId || !category}>
          {pending ? "Creating…" : "Create pack"}
        </Button>
        <p className="mt-4 text-[11px] text-taupe leading-relaxed">Next: upload the render and let the Technical Designer pre-fill what it can see.</p>
      </aside>
    </form>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-hairline pb-3">
      <dt className="eyebrow">{k}</dt>
      <dd className="text-right">{v || <span className="text-mist">—</span>}</dd>
    </div>
  );
}
