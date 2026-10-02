import Link from "next/link";
import { requirePageRole } from "@/lib/auth/dal";
import { importContext } from "@/app/actions/imports";
import { PageHeader } from "@/components/ui";
import { ImportStudio } from "@/components/library/import-studio";

export default async function MaterialsImportPage() {
  await requirePageRole("designer");
  return (
    <>
      <Link href="/library/materials" className="eyebrow hover:text-ink inline-block mb-8">← Materials</Link>
      <PageHeader eyebrow="Library" title="Add swatch cards in bulk">
        A spreadsheet, PDFs or a stack of card photos. The AI reads printed specs — Chinese included — and everything is reviewed before it is saved.
      </PageHeader>
      <ImportStudio kind="material" context={await importContext()} />
    </>
  );
}
