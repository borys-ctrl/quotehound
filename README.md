# QuoteHound — v2 (multi-tenant)

Chases every open quote with 3 AI-written follow-up emails (day 3 / 7 / 14),
sent from each user's own email address. Stops the moment the customer responds.

Every user signs up for their own account, connects their own sending email,
and sees only their own quotes.

## What's deliberately NOT in v2
- No Gmail OAuth (users connect SMTP with an app password instead)
- No Stripe / billing
- No PDF / email parsing (30-second manual form)
- No automatic reply detection (replies land in the sender's inbox; tap "They responded")

## Stack
Next.js App Router · plain JavaScript · Neon Postgres (`@neondatabase/serverless`)
· nodemailer · Anthropic API · Vercel.

## Setup

1. **Database** — create a free Postgres at neon.tech. In the SQL editor:
   - First-time database: run `lib/schema.sql` (creates `quotes` + `followups`).
   - Then run `migration.sql` (creates `users`, adds `quotes.user_id`).
2. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL`, `ANTHROPIC_API_KEY`
   - `APP_SECRET` — a long random string (`openssl rand -base64 48`). Signs
     session cookies and encrypts stored SMTP passwords. **Don't rotate it after
     users connect email** — it can't decrypt existing SMTP passwords if you do.
   - `CRON_SECRET` — Vercel sends this as the Bearer token for the daily cron.
3. **Run** — `npm install && npm run dev` → http://localhost:3000
   - Sign up, then connect a sending email on **Settings** and hit **Send test
     email**. You can't create quotes until the test send succeeds.
4. **Deploy** — push to GitHub, import to Vercel, add the same env vars in the
   Vercel project settings. `vercel.json` schedules the daily cron
   (18:00 UTC = 8:00 AM Hawaii).
5. **Manual cron test** —
   `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourapp.vercel.app/api/cron/send`

## Connecting a sending email (Settings page)
Pick a provider preset (Gmail / Zoho / Outlook / Custom) — it pre-fills host and
port. Enter the sending address as the SMTP username and an **app-specific
password** (not your normal login password). Presets:
- Gmail — `smtp.gmail.com:465`
- Zoho — `smtp.zoho.com:465`
- Outlook — `smtp.office365.com:587`

The password is encrypted (AES-256-GCM) before storage and never returned to the
browser. "Send test email" delivers a test to your own login address and, on
success, unlocks quote creation.

## Owner migration (claiming the old single-tenant quotes)
The v1 install had quotes with no owner. After the owner signs up through
`/signup` (he becomes user id 1), run once in Neon:

```sql
UPDATE quotes SET user_id = 1 WHERE user_id IS NULL;
```

## Onboarding a new user (e.g. Mirasol)
1. Send them the app URL → **Sign up**.
2. **Settings** → pick their email provider → paste an app password → **Send
   test email** until it succeeds.
3. **New quote** → 5 fields → **Start chasing**. QuoteHound writes and schedules
   the three follow-ups, sent from their address.
4. When a customer replies in their inbox → open QuoteHound → **They responded**.

## Daily workflow
1. Send a quote to a customer as usual.
2. QuoteHound → New quote → 5 fields → Start chasing (~30 seconds).
3. Customer replies → mark **They responded** (stops the sequence).

The cron job at 8:00 AM Hawaii sends any follow-ups due that day, each from its
own quote owner's connected address.
