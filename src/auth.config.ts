import type { NextAuthConfig } from "next-auth";

export const SESSION_DAYS = 14;

/**
 * Auth.js settings shared by the proxy (cookie check only) and the full setup in `auth.ts`
 * (which adds the credentials provider and the database). Sessions are JWTs signed with
 * AUTH_SECRET; each carries the id of a row in `sessions`, which the data-access layer checks on
 * every request so an admin can sign a user out (deactivate / reset password) immediately.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: SESSION_DAYS * 24 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.sid = (user as { sid?: string }).sid;
      }
      return token;
    },
    session({ session, token }) {
      return { ...session, uid: token.uid as string | undefined, sid: token.sid as string | undefined };
    },
  },
} satisfies NextAuthConfig;
