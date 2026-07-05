# QuoteHound v3 — One-Click Google + PDF Intake

## Goal
Reduce contractor onboarding to a single click and quote entry to a single PDF drop. Three changes, nothing else:
1. Account creation via "Continue with Google" (replaces email+password signup for new users)
2. Gmail sending permission granted in that same OAuth consent (gmail.send scope) — no SMTP, no app passwords for Google users
3. New quote via PDF upload: Claude reads the quote, extracts the fields, contractor confirms, sequence starts

No payments. No Stripe. Keep everything else from v2 working (existing email+password accounts, SMTP path, dashboard, cron, sequences).

## Reuse from ContractFlag
The PDF upload + Claude document-parsing pipeline already exists in the owner's ContractFlag project (github.com/borys-ctrl — Next.js, plain JS, Anthropic API, sends PDF as a base64 document content block to /v1/messages). Port that pattern rather than inventing a new one: same upload handling, same document block structure, new extraction prompt.

## 1. Google OAuth (auth + sending in one flow)

### Google Cloud setup (owner does this once; include these steps in README)
1. console.cloud.google.com → New project "QuoteHound"
2. APIs & Services → Enable "Gmail API"
3. OAuth consent screen: External, app name QuoteHound, add scopes `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.send`
4. Publish status: set to **In production** (unverified is fine — do NOT leave in Testing mode, Testing expires refresh tokens after 7 days)
5. Credentials → OAuth client ID → Web application → authorized redirect URI: `https://quotehound-one.vercel.app/api/auth/google/callback` (+ http://localhost:3000/api/auth/google/callback for dev)
6. Copy Client ID + Client Secret into Vercel env vars
7. Submit for verification the same day (separate checklist; the app works while pending)

### Implementation
- No heavy auth library. Hand-rolled OAuth code flow with PKCE is fine, or use the `googleapis` npm package for token exchange only.
- `GET /api/auth/google` → redirect to Google consent (scopes above, `access_type=offline`, `prompt=consent` to guarantee a refresh token)
- `GET /api/auth/google/callback` → exchange code for tokens; then:
  - If a user with this Google email exists: log them in (set qh_session)
  - Else: create user row (google_id, email, sender_name from profile name), log in
  - Store refresh token encrypted (AES-256-GCM with APP_SECRET, same as smtp_pass_encrypted)
  - Set email_verified_send = true (send permission was just granted)
- Login page: "Continue with Google" button on top, existing email+password form below it ("or use email")
- users table migration (migration-v3.sql):
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token_encrypted TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'password'; -- 'password' | 'google'
ALTER TABLE users ADD COLUMN IF NOT EXISTS send_via TEXT DEFAULT 'smtp'; -- 'smtp' | 'gmail_api'
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expires_on DATE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT '';
```
- Password nullable problem: password_hash is NOT NULL. For Google users store an empty-string sentinel or relax the constraint in migration-v3.sql (`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;`) — pick one, be consistent, never allow login with an empty password.

## 2. Sending via Gmail API
- lib/mailer.js: add `sendViaGmailApi(user, {to, subject, body})` — refresh access token from stored refresh token, POST to Gmail API `users.me/messages/send` with base64url RFC822 message, From = user's Gmail address.
- Cron and test-send route between paths on user.send_via.
- Handle revoked tokens: on 401/invalid_grant, set email_verified_send=false and surface "Reconnect Google" state in Settings; skip that user's sends without crashing the run.
- Settings page for Google users: show "Connected as {email} via Google" + Reconnect button; hide SMTP fields.

## 3. PDF quote intake
- /new page gets two modes: "Drop quote PDF" (primary, drag-and-drop or file picker) and "Enter manually" (existing form, secondary link).
- `POST /api/quotes/parse`: accepts the PDF (limit 10 MB), sends it to Anthropic as a document content block with an extraction prompt. Model returns ONLY JSON:
```json
{"customer_name": "...", "customer_email": "... or null", "customer_phone": "... or null", "amount": 5668.38, "description": "short summary of what's quoted", "quote_date": "YYYY-MM-DD or null", "expires_on": "YYYY-MM-DD or null"}
```
- Reference format: Best Flooring Honolulu quotes contain customer name + phone + itemized products + TOTAL + quote date, and usually NO email. Description should be a human summary like "28 boxes Karndean rigid core maple + Nroro baseboards/trim" — not the full line-item dump.
- After parsing, show a REVIEW screen: all extracted fields prefilled and editable, customer_email required (highlighted if the PDF didn't contain one), then "Start chasing" runs the existing quote-creation flow (sequence generation etc.).
- Never auto-send without the review step.
- The PDF itself does not need to be stored in v3 — parse and discard (note this in README; storage is a later feature).
- Sequence generation: pass expires_on to the prompt when present ("quote pricing holds until {date}" is real urgency for email 2; if expired, do not schedule remaining emails).

## 4. Env vars (add to Vercel + .env.example)
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- (keep all existing vars)

## 5. Acceptance tests
1. New user clicks "Continue with Google" → account created, lands on dashboard, Settings shows "Connected via Google", no SMTP setup required.
2. That user drops the Paula LeBlanc reference PDF → review screen shows name "Paula LeBlanc", amount 5668.38, phone, sensible description, empty required email field → fill email → Start chasing → 3 emails generated.
3. Backdate the quote, trigger /api/cron/send → email arrives FROM the user's Gmail address (check the actual From header).
4. Existing password user (id 2) still logs in with email+password and still sends via SMTP unchanged.
5. Revoke the app's access at myaccount.google.com/permissions → next cron run does not crash; Settings shows Reconnect.
6. A Google user cannot see or modify the password user's quotes (scoping regression check).
7. npm run build passes.
