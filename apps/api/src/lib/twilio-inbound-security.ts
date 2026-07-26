import { createHash, timingSafeEqual } from "node:crypto";
import twilio from "twilio";

import { RequestBodyTooLargeError, readRequestTextBounded } from "./bounded-request-body";

export const MAX_TWILIO_INBOUND_BODY_BYTES = 64 * 1024;

type RuntimeEnvironment = Record<string, string | undefined>;

export type TwilioInboundVerification =
  | { ok: true; form: URLSearchParams }
  | { ok: false; status: 400 | 403 | 413; reason: "invalid_body" | "body_too_large" | "unauthorized" };

function envValue(environment: RuntimeEnvironment, name: string) {
  return String(environment[name] || "").trim().replace(/^['"]|['"]$/g, "").trim();
}

function isFalseEnv(value: string) {
  return /^(0|false|no|off)$/i.test(value.trim());
}

function isProductionRuntime(environment: RuntimeEnvironment) {
  return environment.NODE_ENV === "production" || envValue(environment, "VERCEL_ENV") === "production";
}

function isHostedRuntime(environment: RuntimeEnvironment) {
  return Boolean(envValue(environment, "VERCEL_ENV"));
}

function constantTimeSecretEqual(received: string, expected: string) {
  if (!received || !expected) return false;
  const receivedDigest = createHash("sha256").update(received, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}

function validationRequired(environment: RuntimeEnvironment) {
  if (isProductionRuntime(environment) || isHostedRuntime(environment)) return true;
  const configured = envValue(environment, "TWILIO_VALIDATE_WEBHOOKS");
  if (configured) return !isFalseEnv(configured);
  return Boolean(envValue(environment, "TWILIO_AUTH_TOKEN"));
}

function internalBypassAllowed(req: Request, environment: RuntimeEnvironment) {
  // Never allow a bypass in production. Preview/local automation gets a
  // dedicated credential instead of reusing the all-powerful admin key.
  if (isProductionRuntime(environment)) return false;
  return constantTimeSecretEqual(
    String(req.headers.get("x-nexid-internal-key") || "").trim(),
    envValue(environment, "TWILIO_INTERNAL_WEBHOOK_KEY"),
  );
}

function canonicalWebhookUrl(req: Request, environment: RuntimeEnvironment) {
  const configured = envValue(environment, "TWILIO_INBOUND_WEBHOOK_URL");
  if (!configured) return new URL(req.url).toString();
  try {
    const parsed = new URL(configured);
    if ((isProductionRuntime(environment) || isHostedRuntime(environment)) && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function formParamsObject(params: URLSearchParams) {
  const output: Record<string, string> = {};
  for (const [key, value] of params.entries()) output[key] = value;
  return output;
}

export async function readAndVerifyTwilioInbound(
  req: Request,
  options: {
    environment?: RuntimeEnvironment;
    maxBodyBytes?: number;
  } = {},
): Promise<TwilioInboundVerification> {
  const environment = options.environment || process.env;
  let rawBody: string;
  try {
    rawBody = await readRequestTextBounded(
      req,
      options.maxBodyBytes || MAX_TWILIO_INBOUND_BODY_BYTES,
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return { ok: false, status: 413, reason: "body_too_large" };
    }
    return { ok: false, status: 400, reason: "invalid_body" };
  }

  const form = new URLSearchParams(rawBody);
  if (internalBypassAllowed(req, environment)) return { ok: true, form };
  if (!validationRequired(environment)) return { ok: true, form };

  const authToken = envValue(environment, "TWILIO_AUTH_TOKEN");
  const signature = String(req.headers.get("x-twilio-signature") || "").trim();
  const webhookUrl = canonicalWebhookUrl(req, environment);
  if (!authToken || !signature || !webhookUrl) {
    return { ok: false, status: 403, reason: "unauthorized" };
  }
  try {
    if (!twilio.validateRequest(authToken, signature, webhookUrl, formParamsObject(form))) {
      return { ok: false, status: 403, reason: "unauthorized" };
    }
  } catch {
    return { ok: false, status: 403, reason: "unauthorized" };
  }
  return { ok: true, form };
}
