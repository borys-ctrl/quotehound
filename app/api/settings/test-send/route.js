import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { makeTransport, sendMail, sendViaGmailApi, GmailAuthError } from "@/lib/mailer";

const TEST_SUBJECT = "QuoteHound test send";
const TEST_BODY =
  "This is a QuoteHound test email. If you're reading this, your sending " +
  "email is connected and follow-ups will go out from this address.";

// Sends a test message to the user's own LOGIN email through their configured
// sending path (Gmail API or SMTP). On success, flips email_verified_send=true.
export async function POST(req) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // --- Gmail API path (Google users) ---
  if (user.send_via === "gmail_api") {
    if (!user.google_refresh_token_encrypted) {
      return NextResponse.json(
        { error: "Reconnect Google to enable sending." },
        { status: 400 }
      );
    }
    try {
      await sendViaGmailApi(user, {
        to: user.email,
        subject: TEST_SUBJECT,
        body: TEST_BODY,
      });
    } catch (err) {
      if (err instanceof GmailAuthError) {
        await sql`UPDATE users SET email_verified_send = false WHERE id = ${user.id}`;
        return NextResponse.json(
          { error: "Google access was revoked. Reconnect Google." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Send failed: " + String(err.message || err) },
        { status: 400 }
      );
    }
    await sql`UPDATE users SET email_verified_send = true WHERE id = ${user.id}`;
    return NextResponse.json({ ok: true });
  }

  // --- SMTP path (password users) ---
  if (!user.smtp_host || !user.smtp_user || !user.smtp_pass_encrypted) {
    return NextResponse.json(
      { error: "Save your SMTP settings first." },
      { status: 400 }
    );
  }

  let pass;
  try {
    pass = decrypt(user.smtp_pass_encrypted);
  } catch {
    return NextResponse.json(
      { error: "Stored password could not be read. Re-enter and save it." },
      { status: 400 }
    );
  }

  const transporter = makeTransport({
    host: user.smtp_host,
    port: user.smtp_port,
    user: user.smtp_user,
    pass,
  });

  try {
    await sendMail(transporter, {
      fromName: `${user.sender_name || "QuoteHound"}${
        user.business_name ? " - " + user.business_name : ""
      }`,
      fromEmail: user.smtp_user,
      to: user.email,
      subject: TEST_SUBJECT,
      body: TEST_BODY,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Send failed: " + String(err.message || err) },
      { status: 400 }
    );
  }

  await sql`UPDATE users SET email_verified_send = true WHERE id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
