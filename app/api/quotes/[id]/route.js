import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// PATCH { action: "responded" | "pause" | "resume" }
export async function PATCH(req, { params }) {
  const { action } = await req.json();
  const id = Number(params.id);

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
