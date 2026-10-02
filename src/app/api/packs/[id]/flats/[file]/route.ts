import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { loadPack } from "@/lib/data";
import { flatFile, type FlatFormat } from "@/lib/exports";
import { getFlat } from "@/lib/lineart/service";
import type { FlatView } from "@/db/schema";

export const maxDuration = 60;

/** GET /api/packs/:id/flats/front.svg | front.ai | front.eps — one view of the line art. */
export async function GET(_req: Request, ctx: RouteContext<"/api/packs/[id]/flats/[file]">) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id, file } = await ctx.params;
  const m = /^(front|back|side|top)\.(svg|ai|eps)$/i.exec(file);
  if (!m) return NextResponse.json({ error: "Unknown file" }, { status: 404 });
  const p = await loadPack(id);
  const f = p ? await getFlat(id, m[1].toUpperCase() as FlatView) : null;
  if (!p || !f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const name = `${p.pack.styleNo}_${f.view}.${m[2].toLowerCase()}`;
  const out = await flatFile(f, m[2].toLowerCase() as FlatFormat, `${p.pack.styleNo} ${f.view} VIEW`);
  return new Response(new Uint8Array(out.data), { headers: { "content-type": out.type, "content-disposition": `attachment; filename="${name}"` } });
}
