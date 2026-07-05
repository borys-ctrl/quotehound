import { NextResponse } from "next/server";
import crypto from "crypto";
import { buildConsentUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

// Kick off the Google OAuth consent flow. A random state nonce is stored in a
// short-lived httpOnly cookie and echoed back on the callback (CSRF guard).
export async function GET(req) {
  const origin = req.nextUrl.origin;
  const state = crypto.randomBytes(16).toString("hex");

  const res = NextResponse.redirect(buildConsentUrl({ origin, state }));
  res.cookies.set("qh_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  return res;
}
