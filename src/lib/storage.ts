import "server-only";
import { put } from "@vercel/blob";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * File storage. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set; otherwise
 * (local development and tests only) writes under .data/uploads and serves it
 * through /api/files.
 */
export function usingBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "file";
}

export async function storeFile(folder: string, name: string, data: Buffer | ArrayBuffer, contentType: string) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const key = `${folder}/${crypto.randomUUID().slice(0, 8)}-${safeName(name)}`;
  if (usingBlob()) {
    const blob = await put(key, buf, { access: "public", contentType, addRandomSuffix: false });
    return blob.url;
  }
  if (process.env.VERCEL) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  const full = path.join(LOCAL_ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  return `/api/files/${key}`;
}

/** Reads a stored file back (used to send images to the vision model). */
export async function readStoredFile(url: string): Promise<{ data: Buffer; contentType: string }> {
  if (url.startsWith("/api/files/")) {
    const rel = url.slice("/api/files/".length);
    const full = path.resolve(LOCAL_ROOT, rel);
    if (!full.startsWith(LOCAL_ROOT)) throw new Error("Bad path");
    return { data: await readFile(full), contentType: contentTypeFor(full) };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
  return { data: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
}

export function contentTypeFor(file: string) {
  const ext = path.extname(file).toLowerCase();
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".ai": "application/pdf",
      ".eps": "application/postscript",
      ".psd": "image/vnd.adobe.photoshop",
      ".csv": "text/csv",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }[ext] ?? "application/octet-stream"
  );
}

export const LOCAL_UPLOAD_ROOT = LOCAL_ROOT;
