import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/dal";
import { loadPack } from "@/lib/data";
import { audit } from "@/lib/audit";
import { buildPackDoc } from "@/lib/pdf/doc";
import { renderPackHtml } from "@/lib/pdf/html";
import { gatePasses } from "@/lib/validation";
import { SIGNED_OFF } from "@/lib/status";
import { attachRevisionPdf, issueRevision, revLabel, withdrawRevision } from "@/lib/revisions";
import { storeFile } from "@/lib/storage";
import { makePackPdf, pdfName } from "@/lib/pdf/make";

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
  if (url.searchParams.get("format") === "html") return new Response(renderPackHtml(doc, { draft }), { headers: { "content-type": "text/html; charset=utf-8" } });
  // Final export: the first one is the original; later ones with changes issue R1, R2 … and the
  // PDF of each is kept so earlier revisions stay downloadable.
  let finalDoc = doc;
  let revision: Awaited<ReturnType<typeof issueRevision>> | null = null;
  if (!draft) {
    if (!can(user, "designer")) return NextResponse.json({ error: "Viewers can download drafts and issued revisions only." }, { status: 403 });
    revision = await issueRevision(p, user.id);
    finalDoc = await buildPackDoc(p);
  }
  const { pdf, gaps } = await makePackPdf(p, finalDoc, { draft });
  if (!draft && gaps.length) {
    if (revision?.created) await withdrawRevision(revision.revision.id);
    return NextResponse.json(
      { error: "Some lines have no Chinese. Add them to the glossary (Admin → Glossary) and export again.", failing: gaps.slice(0, 30).map((g) => ({ rule: `No Chinese for “${g}”`, status: "fail", fix: "Add to the glossary." })) },
      { status: 409 },
    );
  }
  const rev = revision ? revLabel(revision.revision.number) : "";
  const name = pdfName(p, draft ? "_DRAFT" : rev && rev !== "ORIGINAL" ? `_${rev}` : "");
  if (revision && (revision.created || !revision.revision.pdfUrl)) {
    const stored = await storeFile(`revisions/${id}`, name, pdf, "application/pdf");
    await attachRevisionPdf(revision.revision.id, stored, finalDoc.plan.total);
  }
  await audit({ userId: user.id, entity: "pack", entityId: id, action: "update", field: draft ? "export:draft-pdf" : "export:pdf", after: { pages: finalDoc.plan.total, revision: rev || undefined } });
  return new Response(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${name}"` },
  });
}
