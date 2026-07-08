import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// Fetch one quote (scoped to the owner) plus its follow-ups — powers the
// approval page.
export async function GET(req, { params }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  const [quote] = await sql`
    SELECT * FROM quotes WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const followups = await sql`
    SELECT * FROM followups WHERE quote_id = ${id} ORDER BY send_on, step
  `;
  return NextResponse.json({ quote, followups });
}

// PATCH { action: "approve" | "responded" | "pause" | "resume" }
export async function PATCH(req, { params }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json();
  const id = Number(params.id);

  // Ownership check — a user may only touch their own quotes.
  const [owned] = await sql`
    SELECT id FROM quotes WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "approve") {
    // Only a pending quote can be approved into an active (sending) sequence.
    await sql`UPDATE quotes SET status = 'active'
              WHERE id = ${id} AND status = 'pending_approval'`;
  } else if (action === "responded") {
    await sql`UPDATE quotes SET status = 'responded' WHERE id = ${id}`;
    await sql`UPDATE followups SET status = 'canceled'
              WHERE quote_id = ${id} AND status = 'scheduled'`;
  } else if (action === "pause") {
    await sql`UPDATE quotes SET status = 'paused' WHERE id = ${id}`;
  } else if (action === "resume") {
    await sql`UPDATE quotes SET status = 'active' WHERE id = ${id}`;
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const [quote] = await sql`SELECT * FROM quotes WHERE id = ${id}`;
  return NextResponse.json(quote);
}
