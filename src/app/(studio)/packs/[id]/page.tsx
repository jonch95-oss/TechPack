import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { factoryQuestions, packs, sampleComments, sampleRounds, users } from "@/db/schema";
import { requireUser, can } from "@/lib/auth/dal";
import { libraryOptions, loadPack } from "@/lib/data";
import { PackWorkspace } from "@/components/pack/workspace";

export default async function PackPage(props: PageProps<"/packs/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p, library] = await Promise.all([loadPack(id), libraryOptions()]);
  if (!p) notFound();

  const userIds = [p.pack.reviewRequestedBy, p.pack.reviewedBy].filter(Boolean) as string[];
  const qs = await db.select().from(factoryQuestions).where(eq(factoryQuestions.packId, id)).orderBy(asc(factoryQuestions.createdAt));
  const ids = [...new Set([...userIds, ...qs.map((q) => q.answeredBy).filter(Boolean)])] as string[];
  const names = new Map((ids.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)) : []).map((u) => [u.id, u.name]));
  const [src] = p.pack.copiedFrom ? await db.select({ id: packs.id, styleNo: packs.styleNo }).from(packs).where(eq(packs.id, p.pack.copiedFrom)) : [];
  const rounds = await db.select({ id: sampleRounds.id }).from(sampleRounds).where(eq(sampleRounds.packId, id));
  const openComments = rounds.length
    ? (await db.select({ status: sampleComments.status, roundId: sampleComments.roundId }).from(sampleComments).where(inArray(sampleComments.roundId, rounds.map((r) => r.id)))).filter((c) => c.status !== "ACCEPTED").length
    : 0;

  return (
    <>
      <Link href="/" className="eyebrow hover:text-ink inline-block mb-8">← All tech packs</Link>
      <PackWorkspace
        pack={{
          id: p.pack.id,
          styleNo: p.pack.styleNo,
          styleName: p.pack.styleName,
          category: p.pack.category,
          colorways: p.pack.colorways,
          aiAnalysis: p.pack.aiAnalysis,
          status: p.pack.status,
          factory: p.pack.factory,
          factoryStyleNo: p.pack.factoryStyleNo,
          copiedFrom: src ?? null,
        }}
        meId={user.id}
        review={{
          requestedBy: p.pack.reviewRequestedBy ? { id: p.pack.reviewRequestedBy, name: names.get(p.pack.reviewRequestedBy) ?? "" } : null,
          reviewedBy: p.pack.reviewedBy ? { name: names.get(p.pack.reviewedBy) ?? "" } : null,
          reviewedAt: p.pack.reviewedAt?.toISOString() ?? null,
        }}
        factoryQuestions={qs.map((q) => ({
          id: q.id,
          askedBy: q.askedBy,
          question: q.question,
          answer: q.answer,
          answeredByName: q.answeredBy ? names.get(q.answeredBy) ?? null : null,
          createdAt: q.createdAt.toISOString(),
          answeredAt: q.answeredAt?.toISOString() ?? null,
        }))}
        sampleSummary={{ rounds: rounds.length, open: openComments }}
        brand={{ id: p.brand.id, name: p.brand.name, logoUrl: p.brand.logoUrl, licensorRequired: p.brand.licensorRequired }}
        sentBy={p.sentBy}
        answers={p.answers}
        statuses={p.statuses}
        meta={Object.fromEntries(Object.entries(p.meta).map(([k, m]) => [k, { aiNote: m.aiNote, aiValue: m.aiValue }]))}
        files={p.files}
        library={library}
        canEdit={can(user, "designer")}
      />
    </>
  );
}
