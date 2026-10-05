import Link from "next/link";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { brands, packAnswers, packFiles, packs, revisions, users } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/status";
import { CATEGORIES } from "@/lib/questions/types";
import { dueWindow, filterHref, PAGE_SIZE, parseFilters, PIPELINE } from "@/lib/dashboard";
import { PackGrid, type DashPack } from "@/components/pack/dashboard-grid";

/**
 * The dashboard at volume (V2 §8): server-side search and filters (brand, category, stage, status,
 * due, designer), "My queue", pagination, a pipeline view and bulk actions.
 */
export default async function PacksPage(props: PageProps<"/">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const f = parseFilters(sp);
  const showArchived = f.archived && can(user, "admin");
  const due = sql<string | null>`(select ${packAnswers.value} #>> '{}' from ${packAnswers} where ${packAnswers.packId} = ${packs.id} and ${packAnswers.questionId} = 'header.due_date' limit 1)`;
  const { today, week } = dueWindow(new Date());

  // Archive imports waiting for approval live on Admin → Archive, not here.
  const base: SQL[] = [ne(packs.importStatus, "PROPOSED"), showArchived ? isNotNull(packs.archivedAt) : isNull(packs.archivedAt)];
  const where: SQL[] = [...base];
  if (f.status) where.push(eq(packs.status, f.status as (typeof PIPELINE)[number]));
  if (f.brand) where.push(eq(packs.brandId, f.brand));
  if (f.category) where.push(eq(packs.category, f.category));
  if (f.stage) where.push(eq(packs.stage, f.stage));
  if (f.designer) where.push(or(eq(packs.assignedTo, f.designer), and(isNull(packs.assignedTo), eq(packs.createdBy, f.designer)))!);
  if (f.mine) where.push(or(eq(packs.assignedTo, user.id), and(isNull(packs.assignedTo), eq(packs.createdBy, user.id)))!);
  if (f.due === "asap") where.push(sql`${due} = 'ASAP'`);
  if (f.due === "overdue") where.push(sql`${due} <> 'ASAP' and ${due} < ${today}`);
  if (f.due === "week") where.push(sql`(${due} = 'ASAP' or (${due} >= ${today} and ${due} <= ${week}))`);
  // Every style # is searchable, including each colourway's own in a multi-style pack (V2.1 §4).
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    where.push(or(ilike(packs.styleNo, like), ilike(packs.styleName, like), ilike(brands.name, like), sql`${packs.colorwayStyles}::text ilike ${like}`)!);
  }

  const [rows, [{ total }], statusCounts, brandList, designers, archivedCount] = await Promise.all([
    db
      .select({
        id: packs.id,
        styleNo: packs.styleNo,
        styleName: packs.styleName,
        category: packs.category,
        colorways: packs.colorways,
        colorwayStyles: packs.colorwayStyles,
        updatedAt: packs.updatedAt,
        brand: brands.name,
        by: users.name,
        status: packs.status,
        stage: packs.stage,
        due,
        render: sql<string | null>`(select ${packFiles.url} from ${packFiles} where ${packFiles.packId} = ${packs.id} and ${packFiles.kind} = 'render' limit 1)`,
        pending: sql<number>`(select count(*)::int from ${packAnswers} where ${packAnswers.packId} = ${packs.id} and ${packAnswers.status} <> 'confirmed')`,
        revision: sql<number>`(select count(*)::int from ${revisions} where ${revisions.packId} = ${packs.id})`,
        assignee: sql<string | null>`(select ${users.name} from ${users} where ${users.id} = ${packs.assignedTo})`,
      })
      .from(packs)
      .innerJoin(brands, eq(brands.id, packs.brandId))
      .leftJoin(users, eq(users.id, packs.updatedBy))
      .where(and(...where))
      .orderBy(...(f.sort === "due" ? [sql`case when ${due} = 'ASAP' then '0' else coalesce(${due}, '9') end`, desc(packs.updatedAt)] : [desc(packs.updatedAt)]))
      .limit(f.view === "pipeline" ? 500 : PAGE_SIZE)
      .offset(f.view === "pipeline" ? 0 : (f.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(packs).innerJoin(brands, eq(brands.id, packs.brandId)).where(and(...where)),
    db.select({ status: packs.status, n: count() }).from(packs).where(and(...base)).groupBy(packs.status),
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
    db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)),
    can(user, "admin") ? db.select({ n: count() }).from(packs).where(isNotNull(packs.archivedAt)).then((r) => r[0].n) : Promise.resolve(0),
  ]);
  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s.n]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const list: DashPack[] = rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
  const sel = "h-7 border-b border-hairline-strong bg-transparent text-[11px] tracking-[0.1em] uppercase focus:outline-none";

  return (
    <>
      {sp.denied && <p className="mb-6 text-signal text-[12px]">You don&apos;t have access to that page.</p>}
      {typeof sp.deleted === "string" && <p className="mb-6 text-[12px] text-ok" role="status">{sp.deleted} was deleted.</p>}
      <PageHeader
        eyebrow="The Atelier"
        title="Tech Packs"
        actions={
          can(user, "designer") && (
            <>
              <ButtonLink href="/packs/batch" variant="secondary">Batch create</ButtonLink>
              <ButtonLink href="/packs/new">New tech pack</ButtonLink>
            </>
          )
        }
      >
        Upload a render, answer the click-through questions, and every answer is kept for the factory-ready pack.
      </PageHeader>
      <div className="flex flex-wrap items-center justify-between gap-6 mb-6 border-b border-hairline">
        <div className="flex flex-wrap gap-6">
          {[["", "All"], ...Object.entries(STATUS_LABEL)].map(([k, label]) => (
            <Link key={k} href={filterHref(f, { status: k })} className={`pb-3 -mb-px text-[10.5px] tracking-[0.22em] uppercase ${f.status === k ? "border-b border-ink text-ink" : "text-taupe hover:text-ink"}`}>
              {label}
              {k && counts[k] ? <span className="ml-1 text-mist">{counts[k]}</span> : null}
            </Link>
          ))}
        </div>
        <span className="flex gap-6 items-start">
          <Link href={filterHref(f, { mine: !f.mine })} className={`pb-3 eyebrow hover:text-ink ${f.mine ? "text-ink" : ""}`} data-testid="my-queue">
            {f.mine ? "← Everyone's packs" : "My queue"}
          </Link>
          <Link href={filterHref(f, { view: f.view === "pipeline" ? "grid" : "pipeline" })} className="pb-3 eyebrow hover:text-ink" data-testid="pipeline-toggle">
            {f.view === "pipeline" ? "Grid" : "Pipeline"}
          </Link>
          {can(user, "admin") && archivedCount > 0 && (
            <Link href={showArchived ? "/" : "/?archived=1"} className={`pb-3 eyebrow hover:text-ink ${showArchived ? "text-ink" : ""}`} data-testid="archived-filter">
              {showArchived ? "← Active packs" : `Archived · ${archivedCount}`}
            </Link>
          )}
          <Link href={filterHref(f, { sort: f.sort === "due" ? "recent" : "due" })} className="pb-3 eyebrow hover:text-ink">
            {f.sort === "due" ? "Sorted by due date" : "Sort by due date"}
          </Link>
        </span>
      </div>
      <form action="/" className="flex flex-wrap gap-5 items-end mb-10" data-testid="pack-filters">
        {f.status && <input type="hidden" name="status" value={f.status} />}
        {f.mine && <input type="hidden" name="mine" value="1" />}
        {f.view === "pipeline" && <input type="hidden" name="view" value="pipeline" />}
        {f.sort === "due" && <input type="hidden" name="sort" value="due" />}
        <input name="q" defaultValue={f.q} placeholder="SEARCH STYLE #, NAME, BRAND" aria-label="Search style #" data-testid="pack-search" className={`${sel} w-56`} />
        <select name="brand" defaultValue={f.brand} aria-label="Brand" className={sel}>
          <option value="">All brands</option>
          {brandList.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select name="category" defaultValue={f.category} aria-label="Category" className={sel}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select name="stage" defaultValue={f.stage} aria-label="Stage" className={sel}>
          <option value="">Any stage</option>
          <option value="PROTO">Proto</option>
          <option value="PRODUCTION">Production</option>
        </select>
        <select name="due" defaultValue={f.due} aria-label="Due" className={sel}>
          <option value="">Any due date</option>
          <option value="asap">ASAP</option>
          <option value="overdue">Overdue</option>
          <option value="week">Due this week</option>
        </select>
        <select name="designer" defaultValue={f.designer} aria-label="Designer" className={sel}>
          <option value="">Any designer</option>
          {designers.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <button type="submit" className="eyebrow hover:text-ink pb-1">Filter</button>
      </form>
      {total === 0 && !f.q && !f.status && !f.brand && !f.category && !f.stage && !f.due && !f.designer && !f.mine && !showArchived ? (
        <Empty title="No tech packs yet" action={can(user, "designer") && <ButtonLink href="/packs/new">Begin the first pack</ButtonLink>}>
          Start with a brand, category and style number. The render and AI pre-fill come next.
        </Empty>
      ) : (
        <>
          <PackGrid packs={list} view={f.view} canEdit={can(user, "designer")} isAdmin={can(user, "admin")} designers={designers} archivedView={showArchived} />
          {f.view === "grid" && pages > 1 && (
            <nav className="mt-12 flex items-center gap-6 eyebrow" aria-label="Pages">
              {f.page > 1 && <Link href={filterHref(f, { page: f.page - 1 })} className="hover:text-ink">← Previous</Link>}
              <span>
                Page {f.page} of {pages} · {total} packs
              </span>
              {f.page < pages && <Link href={filterHref(f, { page: f.page + 1 })} className="hover:text-ink">Next →</Link>}
            </nav>
          )}
        </>
      )}
    </>
  );
}
