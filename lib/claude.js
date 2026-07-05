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

// Generates 5 follow-up emails (days 2, 5, 10, 16, 24) for a quote.
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
Quote sent on: ${quote.quote_date}${expires ? `\nQuote pricing holds until: ${expires} (real deadline — use it as genuine urgency in email 4)` : ""}

Write exactly 5 follow-up emails:
- Email 1 (day 2): casual check-in. Ask if they had a chance to look it over.
- Email 2 (day 5): offer to answer any questions or adjust the quote if something's off.
- Email 3 (day 10): add value — share one practical tip about the materials or the job, and mention scheduling or material availability as a natural reason not to wait too long.
- Email 4 (day 16): ${expires ? `reference the pricing holding until ${expires} as a real, honest reason to decide soon.` : `a short "still interested?" nudge — no pressure, just checking if it's still on their radar.`}
- Email 5 (day 24): the polite close-out. "Should I keep this quote open or close it out?" - the takeaway angle that gets replies.

Each body: 2-4 sentences max, ends with the sender's first name. Subject lines under 6 words, lowercase-casual is fine.

Respond ONLY with a JSON array, no markdown fences, in this exact shape:
[{"day":2,"subject":"...","body":"..."},{"day":5,"subject":"...","body":"..."},{"day":10,"subject":"...","body":"..."},{"day":16,"subject":"...","body":"..."},{"day":24,"subject":"...","body":"..."}]`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const seq = JSON.parse(textOf(msg));
  if (!Array.isArray(seq) || seq.length !== 5) {
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
