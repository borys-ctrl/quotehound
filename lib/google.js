// Google OAuth (auth + gmail.send) — hand-rolled confidential-client code flow.
// No heavy auth library; token exchange/refresh are plain HTTPS calls.
// Node runtime only.

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
];

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

// Thrown when a refresh token is revoked/expired. Callers demote the user to
// "reconnect Google" instead of crashing the run.
export class GmailAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "GmailAuthError";
  }
}

function clientId() {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_CLIENT_ID is not set");
  return v;
}

function clientSecret() {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not set");
  return v;
}

// The redirect URI must EXACTLY match one registered in Google Cloud. We derive
// it from the incoming request origin so localhost and prod both work.
export function redirectUri(origin) {
  return `${origin}/api/auth/google/callback`;
}

export function buildConsentUrl({ origin, state }) {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",   // ask for a refresh token
    prompt: "consent",        // force refresh token even on re-consent
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// Exchange an authorization code for tokens (access + refresh + id).
export async function exchangeCode({ code, origin }) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${data.error || res.status}`);
  }
  return data; // { access_token, refresh_token, expires_in, id_token, scope }
}

// Get a fresh access token from a stored refresh token.
export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw new GmailAuthError("No refresh token stored");
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    // invalid_grant == revoked or expired refresh token
    if (data.error === "invalid_grant") {
      throw new GmailAuthError("Google access was revoked");
    }
    throw new Error(`Token refresh failed: ${data.error || res.status}`);
  }
  return data.access_token;
}

// Fetch the signed-in Google profile (sub, email, name).
export async function getUserInfo(accessToken) {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  return res.json(); // { sub, email, name, ... }
}
