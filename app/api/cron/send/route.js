import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import {
  makeTransport,
  sendMail,
  sendViaGmailApi,
  gmailAccessTokenFor,
  GmailAuthError,
} from "@/lib/mailer";

export const maxDuration = 60;

// Called daily by Vercel Cron (Bearer CRON_SECRET), or manually by any
// logged-in user. Either way it processes ALL users' due emails — each send is
// scoped to that quote owner's own sending path (SMTP or their Gmail account).
export async function GET(req) {
  const auth = req.headers.get("authorization");
  const cronOk = auth === `Bearer ${process.env.CRON_SECRET}`;
  const sessionOk = cronOk ? false : !!(await getSessionUser(req));
  if (!cronOk && !sessionOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await sql`
    SELECT f.id, f.subject, f.body, f.step, q.customer_email, q.id AS quote_id,
           u.id AS user_id, u.email, u.send_via, u.email_verified_send,
           u.sender_name, u.business_name,
           u.smtp_host, u.smtp_port, u.smtp_user, u.smtp_pass_encrypted,
           u.google_refresh_token_encrypted
    FROM followups f
    JOIN quotes q ON q.id = f.quote_id
    JOIN users u ON u.id = q.user_id
    WHERE f.status = 'scheduled'
      AND f.send_on <= CURRENT_DATE
      AND q.status = 'active'
    ORDER BY f.send_on
    LIMIT 100
  `;

  let sent = 0;
  const errors = [];
  const transporters = new Map(); // user_id -> SMTP transporter (cached per run)
  const gmailTokens = new Map(); // user_id -> Gmail access token (cached per run)
  const demoted = new Set(); // user_ids whose Google access was revoked this run

  for (const f of due) {
    try {
      if (demoted.has(f.user_id)) {
        errors.push({ followup: f.id, error: "Owner must reconnect Google — skipped" });
        continue;
      }
      if (!f.email_verified_send) {
        errors.push({
          followup: f.id,
          error: "Owner's sending email not connected/verified — left scheduled",
        });
        continue;
      }

      if (f.send_via === "gmail_api") {
        try {
          let token = gmailTokens.get(f.user_id);
          if (!token) {
            token = await gmailAccessTokenFor(f);
            gmailTokens.set(f.user_id, token);
          }
          await sendViaGmailApi(f, {
            to: f.customer_email,
            subject: f.subject,
            body: f.body,
            accessToken: token,
          });
        } catch (err) {
          if (err instanceof GmailAuthError) {
            // Revoked/expired: demote the user and skip their sends. Don't crash.
            await sql`UPDATE users SET email_verified_send = false WHERE id = ${f.user_id}`;
            demoted.add(f.user_id);
            errors.push({ followup: f.id, error: "Google access revoked — reconnect required" });
            continue;
          }
          throw err;
        }
      } else {
        // SMTP path
        if (!f.smtp_host || !f.smtp_pass_encrypted) {
          errors.push({ followup: f.id, error: "Owner's SMTP not configured — left scheduled" });
          continue;
        }
        let transporter = transporters.get(f.user_id);
        if (!transporter) {
          transporter = makeTransport({
            host: f.smtp_host,
            port: f.smtp_port,
            user: f.smtp_user,
            pass: decrypt(f.smtp_pass_encrypted),
          });
          transporters.set(f.user_id, transporter);
        }
        await sendMail(transporter, {
          fromName: `${f.sender_name || "QuoteHound"}${
            f.business_name ? " - " + f.business_name : ""
          }`,
          fromEmail: f.smtp_user,
          to: f.customer_email,
          subject: f.subject,
          body: f.body,
        });
      }

      await sql`UPDATE followups SET status = 'sent', sent_at = now()
                WHERE id = ${f.id}`;
      // Final email sent -> sequence exhausted
      if (f.step === 3) {
        await sql`UPDATE quotes SET status = 'exhausted' WHERE id = ${f.quote_id}`;
      }
      sent++;
    } catch (err) {
      errors.push({ followup: f.id, error: String(err) });
    }
  }

  return NextResponse.json({ due: due.length, sent, errors });
}
