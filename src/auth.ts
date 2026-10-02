import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { SESSION_DAYS, authConfig } from "./auth.config";

class BadCredentials extends CredentialsSignin {
  code = "bad_credentials";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // A wrong password is an expected outcome, not a server error.
  logger: {
    error(e) {
      if ((e as { type?: string }).type === "CredentialsSignin" || e.name === "CredentialsSignin") return;
      console.error(e);
    },
  },
  providers: [
    Credentials({
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) throw new BadCredentials();
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) throw new BadCredentials();
        const [s] = await db
          .insert(sessions)
          .values({ userId: user.id, expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000) })
          .returning({ id: sessions.id });
        return { id: user.id, email: user.email, name: user.name, sid: s.id };
      },
    }),
  ],
});
