"use client";

import { useState } from "react";
import { importHardware, type ImportReport } from "@/app/actions/library";
import { uploadFile } from "@/lib/client/upload";
import { Badge, Button, Label, cx } from "@/components/ui";

const COLUMNS = ["code", "brand", "type", "name", "dims mm", "material", "finish", "logo treatment", "enamel pantone", "hollow/solid", "photo", "front", "side", "rear", "notes"];

export function ImportForm({ brands }: { brands: { id: string; name: string }[] }) {
  const [sheet, setSheet] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [brandId, setBrandId] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const run = async () => {
    if (!sheet) return;
    setReport(null);
    const map: Record<string, string> = {};
    try {
      for (let i = 0; i < images.length; i++) {
        setProgress(`Uploading images ${i + 1} / ${images.length}`);
        const f = images[i];
        map[f.webkitRelativePath || f.name] = await uploadFile(f, "hardware");
      }
      setProgress("Importing…");
      const fd = new FormData();
      fd.append("sheet", sheet);
      fd.append("brandId", brandId);
      fd.append("imageMap", JSON.stringify(map));
      setReport(await importHardware(fd));
    } catch (e) {
      setReport({ ok: false, created: [], updated: [], assigned: [], images: 0, errors: [(e as Error).message] });
    }
    setProgress(null);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-16">
      <div className="space-y-10">
        <div>
          <Label required>Spreadsheet (CSV or XLSX)</Label>
          <DropZone label={sheet ? sheet.name : "Choose a .csv or .xlsx file"} accept=".csv,.xlsx" onFiles={(f) => setSheet(f[0] ?? null)} testId="import-sheet" />
        </div>
        <div>
          <Label>Images folder</Label>
          <DropZone
            label={images.length ? `${images.length} image${images.length > 1 ? "s" : ""} selected` : "Choose the images folder"}
            accept="image/*"
            multiple
            directory
            onFiles={(f) => setImages(f.filter((x) => x.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|svg)$/i.test(x.name)))}
            testId="import-images"
          />
          <p className="text-[11px] text-taupe mt-2">Images are matched by the photo / front / side / rear column, or by a file named after the code (PINK005.jpg).</p>
        </div>
        <div>
          <Label>Default brand (for rows with no brand or code)</Label>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="w-full max-w-sm h-10 bg-transparent border-0 border-b border-hairline-strong focus:outline-none focus:border-ink">
            <option value="">—</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <Button onClick={run} disabled={!sheet || !!progress} data-testid="run-import">
          {progress ?? "Import"}
        </Button>

        {report && (
          <div className="border border-hairline bg-paper p-8 fade-up" data-testid="import-report">
            <div className="display text-2xl mb-4">{report.ok ? "Import complete" : "Import failed"}</div>
            <div className="flex flex-wrap gap-3 mb-4">
              <Badge tone="ok">{report.created.length} created</Badge>
              <Badge>{report.updated.length} updated</Badge>
              <Badge tone="gold">{report.assigned.length} codes assigned</Badge>
              <Badge>{report.images} images linked</Badge>
            </div>
            {report.assigned.length > 0 && <p className="text-[12px] mb-3">New codes: {report.assigned.join(", ")}</p>}
            {report.errors.length > 0 && (
              <ul className="text-[12px] text-signal space-y-1">
                {report.errors.map((e) => (
                  <li key={e}>— {e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <aside className="border border-hairline bg-paper p-8 self-start">
        <div className="eyebrow mb-4">Recognised columns</div>
        <ul className="grid grid-cols-2 gap-y-2 text-[12px]">
          {COLUMNS.map((c) => (
            <li key={c} className="tracking-[0.04em]">{c}</li>
          ))}
        </ul>
        <p className="text-[11px] text-taupe mt-6 leading-relaxed">Headers are matched loosely (e.g. “Dimensions”, “Plating”, “Image”). Types are normalised to the library list.</p>
      </aside>
    </div>
  );
}

function DropZone({ label, accept, multiple, directory, onFiles, testId }: { label: string; accept: string; multiple?: boolean; directory?: boolean; onFiles: (f: File[]) => void; testId?: string }) {
  const [over, setOver] = useState(false);
  const dirProps = directory ? ({ webkitdirectory: "", directory: "" } as Record<string, string>) : {};
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cx("flex items-center justify-center h-28 border border-dashed cursor-pointer transition-colors display italic text-lg", over ? "border-ink bg-paper" : "border-hairline-strong text-ink-soft hover:border-ink")}
    >
      {label}
      <input type="file" accept={accept} multiple={multiple} className="sr-only" data-testid={testId} {...dirProps} onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
    </label>
  );
}
