import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";

function textOf(msg) {
  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();
}

// Generates 3 follow-up emails (day 3, 7, 14) for a quote.
// `profile` is the quote owner's user row (sender_name / business_name /
// business_phone). Returns [{ day, subject, body }]
export async function generateSequence(quote, profile = {}) {
  const sender = profile.sender_name || "the owner";
  const business = profile.business_name || "our company";
  const phone = profile.business_phone || "";
  const expires = quote.expires_on
    ? String(quote.expires_on).slice(0, 10)
    : "";

  const prompt = `You write follow-up emails for a contractor/supplier chasing an open quote. Write like a busy tradesperson texting from a phone: short, direct, friendly, zero corporate fluff, no exclamation marks, no "I hope this email finds you well".

Sender: ${sender} at ${business}${phone ? `, phone ${phone}` : ""}
Customer first name: ${quote.customer_name.split(" ")[0]}
Quote amount: $${Number(quote.amount).toLocaleString()}
Quote is for: ${quote.description || "flooring materials/work"}
Quote sent on: ${quote.quote_date}${expires ? `\nQuote pricing holds until: ${expires} (real deadline — use it as genuine urgency in email 2)` : ""}

Write exactly 3 follow-up emails:
- Email 1 (day 3): casual check-in. Ask if they had a chance to look it over, offer to answer questions.
- Email 2 (day 7): add value. ${expires ? `Mention the pricing holds until ${expires} as a real reason to decide soon.` : "Mention one practical reason to decide soon (material availability, scheduling) without fake pressure."}
- Email 3 (day 14): the polite close-out. "Should I keep this quote open or close it out?" - the takeaway angle that gets replies.

Each body: 2-4 sentences max, ends with the sender's first name. Subject lines under 6 words, lowercase-casual is fine.

Respond ONLY with a JSON array, no markdown fences, in this exact shape:
[{"day":3,"subject":"...","body":"..."},{"day":7,"subject":"...","body":"..."},{"day":14,"subject":"...","body":"..."}]`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const seq = JSON.parse(textOf(msg));
  if (!Array.isArray(seq) || seq.length !== 3) {
    throw new Error("Unexpected sequence format from model");
  }
  return seq;
}

// Reads a quote PDF (base64) and extracts structured fields.
// Returns { customer_name, customer_email, customer_phone, amount,
//           description, quote_date, expires_on } with nulls where unknown.
export async function extractQuoteFromPdf(base64) {
  const prompt = `You are reading a single contractor/supplier quote PDF (often flooring — e.g. Best Flooring Honolulu). These typically contain the customer name, phone, an itemized product list, a TOTAL, and a quote date, and usually NO customer email.

Extract these fields. Return the grand TOTAL as the amount (a number, no currency symbol or commas). For "description", write a short human summary of what's being quoted (e.g. "28 boxes Karndean rigid core maple + Nroro baseboards/trim"), NOT the full line-item dump. Use null for anything not present (do not guess an email). Dates as YYYY-MM-DD.

Respond ONLY with a JSON object, no markdown fences, exactly this shape:
{"customer_name":"...","customer_email":"... or null","customer_phone":"... or null","amount":0,"description":"...","quote_date":"YYYY-MM-DD or null","expires_on":"YYYY-MM-DD or null"}`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const data = JSON.parse(textOf(msg));
  return {
    customer_name: data.customer_name || "",
    customer_email: data.customer_email || "",
    customer_phone: data.customer_phone || "",
    amount: data.amount != null ? Number(data.amount) : "",
    description: data.description || "",
    quote_date: data.quote_date || "",
    expires_on: data.expires_on || "",
  };
}
