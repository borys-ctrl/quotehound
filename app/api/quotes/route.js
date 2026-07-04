import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateSequence } from "@/lib/claude";

// List quotes with next scheduled send
export async function GET() {
  const quotes = await sql`
    SELECT q.*,
      (SELECT MIN(send_on) FROM followups f
        WHERE f.quote_id = q.id AND f.status = 'scheduled') AS next_send,
      (SELECT COUNT(*) FROM followups f
        WHERE f.quote_id = q.id AND f.status = 'sent') AS sent_count
    FROM quotes q
    ORDER BY q.created_at DESC
  `;
  return NextResponse.json(quotes);
}

// Create quote and schedule its follow-up sequence
export async function POST(req) {
  const { customer_name, customer_email, amount, description, quote_date } =
    await req.json();

  if (!customer_name || !customer_email || !amount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const [quote] = await sql`
    INSERT INTO quotes (customer_name, customer_email, amount, description, quote_date)
    VALUES (${customer_name}, ${customer_email}, ${amount},
            ${description || ""}, ${quote_date || new Date().toISOString().slice(0, 10)})
    RETURNING *
  `;

  const sequence = await generateSequence(quote);

  for (const [i, email] of sequence.entries()) {
    const sendOn = new Date(quote.quote_date);
    sendOn.setDate(sendOn.getDate() + email.day);
    await sql`
      INSERT INTO followups (quote_id, step, subject, body, send_on)
      VALUES (${quote.id}, ${i + 1}, ${email.subject}, ${email.body},
              ${sendOn.toISOString().slice(0, 10)})
    `;
  }

  return NextResponse.json({ quote, sequence });
}
