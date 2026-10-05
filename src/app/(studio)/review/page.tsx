import { and, asc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { brands, packFiles, packs, users } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { ReviewQueue } from "./review-queue";

/**
 * Review queue (V2 §3 step 5): every pack waiting for a second designer's sign-off, one after another,
 * approved or sent back from the keyboard. A designer never reviews their own request.
 */
export default async function ReviewPage() {
  const user = await requirePageRole("designer");
  const rows = await db
    .select({
      id: packs.id,
      styleNo: packs.styleNo,
      styleName: packs.styleName,
      category: packs.category,
      stage: packs.stage,
      brand: brands.name,
      requestedBy: users.name,
      render: sql<string | null>`(select ${packFiles.url} from ${packFiles} where ${packFiles.packId} = ${packs.id} and ${packFiles.kind} = 'render' limit 1)`,
    })
    .from(packs)
    .innerJoin(brands, eq(brands.id, packs.brandId))
    .leftJoin(users, eq(users.id, packs.reviewRequestedBy))
    .where(and(eq(packs.status, "IN_REVIEW"), isNull(packs.archivedAt), or(isNull(packs.reviewRequestedBy), ne(packs.reviewRequestedBy, user.id))))
    .orderBy(asc(packs.updatedAt));
  return (
    <>
      <PageHeader eyebrow="Sign-off" title="Review queue">
        Packs waiting for a second designer. <kbd>A</kbd> sign off · <kbd>C</kbd> comment and send back · <kbd>J</kbd>/<kbd>K</kbd> next / previous · <kbd>O</kbd> open the pack.
      </PageHeader>
      <ReviewQueue items={rows} />
    </>
  );
}
