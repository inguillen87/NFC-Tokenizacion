import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";

function cleanEventId(value: unknown) {
  const eventId = String(value || "").trim();
  if (!/^\d+$/.test(eventId)) throw new Error("invalid certificate event id");
  return eventId;
}

function signingSecret() {
  const value = String(
    process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET
    || process.env.SUN_HANDOFF_SECRET
    || process.env.PUBLIC_DEMO_SHARE_SECRET
    || process.env.ADMIN_API_KEY
    || "",
  ).trim();
  if (!value) throw new Error("PUBLIC_CERTIFICATE_SIGNING_SECRET is not configured");
  return value;
}

function signatureFor(eventId: string) {
  return createHmac("sha256", signingSecret())
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
    const expected = createPublicCertificateShareToken(eventId);
    const left = Buffer.from(candidate);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

