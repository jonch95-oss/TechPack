import { asc } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/dal";
import { nextCodeForBrand } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { BrandsAdmin } from "./brands-admin";

export default async function BrandsPage() {
  await requirePageRole("admin");
  const rows = await db.select().from(brands).orderBy(asc(brands.name));
  const next = await Promise.all(rows.map((b) => nextCodeForBrand(b.id)));
  return (
    <>
      <PageHeader eyebrow="Administration" title="Brands">
        One ICON template; the brand logo in the masthead is the only visual differentiator. Each brand has a style / code prefix and a code format.
      </PageHeader>
      <BrandsAdmin brands={rows.map((b, i) => ({ id: b.id, name: b.name, codePrefix: b.codePrefix, codeFormat: b.codeFormat, logoUrl: b.logoUrl, licensorRequired: b.licensorRequired, next: next[i] }))} />
    </>
  );
}
