"use client";

/** True for a PDF upload (by type or extension). */
export const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/**
 * A PDF's first page as a PNG file, rendered in the browser (pdf.js, legacy build: the modern one needs Map.getOrInsertComputed, missing from current Chrome), so a supplier's PDF drawing or
 * spec page can go anywhere an image goes (hardware photo, 100% views, crop). Long side ≈ 2400 px.
 * Any other file comes back unchanged.
 */
export async function pdfToImage(file: File): Promise<File> {
  if (!isPdf(file)) return file;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerPort)
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, 2400 / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // PDFs without a page fill would otherwise render on transparent
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("Could not read that PDF."))), "image/png"));
    return new File([blob], file.name.replace(/\.pdf$/i, "") + ".png", { type: "image/png" });
  } finally {
    await doc.destroy();
  }
}
