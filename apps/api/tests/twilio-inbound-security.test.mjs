import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import twilio from "twilio";

import {
  MAX_TWILIO_INBOUND_BODY_BYTES,
  readAndVerifyTwilioInbound,
} from "../src/lib/twilio-inbound-security.ts";

const WEBHOOK_URL = "https://api.nexid.lat/twilio/whatsapp/inbound";
const AUTH_TOKEN = "twilio-test-auth-token";

function formRequest(params, headers = {}) {
  return new Request(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(params).toString(),
  });
}

test("Twilio inbound accepts a valid production signature over the canonical URL", async () => {
  const params = { From: "whatsapp:+5491112345678", Body: "Quiero" };
  const signature = twilio.getExpectedTwilioSignature(AUTH_TOKEN, WEBHOOK_URL, params);
  const result = await readAndVerifyTwilioInbound(formRequest(params, {
    "x-twilio-signature": signature,
  }), {
    environment: {
      NODE_ENV: "production",
      TWILIO_AUTH_TOKEN: AUTH_TOKEN,
      TWILIO_INBOUND_WEBHOOK_URL: WEBHOOK_URL,
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.form.get("From"), params.From);
});

test("Twilio inbound fails closed in production when signature or auth token is missing", async () => {
  const missingSignature = await readAndVerifyTwilioInbound(formRequest({ Body: "hola" }), {
    environment: { NODE_ENV: "production", TWILIO_AUTH_TOKEN: AUTH_TOKEN },
  });
  assert.deepEqual(missingSignature, { ok: false, status: 403, reason: "unauthorized" });

  const flagCannotDisableProduction = await readAndVerifyTwilioInbound(formRequest({ Body: "hola" }), {
    environment: { NODE_ENV: "production", TWILIO_VALIDATE_WEBHOOKS: "false" },
  });
  assert.deepEqual(flagCannotDisableProduction, { ok: false, status: 403, reason: "unauthorized" });

  const previewCannotDisableValidation = await readAndVerifyTwilioInbound(formRequest({ Body: "hola" }), {
    environment: { VERCEL_ENV: "preview", TWILIO_VALIDATE_WEBHOOKS: "false" },
  });
  assert.deepEqual(previewCannotDisableValidation, { ok: false, status: 403, reason: "unauthorized" });
});

test("Twilio inbound rejects oversized bodies based on actual bytes", async () => {
  const request = new Request(WEBHOOK_URL, {
    method: "POST",
    body: "x".repeat(MAX_TWILIO_INBOUND_BODY_BYTES + 1),
  });
  const result = await readAndVerifyTwilioInbound(request, {
    environment: { NODE_ENV: "production", TWILIO_AUTH_TOKEN: AUTH_TOKEN },
  });
  assert.deepEqual(result, { ok: false, status: 413, reason: "body_too_large" });
});

test("Twilio preview bypass uses a dedicated constant-time credential and never ADMIN_API_KEY", async () => {
  const accepted = await readAndVerifyTwilioInbound(formRequest({ Body: "test" }, {
    "x-nexid-internal-key": "dedicated-preview-key",
  }), {
    environment: {
      NODE_ENV: "test",
      TWILIO_INTERNAL_WEBHOOK_KEY: "dedicated-preview-key",
      TWILIO_VALIDATE_WEBHOOKS: "true",
    },
  });
  assert.equal(accepted.ok, true);

  const rejected = await readAndVerifyTwilioInbound(formRequest({ Body: "test" }, {
    "x-nexid-internal-key": "admin-key",
  }), {
    environment: {
      NODE_ENV: "test",
      ADMIN_API_KEY: "admin-key",
      TWILIO_VALIDATE_WEBHOOKS: "true",
    },
  });
  assert.deepEqual(rejected, { ok: false, status: 403, reason: "unauthorized" });

  const source = readFileSync(new URL("../src/lib/twilio-inbound-security.ts", import.meta.url), "utf8");
  assert.match(source, /timingSafeEqual/u);
  assert.doesNotMatch(source, /ADMIN_API_KEY/u);
});

test("Twilio route orders source limit, bounded verification, authenticated limit, then schema work", () => {
  const source = readFileSync(new URL("../src/app/twilio/whatsapp/inbound/route.ts", import.meta.url), "utf8");
  const sourceLimit = source.indexOf("enforceWebhookAuthenticationRateLimit(req)");
  const verification = source.indexOf("readAndVerifyTwilioInbound(req)");
  const authenticatedLimit = source.indexOf("enforceCriticalRateLimit(req");
  const schema = source.indexOf("ensureConsumerPortalSchema()", verification);
  assert.ok(sourceLimit >= 0 && sourceLimit < verification);
  assert.ok(verification < authenticatedLimit);
  assert.ok(authenticatedLimit < schema);
});
