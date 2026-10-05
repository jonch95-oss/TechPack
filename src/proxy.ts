import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/** Optimistic auth check from the Auth.js cookie only; pages and actions re-verify against the database. */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const signedIn = !!req.auth;
  if (pathname.startsWith("/api/auth")) return NextResponse.next();
  if (pathname === "/login") return signedIn ? NextResponse.redirect(new URL("/", req.nextUrl)) : NextResponse.next();
  if (!signedIn) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const url = new URL("/login", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
