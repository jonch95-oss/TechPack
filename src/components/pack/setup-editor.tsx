"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAnswer, updatePackSetup } from "@/app/actions/packs";
import { Drawer } from "@/components/drawer";
import { Button, Label, TextInput } from "@/components/ui";
import { CATEGORIES } from "@/lib/questions";
import { remapAnswers, removeColorway } from "@/lib/colorways";

/**
 * Pack setup stays editable after creation (V2 §3 step 2): style #, name, brand, category and the
 * colourways — added, renamed or removed anywhere, with their breakdown data following.
 */
export function SetupEditor({
  pack,
  brands,
  names,
}: {
  pack: { id: string; styleNo: string; styleName: string; category: string; brandId: string; colorways: string[] };
  brands: { id: string; name: string }[];
  names: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ styleNo: pack.styleNo, styleName: pack.styleName, category: pack.category, brandId: pack.brandId });
  const [cws, setCws] = useState(pack.colorways);
  const [cwNames, setCwNames] = useState(names);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; colorways?: string[] }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return setMsg({ ok: false, text: res.error ?? "Didn't save." });
      if (res.colorways) setCws(res.colorways);
      setMsg({ ok: true, text: ok });
      router.refresh();
    });
  const reopen = () => {
    setV({ styleNo: pack.styleNo, styleName: pack.styleName, category: pack.category, brandId: pack.brandId });
    setCws(pack.colorways);
    setCwNames(names);
    setMsg(null);
    setOpen(true);
  };
  return (
    <>
      <button type="button" onClick={reopen} className="eyebrow hover:text-ink" data-testid="edit-setup">
        Edit setup
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} eyebrow={pack.styleNo} title="Pack setup">
        <div className="space-y-7">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label htmlFor="setup-style" required>Style #</Label>
              <TextInput id="setup-style" data-testid="setup-style" value={v.styleNo} onChange={(e) => setV({ ...v, styleNo: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label htmlFor="setup-name" required>Style name</Label>
              <TextInput id="setup-name" value={v.styleName} onChange={(e) => setV({ ...v, styleName: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label htmlFor="setup-brand">Brand</Label>
              <select id="setup-brand" className="h-10 w-full border border-hairline-strong bg-paper px-3 text-[13px]" value={v.brandId} onChange={(e) => setV({ ...v, brandId: e.target.value })}>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="setup-category">Category</Label>
              <select id="setup-category" data-testid="setup-category" className="h-10 w-full border border-hairline-strong bg-paper px-3 text-[13px]" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          {v.category !== pack.category && (
            <p className="text-[11.5px] text-taupe">Answers that don&apos;t apply to {v.category} are kept but hidden — switching back restores them.</p>
          )}
          <Button
            type="button"
            disabled={pending}
            data-testid="setup-save"
            onClick={() =>
              run(
                () =>
                  updatePackSetup(pack.id, {
                    ...(v.styleNo !== pack.styleNo ? { styleNo: v.styleNo } : {}),
                    ...(v.styleName !== pack.styleName ? { styleName: v.styleName } : {}),
                    ...(v.category !== pack.category ? { category: v.category } : {}),
                    ...(v.brandId !== pack.brandId ? { brandId: v.brandId } : {}),
                  }),
                "Saved.",
              )
            }
          >
            Save
          </Button>

          <div className="pt-6 border-t border-hairline">
            <div className="eyebrow mb-3">Colourways</div>
            <ul className="space-y-2">
              {cws.map((c) => (
                <li key={c} className="flex items-center gap-3" data-testid={`setup-cw-${c}`}>
                  <span className="display text-xl w-10">{c}</span>
                  <TextInput
                    aria-label={`Name of ${c}`}
                    value={cwNames[c] ?? ""}
                    placeholder="COLOURWAY NAME"
                    onChange={(e) => setCwNames({ ...cwNames, [c]: e.target.value.toUpperCase() })}
                    onBlur={() => {
                      if ((cwNames[c] ?? "") === (names[c] ?? "")) return;
                      run(() => saveAnswer(pack.id, "colorways.names", cwNames), "Renamed.");
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${c}`}
                    data-testid={`remove-cw-${c}`}
                    disabled={pending || cws.length <= 1}
                    className="h-8 px-3 border border-hairline-strong text-[10px] tracking-[0.16em] uppercase hover:border-signal hover:text-signal disabled:opacity-30"
                    onClick={() => {
                      if (!confirm(`Remove ${c}${cwNames[c] ? ` (${cwNames[c]})` : ""}? Its breakdown cells go with it; later colourways move up a letter.`)) return;
                      // Names move with their colourway, exactly as the server re-letters them.
                      const { map } = removeColorway(cws, c);
                      setCwNames(remapAnswers({ n: cwNames }, map).n as Record<string, string> ?? cwNames);
                      run(() => updatePackSetup(pack.id, { removeColorway: c }), `${c} removed.`);
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              data-testid="add-cw"
              className="mt-3 text-[10px] tracking-[0.2em] uppercase text-gold hover:text-ink"
              disabled={pending}
              onClick={() => run(() => updatePackSetup(pack.id, { colorways: [...cws, `-${String.fromCharCode(65 + cws.length)}`] }), "Colourway added.")}
            >
              + Add colourway
            </button>
          </div>
          {msg && (
            <p className={msg.ok ? "text-ok text-[12px]" : "text-signal text-[12px]"} role={msg.ok ? "status" : "alert"}>
              {msg.text}
            </p>
          )}
        </div>
      </Drawer>
    </>
  );
}
