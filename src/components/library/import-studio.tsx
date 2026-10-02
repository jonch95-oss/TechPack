"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { commitImport, parseUpload, readCardImage, type CommitReport } from "@/app/actions/imports";
import { uploadFile } from "@/lib/client/upload";
import {
  FIELD_LABELS,
  emptyRow,
  fieldsFor,
  hasErrors,
  rowIssues,
  type ImportContext,
  type ImportRow,
  type LibraryKind,
  type RowIssue,
} from "@/lib/library-import";
import { HARDWARE_TYPES } from "@/lib/questions/common";
import { Badge, Button, SwatchThumb, buttonClass, cx } from "@/components/ui";

type Stage = "add" | "review" | "done";

const IMAGE_RE = /\.(jpe?g|png|webp|gif|heic|svg)$/i;

export function ImportStudio({ kind, context }: { kind: LibraryKind; context: ImportContext }) {
  const [stage, setStage] = useState<Stage>("add");
  const [files, setFiles] = useState<File[]>([]);
  const [defaultBrandId, setDefaultBrandId] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [messages, setMessages] = useState<{ errors: string[]; notes: string[] }>({ errors: [], notes: [] });
  const [report, setReport] = useState<CommitReport | null>(null);
  const [filter, setFilter] = useState<"all" | "attention">("all");

  const ctx = useMemo(() => ({ ...context, defaultBrandId: defaultBrandId || null }), [context, defaultBrandId]);
  const issues = useMemo(() => rowIssues(kind, rows, ctx), [kind, rows, ctx]);
  const included = rows.filter((r) => r.include);
  const blocked = included.filter((r) => hasErrors(issues[r.key]));
  const ready = included.length - blocked.length;
  const warned = included.filter((r) => !hasErrors(issues[r.key]) && issues[r.key]?.some((i) => i.level === "warning")).length;
  const fields = fieldsFor(kind);
  const noun = kind === "hardware" ? "component" : "swatch";

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const next = Array.from(list).filter((f) => f.size > 0 && !f.name.startsWith("."));
    setFiles((cur) => [...cur, ...next.filter((n) => !cur.some((c) => c.name === n.name && c.size === n.size))]);
  };

  const review = async () => {
    setBusy("Uploading…");
    try {
      const images = files.filter((f) => IMAGE_RE.test(f.name) || f.type.startsWith("image/"));
      const pdfs = files.filter((f) => /\.pdf$/i.test(f.name));
      const sheets = files.filter((f) => /\.(xlsx|xls|csv|txt)$/i.test(f.name));
      const imageMap: Record<string, string> = {};
      for (let i = 0; i < images.length; i++) {
        setBusy(`Uploading photos ${i + 1} / ${images.length}`);
        imageMap[images[i].webkitRelativePath || images[i].name] = await uploadFile(images[i], kind === "hardware" ? "hardware" : "swatches");
      }
      const pdfUrls: { name: string; url: string }[] = [];
      for (const p of pdfs) {
        setBusy(`Uploading ${p.name}`);
        pdfUrls.push({ name: p.name, url: await uploadFile(p, "misc") });
      }
      setBusy(pdfs.length ? "Reading PDFs…" : "Reading…");
      const fd = new FormData();
      fd.set("kind", kind);
      for (const s of sheets) fd.append("sheets", s);
      fd.set("imageMap", JSON.stringify(imageMap));
      fd.set("pdfUrls", JSON.stringify(pdfUrls));
      const res = await parseUpload(fd);
      setRows(res.rows);
      setMessages({ errors: res.errors, notes: res.notes });
      setStage("review");
    } catch (e) {
      setMessages({ errors: [(e as Error).message], notes: [] });
    }
    setBusy(null);
  };

  const setField = (key: string, field: string, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, fields: { ...r.fields, [field]: value }, aiFields: r.aiFields.filter((f) => f !== field) } : r)));

  const readCards = async () => {
    const targets = rows.filter((r) => r.include && r.images.photo && !r.fields.composition && !r.fields.thickness);
    for (let i = 0; i < targets.length; i++) {
      setBusy(`Reading card ${i + 1} / ${targets.length}`);
      const r = targets[i];
      const res = await readCardImage(r.images.photo, { supplier: r.fields.supplier, colourNo: r.fields.colourNo, colourName: r.fields.colourName });
      if (!res.ok) {
        setMessages((m) => ({ ...m, errors: [...m.errors, `${r.source}: ${res.error}`] }));
        if (res.error.includes("ANTHROPIC")) break;
        continue;
      }
      setRows((rs) =>
        rs.map((x) => {
          if (x.key !== r.key) return x;
          const f = { ...x.fields };
          const ai = new Set(x.aiFields);
          for (const [k, v] of Object.entries(res.fields)) {
            if (v && !f[k]) {
              f[k] = v;
              ai.add(k);
            }
          }
          return { ...x, fields: f, aiFields: [...ai], chipBox: res.chipBox ?? x.chipBox };
        }),
      );
    }
    setBusy(null);
  };

  const save = async () => {
    setBusy("Saving…");
    setReport(await commitImport(kind, rows, defaultBrandId || null));
    setBusy(null);
    setStage("done");
  };

  /* ------------------------------ add files ------------------------------ */
  if (stage === "add") {
    const ways =
      kind === "hardware"
        ? [
            { t: "Excel template", d: "Download, fill one row per component, paste a photo into each row.", a: <a href="/api/templates/hardware" className={buttonClass("secondary", "sm")} download>Download template</a> },
            { t: "Your own spreadsheet", d: "Any .xlsx or .csv — columns are matched loosely (Code, Type, Plating, Image…). Pasted pictures come across." },
            { t: "PDF", d: "Supplier spec sheets or hardware catalogues. The AI reads every component; you confirm." },
            { t: "Photos", d: "A folder or a batch. Matched to rows by file name or code (PINK005.jpg); extra photos start a new row." },
          ]
        : [
            { t: "Excel template", d: "Download, fill one row per colour, paste a card photo into each row.", a: <a href="/api/templates/materials" className={buttonClass("secondary", "sm")} download>Download template</a> },
            { t: "Your own spreadsheet", d: "Any .xlsx or .csv — Supplier, Article, Colour no., Composition… matched loosely." },
            { t: "PDF", d: "Mill spec sheets, colour cards or scanned swatch cards. Read by the AI, Chinese included." },
            { t: "Card photos", d: "Snap the cards and drop them in. Each photo becomes a swatch; the AI reads the printed spec." },
          ];
    return (
      <div className="space-y-12">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {ways.map((w, i) => (
            <div key={w.t} className="border border-hairline bg-paper p-6 flex flex-col fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="display italic text-gold text-lg">{["I", "II", "III", "IV"][i]}</div>
              <div className="display text-[22px] leading-tight mt-1">{w.t}</div>
              <p className="text-[12px] text-taupe mt-2 leading-relaxed flex-1">{w.d}</p>
              {w.a && <div className="mt-4">{w.a}</div>}
            </div>
          ))}
        </div>

        <DropArea onFiles={addFiles} />

        {files.length > 0 && (
          <div className="border border-hairline">
            <div className="flex items-center justify-between px-6 py-3 border-b border-hairline bg-paper">
              <span className="eyebrow">{files.length} file{files.length > 1 ? "s" : ""} ready</span>
              <button className="eyebrow hover:text-signal" onClick={() => setFiles([])}>Clear</button>
            </div>
            <ul className="divide-y divide-hairline max-h-72 overflow-y-auto" data-testid="import-files">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between px-6 py-2 text-[12.5px]">
                  <span className="truncate">{f.webkitRelativePath || f.name}</span>
                  <span className="flex items-center gap-4">
                    <Badge>{kindOf(f)}</Badge>
                    <button aria-label={`Remove ${f.name}`} className="text-taupe hover:text-signal" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-8">
          {kind === "hardware" && (
            <div>
              <div className="eyebrow mb-2">Brand for rows that don&apos;t say</div>
              <select value={defaultBrandId} onChange={(e) => setDefaultBrandId(e.target.value)} className="h-10 min-w-64 bg-transparent border-0 border-b border-hairline-strong focus:outline-none focus:border-ink" aria-label="Default brand">
                <option value="">—</option>
                {context.brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <Button onClick={review} disabled={!files.length || !!busy} data-testid="import-review">
            {busy ?? "Review before saving"}
          </Button>
          <Button variant="ghost" onClick={() => { setRows([emptyRow(kind, "Typed in")]); setStage("review"); }}>
            Or type rows in by hand
          </Button>
        </div>
        {messages.errors.map((e) => (
          <p key={e} className="text-signal text-[12px]">{e}</p>
        ))}
      </div>
    );
  }

  /* ------------------------------ done ------------------------------ */
  if (stage === "done" && report) {
    return (
      <div className="border border-hairline bg-paper p-10 fade-up" data-testid="import-report">
        <div className="display text-[34px]">Saved to the library</div>
        <div className="flex flex-wrap gap-3 mt-5">
          <Badge tone="ok">{report.created.length} added</Badge>
          {kind === "hardware" && <Badge>{report.updated.length} updated</Badge>}
          {report.skipped.length > 0 && <Badge tone="signal">{report.skipped.length} not saved</Badge>}
        </div>
        {report.created.length > 0 && <p className="mt-6 text-[13px] leading-relaxed">{report.created.join(" · ")}</p>}
        {report.skipped.map((s) => (
          <p key={s.source} className="mt-2 text-[12px] text-signal">{s.source}: {s.reason}</p>
        ))}
        <div className="mt-8 flex gap-4">
          <Link href={kind === "hardware" ? "/library/hardware" : "/library/materials"} className={buttonClass("primary")}>Open the library</Link>
          <Button variant="secondary" onClick={() => { setFiles([]); setRows([]); setReport(null); setStage("add"); }}>Add more</Button>
        </div>
      </div>
    );
  }

  /* ------------------------------ review ------------------------------ */
  const shown = filter === "all" ? rows : rows.filter((r) => issues[r.key]?.some((i) => i.level !== "info"));
  const cardsToRead = kind === "material" ? rows.filter((r) => r.include && r.images.photo && !r.fields.composition && !r.fields.thickness).length : 0;
  return (
    <div className="space-y-8">
      <div className="sticky top-[72px] z-20 bg-ivory/95 backdrop-blur border-b border-hairline -mx-10 px-10 py-5 flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-3" data-testid="import-summary">
          <span className="display text-[28px] leading-none">{ready}</span>
          <span className="text-taupe mr-3">ready to save</span>
          {blocked.length > 0 && <Badge tone="signal">{blocked.length} need fixing</Badge>}
          {warned > 0 && <Badge tone="ai">{warned} to check</Badge>}
          {rows.length - included.length > 0 && <Badge>{rows.length - included.length} skipped</Badge>}
          <button className="eyebrow ml-4 hover:text-ink" onClick={() => setFilter(filter === "all" ? "attention" : "all")}>
            {filter === "all" ? "Show only call-outs" : "Show all rows"}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {kind === "hardware" && (
            <select value={defaultBrandId} onChange={(e) => setDefaultBrandId(e.target.value)} className="h-10 bg-transparent border-b border-hairline-strong text-[12px]" aria-label="Default brand">
              <option value="">Brand for rows that don&apos;t say —</option>
              {context.brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {cardsToRead > 0 && (
            <Button variant="gold" size="sm" onClick={readCards} disabled={!!busy}>Read {cardsToRead} card{cardsToRead > 1 ? "s" : ""} with AI</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, emptyRow(kind, "Typed in")])}>+ Row</Button>
          <Button onClick={save} disabled={!ready || !!busy} data-testid="import-save">
            {busy ?? `Save ${ready} ${noun}${ready === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>

      {[...messages.errors, ...messages.notes].length > 0 && (
        <div className="space-y-1">
          {messages.errors.map((e) => (
            <p key={e} className="text-signal text-[12px]">{e}</p>
          ))}
          {messages.notes.map((n) => (
            <p key={n} className="text-taupe text-[12px]">{n}</p>
          ))}
        </div>
      )}

      {rows.length === 0 && <p className="display italic text-xl text-taupe">Nothing was found to import. Check the messages above.</p>}

      <div className="space-y-3" data-testid="import-rows">
        {shown.map((r) => {
          const iss = issues[r.key] ?? [];
          const err = hasErrors(iss);
          const errFields = new Set(iss.filter((i) => i.level === "error" && i.field).map((i) => i.field));
          const warnFields = new Set(iss.filter((i) => i.level === "warning" && i.field).map((i) => i.field));
          return (
            <div key={r.key} data-testid="import-row" className={cx("border bg-paper transition-opacity", !r.include && "opacity-45", err && r.include ? "border-signal/50" : "border-hairline")}>
              <div className="grid grid-cols-[auto_88px_minmax(0,1fr)] gap-5 p-4">
                <label className="pt-1">
                  <input type="checkbox" checked={r.include} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, include: e.target.checked } : x)))} aria-label="Include row" className="accent-ink w-4 h-4" />
                </label>
                <SwatchThumb src={r.images.photo} box={r.chipBox} alt="" className="w-[88px] h-[88px]" />
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[10px] tracking-[0.18em] uppercase text-mist truncate">{r.source}</span>
                    <button className="text-taupe hover:text-signal text-[12px]" aria-label="Delete row" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>✕</button>
                  </div>
                  <div className={cx("grid gap-x-4 gap-y-2", kind === "hardware" ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-6" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-5")}>
                    {fields.map((f) => (
                      <label key={f} className="block min-w-0">
                        <span className={cx("block text-[9.5px] tracking-[0.18em] uppercase mb-0.5", errFields.has(f) ? "text-signal" : warnFields.has(f) ? "text-gold" : "text-taupe")}>
                          {FIELD_LABELS[f]}
                          {r.aiFields.includes(f) && <span className="text-gold"> · AI</span>}
                        </span>
                        {kind === "hardware" && f === "type" ? (
                          <select
                            value={r.fields.type}
                            onChange={(e) => setField(r.key, f, e.target.value)}
                            className={cx("w-full h-8 bg-transparent border-0 border-b text-[12px] focus:outline-none", errFields.has(f) ? "border-signal" : "border-hairline-strong")}
                          >
                            <option value="">—</option>
                            {[...HARDWARE_TYPES, ...(r.fields.type && !HARDWARE_TYPES.includes(r.fields.type) ? [r.fields.type] : [])].map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        ) : kind === "hardware" && f === "brand" ? (
                          <select
                            value={context.brands.find((b) => b.name.toUpperCase() === r.fields.brand.toUpperCase())?.name ?? r.fields.brand}
                            onChange={(e) => setField(r.key, f, e.target.value)}
                            className={cx("w-full h-8 bg-transparent border-0 border-b text-[12px] focus:outline-none", errFields.has(f) ? "border-signal" : "border-hairline-strong")}
                          >
                            <option value="">{defaultBrandId ? `(${context.brands.find((b) => b.id === defaultBrandId)?.name})` : "—"}</option>
                            {[...context.brands.map((b) => b.name), ...(r.fields.brand && !context.brands.some((b) => b.name.toUpperCase() === r.fields.brand.toUpperCase()) ? [r.fields.brand] : [])].map((b) => (
                              <option key={b}>{b}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={r.fields[f] ?? ""}
                            onChange={(e) => setField(r.key, f, e.target.value.toUpperCase())}
                            className={cx(
                              "w-full h-8 bg-transparent border-0 border-b text-[12px] tracking-[0.03em] focus:outline-none focus:border-ink",
                              errFields.has(f) ? "border-signal" : warnFields.has(f) ? "border-gold" : "border-hairline-strong",
                              r.aiFields.includes(f) && "bg-gold-soft/40",
                            )}
                            aria-label={FIELD_LABELS[f]}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                  {iss.length > 0 && r.include && (
                    <ul className="mt-3 space-y-0.5">
                      {iss.map((i, k) => (
                        <IssueLine key={k} i={i} />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IssueLine({ i }: { i: RowIssue }) {
  return (
    <li className={cx("text-[11.5px] leading-relaxed", i.level === "error" ? "text-signal" : i.level === "warning" ? "text-gold" : "text-taupe")}>
      {i.level === "error" ? "✕ " : i.level === "warning" ? "! " : "· "}
      {i.message}
    </li>
  );
}

function kindOf(f: File) {
  if (/\.pdf$/i.test(f.name)) return "PDF";
  if (/\.(xlsx|xls)$/i.test(f.name)) return "Excel";
  if (/\.(csv|txt)$/i.test(f.name)) return "CSV";
  if (IMAGE_RE.test(f.name) || f.type.startsWith("image/")) return "Photo";
  return "Other";
}

function DropArea({ onFiles }: { onFiles: (f: FileList | File[]) => void }) {
  const [over, setOver] = useState(false);
  const dirProps = { webkitdirectory: "", directory: "" } as Record<string, string>;
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cx("border border-dashed py-16 px-8 text-center transition-colors", over ? "border-ink bg-paper" : "border-hairline-strong")}
    >
      <div className="display italic text-[28px] text-ink-soft">Drop spreadsheets, PDFs and photos here</div>
      <p className="text-[12px] text-taupe mt-2">Mix them freely — a sheet plus its photos, a stack of PDFs, or just a folder of pictures.</p>
      <div className="mt-6 flex justify-center gap-3">
        <label className={cx(buttonClass("secondary", "sm"), "cursor-pointer")}>
          Choose files
          <input type="file" multiple accept=".xlsx,.xls,.csv,.pdf,image/*" className="sr-only" data-testid="import-files-input" onChange={(e) => { onFiles(e.target.files ?? []); e.target.value = ""; }} />
        </label>
        <label className={cx(buttonClass("ghost", "sm"), "cursor-pointer")}>
          Choose a folder
          <input type="file" multiple className="sr-only" data-testid="import-folder-input" {...dirProps} onChange={(e) => { onFiles(e.target.files ?? []); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}
