import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateSequence } from "@/lib/claude";
import { getSessionUser } from "@/lib/auth";

// List the session user's quotes with next scheduled send + sent count.
export async function GET(req) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotes = await sql`
    SELECT q.*,
      (SELECT MIN(send_on) FROM followups f
        WHERE f.quote_id = q.id AND f.status = 'scheduled') AS next_send,
      (SELECT COUNT(*) FROM followups f
        WHERE f.quote_id = q.id AND f.status = 'sent') AS sent_count
    FROM quotes q
    WHERE q.user_id = ${user.id}
    ORDER BY q.created_at DESC
  `;
  return NextResponse.json(quotes);
}

// Create a quote (owned by the session user) and schedule its sequence.
export async function POST(req) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.email_verified_send) {
    return NextResponse.json(
      { error: "Connect your sending email first." },
      { status: 403 }
    );
  }

  const {
    customer_name,
    customer_email,
    customer_phone,
    amount,
    description,
    quote_date,
    expires_on,
  } = await req.json();

  if (!customer_name || !customer_email || !amount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const [quote] = await sql`
    INSERT INTO quotes
      (user_id, customer_name, customer_email, customer_phone, amount,
       description, quote_date, expires_on)
    VALUES
      (${user.id}, ${customer_name}, ${customer_email}, ${customer_phone || ""},
       ${amount}, ${description || ""},
       ${quote_date || new Date().toISOString().slice(0, 10)},
       ${expires_on || null})
    RETURNING *
  `;

  const sequence = await generateSequence(quote, user);

  // When the quote has an expiry, pricing no longer holds past it — don't
  // schedule any follow-up that would land after the quote expires.
  const expiry = quote.expires_on ? new Date(quote.expires_on) : null;
  const scheduled = [];

  for (const [i, email] of sequence.entries()) {
    const sendOn = new Date(quote.quote_date);
    sendOn.setDate(sendOn.getDate() + email.day);
    if (expiry && sendOn > expiry) continue; // skip emails past expiry
    await sql`
      INSERT INTO followups (quote_id, step, subject, body, send_on)
      VALUES (${quote.id}, ${i + 1}, ${email.subject}, ${email.body},
              ${sendOn.toISOString().slice(0, 10)})
    `;
    scheduled.push(email);
  }

  return NextResponse.json({ quote, sequence, scheduled });
}
