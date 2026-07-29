import { createHash, randomBytes } from "node:crypto";

export const WEBHOOK_SECRET_OVERLAP_MIN_SECONDS = 5 * 60;
export const WEBHOOK_SECRET_OVERLAP_DEFAULT_SECONDS = 60 * 60;
export const WEBHOOK_SECRET_OVERLAP_MAX_SECONDS = 24 * 60 * 60;

export function generateWebhookSigningSecret() {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function webhookSecretFingerprint(secret: string) {
  const digest = createHash("sha256").update(String(secret || ""), "utf8").digest("hex");
  return `sha256:${digest.slice(0, 32)}`;
}

export function normalizeWebhookSecretOverlapSeconds(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return WEBHOOK_SECRET_OVERLAP_DEFAULT_SECONDS;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return null;
  if (parsed < WEBHOOK_SECRET_OVERLAP_MIN_SECONDS || parsed > WEBHOOK_SECRET_OVERLAP_MAX_SECONDS) return null;
  return parsed;
}
