# QuoteHound — v3 (one-click Google + PDF intake)

Chases every open quote with 3 AI-written follow-up emails (day 3 / 7 / 14),
sent from each user's own email address. Stops the moment the customer responds.

Two ways to onboard:
- **Continue with Google** — one click creates the account *and* grants Gmail
  sending permission (no SMTP, no app password).
- **Email + password** — the v2 path, still fully supported; connect SMTP on
  Settings.

New quotes can be created by **dropping the quote PDF** (Claude reads it and you
confirm) or by entering the fields manually. Each user sees only their own quotes.

## What's deliberately NOT in v3
- No payments / Stripe
- No PDF storage (the PDF is parsed for fields, then discarded — storage is a later feature)
- No automatic reply detection (replies land in the sender's inbox; tap "They responded")

## Stack
Next.js App Router · plain JavaScript · Neon Postgres (`@neondatabase/serverless`)
· nodemailer (SMTP) · Gmail API (Google users) · Anthropic API · Vercel.

## Setup

1. **Database** — create a free Postgres at neon.tech. In the SQL editor, run in
   order:
   - `lib/schema.sql` (base `quotes` + `followups`)
   - `migration.sql` (v2: `users`, `quotes.user_id`)
   - `migration-v3.sql` (v3: Google columns, `quotes.expires_on` + `customer_phone`)
2. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL`, `ANTHROPIC_API_KEY`
   - `APP_SECRET` — long random string (`openssl rand -base64 48`). Signs session
     cookies and encrypts stored SMTP passwords **and Google refresh tokens**.
     **Don't rotate it after users connect** — it can't decrypt existing secrets if you do.
   - `CRON_SECRET` — Vercel sends this as the Bearer token for the daily cron.
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — from the Google Cloud setup below.
3. **Run** — `npm install && npm run dev` → http://localhost:3000
4. **Deploy** — push to GitHub, import to Vercel, add the same env vars. `vercel.json`
   schedules the daily cron (18:00 UTC = 8:00 AM Hawaii).
5. **Manual cron test** —
   `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourapp.vercel.app/api/cron/send`

## Google Cloud setup (owner does this once)
1. console.cloud.google.com → **New project** "QuoteHound".
2. **APIs & Services → Enable "Gmail API"**.
3. **OAuth consent screen**: User type **External**; app name QuoteHound; add
   scopes `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.send`.
4. **Publishing status → In production** (unverified is fine to launch — do NOT
   leave it in *Testing*, which expires refresh tokens after 7 days).
5. **Credentials → Create OAuth client ID → Web application**. Authorized redirect URIs:
   - `https://quotehound-one.vercel.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback` (dev)
6. Copy the **Client ID** + **Client Secret** into Vercel env vars (and `.env.local`).
7. Submit for verification the same day — the app works while the request is pending.

The redirect URI is derived from the request origin at runtime, so the same code
works on localhost and production as long as both URIs are registered.

## Sending paths
- **Google users** — follow-ups send through the Gmail API from the user's Gmail
  address, using the refresh token captured at consent (stored AES-256-GCM
  encrypted). `email_verified_send` is set true at sign-in — no test send needed.
  If access is later revoked, the next send demotes the user and Settings shows
  **Reconnect Google**.
- **Password users** — SMTP via nodemailer. Pick a provider preset (Gmail / Zoho /
  Outlook / Custom), enter the sending address + an **app-specific password**
  (encrypted at rest), then **Send test email** to unlock quote creation.
  Presets: Gmail `smtp.gmail.com:465`, Zoho `smtp.zoho.com:465`, Outlook `smtp.office365.com:587`.

## PDF quote intake
On **New quote**, drop a quote PDF (≤ 10 MB). It's sent to Claude as a document
block; the model returns the customer name, phone, amount, a short description,
quote date, and any "pricing holds until" date. You land on a **review screen**
with everything prefilled and editable — customer email is required and
highlighted if the PDF didn't contain one (Best Flooring quotes usually don't).
Nothing sends until you confirm with **Start chasing**. The PDF is discarded
after parsing (not stored in v3). If a "pricing holds until" date is set,
follow-ups that would land after it aren't scheduled.

## Owner migration (claiming the old single-tenant quotes)
After the owner signs in (he becomes user id 1), run once in Neon:

```sql
UPDATE quotes SET user_id = 1 WHERE user_id IS NULL;
```

## Onboarding a new user
1. Send them the app URL → **Continue with Google** (one click; sending is ready
   immediately). Or **email + password** → Settings → connect SMTP → test send.
2. **New quote** → drop the quote PDF → review the fields → **Start chasing**.
3. When a customer replies in their inbox → open QuoteHound → **They responded**.

## Daily workflow
1. Send a quote to a customer as usual.
2. QuoteHound → New quote → drop the PDF (or type it) → review → Start chasing.
3. Customer replies → mark **They responded** (stops the sequence).

The cron job at 8:00 AM Hawaii sends any follow-ups due that day, each from its
own quote owner's connected address (Gmail API or SMTP).
