import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { flats } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { loadPack } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { FlatStudio } from "@/components/lineart/flat-studio";

export default async function FlatsPage(props: PageProps<"/packs/[id]/flats">) {
  const user = await requireUser();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await loadPack(id);
  if (!p) notFound();
  const rows = await db.select().from(flats).where(eq(flats.packId, id)).orderBy(asc(flats.createdAt));
  const a = p.answers;
  const unit = a["dims.unit"] === "INCHES" ? '"' : " CM";
  const dims = ["h", "w", "d"].map((k) => a[`dims.${k}`]).every((v) => typeof v === "number") ? `${a["dims.h"]}${unit} H × ${a["dims.w"]}${unit} W × ${a["dims.d"]}${unit} D` : "";
  const sp = await props.searchParams;
  return (
    <>
      <Link href={`/packs/${id}`} className="eyebrow hover:text-ink inline-block mb-8">← {p.pack.styleNo} {p.pack.styleName}</Link>
      <PageHeader eyebrow={`${p.pack.styleNo} · ${p.pack.styleName}`} title="Line art">
        Technical flats from the render, traced to vectors and scaled to {dims || "the entered dimensions"}. Edit them here; dimension lines and callouts are placed for you and read true.
      </PageHeader>
      <FlatStudio
        packId={id}
        canEdit={can(user, "designer")}
        hasRender={p.files.some((f) => f.kind === "render")}
        dims={dims}
        initialView={typeof sp.view === "string" ? sp.view.toUpperCase() : undefined}
        flats={rows.map((f) => ({ id: f.id, view: f.view, status: f.status, source: f.source, svg: f.svg, updatedAt: f.updatedAt.toISOString() }))}
      />
    </>
  );
}
