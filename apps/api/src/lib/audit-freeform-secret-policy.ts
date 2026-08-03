const EXPLICIT_SECRET_LABEL = /(?:^|[^A-Za-z0-9_])(?:PACK[_ -]?PASSWORD|K[_ -]?META(?:[_ -]?BATCH)?|K[_ -]?FILE(?:[_ -]?BATCH)?)(?:$|[^A-Za-z0-9_])/i;
const ASSIGNED_CREDENTIAL = /(?:^|[^A-Za-z0-9_])(?:PASSWORD|PASSWD|SECRET|WEBHOOK[_ -]?SECRET|PRIVATE[_ -]?KEY|API[_ -]?KEY|TOKEN|BEARER[_ -]?TOKEN|SESSION[_ -]?TOKEN|AUTHORIZATION|COOKIE|DATABASE[_ -]?URL)\s*[:=]/i;
const URI_CREDENTIALS = /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/;
const PEM_PRIVATE_KEY = /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/i;
const HEX_SECRET = /(?:^|[^0-9A-Fa-f])(?:0x)?[0-9A-Fa-f]{32,}(?:$|[^0-9A-Fa-f])/;
const ENCODED_TOKEN = /[A-Za-z0-9+/_-]{32,}={0,2}/g;

function containsHighEntropyEncodedToken(value: string) {
  for (const match of value.matchAll(ENCODED_TOKEN)) {
    const token = match[0].replace(/=+$/, "");
    if (token.length < 32) continue;
    const characterClasses = [/[A-Z]/, /[a-z]/, /[0-9]/, /[+/_-]/]
      .filter((pattern) => pattern.test(token)).length;
    if (characterClasses >= 3 && new Set(token).size >= 16) return true;
  }
  return false;
}

/**
 * Rejects secret-bearing free-form audit text without returning, logging, or
 * otherwise reflecting any part of the supplied value.
 */
export function auditFreeformContainsSecret(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return false;
  return EXPLICIT_SECRET_LABEL.test(normalized)
    || ASSIGNED_CREDENTIAL.test(normalized)
    || URI_CREDENTIALS.test(normalized)
    || PEM_PRIVATE_KEY.test(normalized)
    || HEX_SECRET.test(normalized)
    || containsHighEntropyEncodedToken(normalized);
}

export function auditFreeformValuesAreSafe(values: readonly unknown[]) {
  return values.every((value) => !auditFreeformContainsSecret(value));
}
