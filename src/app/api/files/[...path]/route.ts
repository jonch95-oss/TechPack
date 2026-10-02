import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/dal";
import { LOCAL_UPLOAD_ROOT, contentTypeFor, getBlob, usingBlob } from "@/lib/storage";

/**
 * Serves stored files to signed-in users only: from the private Blob store on Vercel, from
 * .data/uploads locally. Blob URLs are never exposed.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...path]">) {
  if (!(await getCurrentUser())) return new Response("Not signed in", { status: 401 });
  const { path: parts } = await ctx.params;
  if (parts.some((p) => p === ".." || p === "")) return new Response("Bad path", { status: 400 });
  const headers = (type: string) => ({ "content-type": type, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" });

  if (usingBlob()) {
    const b = await getBlob(parts.join("/")).catch(() => null);
    if (!b) return new Response("Not found", { status: 404 });
    return new Response(b.stream, { headers: headers(b.contentType) });
  }
  const full = path.resolve(LOCAL_UPLOAD_ROOT, ...parts);
  if (!full.startsWith(LOCAL_UPLOAD_ROOT + path.sep)) return new Response("Bad path", { status: 400 });
  try {
    const data = await readFile(full);
    return new Response(new Uint8Array(data), { headers: headers(contentTypeFor(full)) });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
