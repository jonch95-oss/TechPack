import "server-only";
import { loadPack } from "@/lib/data";
import { audit } from "@/lib/audit";
import { buildPackDoc } from "@/lib/pdf/doc";
import { gatePasses, type RuleResult } from "@/lib/validation";
import { SIGNED_OFF } from "@/lib/status";
import { attachRevisionPdf, issueRevision, revLabel, withdrawRevision } from "@/lib/revisions";
import { storeFile } from "@/lib/storage";
import { makePackPdf, pdfName } from "@/lib/pdf/make";

export type ExportResult =
  | { ok: true; pdf: Buffer; name: string; pages: number; revision: string; url: string | null }
  | { ok: false; status: number; error: string; failing: Pick<RuleResult, "rule" | "status" | "fix">[] };

/**
 * Builds the tech pack PDF — used by the download route and by the background PDF job (V2 §3 step 5).
 * Final exports are blocked until the gate passes and the pack is signed off; the first final export
 * is the original, later ones with changes issue R1, R2 … and each revision's PDF is kept.
 * `store` keeps a copy in private Blob storage and returns its (authenticated) URL.
 */
export async function exportPackPdf(packId: string, user: { id: string; canEdit: boolean }, opts: { draft: boolean; store?: boolean }): Promise<ExportResult> {
  const p = await loadPack(packId);
  if (!p) return { ok: false, status: 404, error: "Not found", failing: [] };
  const { draft } = opts;
  const doc = await buildPackDoc(p);
  if (!draft && !gatePasses(doc.validation))
    return { ok: false, status: 409, error: "Export is blocked until every rule passes.", failing: doc.validation.filter((r) => r.status === "fail") };
  if (!draft && !SIGNED_OFF.includes(p.pack.status)) return { ok: false, status: 409, error: "A second designer has to sign the pack off before the final PDF.", failing: [] };
  let finalDoc = doc;
  let revision: Awaited<ReturnType<typeof issueRevision>> | null = null;
  if (!draft) {
    if (!user.canEdit) return { ok: false, status: 403, error: "Viewers can download drafts and issued revisions only.", failing: [] };
    revision = await issueRevision(p, user.id);
    finalDoc = await buildPackDoc(p);
  }
  const { pdf, gaps } = await makePackPdf(p, finalDoc, { draft });
  if (!draft && gaps.length) {
    if (revision?.created) await withdrawRevision(revision.revision.id);
    return {
      ok: false,
      status: 409,
      error: "Some lines have no Chinese. Add them to the glossary (Admin → Glossary) and export again.",
      failing: gaps.slice(0, 30).map((g) => ({ rule: `No Chinese for “${g}”`, status: "fail" as const, fix: "Add to the glossary." })),
    };
  }
  const rev = revision ? revLabel(revision.revision.number) : "";
  const name = pdfName(p, draft ? "_DRAFT" : rev && rev !== "ORIGINAL" ? `_${rev}` : "");
  let url: string | null = null;
  if (revision && (revision.created || !revision.revision.pdfUrl)) {
    url = await storeFile(`revisions/${packId}`, name, pdf, "application/pdf");
    await attachRevisionPdf(revision.revision.id, url, finalDoc.plan.total);
  } else if (revision?.revision.pdfUrl) url = revision.revision.pdfUrl;
  if (opts.store && !url) url = await storeFile(`exports/${packId}`, name, pdf, "application/pdf");
  await audit({ userId: user.id, entity: "pack", entityId: packId, action: "update", field: draft ? "export:draft-pdf" : "export:pdf", after: { pages: finalDoc.plan.total, revision: rev || undefined } });
  return { ok: true, pdf, name, pages: finalDoc.plan.total, revision: rev, url };
}
