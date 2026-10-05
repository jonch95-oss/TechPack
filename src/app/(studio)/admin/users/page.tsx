import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { UsersAdmin } from "./users-admin";

export default async function UsersPage() {
  const me = await requirePageRole("admin");
  const rows = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role, active: users.active }).from(users).orderBy(asc(users.name));
  return (
    <>
      <PageHeader eyebrow="Administration" title="The team">
        Admins manage users, brands and libraries. Designers create and edit packs. Viewers have read-only access. The name prints as SENT BY.
      </PageHeader>
      <UsersAdmin users={rows} meId={me.id} />
    </>
  );
}
