import { asc } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { BatchCreate } from "./batch-create";

export default async function BatchPage() {
  await requirePageRole("designer");
  const all = await db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name));
  return (
    <>
      <PageHeader eyebrow="New tech packs" title="Batch create">
        A spreadsheet of styles (style #, name, brand, category, base style, colourways, render file name) with its renders — or just a folder of renders — becomes draft packs. Rows with a problem are listed and skipped; nothing is overwritten.
      </PageHeader>
      <BatchCreate brands={all} />
    </>
  );
}
