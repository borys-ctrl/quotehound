-- QuoteHound v2 migration — run this ONCE in the Neon SQL editor.
-- (v1 schema in lib/schema.sql must already be applied.)

-- 1. Accounts ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,            -- login email
  password_hash TEXT NOT NULL,           -- bcrypt
  sender_name TEXT DEFAULT '',           -- "Borys"
  business_name TEXT DEFAULT '',         -- "Best Flooring Honolulu"
  business_phone TEXT DEFAULT '',
  smtp_host TEXT DEFAULT '',             -- e.g. smtp.gmail.com
  smtp_port INTEGER DEFAULT 465,
  smtp_user TEXT DEFAULT '',             -- the address follow-ups send FROM
  smtp_pass_encrypted TEXT DEFAULT '',   -- AES-256-GCM, key = APP_SECRET env
  email_verified_send BOOLEAN DEFAULT false, -- set true after a successful test send
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Scope quotes by owner --------------------------------------------------
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes (user_id);

-- 3. AFTER the owner signs up through the new /signup flow (he becomes id 1),
--    run this once to claim the pre-existing single-tenant quotes:
--
--    UPDATE quotes SET user_id = 1 WHERE user_id IS NULL;
