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
