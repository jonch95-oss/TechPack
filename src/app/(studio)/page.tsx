import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { brands, packAnswers, packFiles, packs, users } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { ButtonLink, Empty, PageHeader, Thumb, Badge } from "@/components/ui";

export default async function PacksPage(props: PageProps<"/">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const rows = await db
    .select({
      id: packs.id,
      styleNo: packs.styleNo,
      styleName: packs.styleName,
      category: packs.category,
      colorways: packs.colorways,
      updatedAt: packs.updatedAt,
      brand: brands.name,
      logo: brands.logoUrl,
      by: users.name,
      render: sql<string | null>`(select ${packFiles.url} from ${packFiles} where ${packFiles.packId} = ${packs.id} and ${packFiles.kind} = 'render' limit 1)`,
      pending: sql<number>`(select count(*)::int from ${packAnswers} where ${packAnswers.packId} = ${packs.id} and ${packAnswers.status} <> 'confirmed')`,
    })
    .from(packs)
    .innerJoin(brands, eq(brands.id, packs.brandId))
    .leftJoin(users, eq(users.id, packs.updatedBy))
    .orderBy(desc(packs.updatedAt));

  return (
    <>
      {sp.denied && <p className="mb-6 text-signal text-[12px]">You don&apos;t have access to that page.</p>}
      <PageHeader
        eyebrow="The Atelier"
        title="Tech Packs"
        actions={can(user, "designer") && <ButtonLink href="/packs/new">New tech pack</ButtonLink>}
      >
        Upload a render, answer the click-through questions, and every answer is kept for the factory-ready pack.
      </PageHeader>
      {rows.length === 0 ? (
        <Empty
          title="No tech packs yet"
          action={can(user, "designer") && <ButtonLink href="/packs/new">Begin the first pack</ButtonLink>}
        >
          Start with a brand, category and style number. The render and AI pre-fill come next.
        </Empty>
      ) : (
        <ul className="grid gap-x-8 gap-y-12 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          {rows.map((r, i) => (
            <li key={r.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <Link href={`/packs/${r.id}`} className="group block">
                <div className="aspect-[4/3] bg-white border border-hairline overflow-hidden flex items-center justify-center">
                  {r.render ? (
                    <Thumb src={r.render} alt={r.styleNo} className="w-full h-full border-0 group-hover:scale-[1.03] transition-transform duration-700" />
                  ) : (
                    <span className="display italic text-mist text-lg">Awaiting render</span>
                  )}
                </div>
                <div className="pt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="eyebrow">{r.brand}</div>
                    <div className="display text-[24px] leading-tight mt-1 group-hover:text-gold transition-colors">
                      {r.styleNo} <span className="italic text-ink-soft">{r.styleName}</span>
                    </div>
                    <div className="text-[11px] text-taupe mt-1 tracking-wide">
                      {r.category} · {r.colorways.join(" ")}
                    </div>
                  </div>
                  {r.pending > 0 && <Badge tone="ai">{r.pending} to confirm</Badge>}
                </div>
                <div className="mt-3 pt-3 border-t border-hairline text-[10px] tracking-[0.18em] uppercase text-mist">
                  {r.by ? `${r.by} · ` : ""}
                  {r.updatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
