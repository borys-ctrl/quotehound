import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function POST(req) {
  const { email, password } = await req.json();

  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (!password || String(password).length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const existing = await sql`SELECT id FROM users WHERE email = ${cleanEmail}`;
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  const password_hash = await hashPassword(String(password));
  const [user] = await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${cleanEmail}, ${password_hash})
    RETURNING id
  `;

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
