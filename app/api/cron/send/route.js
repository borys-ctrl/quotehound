import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendFollowup } from "@/lib/mailer";

export const maxDuration = 60;

// Called daily by Vercel Cron; also callable by a logged-in admin (qh_auth cookie).
export async function GET(req) {
  const auth = req.headers.get("authorization");
  const cookieOk = req.cookies?.get?.("qh_auth")?.value === process.env.ADMIN_PASSWORD;
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && !cookieOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await sql`SELECT f.id, f.subject, f.body, f.step, q.customer_email, q.id AS quote_id FROM followups f JOIN quotes q ON q.id = f.quote_id WHERE f.status = 'scheduled' AND f.send_on <= CURRENT_DATE AND q.status = 'active' ORDER BY f.send_on LIMIT 50`;

  let sent = 0;
  const errors = [];

  for (const f of due) {
    try {
      await sendFollowup({ to: f.customer_email, subject: f.subject, body: f.body });
      await sql`UPDATE followups SET status = 'sent', sent_at = now() WHERE id = ${f.id}`;
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
