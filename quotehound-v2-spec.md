# QuoteHound v2 — Multi-Tenant Build Spec

## Goal
Convert QuoteHound from single-password to real accounts. Each user signs up, connects their own sending email, and sees only their own quotes. Existing functionality (sequence generation, daily cron, dashboard) stays identical — it just becomes per-account.

Stack stays the same: Next.js App Router, plain JavaScript (no TypeScript), Neon Postgres via @neondatabase/serverless, nodemailer, Anthropic API, deployed on Vercel. Do not add heavy frameworks. Do not add Stripe, Gmail OAuth, or PDF upload — those are explicitly out of scope for this build.

## 1. Database changes (write a migration.sql the owner runs once in Neon)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,           -- login email
  password_hash TEXT NOT NULL,          -- bcrypt
  sender_name TEXT DEFAULT '',          -- "Borys"
  business_name TEXT DEFAULT '',        -- "Best Flooring Honolulu"
  business_phone TEXT DEFAULT '',
  smtp_host TEXT DEFAULT '',            -- e.g. smtp.gmail.com
  smtp_port INTEGER DEFAULT 465,
  smtp_user TEXT DEFAULT '',            -- the address follow-ups send FROM
  smtp_pass_encrypted TEXT DEFAULT '',  -- AES-256-GCM, key = APP_SECRET env
  email_verified_send BOOLEAN DEFAULT false, -- set true after a successful test send
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE quotes ADD COLUMN user_id INTEGER REFERENCES users(id);
CREATE INDEX idx_quotes_user ON quotes (user_id);
```

Migration note: after the owner creates his own account through the new signup flow, provide a one-line SQL he runs to claim existing quotes: `UPDATE quotes SET user_id = 1 WHERE user_id IS NULL;`

## 2. Auth

- bcryptjs for password hashing (pure JS, works on Vercel).
- Session: signed, httpOnly, secure cookie containing the user id. Sign with HMAC-SHA256 using APP_SECRET. No third-party auth library needed. Cookie name: qh_session. 90-day expiry.
- Pages: /signup (email, password, confirm), /login (email, password). Both plain forms matching the existing globals.css design system (Barlow Condensed headers, IBM Plex Sans body, paper/ink palette).
- middleware.js: replace the ADMIN_PASSWORD cookie check with session verification. Public routes: /login, /signup, /api/login, /api/signup, /api/cron.
- Rate limit login attempts minimally (in-memory counter per IP is fine for now).
- Remove the old ADMIN_PASSWORD login page and env dependency.

## 3. Sender email connection (Settings page: /settings)

Each user connects the address their follow-ups send from:
- Fields: sender name, business name, business phone, email provider preset dropdown (Gmail / Zoho / Outlook / Custom) that pre-fills smtp_host and smtp_port, SMTP username (their email address), SMTP app password.
- Provider presets: Gmail = smtp.gmail.com:465, Zoho = smtp.zoho.com:465, Outlook = smtp.office365.com:587.
- Include short inline instructions per provider for generating an app password (2-3 lines each, link to provider docs).
- Encrypt smtp_pass with AES-256-GCM using APP_SECRET before storing. Never return the password to the client; show only "connected as sales@..." status.
- "Send test email" button: sends a test message to the user's own login email through their SMTP settings; on success set email_verified_send = true.
- Users cannot start chasing quotes until email_verified_send is true — the New Quote page should show a clear "Connect your sending email first" state with a link to /settings.

## 4. Scope everything by user

- /api/quotes GET/POST: filter and insert with user_id from session.
- /api/quotes/[id] PATCH: verify the quote belongs to the session user before updating.
- lib/claude.js generateSequence: pull sender_name, business_name, business_phone from the user row (not env vars).
- Dashboard: unchanged visually, but only the session user's quotes.

## 5. Cron changes (app/api/cron/send/route.js)

- Keep both auth paths: Vercel Bearer CRON_SECRET, or a logged-in session (any authenticated user may trigger a run; the run still processes all users' due emails — sends are already scoped per-quote to each quote owner's SMTP).
- Join followups → quotes → users. For each due email, build a nodemailer transporter from that user's decrypted SMTP settings and send from their address.
- Skip (leave scheduled, add to errors array) any due email whose owner has email_verified_send = false.
- Cache transporters per user within a single run.

## 6. Env vars

- ADD: APP_SECRET (long random string; used for session signing + SMTP encryption).
- KEEP: DATABASE_URL, ANTHROPIC_API_KEY, CRON_SECRET.
- REMOVE from code paths: ADMIN_PASSWORD, SMTP_HOST/PORT/USER/PASS, SENDER_NAME, BUSINESS_NAME, BUSINESS_PHONE (all now live per-user in the users table). Update .env.example accordingly.

## 7. Files expected to change or be created

- migration.sql (new)
- lib/auth.js (new: hash/verify password, sign/verify session cookie, getSessionUser helper)
- lib/crypto.js (new: AES-256-GCM encrypt/decrypt for SMTP passwords)
- lib/mailer.js (accept per-user SMTP config instead of env)
- lib/claude.js (accept user profile as argument)
- middleware.js (session check)
- app/signup/page.jsx, app/api/signup/route.js (new)
- app/login/page.jsx, app/api/login/route.js (rewrite for email+password)
- app/settings/page.jsx, app/api/settings/route.js, app/api/settings/test-send/route.js (new)
- app/api/quotes/route.js, app/api/quotes/[id]/route.js (user scoping)
- app/api/cron/send/route.js (per-user transporters)
- app/page.jsx, app/new/page.jsx (minor: settings link in header, "connect email first" state)
- README.md (update setup + Mirasol onboarding steps)

## 8. Acceptance test (do these before calling it done)

1. Sign up as user A, connect SMTP, test send succeeds.
2. Create a quote as A backdated 20 days; hit /api/cron/send; 3 emails arrive from A's address.
3. Sign up as user B in a different browser; B sees an empty dashboard (not A's quotes).
4. B without connected email cannot create a quote; after connecting, B can.
5. A cannot PATCH B's quote id via API (returns 404/403).
6. Old ADMIN_PASSWORD login no longer exists; unauthenticated users are redirected to /login.
