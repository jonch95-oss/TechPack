import { requirePageRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { listArchiveImports } from "@/app/actions/archive";
import { ARCHIVE_PAGE_CAP, COST_PER_PAGE_USD } from "@/lib/archive-read";
import { ArchiveImport } from "./archive-import";

export default async function ArchivePage() {
  await requirePageRole("admin");
  return (
    <>
      <PageHeader eyebrow="Admin" title="Import past tech packs">
        Drop finished tech pack PDFs. Each is read into a <strong>proposed</strong> base style (searchable in &ldquo;Start from…&rdquo; once approved) and proposed library parts and swatches. Pages and the estimated AI cost show before anything runs; files already imported are skipped; files over {ARCHIVE_PAGE_CAP} pages are refused. Estimate: about ${COST_PER_PAGE_USD.toFixed(2)} a page.
      </PageHeader>
      <ArchiveImport initial={await listArchiveImports()} />
    </>
  );
}
