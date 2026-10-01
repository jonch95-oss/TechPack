import Link from "next/link";
import { requirePageRole } from "@/lib/auth/dal";
import { importContext } from "@/app/actions/imports";
import { PageHeader } from "@/components/ui";
import { ImportStudio } from "@/components/library/import-studio";

export default async function HardwareImportPage() {
  await requirePageRole("designer");
  return (
    <>
      <Link href="/library/hardware" className="eyebrow hover:text-ink inline-block mb-8">← Hardware</Link>
      <PageHeader eyebrow="Library" title="Add hardware in bulk">
        Four ways in. Everything lands in a review table first — duplicates, style-number clashes and codes outside a brand&apos;s format are called out before anything is saved.
      </PageHeader>
      <ImportStudio kind="hardware" context={await importContext()} />
    </>
  );
}
