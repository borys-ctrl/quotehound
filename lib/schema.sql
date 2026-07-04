-- Run this once in the Neon SQL editor

CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT DEFAULT '',
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active', -- active | responded | paused | exhausted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS followups (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,            -- 1, 2, 3
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  send_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | sent | canceled
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_followups_due ON followups (status, send_on);
