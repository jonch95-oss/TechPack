import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { packs } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { loadSamples } from "@/app/actions/samples";
import { PageHeader } from "@/components/ui";
import { SampleLog } from "@/components/pack/sample-log";

export default async function SamplesPage(props: PageProps<"/packs/[id]/samples">) {
  const user = await requireUser();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p] = await db.select().from(packs).where(eq(packs.id, id));
  if (!p) notFound();
  const rounds = await loadSamples(id);
  return (
    <>
      <Link href={`/packs/${id}`} className="eyebrow hover:text-ink inline-block mb-8">← {p.styleNo} {p.styleName}</Link>
      <PageHeader eyebrow={`${p.styleNo} · ${p.styleName}`} title="Sample review">
        Proto, salesman sample, pre-production and top of production. Mark up photos with lettered red circles; comments still open carry into the next round on their own.
      </PageHeader>
      <SampleLog
        packId={id}
        factory={p.factory}
        canEdit={can(user, "designer")}
        rounds={rounds.map((r) => ({
          id: r.id,
          stage: r.stage,
          number: r.number,
          receivedAt: r.receivedAt,
          factory: r.factory,
          verdict: r.verdict,
          notes: r.notes,
          comments: r.comments.map((c) => ({ id: c.id, letter: c.letter, text: c.text, photoUrl: c.photoUrl, markup: c.markup, status: c.status, carried: !!c.carriedFrom })),
        }))}
      />
    </>
  );
}
