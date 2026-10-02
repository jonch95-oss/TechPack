import { asc } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { NewPackForm } from "./new-pack-form";

export default async function NewPackPage() {
  await requirePageRole("designer");
  const all = await db.select().from(brands).orderBy(asc(brands.name));
  return (
    <>
      <PageHeader eyebrow="New tech pack" title="Begin a pack">
        Designers assign style numbers. Brand, category and colorways can be adjusted later.
      </PageHeader>
      <NewPackForm brands={all.map((b) => ({ id: b.id, name: b.name, prefix: b.codePrefix, logo: b.logoUrl }))} />
    </>
  );
}
