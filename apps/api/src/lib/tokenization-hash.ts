import { createHash } from "node:crypto";

/**
 * Hashes chip UID with optional server-side salt.
 * Never expose raw UID on-chain.
 */
export function buildChipUidHash(uidHex: string, salt?: string | null) {
  const normalizedUid = String(uidHex || "").trim().toUpperCase();
  const normalizedSalt = String(salt || process.env.TOKENIZATION_UID_SALT || "").trim();
  const digest = createHash("sha256").update(`${normalizedUid}:${normalizedSalt}`).digest("hex");
  return `sha256:${digest}`;
}
