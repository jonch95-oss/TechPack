import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/dal";
import { loadPack } from "@/lib/data";
import { buildPackDoc } from "@/lib/pdf/doc";
import { renderPackHtml } from "@/lib/pdf/html";
import { exportPackPdf } from "@/lib/pdf/export";

export const maxDuration = 60;

/**
 * GET /api/packs/:id/pdf           — the tech pack PDF; blocked (409 + failing rules) until the gate passes
 * GET /api/packs/:id/pdf?draft=1   — always available, watermarked "DRAFT — NOT FOR FACTORY"
 * GET /api/packs/:id/pdf?format=html — the print HTML (for checking layouts)
 * The studio builds PDFs as background jobs (kind "pdf"); this route is the direct download.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/packs/[id]/pdf">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const draft = url.searchParams.get("draft") === "1";
  if (url.searchParams.get("format") === "html") {
    const p = await loadPack(id);
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const doc = await buildPackDoc(p);
    return new Response(renderPackHtml(doc, { draft }), { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const res = await exportPackPdf(id, { id: user.id, canEdit: can(user, "designer") }, { draft });
  if (!res.ok) return NextResponse.json({ error: res.error, failing: res.failing }, { status: res.status });
  return new Response(new Uint8Array(res.pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${res.name}"` } });
}
