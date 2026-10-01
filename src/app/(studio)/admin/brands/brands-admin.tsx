"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBrand } from "@/app/actions/admin";
import { uploadFile } from "@/lib/client/upload";
import { Button, Label, TextInput, cx } from "@/components/ui";
import { Toggle } from "@/components/chips";
import { FileButton } from "@/components/library/hardware-form";

type B = { id?: string; name: string; codePrefix: string; codeFormat: string; logoUrl: string | null; licensorRequired: boolean; next?: string };

export function BrandsAdmin({ brands }: { brands: B[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-6">
      {brands.map((b) => (
        <BrandRow key={b.id} b={b} />
      ))}
      {adding ? (
        <BrandRow b={{ name: "", codePrefix: "", codeFormat: "", logoUrl: null, licensorRequired: false }} onDone={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)} className="w-full h-14 border border-dashed border-hairline-strong eyebrow hover:text-ink hover:border-ink transition-colors">
          + Add brand
        </button>
      )}
    </div>
  );
}

function BrandRow({ b, onDone }: { b: B; onDone?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(b);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(b);
  return (
    <div className="grid md:grid-cols-[160px_1fr_1fr_1fr_auto_auto] items-end gap-8 border border-hairline bg-paper p-6" data-testid={`brand-${b.codePrefix || "new"}`}>
      <div>
        <div className="h-16 bg-white border border-hairline flex items-center justify-center">
          {v.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.logoUrl} alt={`${v.name} logo`} className="max-h-12 max-w-[90%] object-contain" />
          ) : (
            <span className="display italic text-mist">No logo</span>
          )}
        </div>
        <FileButton
          label={v.logoUrl ? "Replace logo" : "Upload logo (SVG)"}
          accept="image/svg+xml,image/*"
          onFile={async (f) => {
            try {
              setV((x) => ({ ...x, logoUrl: null }));
              const url = await uploadFile(f, "brands");
              setV((x) => ({ ...x, logoUrl: url }));
            } catch (e) {
              setMsg({ ok: false, text: (e as Error).message });
            }
          }}
        />
      </div>
      <div>
        <Label required>Brand</Label>
        <TextInput value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </div>
      <div>
        <Label required>Prefix</Label>
        <TextInput value={v.codePrefix} onChange={(e) => setV({ ...v, codePrefix: e.target.value.toUpperCase() })} placeholder="PINK" />
      </div>
      <div>
        <Label>Code format</Label>
        <TextInput value={v.codeFormat} onChange={(e) => setV({ ...v, codeFormat: e.target.value.toUpperCase() })} placeholder={`${v.codePrefix || "PINK"}###`} />
        <div className="text-[11px] text-taupe mt-1">{b.next ? <>Next free: <span className="text-ink">{b.next}</span></> : "# = digit"}</div>
      </div>
      <div>
        <Label>Licensor fields</Label>
        <Toggle value={v.licensorRequired} onChange={(x) => setV({ ...v, licensorRequired: x })} />
      </div>
      <div className="flex flex-col items-end gap-2">
        <Button
          size="sm"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const r = await saveBrand(v);
              setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
              if (r.ok) {
                onDone?.();
                router.refresh();
              }
            })
          }
        >
          Save
        </Button>
        {msg && <span className={cx("text-[11px]", msg.ok ? "text-ok" : "text-signal")}>{msg.text}</span>}
      </div>
    </div>
  );
}
