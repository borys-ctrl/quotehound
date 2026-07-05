-- QuoteHound v3 migration — run this ONCE in the Neon SQL editor.
-- (v2 migration.sql must already be applied.)

-- Google-auth + sending-path columns on users -----------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token_encrypted TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'password'; -- 'password' | 'google'
ALTER TABLE users ADD COLUMN IF NOT EXISTS send_via TEXT DEFAULT 'smtp';          -- 'smtp' | 'gmail_api'

-- Google users have no password. Relax the NOT NULL constraint; login code
-- never accepts an empty password, so a NULL hash simply can't authenticate.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- New quote fields (PDF intake) --------------------------------------------
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expires_on DATE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT '';
