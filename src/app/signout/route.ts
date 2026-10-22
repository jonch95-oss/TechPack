import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { sessions } from "@/db/schema";

/**
 * Clears the sign-in cookie and goes to the login page. Pages send a browser here when its cookie
 * is still valid but the session behind it has ended (signed out elsewhere, password reset,
 * account deactivated, expired): sending it straight to /login would bounce back, because the
 * proxy only sees the cookie — a redirect loop.
 */
export async function GET(req: Request) {
  const session = (await auth()) as { sid?: string } | null;
  if (session?.sid) await db.delete(sessions).where(eq(sessions.id, session.sid));
  await signOut({ redirect: false });
  const next = new URL(req.url).searchParams.get("next");
  const url = new URL("/login", req.url);
  if (next?.startsWith("/") && !next.startsWith("//")) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}
