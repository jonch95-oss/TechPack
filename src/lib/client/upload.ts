"use client";

import { uploadPresigned } from "@vercel/blob/client";

const SERVER_LIMIT = 4 * 1024 * 1024; // Vercel function bodies are capped at 4.5 MB

/**
 * Uploads a file and returns its /api/files URL. Small files go through /api/upload; large ones
 * go straight into the private Blob store with a presigned URL (falls back to /api/upload when
 * Blob isn't configured, i.e. local development).
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  if (file.size > SERVER_LIMIT) {
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "file";
      const blob = await uploadPresigned(`${folder}/${crypto.randomUUID().slice(0, 8)}-${safe}`, file, { access: "private", handleUploadUrl: "/api/blob", contentType: file.type || undefined });
      return `/api/files/${blob.pathname}`;
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
