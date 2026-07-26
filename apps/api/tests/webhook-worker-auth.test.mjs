import assert from "node:assert/strict";
import test from "node:test";

import { authenticateWebhookWorkerRequest } from "../src/lib/webhook-worker-auth.ts";

const audience = "https://api.nexid.lat/internal/webhooks/worker";
const serviceAccount = "nexid-webhook-scheduler@nexid-security-staging.iam.gserviceaccount.com";

function request(headers = {}) {
  return new Request(audience, { method: "POST", headers });
}

function validPayload(overrides = {}) {
  return {
    aud: audience,
    email: serviceAccount,
    email_verified: true,
    iss: "https://accounts.google.com",
    ...overrides,
  };
}

function oidcEnv(overrides = {}) {
  return {
    WEBHOOK_SCHEDULER_OIDC_SERVICE_ACCOUNT_EMAIL: serviceAccount,
    WEBHOOK_SCHEDULER_OIDC_AUDIENCE: audience,
    ...overrides,
  };
}

function verifier(payload, observe = () => {}) {
  return async (input) => {
    observe(input);
    return { getPayload: () => payload };
  };
}

test("shared-secret recovery remains timing-safe and skips OIDC verification", async () => {
  let oidcCalled = false;
  const method = await authenticateWebhookWorkerRequest(
    request({ "x-internal-webhook-key": "recovery-secret" }),
    { INTERNAL_WEBHOOK_WORKER_KEY: "recovery-secret" },
    async () => {
      oidcCalled = true;
      throw new Error("must not run");
    },
  );
  assert.equal(method, "shared_secret");
  assert.equal(oidcCalled, false);

  assert.equal(await authenticateWebhookWorkerRequest(
    request({ "x-internal-webhook-key": "wrong" }),
    { INTERNAL_WEBHOOK_WORKER_KEY: "recovery-secret" },
  ), null);
});

test("Google Scheduler OIDC accepts only the configured email and audience", async () => {
  let verifiedInput;
  const method = await authenticateWebhookWorkerRequest(
    request({ authorization: "Bearer signed.jwt.token" }),
    oidcEnv(),
    verifier(validPayload(), (input) => { verifiedInput = input; }),
  );
  assert.equal(method, "oidc");
  assert.deepEqual(verifiedInput, { idToken: "signed.jwt.token", audience });

  for (const payload of [
    validPayload({ aud: "https://api.nexid.lat/" }),
    validPayload({ email: "other@nexid-security-staging.iam.gserviceaccount.com" }),
    validPayload({ email_verified: false }),
    validPayload({ iss: "https://attacker.example" }),
  ]) {
    assert.equal(await authenticateWebhookWorkerRequest(
      request({ authorization: "Bearer signed.jwt.token" }),
      oidcEnv(),
      verifier(payload),
    ), null);
  }
});

test("OIDC fails closed for malformed bearer tokens, partial config and verifier errors", async () => {
  const never = async () => { throw new Error("invalid signature"); };
  assert.equal(await authenticateWebhookWorkerRequest(request(), {}, never), null);
  assert.equal(await authenticateWebhookWorkerRequest(
    request({ authorization: "Basic signed.jwt.token" }),
    oidcEnv(),
    verifier(validPayload()),
  ), null);
  assert.equal(await authenticateWebhookWorkerRequest(
    request({ authorization: "Bearer signed.jwt.token extra" }),
    oidcEnv(),
    verifier(validPayload()),
  ), null);
  assert.equal(await authenticateWebhookWorkerRequest(
    request({ authorization: "Bearer signed.jwt.token" }),
    { WEBHOOK_SCHEDULER_OIDC_SERVICE_ACCOUNT_EMAIL: serviceAccount },
    verifier(validPayload()),
  ), null);
  assert.equal(await authenticateWebhookWorkerRequest(
    request({ authorization: "Bearer signed.jwt.token" }),
    oidcEnv({ WEBHOOK_SCHEDULER_OIDC_AUDIENCE: `${audience}?unsafe=1` }),
    verifier(validPayload()),
  ), null);
  assert.equal(await authenticateWebhookWorkerRequest(
    request({ authorization: "Bearer signed.jwt.token" }),
    oidcEnv(),
    never,
  ), null);
  assert.equal(await authenticateWebhookWorkerRequest(
    request({ authorization: "Bearer definitely-not-a-google-id-token" }),
    oidcEnv(),
  ), null);
});
