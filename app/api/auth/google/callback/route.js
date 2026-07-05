import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, getUserInfo } from "@/lib/google";

export const dynamic = "force-dynamic";

function fail(origin, reason) {
  // Bounce back to the login page with an error banner.
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
}

export async function GET(req) {
  const origin = req.nextUrl.origin;
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) return fail(origin, "Google sign-in was cancelled.");

  // CSRF: state must match the cookie we set at the start of the flow.
  const expectedState = req.cookies.get("qh_oauth_state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail(origin, "Sign-in expired. Please try again.");
  }

  let tokens, profile;
  try {
    tokens = await exchangeCode({ code, origin });
    profile = await getUserInfo(tokens.access_token);
  } catch (err) {
    return fail(origin, "Could not complete Google sign-in.");
  }

  const googleId = String(profile.sub);
  const email = String(profile.email || "").toLowerCase();
  const name = profile.name || "";
  if (!email) return fail(origin, "Google account has no email.");

  // Find by google_id first, then by email (link an existing account).
  let [user] =
    await sql`SELECT * FROM users WHERE google_id = ${googleId} LIMIT 1`;
  if (!user) {
    [user] = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
  }

  // A refresh token is only returned on first consent (prompt=consent forces
  // it, but be defensive): keep the existing one if Google omits it.
  const refreshEnc = tokens.refresh_token
    ? encrypt(tokens.refresh_token)
    : user?.google_refresh_token_encrypted || "";

  if (user) {
    await sql`
      UPDATE users SET
        google_id = ${googleId},
        google_refresh_token_encrypted = ${refreshEnc},
        auth_provider = 'google',
        send_via = 'gmail_api',
        email_verified_send = true,
        sender_name = ${user.sender_name || name}
      WHERE id = ${user.id}
    `;
  } else {
    [user] = await sql`
      INSERT INTO users
        (email, sender_name, google_id, google_refresh_token_encrypted,
         auth_provider, send_via, email_verified_send)
      VALUES
        (${email}, ${name}, ${googleId}, ${refreshEnc},
         'google', 'gmail_api', true)
      RETURNING id
    `;
  }

  const res = NextResponse.redirect(`${origin}/`);
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  // clear the one-time state cookie
  res.cookies.set("qh_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}
