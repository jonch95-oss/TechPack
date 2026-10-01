import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { brands, hardware } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { usedIn } from "@/lib/data";
import { ButtonLink, Empty, PageHeader, Thumb } from "@/components/ui";

export default async function HardwarePage(props: PageProps<"/library/hardware">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const brandFilter = typeof sp.brand === "string" ? sp.brand : "";
  const all = await db.select().from(brands).orderBy(asc(brands.name));
  const rows = await db
    .select({ h: hardware, brand: brands.name })
    .from(hardware)
    .leftJoin(brands, eq(brands.id, hardware.brandId))
    .orderBy(asc(hardware.code));
  const list = brandFilter ? rows.filter((r) => r.h.brandId === brandFilter) : rows;
  const used = await usedIn(list.map((r) => r.h.id));
  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Hardware & trims"
        actions={
          can(user, "designer") && (
            <>
              <ButtonLink href="/library/hardware/import" variant="secondary">Bulk import</ButtonLink>
              <ButtonLink href="/library/hardware/new">New component</ButtonLink>
            </>
          )
        }
      >
        New components take the next free number in the brand&apos;s format — checked against style numbers too, so the two never collide.
      </PageHeader>
      <div className="flex flex-wrap gap-6 mb-10 border-b border-hairline">
        <FilterLink href="/library/hardware" active={!brandFilter}>All</FilterLink>
        {all.map((b) => (
          <FilterLink key={b.id} href={`/library/hardware?brand=${b.id}`} active={brandFilter === b.id}>
            {b.name}
          </FilterLink>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty title="No components yet" action={can(user, "designer") && <ButtonLink href="/library/hardware/import">Import your hardware list</ButtonLink>}>
          Import a CSV or XLSX with an images folder, or create components one by one.
        </Empty>
      ) : (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left border-b border-ink">
              {["", "Code", "Type", "Name", "Dims (mm)", "Finish", "Brand", "Used in"].map((h) => (
                <th key={h} className="eyebrow py-3 pr-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map(({ h, brand }) => (
              <tr key={h.id} className="border-b border-hairline hover:bg-paper transition-colors group">
                <td className="py-2 pr-4 w-16">
                  <Link href={`/library/hardware/${h.id}`}><Thumb src={h.photoUrl} alt={h.code} className="w-12 h-12" /></Link>
                </td>
                <td className="py-2 pr-4">
                  <Link href={`/library/hardware/${h.id}`} className="display text-[19px] group-hover:text-gold transition-colors">{h.code}</Link>
                </td>
                <td className="py-2 pr-4 tracking-[0.06em]">{h.type}</td>
                <td className="py-2 pr-4 text-ink-soft">{h.name}</td>
                <td className="py-2 pr-4">{h.dimsMm}</td>
                <td className="py-2 pr-4">{h.finish}</td>
                <td className="py-2 pr-4 text-taupe">{brand}</td>
                <td className="py-2 pr-4 text-taupe">{(used.get(h.id) ?? []).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`pb-3 -mb-px text-[10.5px] tracking-[0.22em] uppercase ${active ? "border-b border-ink text-ink" : "text-taupe hover:text-ink"}`}>
      {children}
    </Link>
  );
}
