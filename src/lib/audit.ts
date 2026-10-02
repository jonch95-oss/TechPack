import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

/** Every edit records who made it and when. */
export async function audit(entry: {
  userId: string | null;
  entity: string;
  entityId: string;
  action: "create" | "update" | "delete" | "ai";
  field?: string;
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(auditLog).values({
    userId: entry.userId,
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    field: entry.field ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
