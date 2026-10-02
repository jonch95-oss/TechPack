import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { packFiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { readCroppedFile } from "@/lib/crop";

/** GET /api/packs/:id/files/:fileId — a render or board as it prints: cropped to the product. */
export async function GET(_req: Request, ctx: RouteContext<"/api/packs/[id]/files/[fileId]">) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id, fileId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(fileId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [f] = await db.select().from(packFiles).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, id)));
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const out = await readCroppedFile(f);
  return new Response(new Uint8Array(out.data), { headers: { "content-type": out.contentType, "cache-control": "private, max-age=31536000, immutable" } });
}
