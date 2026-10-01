"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PackFile } from "@/db/schema";
import { addPackFile, removePackFile, updatePackFile } from "@/app/actions/packs";
import { uploadFile } from "@/lib/client/upload";
import { CommentDot, Thumb, cx } from "@/components/ui";

type Kind = PackFile["kind"];

const GROUPS: { kind: Kind; title: string; hint: string }[] = [
  { kind: "colorway_render", title: "Colorway renders", hint: "One per colorway for the Enlarged CAD page." },
  { kind: "reference", title: "Reference photos", hint: "Each gets a lettered red callout." },
  { kind: "construction", title: "Construction references", hint: "Closure, strap attachment, pocket details…" },
  { kind: "reference_sample", title: "Reference sample", hint: "Photo of the reference sample." },
  { kind: "swatch_photo", title: "Swatch-card photos", hint: "Add to the library from Materials." },
];

export function FilesPanel({ packId, files, colorways, canEdit }: { packId: string; files: PackFile[]; colorways: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();

  const add = async (kind: Kind, list: FileList | null, tag?: string) => {
    if (!list?.length) return;
    setErr(null);
    setBusy(kind);
    try {
      for (const f of Array.from(list)) {
        const url = await uploadFile(f, kind === "render" || kind === "colorway_render" ? "renders" : "references");
        const res = await addPackFile(packId, { kind, url, name: f.name, tag });
        if (!res.ok) throw new Error(res.error);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(null);
  };

  return (
    <div className="space-y-8">
      {GROUPS.map((g) => {
        const items = files.filter((f) => f.kind === g.kind);
        const usedSuffixes = new Set(items.map((i) => i.tag));
        const nextSuffix = colorways.find((c) => !usedSuffixes.has(c));
        return (
          <div key={g.kind}>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="eyebrow text-ink-soft">{g.title}</div>
                <div className="text-[11px] text-taupe mt-0.5">{g.hint}</div>
              </div>
              {canEdit && (
                <label className={cx("cursor-pointer text-[10px] tracking-[0.2em] uppercase text-taupe hover:text-ink", busy === g.kind && "opacity-50 pointer-events-none")}>
                  {busy === g.kind ? "Uploading…" : "+ Add"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple={g.kind !== "colorway_render"}
                    className="sr-only"
                    data-testid={`upload-${g.kind}`}
                    onChange={(e) => {
                      const fl = e.target.files;
                      add(g.kind, fl, g.kind === "colorway_render" ? nextSuffix : undefined);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            {items.length > 0 && (
              <ul className="grid grid-cols-3 gap-3">
                {items.map((f) => (
                  <li key={f.id} className="group relative">
                    <Thumb src={f.url} alt={f.name} className="w-full aspect-square" />
                    <div className="flex items-center justify-between gap-1 mt-1">
                      {g.kind === "reference" || g.kind === "construction" ? (
                        <span className="flex items-center gap-1">
                          <CommentDot letter={f.tag || "?"} size={18} />
                          {canEdit && (
                            <select
                              aria-label="Comment letter"
                              value={f.tag}
                              onChange={(e) => start(async () => { await updatePackFile(packId, f.id, { tag: e.target.value }); router.refresh(); })}
                              className="text-[10px] bg-transparent text-taupe"
                            >
                              {Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)).map((l) => (
                                <option key={l}>{l}</option>
                              ))}
                            </select>
                          )}
                        </span>
                      ) : g.kind === "colorway_render" ? (
                        canEdit ? (
                          <select
                            aria-label="Colorway"
                            value={f.tag}
                            onChange={(e) => start(async () => { await updatePackFile(packId, f.id, { tag: e.target.value }); router.refresh(); })}
                            className="text-[11px] bg-transparent"
                          >
                            {colorways.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px]">{f.tag}</span>
                        )
                      ) : (
                        <span className="text-[10px] text-taupe truncate">{f.name}</span>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          className="text-taupe hover:text-signal text-[12px]"
                          aria-label={`Remove ${f.name}`}
                          onClick={() => start(async () => { await removePackFile(packId, f.id); router.refresh(); })}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {(g.kind === "reference" || g.kind === "construction") && (
                      <input
                        defaultValue={f.note}
                        disabled={!canEdit}
                        placeholder="Caption…"
                        aria-label={`Caption for ${f.name}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim().toUpperCase();
                          if (v !== f.note) start(async () => { await updatePackFile(packId, f.id, { note: v }); router.refresh(); });
                        }}
                        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                        className="mt-1 w-full h-7 bg-transparent border-0 border-b border-hairline-strong text-[10.5px] uppercase focus:outline-none focus:border-ink placeholder:normal-case placeholder:text-mist"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {err && <p className="text-signal text-[12px]" role="alert">{err}</p>}
    </div>
  );
}
