import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { loadPack } from "@/lib/data";
import { packZip } from "@/lib/exports";

export const maxDuration = 120;

/** GET /api/packs/:id/export — PDF + line art (SVG / AI / EPS) + layered PSD as one ZIP. */
export async function GET(_req: Request, ctx: RouteContext<"/api/packs/[id]/export">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const p = await loadPack(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { zip, name } = await packZip(p);
  await audit({ userId: user.id, entity: "pack", entityId: id, action: "update", field: "export:zip", after: { bytes: zip.length } });
  return new Response(new Uint8Array(zip), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${name}"` } });
}
