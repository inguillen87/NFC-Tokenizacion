import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

type NodeBuf = Buffer<ArrayBufferLike>;

function kmsKey(): NodeBuf {
  const hex = process.env.KMS_MASTER_KEY_HEX;
  if (!hex) throw new Error("KMS_MASTER_KEY_HEX is not set");
  const key = Buffer.from(hex, "hex") as NodeBuf;
  if (key.length !== 32) throw new Error("KMS_MASTER_KEY_HEX must be 32 bytes hex (64 chars)");
  return key;
}

export function encryptKey16(key16: Uint8Array): string {
  if (key16.length !== 16) throw new Error("key must be 16 bytes");
  const key = kmsKey();
  const iv = randomBytes(12) as NodeBuf;
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(key16), cipher.final()]) as NodeBuf;
  const tag = cipher.getAuthTag() as NodeBuf;
  return (Buffer.concat([iv, tag, ct]) as NodeBuf).toString("base64");
}

export function decryptKey16(b64: string): NodeBuf {
  const raw = Buffer.from(b64, "base64") as NodeBuf;
  const iv = raw.subarray(0, 12) as NodeBuf;
  const tag = raw.subarray(12, 28) as NodeBuf;
  const ct = raw.subarray(28) as NodeBuf;
  const decipher = createDecipheriv("aes-256-gcm", kmsKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]) as NodeBuf;
}
