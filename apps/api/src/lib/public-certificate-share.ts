import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";

function cleanEventId(value: unknown) {
  const eventId = String(value || "").trim();
  if (!/^\d+$/.test(eventId)) throw new Error("invalid certificate event id");
  return eventId;
}

function legacyFallbackEnabled() {
  return String(process.env.PUBLIC_CERTIFICATE_ALLOW_LEGACY_SECRET_FALLBACK || "").trim().toLowerCase() === "true";
}

function legacySecrets() {
  if (!legacyFallbackEnabled()) return [];
  return [process.env.SUN_HANDOFF_SECRET, process.env.PUBLIC_DEMO_SHARE_SECRET, process.env.ADMIN_API_KEY]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function signingSecret() {
  const value = String(process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET || "").trim() || legacySecrets()[0] || "";
  if (!value) throw new Error("PUBLIC_CERTIFICATE_SIGNING_SECRET is not configured");
  return value;
}

function verificationSecrets() {
  return [...new Set([
    String(process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET || "").trim(),
    String(process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET_PREVIOUS || "").trim(),
    ...legacySecrets(),
  ].filter(Boolean))];
}

function signatureFor(eventId: string, secret = signingSecret()) {
  return createHmac("sha256", secret)
    .update(`nexid:public-certificate:${TOKEN_VERSION}:${eventId}`)
    .digest("base64url");
}

export function createPublicCertificateShareToken(eventId: unknown) {
  return `${TOKEN_VERSION}.${signatureFor(cleanEventId(eventId))}`;
}

export function verifyPublicCertificateShareToken(eventId: unknown, token: unknown) {
  const candidate = String(token || "").trim();
  if (!candidate.startsWith(`${TOKEN_VERSION}.`)) return false;

  try {
    const left = Buffer.from(candidate);
    const cleanId = cleanEventId(eventId);
    return verificationSecrets().some((secret) => {
      const right = Buffer.from(`${TOKEN_VERSION}.${signatureFor(cleanId, secret)}`);
      return left.length === right.length && timingSafeEqual(left, right);
    });
  } catch {
    return false;
  }
}
