import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { materials } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { materialLabel, usedIn } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { MaterialForm } from "@/components/library/material-form";
import { MaterialCreated } from "./created";

export default async function MaterialPage(props: PageProps<"/library/materials/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const m = isNew ? null : (await db.select().from(materials).where(eq(materials.id, id)))[0];
  if (!isNew && !m) notFound();
  const used = m ? (await usedIn([m.id])).get(m.id) ?? [] : undefined;
  return (
    <>
      <Link href="/library/materials" className="eyebrow hover:text-ink inline-block mb-8">← Materials</Link>
      <PageHeader eyebrow="Swatch card" title={m ? materialLabel(m) : "New swatch card"} />
      {isNew ? <MaterialCreated /> : <MaterialForm material={m!} canEdit={can(user, "designer")} usedIn={used} />}
    </>
  );
}
