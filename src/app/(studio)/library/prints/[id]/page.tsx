import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { brands, prints } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { libraryOptions, usedIn } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { PrintForm } from "@/components/library/print-form";
import { PrintCreated } from "./created";

export default async function PrintPage(props: PageProps<"/library/prints/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const item = isNew ? null : (await db.select().from(prints).where(eq(prints.id, id)))[0];
  if (!isNew && !item) notFound();
  const all = await db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name));
  const mats = (await libraryOptions()).materials.map((m) => ({ id: m.id, label: m.label }));
  const used = item ? (await usedIn([item.id])).get(item.id) ?? [] : undefined;
  return (
    <>
      <Link href="/library/prints" className="eyebrow hover:text-ink inline-block mb-8">← Artwork</Link>
      <PageHeader eyebrow="Print / lining artwork" title={item ? item.name : "New artwork"} />
      {isNew ? (
        <PrintCreated brands={all} materials={mats} />
      ) : (
        <PrintForm item={item!} brands={all} materials={mats} canEdit={can(user, "designer")} usedIn={used} />
      )}
    </>
  );
}
