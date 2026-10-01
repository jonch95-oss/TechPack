"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { clearSessionCookie, decrypt, sessionExpiry, setSessionCookie, SESSION_COOKIE } from "@/lib/auth/session";
import { cookies } from "next/headers";

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash)))
    return { error: "That email and password don't match." };
  const expiresAt = sessionExpiry();
  const [s] = await db.insert(sessions).values({ userId: user.id, expiresAt }).returning({ id: sessions.id });
  await setSessionCookie({ sessionId: s.id, userId: user.id, role: user.role, expiresAt: expiresAt.toISOString() });
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const payload = await decrypt((await cookies()).get(SESSION_COOKIE)?.value);
  if (payload) await db.delete(sessions).where(eq(sessions.id, payload.sessionId));
  await clearSessionCookie();
  redirect("/login");
}

export type PasswordState = { error?: string; ok?: boolean } | undefined;

/** Change your own password. Required at first sign-in after an admin sets a temporary one. */
export async function changePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const { getCurrentUser } = await import("@/lib/auth/dal");
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Your current password is not right." };
  if (next.length < 10) return { error: "Use at least 10 characters." };
  if (next !== confirm) return { error: "The two new passwords don't match." };
  if (next === current) return { error: "Choose a password different from the temporary one." };
  await db.update(users).set({ passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false }).where(eq(users.id, user.id));
  const { audit } = await import("@/lib/audit");
  await audit({ userId: user.id, entity: "user", entityId: user.id, action: "update", field: "password", after: "(changed)" });
  redirect("/");
}
