"use client";

import { upload } from "@vercel/blob/client";

const SERVER_LIMIT = 4 * 1024 * 1024; // Vercel function bodies are capped at 4.5 MB

/**
 * Uploads a file and returns its URL. Small files go through /api/upload; large ones go
 * straight to Vercel Blob with a client token (falls back to /api/upload when Blob isn't configured).
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  if (file.size > SERVER_LIMIT) {
    try {
      const blob = await upload(`${folder}/${file.name}`, file, { access: "public", handleUploadUrl: "/api/blob" });
      return blob.url;
    } catch {
      // Not on Blob (local dev) — fall through to the server route.
    }
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? `Upload failed (${res.status})`);
  return json.url;
}
