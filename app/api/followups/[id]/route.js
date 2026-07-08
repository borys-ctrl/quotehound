import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// PATCH { subject, body } — edit a single follow-up during approval.
// Ownership is enforced through the parent quote's user_id; only 'scheduled'
// rows are editable.
export async function PATCH(req, { params }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  const { subject, body } = await req.json();

  // Join to the owning quote so a user can only reach their own follow-ups.
  const [row] = await sql`
    SELECT f.id, f.status
    FROM followups f
    JOIN quotes q ON q.id = f.quote_id
    WHERE f.id = ${id} AND q.user_id = ${user.id}
  `;
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== "scheduled") {
    return NextResponse.json(
      { error: "Only scheduled emails can be edited." },
      { status: 409 }
    );
  }

  const cleanSubject = String(subject ?? "").trim();
  const cleanBody = String(body ?? "").trim();
  if (!cleanSubject || !cleanBody) {
    return NextResponse.json(
      { error: "Subject and body can't be empty." },
      { status: 400 }
    );
  }

  const [updated] = await sql`
    UPDATE followups SET subject = ${cleanSubject}, body = ${cleanBody}
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json(updated);
}
