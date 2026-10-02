import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { loadPack } from "@/lib/data";
import { audit } from "@/lib/audit";
import { buildPackDoc } from "@/lib/pdf/doc";
import { renderPackHtml } from "@/lib/pdf/html";
import { htmlToPdf } from "@/lib/pdf/render";
import { gatePasses } from "@/lib/validation";
import { SIGNED_OFF } from "@/lib/status";

export const maxDuration = 60;

/**
 * GET /api/packs/:id/pdf           — the tech pack PDF; blocked (409 + failing rules) until the gate passes
 * GET /api/packs/:id/pdf?draft=1   — always available, watermarked "DRAFT — NOT FOR FACTORY"
 * GET /api/packs/:id/pdf?format=html — the print HTML (for checking layouts)
 */
export async function GET(req: Request, ctx: RouteContext<"/api/packs/[id]/pdf">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const p = await loadPack(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const draft = url.searchParams.get("draft") === "1";
  const doc = await buildPackDoc(p);
  if (!draft && !gatePasses(doc.validation)) {
    return NextResponse.json(
      { error: "Export is blocked until every rule passes.", failing: doc.validation.filter((r) => r.status === "fail") },
      { status: 409 },
    );
  }
  if (!draft && !SIGNED_OFF.includes(p.pack.status)) {
    return NextResponse.json({ error: "A second designer has to sign the pack off before the final PDF.", failing: [] }, { status: 409 });
  }
  const html = renderPackHtml(doc, { draft });
  if (url.searchParams.get("format") === "html") return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  const pdf = await htmlToPdf(html);
  await audit({ userId: user.id, entity: "pack", entityId: id, action: "update", field: draft ? "export:draft-pdf" : "export:pdf", after: { pages: doc.plan.total } });
  const name = `${p.pack.styleNo}${p.pack.colorways.length ? p.pack.colorways.join("_").replace(/-/g, "") : ""}_${p.pack.styleName.replace(/\W+/g, "_")}${draft ? "_DRAFT" : ""}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${name}"` },
  });
}
