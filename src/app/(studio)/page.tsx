import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { brands, packAnswers, packFiles, packs, users } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { ButtonLink, Empty, PageHeader, Thumb, Badge } from "@/components/ui";
import { STATUS_LABEL, statusTone } from "@/lib/status";

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
      colorwayStyles: packs.colorwayStyles,
      updatedAt: packs.updatedAt,
      brand: brands.name,
      logo: brands.logoUrl,
      by: users.name,
      status: packs.status,
      archivedAt: packs.archivedAt,
      due: sql<string | null>`(select ${packAnswers.value} #>> '{}' from ${packAnswers} where ${packAnswers.packId} = ${packs.id} and ${packAnswers.questionId} = 'header.due_date' limit 1)`,
      render: sql<string | null>`(select ${packFiles.url} from ${packFiles} where ${packFiles.packId} = ${packs.id} and ${packFiles.kind} = 'render' limit 1)`,
      pending: sql<number>`(select count(*)::int from ${packAnswers} where ${packAnswers.packId} = ${packs.id} and ${packAnswers.status} <> 'confirmed')`,
    })
    .from(packs)
    .innerJoin(brands, eq(brands.id, packs.brandId))
    .leftJoin(users, eq(users.id, packs.updatedBy))
    .orderBy(desc(packs.updatedAt));
  const statusFilter = typeof sp.status === "string" ? sp.status : "";
  // Archived packs only show under the admin's "Archived" filter.
  const showArchived = sp.archived === "1" && can(user, "admin");
  const archivedCount = rows.filter((r) => r.archivedAt).length;
  const sort = sp.sort === "due" ? "due" : "recent";
  // Every style # is searchable, including each colourway's own in a multi-style pack (V2.1 §4).
  const q = typeof sp.q === "string" ? sp.q.trim().toUpperCase() : "";
  const matches = (r: (typeof rows)[number]) => !q || [r.styleNo, r.styleName, r.brand, ...Object.values(r.colorwayStyles ?? {})].some((t) => t.toUpperCase().includes(q));
  const shown = rows
    .filter((r) => (showArchived ? !!r.archivedAt : !r.archivedAt))
    .filter((r) => !statusFilter || r.status === statusFilter)
    .filter(matches)
    .sort((x, y) => {
      if (sort !== "due") return 0;
      const key = (d: string | null) => (d === "ASAP" ? "0" : d || "9");
      return key(x.due).localeCompare(key(y.due));
    });
  const counts = rows.filter((r) => !r.archivedAt).reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});

  return (
    <>
      {sp.denied && <p className="mb-6 text-signal text-[12px]">You don&apos;t have access to that page.</p>}
      {typeof sp.deleted === "string" && <p className="mb-6 text-[12px] text-ok" role="status">{sp.deleted} was deleted.</p>}
      <PageHeader
        eyebrow="The Atelier"
        title="Tech Packs"
        actions={can(user, "designer") && <ButtonLink href="/packs/new">New tech pack</ButtonLink>}
      >
        Upload a render, answer the click-through questions, and every answer is kept for the factory-ready pack.
      </PageHeader>
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-6 mb-10 border-b border-hairline">
          <div className="flex flex-wrap gap-6">
            {[["", "All"], ...Object.entries(STATUS_LABEL)].map(([k, label]) => (
              <Link
                key={k}
                href={`/?${new URLSearchParams({ ...(k ? { status: k } : {}), ...(sort === "due" ? { sort: "due" } : {}) })}`}
                className={`pb-3 -mb-px text-[10.5px] tracking-[0.22em] uppercase ${statusFilter === k ? "border-b border-ink text-ink" : "text-taupe hover:text-ink"}`}
              >
                {label}
                {k && counts[k] ? <span className="ml-1 text-mist">{counts[k]}</span> : null}
              </Link>
            ))}
          </div>
          <span className="flex gap-6 items-start">
            <form action="/" className="pb-2">
              {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
              <input name="q" defaultValue={q} placeholder="SEARCH STYLE #" aria-label="Search style #" data-testid="pack-search" className="h-7 w-44 border-b border-hairline-strong bg-transparent text-[11px] tracking-[0.14em] uppercase focus:outline-none" />
            </form>
            {can(user, "admin") && archivedCount > 0 && (
              <Link href={showArchived ? "/" : "/?archived=1"} className={`pb-3 eyebrow hover:text-ink ${showArchived ? "text-ink" : ""}`} data-testid="archived-filter">
                {showArchived ? "← Active packs" : `Archived · ${archivedCount}`}
              </Link>
            )}
            <Link href={`/?${new URLSearchParams({ ...(statusFilter ? { status: statusFilter } : {}), ...(sort === "due" ? {} : { sort: "due" }) })}`} className="pb-3 eyebrow hover:text-ink">
              {sort === "due" ? "Sorted by due date" : "Sort by due date"}
            </Link>
          </span>
        </div>
      )}
      {rows.length === 0 ? (
        <Empty
          title="No tech packs yet"
          action={can(user, "designer") && <ButtonLink href="/packs/new">Begin the first pack</ButtonLink>}
        >
          Start with a brand, category and style number. The render and AI pre-fill come next.
        </Empty>
      ) : (
        <ul className="grid gap-x-8 gap-y-12 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          {shown.map((r, i) => (
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
                    {Object.values(r.colorwayStyles ?? {}).filter((x) => x !== r.styleNo).length > 0 && (
                      <div className="text-[11px] text-ink-soft mt-1 tracking-wide" data-testid="pack-styles">
                        + {Object.values(r.colorwayStyles).filter((x) => x !== r.styleNo).join(" · ")}
                      </div>
                    )}
                    <div className="text-[11px] text-taupe mt-1 tracking-wide">
                      {r.category} · {r.colorways.join(" ")}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                    {r.pending > 0 && <Badge tone="ai">{r.pending} to confirm</Badge>}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-hairline text-[10px] tracking-[0.18em] uppercase text-mist">
                  {r.due ? <span className={r.due === "ASAP" ? "text-signal" : "text-ink-soft"}>DUE {r.due} · </span> : null}
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
