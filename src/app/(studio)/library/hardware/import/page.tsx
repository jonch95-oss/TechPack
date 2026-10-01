import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  await requirePageRole("designer");
  const all = await db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name));
  return (
    <>
      <Link href="/library/hardware" className="eyebrow hover:text-ink inline-block mb-8">← Hardware</Link>
      <PageHeader eyebrow="Library" title="Bulk import hardware">
        A CSV or XLSX plus a folder of images. Existing codes are updated; rows without a code get the next free code for their brand.
      </PageHeader>
      <ImportForm brands={all} />
    </>
  );
}
