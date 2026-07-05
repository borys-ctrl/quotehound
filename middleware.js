import { NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

// Routes reachable without a session.
const PUBLIC = [
  "/login",
  "/signup",
  "/api/login",
  "/api/signup",
  "/api/logout",
  "/api/cron",
];

function isPublic(pathname) {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifySession(token);
  if (!userId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
