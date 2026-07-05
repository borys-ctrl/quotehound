// Auth helpers: signed session cookies + session-user lookup.
//
// The session sign/verify path uses the Web Crypto API (globalThis.crypto)
// only, so it runs in BOTH the Edge middleware runtime and the Node runtime.
// The DB client is imported lazily inside getSessionUser, so importing this
// module from middleware.js does not pull Node-only code into the Edge bundle.
// Password hashing lives in lib/password.js (Node only) for the same reason.

export const SESSION_COOKIE = "qh_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days, in seconds

const encoder = new TextEncoder();

function base64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload) {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64url(new Uint8Array(sig));
}

// Returns "<userId>.<signature>"
export async function signSession(userId) {
  const payload = String(userId);
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

// Returns the numeric user id, or null if the token is missing/tampered.
export async function verifySession(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const idx = token.lastIndexOf(".");
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = await hmac(payload);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return null;
  const id = Number(payload);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Reads the session cookie off a NextRequest, verifies it, and returns the
// full user row (or null). Node runtime only — pulls in the DB client.
export async function getSessionUser(req) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const id = await verifySession(token);
  if (!id) return null;
  const { sql } = await import("./db");
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] || null;
}
