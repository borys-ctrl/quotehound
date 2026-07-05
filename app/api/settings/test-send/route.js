import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { makeTransport, sendMail } from "@/lib/mailer";

// Sends a test message to the user's own LOGIN email through their stored SMTP
// settings. On success, flips email_verified_send = true.
export async function POST(req) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      subject: "QuoteHound test send",
      body:
        "This is a QuoteHound test email. If you're reading this, your sending " +
        "email is connected and follow-ups will go out from this address.",
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
