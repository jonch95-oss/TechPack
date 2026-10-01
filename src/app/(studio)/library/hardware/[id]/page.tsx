import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { brands, hardware } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { usedIn } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { HardwareForm } from "@/components/library/hardware-form";
import { HardwareCreated } from "./created";

export default async function HardwareItemPage(props: PageProps<"/library/hardware/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const item = isNew ? null : (await db.select().from(hardware).where(eq(hardware.id, id)))[0];
  if (!isNew && !item) notFound();
  const all = (await db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)));
  const used = item ? (await usedIn([item.id])).get(item.id) ?? [] : undefined;
  return (
    <>
      <Link href="/library/hardware" className="eyebrow hover:text-ink inline-block mb-8">← Hardware</Link>
      <PageHeader eyebrow={item ? item.type : "New component"} title={item ? item.code : "New component"}>
        {isNew && "Type, dimensions, views, material, logo treatment, enamel and hollow/solid. The code is assigned automatically."}
      </PageHeader>
      {isNew ? <HardwareCreated brands={all} /> : <HardwareForm item={item!} brands={all} canEdit={can(user, "designer")} usedIn={used} />}
    </>
  );
}
