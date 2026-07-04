import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Public: login page, login API, cron endpoint (protected by its own Bearer secret)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/cron")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("qh_auth")?.value;
  if (cookie !== process.env.ADMIN_PASSWORD) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
