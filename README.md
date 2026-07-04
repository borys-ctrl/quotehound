# QuoteHound — v1 (single tenant, Best Flooring Honolulu)

Chases every open quote with 3 AI-written follow-up emails (day 3 / 7 / 14) sent
from your own Zoho address. Stops the moment the customer responds.

## What's deliberately NOT in v1
- No Gmail OAuth (Zoho SMTP app password instead — zero verification process)
- No Stripe / multi-tenant (add at customer #2)
- No email parsing (30-second manual form; Zoho Flow webhook later)
- No automatic reply detection (replies land in your inbox; tap "They responded")

## Setup (~30 min)

1. **Database** — create a free Postgres at neon.tech. Open the SQL editor,
   paste `lib/schema.sql`, run it. Copy the connection string.
2. **Zoho app password** — Zoho Mail → My Account → Security → App Passwords →
   generate one for "QuoteHound".
3. **Env vars** — copy `.env.example` to `.env.local`, fill everything in.
4. **Local test** — `npm install && npm run dev` → localhost:3000 → log in →
   add a test quote with YOUR email as the customer.
5. **Deploy** — push to GitHub, import to Vercel, add the same env vars in
   Vercel project settings. `vercel.json` already schedules the daily cron
   (18:00 UTC = 8:00 AM Hawaii). In Vercel, set the CRON_SECRET env var —
   Vercel automatically sends it as the Bearer token for cron jobs.
6. **Manual cron test** —
   `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourapp.vercel.app/api/cron/send`

## Daily workflow (Mirasol)
1. Send a quote from Zoho Books as usual.
2. Open QuoteHound → New quote → 5 fields → Start chasing. (~30 seconds)
3. When the customer replies in the inbox → open QuoteHound → "They responded".

## v2 backlog (only after 3+ buddies pay)
- Zoho Flow webhook: auto-create quote in QuoteHound when a Zoho Books quote is sent
- Gmail/Microsoft OAuth for external customers (start Google verification early — 3–6 weeks)
- Automatic reply detection (IMAP poll or Gmail metadata scope)
- Multi-tenant auth + Stripe credit packs (reuse ContractFlag setup)
- Weekly digest email: "You have $34,200 sitting in unanswered quotes"
