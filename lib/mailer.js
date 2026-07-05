import nodemailer from "nodemailer";
import { decrypt } from "@/lib/crypto";
import { refreshAccessToken, GmailAuthError } from "@/lib/google";

// ---- SMTP path (password users) ------------------------------------------

// Build a transporter from a single user's SMTP settings.
// Port 465 = implicit TLS (secure); 587 = STARTTLS (secure:false).
export function makeTransport({ host, port, user, pass }) {
  const p = Number(port) || 465;
  return nodemailer.createTransport({
    host,
    port: p,
    secure: p === 465,
    auth: { user, pass },
  });
}

// Sends one message from the user's own address; replies land in their inbox.
export async function sendMail(transporter, { fromName, fromEmail, to, subject, body }) {
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text: body,
  });
}

// ---- Gmail API path (Google users) ---------------------------------------

function base64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// RFC 2047 encoded-word for header values that contain non-ASCII.
function encodeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function buildRfc822({ fromName, fromEmail, to, subject, body }) {
  const from = `${encodeHeader(fromName)} <${fromEmail}>`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  return headers.join("\r\n") + "\r\n\r\n" + body;
}

// Exchange a user's stored (encrypted) refresh token for an access token.
// Throws GmailAuthError if the token is revoked. Callers can cache the result
// for the duration of a run.
export async function gmailAccessTokenFor(user) {
  return refreshAccessToken(decrypt(user.google_refresh_token_encrypted));
}

// Sends via the Gmail API. Pass a pre-fetched `accessToken` to reuse one across
// several sends for the same user; otherwise one is refreshed here.
// Throws GmailAuthError if the token is revoked so callers can demote the user.
export async function sendViaGmailApi(user, { to, subject, body, accessToken }) {
  const token = accessToken || (await gmailAccessTokenFor(user)); // may throw GmailAuthError

  const fromName = `${user.sender_name || "QuoteHound"}${
    user.business_name ? " - " + user.business_name : ""
  }`;
  const raw = base64url(
    buildRfc822({ fromName, fromEmail: user.email, to, subject, body })
  );

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (res.status === 401) {
    throw new GmailAuthError("Gmail rejected the access token");
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${detail}`);
  }
}

export { GmailAuthError };
