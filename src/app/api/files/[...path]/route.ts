import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/dal";
import { LOCAL_UPLOAD_ROOT, contentTypeFor } from "@/lib/storage";

/** Serves locally stored uploads (development / tests only; production uses Vercel Blob URLs). */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...path]">) {
  if (!(await getCurrentUser())) return new Response("Not signed in", { status: 401 });
  const { path: parts } = await ctx.params;
  const full = path.resolve(LOCAL_UPLOAD_ROOT, ...parts);
  if (!full.startsWith(LOCAL_UPLOAD_ROOT + path.sep)) return new Response("Bad path", { status: 400 });
  try {
    const data = await readFile(full);
    return new Response(new Uint8Array(data), {
      headers: { "content-type": contentTypeFor(full), "cache-control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
