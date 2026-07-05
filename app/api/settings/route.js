import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

// Return the profile — never the SMTP password. `smtp_connected` is derived
// from whether an encrypted password is stored.
export async function GET(req) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    email: user.email,
    sender_name: user.sender_name || "",
    business_name: user.business_name || "",
    business_phone: user.business_phone || "",
    smtp_host: user.smtp_host || "",
    smtp_port: user.smtp_port || 465,
    smtp_user: user.smtp_user || "",
    smtp_connected: !!user.smtp_pass_encrypted,
    email_verified_send: !!user.email_verified_send,
  });
}

// Save profile + SMTP settings. A blank smtp_pass keeps the stored one.
// Any change to the SMTP connection resets email_verified_send to false.
export async function POST(req) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const sender_name = String(body.sender_name || "").trim();
  const business_name = String(body.business_name || "").trim();
  const business_phone = String(body.business_phone || "").trim();
  const smtp_host = String(body.smtp_host || "").trim();
  const smtp_port = Number(body.smtp_port) || 465;
  const smtp_user = String(body.smtp_user || "").trim();
  const newPass = body.smtp_pass ? String(body.smtp_pass) : "";

  // Did the sending connection change?
  const connChanged =
    smtp_host !== (user.smtp_host || "") ||
    smtp_port !== (user.smtp_port || 465) ||
    smtp_user !== (user.smtp_user || "") ||
    newPass.length > 0;

  const smtp_pass_encrypted = newPass
    ? encrypt(newPass)
    : user.smtp_pass_encrypted || "";

  const email_verified_send = connChanged ? false : user.email_verified_send;

  await sql`
    UPDATE users SET
      sender_name = ${sender_name},
      business_name = ${business_name},
      business_phone = ${business_phone},
      smtp_host = ${smtp_host},
      smtp_port = ${smtp_port},
      smtp_user = ${smtp_user},
      smtp_pass_encrypted = ${smtp_pass_encrypted},
      email_verified_send = ${email_verified_send}
    WHERE id = ${user.id}
  `;

  return NextResponse.json({ ok: true, email_verified_send });
}
