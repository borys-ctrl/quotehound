import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { makeTransport, sendMail } from "@/lib/mailer";

export const maxDuration = 60;

// Called daily by Vercel Cron (Bearer CRON_SECRET), or manually by any
// logged-in user. Either way it processes ALL users' due emails — each send is
// scoped to that quote owner's own SMTP settings and from-address.
export async function GET(req) {
  const auth = req.headers.get("authorization");
  const cronOk = auth === `Bearer ${process.env.CRON_SECRET}`;
  const sessionOk = cronOk ? false : !!(await getSessionUser(req));
  if (!cronOk && !sessionOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await sql`
    SELECT f.id, f.subject, f.body, f.step, q.customer_email, q.id AS quote_id,
           u.id AS user_id, u.smtp_host, u.smtp_port, u.smtp_user,
           u.smtp_pass_encrypted, u.email_verified_send,
           u.sender_name, u.business_name
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
  const transporters = new Map(); // user_id -> transporter (cached per run)

  for (const f of due) {
    try {
      if (!f.email_verified_send || !f.smtp_host || !f.smtp_pass_encrypted) {
        errors.push({
          followup: f.id,
          error: "Owner's sending email not connected/verified — left scheduled",
        });
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
