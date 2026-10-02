import { asc } from "drizzle-orm";
import { db } from "@/db";
import { glossary } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { GlossaryAdmin } from "./glossary-admin";

export default async function GlossaryPage() {
  await requirePageRole("admin");
  const rows = await db.select().from(glossary).orderBy(asc(glossary.en));
  return (
    <>
      <PageHeader eyebrow="Administration" title="Trade glossary">
        With 中文 on, every line of a pack prints with its Chinese underneath. These terms always win over machine translation — add the factory&apos;s own words here.
      </PageHeader>
      <GlossaryAdmin terms={rows.map((r) => ({ id: r.id, en: r.en, zh: r.zh }))} />
    </>
  );
}
