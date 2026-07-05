import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { extractQuoteFromPdf } from "@/lib/claude";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Accepts a quote PDF (multipart form field "file"), sends it to Claude as a
// document block, and returns the extracted fields for the review screen.
// The PDF itself is parsed and discarded — not stored in v3.
export async function POST(req) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "The PDF is empty." }, { status: 400 });
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "PDF is larger than 10 MB." }, { status: 400 });
  }

  try {
    const fields = await extractQuoteFromPdf(bytes.toString("base64"));
    return NextResponse.json({ fields });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not read that PDF. Enter the quote manually." },
      { status: 422 }
    );
  }
}
