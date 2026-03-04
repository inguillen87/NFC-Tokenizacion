import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function kmsKey(): Buffer {
  const hex = process.env.KMS_MASTER_KEY_HEX;
  if (!hex) throw new Error("KMS_MASTER_KEY_HEX is not set");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("KMS_MASTER_KEY_HEX must be 32 bytes hex (64 chars)");
  return key;
}

export function encryptKey16(key16: Buffer): string {
  if (key16.length !== 16) throw new Error("key must be 16 bytes");
  const key = kmsKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(key16), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptKey16(b64: string): Buffer {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", kmsKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}
