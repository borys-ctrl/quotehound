// AES-256-GCM encryption for SMTP passwords at rest.
// Key is derived from APP_SECRET (any length) via SHA-256 -> 32 bytes.
// Stored format: "<ivB64>:<tagB64>:<ciphertextB64>". Node runtime only.

import crypto from "crypto";

function key() {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set");
  return crypto.createHash("sha256").update(secret).digest(); // 32 bytes
}

export function encrypt(plaintext) {
  if (plaintext == null || plaintext === "") return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(stored) {
  if (!stored) return "";
  const parts = String(stored).split(":");
  if (parts.length !== 3) throw new Error("Malformed ciphertext");
  const [ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
