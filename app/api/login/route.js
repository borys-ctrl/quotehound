import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

// Minimal in-memory rate limit: max attempts per IP per rolling window.
// Good enough for a single-region deployment; resets on cold start.
const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_ATTEMPTS = 10;
const attempts = new Map(); // ip -> { count, resetAt }

function rateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

export async function POST(req) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const { email, password } = await req.json();
  const cleanEmail = String(email || "").trim().toLowerCase();

  const [user] = await sql`SELECT * FROM users WHERE email = ${cleanEmail}`;
  const ok = user && (await verifyPassword(String(password || ""), user.password_hash));
  if (!ok) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
