import "server-only";
import { get, put } from "@vercel/blob";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * File storage. On Vercel, files go to the PRIVATE Blob store (`BLOB_STORE_ID`, authenticated with
 * Vercel OIDC — or `BLOB_READ_WRITE_TOKEN` if one is ever set). Locally (development and tests)
 * they go under .data/uploads. Either way a file's URL is `/api/files/<pathname>`, served only to
 * signed-in users — blob URLs are never handed out.
 */
export function usingBlob() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

export const FILES_PREFIX = "/api/files/";

/** Reads a blob from the private store; null when it doesn't exist. */
export async function getBlob(pathname: string) {
  const res = await get(pathname, { access: "private" });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return { stream: res.stream, contentType: res.blob.contentType ?? contentTypeFor(pathname) };
}

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "file";
}

export async function storeFile(folder: string, name: string, data: Buffer | ArrayBuffer, contentType: string) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const key = `${folder}/${crypto.randomUUID().slice(0, 8)}-${safeName(name)}`;
  if (usingBlob()) {
    const blob = await put(key, buf, { access: "private", contentType, addRandomSuffix: false });
    return FILES_PREFIX + blob.pathname;
  }
  if (process.env.VERCEL) throw new Error("Blob storage is not configured (BLOB_STORE_ID)");
  const full = path.join(LOCAL_ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  return `/api/files/${key}`;
}

/** Reads a stored file back (used to send images to the vision model). */
export async function readStoredFile(url: string): Promise<{ data: Buffer; contentType: string }> {
  if (url.startsWith(FILES_PREFIX) && usingBlob()) {
    const rel = decodeURI(url.slice(FILES_PREFIX.length));
    const b = await getBlob(rel);
    if (!b) throw new Error(`File not found: ${rel}`);
    return { data: Buffer.from(await new Response(b.stream).arrayBuffer()), contentType: b.contentType };
  }
  if (url.startsWith(FILES_PREFIX)) {
    const rel = url.slice(FILES_PREFIX.length);
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
