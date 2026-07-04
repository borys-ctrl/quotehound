import { neon } from "@neondatabase/serverless";

// Lazy init so the client isn't created at build time (no env vars yet)
let _sql = null;

export function sql(strings, ...values) {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql(strings, ...values);
}
