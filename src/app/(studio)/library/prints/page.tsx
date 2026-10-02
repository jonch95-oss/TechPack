import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { prints } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { usedIn } from "@/lib/data";
import { Badge, ButtonLink, Empty, PageHeader } from "@/components/ui";

export default async function PrintsPage() {
  const user = await requireUser();
  const rows = await db.select().from(prints).orderBy(asc(prints.name));
  const used = await usedIn(rows.map((r) => r.id));
  return (
    <>
      <PageHeader eyebrow="Library" title="Print & lining artwork" actions={can(user, "designer") && <ButtonLink href="/library/prints/new">New artwork</ButtonLink>}>
        Motif, repeat, tile size, Pantone C / TCX colours, application method and base fabric.
      </PageHeader>
      {rows.length === 0 ? (
        <Empty title="No artwork yet" action={can(user, "designer") && <ButtonLink href="/library/prints/new">Add artwork</ButtonLink>} />
      ) : (
        <ul className="grid gap-x-8 gap-y-10 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {rows.map((p) => (
            <li key={p.id} className="fade-up">
              <Link href={`/library/prints/${p.id}`} className="group block">
                <div className="aspect-square bg-white border border-hairline overflow-hidden flex items-center justify-center">
                  {p.motifUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.motifUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" />
                  ) : (
                    <span className="display italic text-mist text-lg">{p.repeatType || "Repeat"}</span>
                  )}
                </div>
                <div className="pt-3">
                  <div className="eyebrow">{p.application}</div>
                  <div className="display text-[20px] leading-tight mt-1 group-hover:text-gold transition-colors">{p.name}</div>
                  <div className="text-[11px] text-taupe">
                    {p.tileW && `${p.tileW} × ${p.tileH} ${p.tileUnit.toUpperCase()} · `}
                    {p.colours.map((c) => c.code).join(", ")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">{(used.get(p.id) ?? []).map((s) => <Badge key={s}>{s}</Badge>)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
