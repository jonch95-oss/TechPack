"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { batchCheck, batchCreate, batchParse } from "@/app/actions/packs";
import { uploadFile } from "@/lib/client/upload";
import { groupRenders, type BatchRow } from "@/lib/batch";
import { CATEGORIES, type Category } from "@/lib/questions/types";
import { Button, Label, Select } from "@/components/ui";

export function BatchCreate({ brands }: { brands: { id: string; name: string }[] }) {
  const [mode, setMode] = useState<"sheet" | "folder">("sheet");
  const [sheet, setSheet] = useState<File | null>(null);
  const [renders, setRenders] = useState<File[]>([]);
  const [brand, setBrand] = useState(brands[0]?.name ?? "");
  const [category, setCategory] = useState<Category>("Handbags");
  const [rows, setRows] = useState<BatchRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<{ created: { id: string; styleNo: string }[]; skipped: string[] } | null>(null);
  const [pending, start] = useTransition();
  const names = renders.map((f) => f.name);

  const check = () =>
    start(async () => {
      setDone(null);
      if (mode === "sheet") {
        const fd = new FormData();
        if (sheet) fd.set("sheet", sheet);
        for (const n of names) fd.append("files", n);
        const r = await batchParse(fd);
        setRows(r.rows);
        setErrors(r.errors);
      } else {
        const grouped = groupRenders(names).map((g, i) => ({ line: i + 1, styleNo: g.styleNo, styleName: g.styleNo, brand, category, base: "", colorways: g.colorways, renders: g.renders, issues: [] }));
        setRows(await batchCheck(grouped, names));
        setErrors([]);
      }
    });

  const create = () =>
    start(async () => {
      if (!rows) return;
      // Renders go straight to storage from the browser; only their URLs reach the server.
      const wanted = new Set(rows.filter((r) => !r.issues.length).flatMap((r) => r.renders.map((n) => n.toLowerCase())));
      const files = await Promise.all(renders.filter((f) => wanted.has(f.name.toLowerCase())).map(async (f) => ({ name: f.name, url: await uploadFile(f, "batch") })));
      const r = await batchCreate(rows, files);
      if (r.ok) setDone({ created: r.created ?? [], skipped: r.skipped ?? [] });
      else setErrors([r.error ?? "Something went wrong."]);
    });

  const ready = rows?.filter((r) => !r.issues.length).length ?? 0;
  return (
    <div className="space-y-8 max-w-5xl" data-testid="batch">
      <div className="flex gap-6 text-[13px]" role="radiogroup" aria-label="Source">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "sheet"} onChange={() => (setMode("sheet"), setRows(null))} className="accent-ink" /> Spreadsheet + renders
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "folder"} onChange={() => (setMode("folder"), setRows(null))} className="accent-ink" /> Folder of renders
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {mode === "sheet" ? (
          <div>
            <Label htmlFor="b-sheet">Spreadsheet (CSV / XLSX)</Label>
            <input id="b-sheet" type="file" accept=".csv,.xlsx" onChange={(e) => setSheet(e.target.files?.[0] ?? null)} className="text-[13px]" />
            <p className="text-[11px] text-taupe mt-2">Columns: Style #, Style name, Brand, Category, Base style, Colourways (e.g. &quot;BLACK, RED&quot;), Render (file name; several separated by commas).</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="b-brand">Brand</Label>
              <Select id="b-brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
                {brands.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="b-cat">Category</Label>
              <Select id="b-cat" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="b-renders">Renders</Label>
          <input id="b-renders" type="file" multiple accept="image/*" onChange={(e) => setRenders([...(e.target.files ?? [])])} className="text-[13px]" />
          {mode === "folder" && <p className="text-[11px] text-taupe mt-2">Grouped by file name: STYLE-A.png and STYLE-B.png become one pack with two colourways.</p>}
        </div>
      </div>
      <Button type="button" onClick={check} disabled={pending || (mode === "sheet" ? !sheet : !renders.length)}>
        {pending && !rows ? "Checking…" : "Check"}
      </Button>
      {errors.map((e) => (
        <p key={e} className="text-signal text-[12px]" role="alert">{e}</p>
      ))}
      {rows && (
        <div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left eyebrow">
                <th className="py-2">Style #</th>
                <th>Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Base</th>
                <th>Colourways</th>
                <th>Renders</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.line}-${r.styleNo}`} className="border-t border-hairline align-top">
                  <td className="py-2">{r.styleNo}</td>
                  <td>{r.styleName}</td>
                  <td>{r.brand}</td>
                  <td>{r.category}</td>
                  <td>{r.base}</td>
                  <td>{r.colorways.map((c) => `${c.code}${c.name ? ` ${c.name}` : ""}`).join(", ")}</td>
                  <td>{r.renders.join(", ")}</td>
                  <td className={r.issues.length ? "text-signal" : "text-ok"}>{r.issues.length ? r.issues.join(" ") : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6">
            <Button type="button" onClick={create} disabled={pending || !ready}>
              {pending ? "Creating…" : `Create ${ready} pack${ready === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
      {done && (
        <div className="border border-hairline p-5 text-[13px]" role="status">
          <div className="eyebrow mb-2">{done.created.length} created</div>
          <ul className="flex flex-wrap gap-4">
            {done.created.map((c) => (
              <li key={c.id}>
                <Link href={`/packs/${c.id}`} className="underline underline-offset-4">{c.styleNo}</Link>
              </li>
            ))}
          </ul>
          {done.skipped.length > 0 && <ul className="mt-3 text-signal">{done.skipped.map((s) => <li key={s}>{s}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
