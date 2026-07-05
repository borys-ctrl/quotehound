// bcrypt password hashing. Node runtime only — kept out of lib/auth.js so the
// Edge middleware bundle (which imports auth.js for session verification) never
// pulls bcryptjs into the Edge Runtime.

import bcrypt from "bcryptjs";

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
