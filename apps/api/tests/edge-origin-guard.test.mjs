import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import {
  EDGE_ORIGIN_AUTH_HEADER,
  EDGE_ORIGIN_VERIFIED_HEADER,
  edgeOriginAllowed,
} from "../src/lib/edge-origin-guard.ts";
import { proxy } from "../src/proxy.ts";

const CURRENT_SECRET = "nexid_test_current_0123456789abcdefghijklmnopqrstuvwxyz";
const PREVIOUS_SECRET = "nexid_test_previous_0123456789abcdefghijklmnopqrstuvwxyz";
const ENV_KEYS = [
  "NEXID_EDGE_ORIGIN_ENFORCED",
  "NEXID_EDGE_ORIGIN_SECRET",
  "NEXID_EDGE_ORIGIN_SECRET_PREVIOUS",
  "NEXID_EDGE_ORIGIN_PROTECTED_HOSTS",
  "VERCEL_ENV",
  "NODE_ENV",
];

async function withEnvironment(values, run) {
  const before = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  try {
    return await run();
  } finally {
    for (const key of ENV_KEYS) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
}

function productionInput(overrides = {}) {
  return {
    path: "/public/meta",
    method: "GET",
    host: "nexid-api.vercel.app",
    provided: null,
    expected: CURRENT_SECRET,
    enforced: true,
    vercelEnvironment: "production",
    nodeEnvironment: "production",
    ...overrides,
  };
}

test("guard remains rollout-safe until enforcement is explicitly enabled", () => {
  const decision = edgeOriginAllowed(productionInput({ enforced: undefined, expected: null }));
  assert.deepEqual(decision, { allowed: true, verified: false, reason: "not_enforced" });
});

test("production and configured custom hosts fail closed on missing or invalid configuration", () => {
  assert.equal(edgeOriginAllowed(productionInput({ expected: null })).reason, "origin_secret_missing");
  assert.equal(edgeOriginAllowed(productionInput({ expected: "too-short" })).reason, "origin_secret_invalid");
  assert.equal(edgeOriginAllowed(productionInput({ enforced: "tru" })).reason, "enforcement_config_invalid");

  const customHost = edgeOriginAllowed(productionInput({
    host: "staging-api.nexid.lat:443",
    vercelEnvironment: "preview",
    protectedHosts: "staging-api.nexid.lat",
  }));
  assert.equal(customHost.allowed, false);
  assert.equal(customHost.reason, "origin_secret_mismatch");
});

test("preview and development deployments remain reachable without the origin credential", () => {
  const preview = edgeOriginAllowed(productionInput({
    host: "nexid-api-git-feature.vercel.app",
    vercelEnvironment: "preview",
    nodeEnvironment: "production",
  }));
  assert.deepEqual(preview, { allowed: true, verified: false, reason: "non_protected_runtime" });

  const development = edgeOriginAllowed(productionInput({
    host: "localhost:3003",
    vercelEnvironment: "development",
    nodeEnvironment: "development",
  }));
  assert.deepEqual(development, { allowed: true, verified: false, reason: "non_protected_runtime" });
});

test("health is the only path exemption and only for GET or HEAD", () => {
  for (const method of ["GET", "HEAD"]) {
    assert.deepEqual(
      edgeOriginAllowed(productionInput({ path: "/health", method, expected: null })),
      { allowed: true, verified: false, reason: "public_health" },
    );
  }

  for (const [path, method] of [["/health", "POST"], ["/health/", "GET"], ["/api/health", "GET"], ["/healthz", "GET"], ["/health/../admin", "GET"]]) {
    assert.equal(edgeOriginAllowed(productionInput({ path, method, expected: null })).allowed, false);
  }
});

test("all public and machine routes require the exact credential without path bypasses", () => {
  const protectedPaths = [
    "/sun",
    "/api/v1/sdk/verify",
    "/twilio/whatsapp/inbound",
    "/internal/webhooks/worker",
    "/admin/events/stream",
  ];

  for (const path of protectedPaths) {
    assert.equal(edgeOriginAllowed(productionInput({ path, provided: null })).allowed, false, path);
    assert.equal(edgeOriginAllowed(productionInput({ path, provided: ` ${CURRENT_SECRET}` })).allowed, false, path);
    assert.deepEqual(
      edgeOriginAllowed(productionInput({ path, provided: CURRENT_SECRET })),
      { allowed: true, verified: true, reason: "trusted_origin_current" },
      path,
    );
  }
});

test("a previous credential is accepted only for an explicit zero-downtime rotation window", () => {
  assert.deepEqual(
    edgeOriginAllowed(productionInput({ provided: PREVIOUS_SECRET, previousExpected: PREVIOUS_SECRET })),
    { allowed: true, verified: true, reason: "trusted_origin_previous" },
  );
  assert.equal(edgeOriginAllowed(productionInput({ provided: PREVIOUS_SECRET })).allowed, false);
  assert.equal(edgeOriginAllowed(productionInput({ provided: CURRENT_SECRET, previousExpected: "weak" })).reason, "origin_secret_previous_invalid");
});

test("real proxy blocks a direct production-origin request with a generic no-store response", async () => {
  await withEnvironment({
    NEXID_EDGE_ORIGIN_ENFORCED: "true",
    NEXID_EDGE_ORIGIN_SECRET: CURRENT_SECRET,
    VERCEL_ENV: "production",
    NODE_ENV: "production",
  }, async () => {
    const response = proxy(new NextRequest("https://nexid-api.vercel.app/public/meta"));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(response.headers.get("x-nexid-origin-guard"), "denied");
    assert.deepEqual(await response.json(), { ok: false, reason: "origin_not_allowed" });
  });
});

test("real proxy preserves trusted NFC, SDK, webhook and streaming requests and strips the credential", async () => {
  await withEnvironment({
    NEXID_EDGE_ORIGIN_ENFORCED: "true",
    NEXID_EDGE_ORIGIN_SECRET: CURRENT_SECRET,
    VERCEL_ENV: "production",
    NODE_ENV: "production",
  }, async () => {
    for (const path of ["/sun", "/api/v1/sdk/verify", "/twilio/whatsapp/inbound", "/internal/webhooks/worker", "/admin/events/stream"]) {
      const request = new NextRequest(`https://api.nexid.lat${path}`, {
        headers: {
          [EDGE_ORIGIN_AUTH_HEADER]: CURRENT_SECRET,
          [EDGE_ORIGIN_VERIFIED_HEADER]: "client-spoof",
        },
      });
      const response = proxy(request);
      assert.equal(response.headers.get("x-middleware-next"), "1", path);
      assert.equal(response.headers.get(`x-middleware-request-${EDGE_ORIGIN_AUTH_HEADER}`), null, path);
      assert.equal(response.headers.get(`x-middleware-request-${EDGE_ORIGIN_VERIFIED_HEADER}`), "1", path);
      assert.doesNotMatch(JSON.stringify(Object.fromEntries(response.headers)), new RegExp(CURRENT_SECRET), path);
    }
  });
});

test("real proxy preserves exact healthchecks and strips a spoofed trust marker in previews", async () => {
  await withEnvironment({
    NEXID_EDGE_ORIGIN_ENFORCED: "true",
    NEXID_EDGE_ORIGIN_SECRET: CURRENT_SECRET,
    VERCEL_ENV: "production",
    NODE_ENV: "production",
  }, async () => {
    const health = proxy(new NextRequest("https://nexid-api.vercel.app/health"));
    assert.equal(health.headers.get("x-middleware-next"), "1");
  });

  await withEnvironment({
    NEXID_EDGE_ORIGIN_ENFORCED: "true",
    VERCEL_ENV: "preview",
    NODE_ENV: "production",
  }, async () => {
    const preview = proxy(new NextRequest("https://nexid-api-git-feature.vercel.app/sun", {
      headers: { [EDGE_ORIGIN_VERIFIED_HEADER]: "1" },
    }));
    assert.equal(preview.headers.get("x-middleware-next"), "1");
    assert.equal(preview.headers.get(`x-middleware-request-${EDGE_ORIGIN_VERIFIED_HEADER}`), null);
  });
});

test("Cloudflare template overwrites the credential on every API path without embedding a usable secret", async () => {
  const template = JSON.parse(await readFile(
    new URL("../../../infra/waf/cloudflare-origin-auth-rule.template.json", import.meta.url),
    "utf8",
  ));
  assert.equal(template.expression, '(http.host eq "api.nexid.lat")');
  assert.equal(template.action, "rewrite");
  assert.equal(template.action_parameters.headers[EDGE_ORIGIN_AUTH_HEADER].operation, "set");
  assert.equal(template.action_parameters.headers[EDGE_ORIGIN_AUTH_HEADER].value, "__SET_AT_DEPLOY_TIME__");
  assert.doesNotMatch(template.expression, /uri\.path|health|sun|webhook|sdk/i);
  assert.ok(template.ref);
});
