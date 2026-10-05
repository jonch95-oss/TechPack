import Link from "next/link";
import { asc, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { materials } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { usedIn } from "@/lib/data";
import { Badge, ButtonLink, Empty, PageHeader } from "@/components/ui";

export default async function MaterialsPage(props: PageProps<"/library/materials">) {
  const user = await requireUser();
  // Search by Icon F-code (shared across brands), supplier, article or colour.
  const q = String((await props.searchParams).q ?? "").trim();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await db
    .select()
    .from(materials)
    .where(q ? or(ilike(materials.iconCode, like), ilike(materials.supplier, like), ilike(materials.articleName, like), ilike(materials.articleNo, like), ilike(materials.colourNo, like), ilike(materials.colourName, like)) : undefined)
    .orderBy(asc(materials.iconCode), asc(materials.supplier), asc(materials.colourNo));
  const used = await usedIn(rows.map((r) => r.id));
  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Materials & swatch cards"
        actions={
          can(user, "designer") && (
            <>
              <ButtonLink href="/library/materials/import" variant="secondary">Add in bulk</ButtonLink>
              <ButtonLink href="/library/materials/new">Add swatch card</ButtonLink>
            </>
          )
        }
      >
        Upload a card photo and the Technical Designer reads the printed spec — Chinese included. Draw the red box on the chip.
      </PageHeader>
      <form className="mb-8 flex gap-3 max-w-md" role="search">
        <input name="q" defaultValue={q} placeholder="Search F-code, supplier, article, colour" aria-label="Search materials" className="flex-1 border border-hairline bg-white px-3 py-2 text-[13px]" />
        <button type="submit" className="eyebrow hover:text-ink">Search</button>
      </form>
      {rows.length === 0 ? (
        <Empty title="The swatch library is empty" action={can(user, "designer") && <ButtonLink href="/library/materials/new">Add the first card</ButtonLink>} />
      ) : (
        <ul className="grid gap-x-8 gap-y-10 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {rows.map((m, i) => {
            const pending = Object.values(m.fieldStatus).filter((s) => s === "ai").length;
            return (
              <li key={m.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <Link href={`/library/materials/${m.id}`} className="group block">
                  <div className="aspect-[3/4] bg-white border border-hairline relative overflow-hidden">
                    {m.cardPhotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.cardPhotoUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" />
                    )}
                    {m.cardPhotoUrl && m.chipBox && (
                      <div
                        className="absolute border-2 border-signal"
                        style={{ left: `${m.chipBox.x * 100}%`, top: `${m.chipBox.y * 100}%`, width: `${m.chipBox.w * 100}%`, height: `${m.chipBox.h * 100}%` }}
                      />
                    )}
                  </div>
                  <div className="pt-3">
                    <div className="eyebrow">{m.iconCode ? `${m.iconCode} · ` : ""}{m.supplier}{m.qualityOnly ? " · QUALITY REF" : ""}</div>
                    <div className="display text-[20px] leading-tight mt-1 group-hover:text-gold transition-colors">
                      {[m.articleName, m.colourNo && (m.colourNo.startsWith("#") ? m.colourNo : `#${m.colourNo}`)].filter(Boolean).join(" / ")}
                    </div>
                    <div className="text-[11px] text-taupe tracking-wide">{m.colourName}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={m.approval?.status === "APPROVED" ? "ok" : m.approval?.status === "REJECTED" ? "signal" : "neutral"}>{m.approval?.status === "APPROVED" ? `${m.approval.type || ""} APPROVED`.trim() : m.approval?.status ?? "PENDING"}</Badge>
                      {pending > 0 && <Badge tone="ai">{pending} AI-read</Badge>}
                      {(used.get(m.id) ?? []).map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
