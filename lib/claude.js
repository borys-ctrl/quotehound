import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Generates 3 follow-up emails (day 3, 7, 14) for a quote.
// Returns [{ day, subject, body }]
export async function generateSequence(quote) {
  const sender = process.env.SENDER_NAME || "the owner";
  const business = process.env.BUSINESS_NAME || "our company";
  const phone = process.env.BUSINESS_PHONE || "";

  const prompt = `You write follow-up emails for a contractor/supplier chasing an open quote. Write like a busy tradesperson texting from a phone: short, direct, friendly, zero corporate fluff, no exclamation marks, no "I hope this email finds you well".

Sender: ${sender} at ${business}${phone ? `, phone ${phone}` : ""}
Customer first name: ${quote.customer_name.split(" ")[0]}
Quote amount: $${Number(quote.amount).toLocaleString()}
Quote is for: ${quote.description || "flooring materials/work"}
Quote sent on: ${quote.quote_date}

Write exactly 3 follow-up emails:
- Email 1 (day 3): casual check-in. Ask if they had a chance to look it over, offer to answer questions.
- Email 2 (day 7): add value. Mention one practical reason to decide soon (material availability, scheduling) without fake pressure.
- Email 3 (day 14): the polite close-out. "Should I keep this quote open or close it out?" - the takeaway angle that gets replies.

Each body: 2-4 sentences max, ends with the sender's first name. Subject lines under 6 words, lowercase-casual is fine.

Respond ONLY with a JSON array, no markdown fences, in this exact shape:
[{"day":3,"subject":"...","body":"..."},{"day":7,"subject":"...","body":"..."},{"day":14,"subject":"...","body":"..."}]`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();

  const seq = JSON.parse(text);
  if (!Array.isArray(seq) || seq.length !== 3) {
    throw new Error("Unexpected sequence format from model");
  }
  return seq;
}
