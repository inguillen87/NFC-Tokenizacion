import { createHash, timingSafeEqual } from "node:crypto";

import { OAuth2Client } from "google-auth-library";

const GOOGLE_SERVICE_ACCOUNT_ISSUER = "https://accounts.google.com";
const WEBHOOK_WORKER_PATH = "/internal/webhooks/worker";

type Env = Record<string, string | undefined>;

type VerifiedIdTokenPayload = {
  aud?: string;
  email?: string;
  email_verified?: boolean;
  iss?: string;
};

type IdTokenVerifier = (input: {
  idToken: string;
  audience: string;
}) => Promise<{ getPayload(): VerifiedIdTokenPayload | undefined }>;

export type WebhookWorkerAuthMethod = "oidc" | "shared_secret";

const oidcClient = new OAuth2Client();

const verifyGoogleIdToken: IdTokenVerifier = (input) => oidcClient.verifyIdToken(input);

function secretMatches(provided: string, expected: string) {
  if (!provided || !expected) return false;
  const left = createHash("sha256").update(provided, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

function expectedOidcIdentity(env: Env) {
  const email = String(env.WEBHOOK_SCHEDULER_OIDC_SERVICE_ACCOUNT_EMAIL || "").trim();
  const audience = String(env.WEBHOOK_SCHEDULER_OIDC_AUDIENCE || "").trim();
  if (!email || !audience) return null;
  if (email !== email.toLowerCase() || !email.endsWith(".iam.gserviceaccount.com")) return null;

  try {
    const url = new URL(audience);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.search
      || url.hash
      || url.pathname !== WEBHOOK_WORKER_PATH
    ) return null;
  } catch {
    return null;
  }

  return { audience, email };
}

function bearerToken(req: Request) {
  const header = String(req.headers.get("authorization") || "").trim();
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  return match?.[1] || null;
}

/**
 * Authenticates the webhook outbox worker before rate limiting, body parsing,
 * database access, or tenant-controlled egress. A legacy shared secret remains
 * available for controlled recovery, while Google-signed Scheduler ID tokens
 * are restricted to one exact service-account email and one exact audience.
 */
export async function authenticateWebhookWorkerRequest(
  req: Request,
  env: Env = process.env,
  verifyIdToken: IdTokenVerifier = verifyGoogleIdToken,
): Promise<WebhookWorkerAuthMethod | null> {
  const expectedSecret = String(env.INTERNAL_WEBHOOK_WORKER_KEY || "").trim();
  const providedSecret = String(req.headers.get("x-internal-webhook-key") || "").trim();
  if (secretMatches(providedSecret, expectedSecret)) return "shared_secret";

  const identity = expectedOidcIdentity(env);
  const token = bearerToken(req);
  if (!identity || !token) return null;

  try {
    const ticket = await verifyIdToken({ idToken: token, audience: identity.audience });
    const payload = ticket.getPayload();
    if (!payload) return null;
    if (payload.iss !== GOOGLE_SERVICE_ACCOUNT_ISSUER) return null;
    if (payload.aud !== identity.audience) return null;
    if (payload.email !== identity.email || payload.email_verified !== true) return null;
    return "oidc";
  } catch {
    return null;
  }
}
