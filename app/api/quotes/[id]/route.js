import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// PATCH { action: "responded" | "pause" | "resume" }
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

  if (action === "responded") {
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
