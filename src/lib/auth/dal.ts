import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type Role, type User } from "@/db/schema";
import { auth } from "@/auth";

/** Verifies the Auth.js session against the database (revocable). Memoised per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = (await auth()) as { sid?: string } | null;
  if (!session?.sid) return null;
  const payload = { sessionId: session.sid };
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, payload.sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user;
  if (!user || !user.active) return null;
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

const RANK: Record<Role, number> = { viewer: 0, designer: 1, admin: 2 };

export function can(user: Pick<User, "role">, min: Role) {
  return RANK[user.role] >= RANK[min];
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireRole(min: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  if (!can(user, min)) throw new Error(`Requires ${min} role`);
  return user;
}

/** For pages: redirects to login, or home when the role is too low. */
export async function requirePageRole(min: Role): Promise<User> {
  const user = await requireUser();
  if (!can(user, min)) redirect("/?denied=1");
  return user;
}
