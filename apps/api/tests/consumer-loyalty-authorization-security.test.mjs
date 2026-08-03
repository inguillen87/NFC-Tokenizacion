import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiRoot = new URL("../", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, apiRoot), "utf8");
}

const {
  consumerSessionTokenFromRequest,
  deleteConsumerAccountAndRevokeSessions,
  getConsumerFromRequest,
  isConsumerSessionAccountActive,
  revokeConsumerSessionFromRequest,
} = await import("../src/lib/consumer-auth.ts");
const {
  consumerMutationOriginDecision,
  enforceConsumerMutationOrigin,
} = await import("../src/lib/consumer-mutation-origin.ts");
const { installEphemeralE2eSqlExecutor } = await import("../src/lib/db.ts");

const mutationOrigins = {
  allowedOrigins: ["https://nexid.lat", "https://api.nexid.lat"],
  nodeEnvironment: "production",
  vercelEnvironment: "production",
};

function mutationRequest(origin, fetchSite = "same-site", extraHeaders = {}) {
  return new Request("https://api.nexid.lat/consumer/auth/logout", {
    method: "POST",
    headers: {
      ...(origin === undefined ? {} : { origin }),
      ...(fetchSite === undefined ? {} : { "sec-fetch-site": fetchSite }),
      cookie: `nexid_consumer_session=${"c3".repeat(24)}`,
      ...extraHeaders,
    },
  });
}

test("consumer session cookies are parsed exactly and account status fails closed", () => {
  const token = "a1".repeat(24);
  assert.equal(consumerSessionTokenFromRequest(new Request("https://api.nexid.test", {
    headers: { cookie: `other=x; nexid_consumer_session=${token}; theme=dark` },
  })), token);
  assert.equal(consumerSessionTokenFromRequest(new Request("https://api.nexid.test", {
    headers: { cookie: `evilnexid_consumer_session=${token}` },
  })), null);
  assert.equal(consumerSessionTokenFromRequest(new Request("https://api.nexid.test", {
    headers: { cookie: "nexid_consumer_session=%E0%A4%A" },
  })), null);
  assert.equal(consumerSessionTokenFromRequest(new Request("https://api.nexid.test", {
    headers: { cookie: "nexid_consumer_session=short" },
  })), null);

  for (const status of ["anonymous", "registered", "verified"]) {
    assert.equal(isConsumerSessionAccountActive(status), true);
  }
  for (const status of ["blocked", "deleted", "disabled", "", null, "future_status"]) {
    assert.equal(isConsumerSessionAccountActive(status), false);
  }
});

test("consumer cookie mutations require an exact canonical Origin and reject hostile same-site subdomains", () => {
  assert.deepEqual(
    consumerMutationOriginDecision(mutationRequest("https://nexid.lat"), mutationOrigins),
    { allowed: true, reason: "configured_origin", origin: "https://nexid.lat" },
  );
  assert.deepEqual(
    consumerMutationOriginDecision(mutationRequest("https://api.nexid.lat", "same-origin"), mutationOrigins),
    { allowed: true, reason: "configured_origin", origin: "https://api.nexid.lat" },
  );

  for (const request of [
    mutationRequest("https://evil.nexid.lat", "same-site"),
    mutationRequest("https://attacker.example", "cross-site"),
    mutationRequest("null", "cross-site"),
    mutationRequest(undefined, "same-origin"),
    mutationRequest(undefined, undefined),
    mutationRequest("https://nexid.lat/path", "same-site"),
    mutationRequest("https://nexid.lat", "cross-site"),
  ]) {
    assert.equal(consumerMutationOriginDecision(request, mutationOrigins).allowed, false);
    const denied = enforceConsumerMutationOrigin(request, mutationOrigins);
    assert.equal(denied?.status, 403);
  }

  const spoofedHost = mutationRequest("https://evil.nexid.lat", "same-site", {
    host: "nexid.lat",
    "x-forwarded-host": "nexid.lat",
  });
  assert.equal(consumerMutationOriginDecision(spoofedHost, mutationOrigins).allowed, false);
});

test("logout and privacy deletion enforce the centralized origin guard before session state changes", async () => {
  const [logout, deletion, webProxy] = await Promise.all([
    source("src/app/consumer/auth/logout/route.ts"),
    source("src/app/consumer/privacy/delete-request/route.ts"),
    source("../web/src/app/api/_lib/runtime-proxy.ts"),
  ]);

  const logoutGuard = logout.indexOf("enforceConsumerMutationOrigin(req)");
  assert.ok(logoutGuard >= 0 && logout.indexOf("enforceCriticalRateLimit", logoutGuard) > logoutGuard);
  assert.ok(logout.indexOf("revokeConsumerSessionFromRequest(req)", logoutGuard) > logoutGuard);

  const deletionGuard = deletion.indexOf("enforceConsumerMutationOrigin(req)");
  assert.ok(deletionGuard >= 0 && deletion.indexOf("getConsumerFromRequest(req)", deletionGuard) > deletionGuard);
  assert.ok(deletion.indexOf("deleteConsumerAccountAndRevokeSessions", deletionGuard) > deletionGuard);

  assert.match(webProxy, /if \(origin\) headers\.origin = origin/);
  assert.match(webProxy, /if \(fetchSite\) headers\["sec-fetch-site"\] = fetchSite/);
  assert.doesNotMatch(webProxy, /headers\.origin\s*=\s*new URL\(req\.url\)\.origin/);
});

test("member lookup, preferences and deletion bind the path member to the authenticated consumer", async () => {
  const [lookup, preferences, deletion, loyalty] = await Promise.all([
    source("src/app/mobile/loyalty/member/[memberId]/route.ts"),
    source("src/app/mobile/loyalty/member/[memberId]/preferences/route.ts"),
    source("src/app/mobile/loyalty/member/[memberId]/data-request/route.ts"),
    source("src/lib/loyalty-service.ts"),
  ]);

  for (const [route, sink] of [
    [lookup, "getLoyaltyMemberById"],
    [preferences, "updateLoyaltyMemberPreferences"],
    [deletion, "requestLoyaltyMemberDataDeletion"],
  ]) {
    const auth = route.indexOf("getConsumerFromRequest(req)");
    const sinkCall = route.indexOf(`${sink}({`);
    assert.ok(auth >= 0 && sinkCall > auth, `${sink} must run after consumer authentication`);
    assert.match(route, /consumerId:\s*consumer\.id/);
    assert.match(route, /if \(!consumer\) return json\(\{ ok: false, error: "unauthorized" \}, 401\)/);
  }

  for (const mutation of [preferences, deletion]) {
    assert.match(mutation, /enforceCriticalRateLimit/);
    assert.match(mutation, /readBoundedJsonBody/);
  }

  assert.match(loyalty, /WHERE m\.id = \$\{input\.memberId\}[\s\S]*AND m\.consumer_id = \$\{input\.consumerId\}/);
  assert.match(loyalty, /WHERE id = \$\{input\.memberId\}[\s\S]*AND consumer_id = \$\{input\.consumerId\}/);
  assert.ok((loyalty.match(/AND consumer_id = \$\{input\.consumerId\}/g) || []).length >= 2);
});

test("claim-tap derives membership server-side and consumes a fresh event-bound capability before award", async () => {
  const route = await source("src/app/mobile/passport/[eventId]/loyalty/claim-tap/route.ts");
  const auth = route.indexOf("getConsumerFromRequest(req)");
  const event = route.indexOf("getTapEvent(eventId)");
  const capability = route.indexOf("consumeSunFreshHandoff(req, body");
  const memberLookup = route.indexOf("FROM loyalty_members");
  const award = route.indexOf("await awardPoints({");

  assert.ok(auth >= 0 && event > auth && capability > event && memberLookup > capability && award > memberLookup);
  assert.match(route, /tenant_id = \$\{event\.tenant_id\}[\s\S]*program_id = \$\{program\.id\}[\s\S]*consumer_id = \$\{consumer\.id\}/);
  assert.match(route, /idempotencyKey: `tap:\$\{event\.id\}:member:\$\{member\.id\}`/);
  assert.match(route, /readBoundedJsonBody/);
  assert.match(route, /enforceCriticalRateLimit/);
  assert.doesNotMatch(route, /body\.member(?:Id|Key)|body\[\s*["']member(?:Id|Key)/);
});

test("reward redemption derives membership server-side and debits points, stock and receipt atomically", async () => {
  const [route, loyalty] = await Promise.all([
    source("src/app/mobile/passport/[eventId]/loyalty/rewards/[rewardId]/redeem/route.ts"),
    source("src/lib/loyalty-service.ts"),
  ]);
  const auth = route.indexOf("getConsumerFromRequest(req)");
  const capability = route.indexOf("consumeSunFreshHandoff(req, body");
  const memberLookup = route.indexOf("FROM loyalty_members");
  const redeem = route.indexOf("await redeemReward({");

  assert.ok(auth >= 0 && capability > auth && memberLookup > capability && redeem > memberLookup);
  assert.match(route, /tenant_id = \$\{event\.tenant_id\}[\s\S]*program_id = \$\{program\.id\}[\s\S]*consumer_id = \$\{consumer\.id\}/);
  assert.doesNotMatch(route, /body\.memberId|body\[\s*["']memberId/);
  assert.match(route, /readBoundedJsonBody/);
  assert.match(route, /enforceCriticalRateLimit/);

  const redeemService = loyalty.slice(loyalty.indexOf("export async function redeemReward"));
  assert.match(redeemService, /WITH locked AS MATERIALIZED/);
  assert.match(redeemService, /reserved_ledger AS MATERIALIZED/);
  assert.match(redeemService, /updated_member AS MATERIALIZED/);
  assert.match(redeemService, /updated_reward AS MATERIALIZED/);
  assert.match(redeemService, /inserted_redemption AS/);
  assert.match(redeemService, /ON CONFLICT \(idempotency_key\) DO NOTHING/);
});

test("logout and account deletion revoke sessions server-side and the resolver rejects revoked or deleted principals", async () => {
  const [auth, runtimeSchema, logout, deletion, migration] = await Promise.all([
    source("src/lib/consumer-auth.ts"),
    source("src/lib/commercial-runtime-schema.ts"),
    source("src/app/consumer/auth/logout/route.ts"),
    source("src/app/consumer/privacy/delete-request/route.ts"),
    source("db/migrations/20260802170000_0082_consumer_session_revocation.sql"),
  ]);

  assert.match(migration, /ALTER TABLE consumer_sessions[\s\S]*ADD COLUMN IF NOT EXISTS revoked_at timestamptz/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_consumer_sessions_active[\s\S]*WHERE revoked_at IS NULL/);
  assert.match(runtimeSchema, /ALTER TABLE consumer_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz/);

  assert.match(auth, /WHERE s\.session_token_hash = \$\{sha\(token\)\}[\s\S]*AND s\.expires_at >= now\(\)[\s\S]*AND s\.revoked_at IS NULL[\s\S]*AND c\.status IN \('anonymous', 'registered', 'verified'\)/);
  assert.match(auth, /UPDATE consumer_sessions[\s\S]*WHERE session_token_hash = \$\{sha\(token\)\}[\s\S]*AND revoked_at IS NULL/);
  assert.match(auth, /WITH deleted_consumer AS MATERIALIZED[\s\S]*revoked_sessions AS MATERIALIZED[\s\S]*session\.consumer_id = \$\{consumerId\}/);

  const logoutRevocation = logout.indexOf("await revokeConsumerSessionFromRequest(req)");
  const logoutSuccess = logout.lastIndexOf("JSON.stringify({ ok: true }");
  assert.ok(logoutRevocation >= 0 && logoutSuccess > logoutRevocation);
  assert.match(logout, /session_revocation_unavailable/);
  assert.match(logout, /status: 503/);
  const logoutFailure = logout.slice(logout.indexOf("session_revocation_unavailable"), logoutSuccess);
  assert.doesNotMatch(logoutFailure, /set-cookie/, "a failed revocation must preserve the cookie so the caller can retry");

  const deleteAuth = deletion.indexOf("getConsumerFromRequest(req)");
  const deleteRevocation = deletion.indexOf("await deleteConsumerAccountAndRevokeSessions");
  const deleteSuccess = deletion.lastIndexOf("delete_requested");
  assert.ok(deleteAuth >= 0 && deleteRevocation > deleteAuth && deleteSuccess > deleteRevocation);
  assert.match(deletion, /account_deletion_unavailable/);
  assert.match(deletion, /sessionCookieHeader\(null\)/);
});

test("the real consumer auth helper rejects unsafe session rows and persists revocation without exposing the token", async () => {
  const token = "b2".repeat(24);
  const request = new Request("https://api.nexid.test/consumer/session", {
    headers: { cookie: `nexid_consumer_session=${token}` },
  });
  let resolvedRow = {
    id: "00000000-0000-0000-0000-000000000111",
    status: "registered",
    session_revoked_at: null,
  };
  const businessCalls = [];
  const removeExecutor = installEphemeralE2eSqlExecutor(async (strings, ...values) => {
    const statement = strings.join("?");
    if (statement.includes("FROM consumer_sessions s")) {
      businessCalls.push({ kind: "resolve", values });
      return [resolvedRow];
    }
    if (/^\s*UPDATE consumer_sessions\s+SET revoked_at/m.test(statement)) {
      businessCalls.push({ kind: "revoke", values });
      return [{ id: "00000000-0000-0000-0000-000000000222", consumer_id: resolvedRow.id }];
    }
    if (statement.includes("WITH deleted_consumer AS MATERIALIZED")) {
      businessCalls.push({ kind: "delete", values });
      return [{ consumer_id: resolvedRow.id, revoked_session_count: 3 }];
    }
    return [];
  }, {
    NODE_ENV: "test",
    VERCEL_ENV: "test",
    NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",
    NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:test-only@localhost/nexid_e2e_consumer_sessions",
  });

  try {
    assert.equal((await getConsumerFromRequest(request))?.id, resolvedRow.id);

    resolvedRow = { ...resolvedRow, status: "deleted" };
    assert.equal(await getConsumerFromRequest(request), null);

    resolvedRow = { ...resolvedRow, status: "registered", session_revoked_at: new Date().toISOString() };
    assert.equal(await getConsumerFromRequest(request), null);

    const revoked = await revokeConsumerSessionFromRequest(request);
    assert.deepEqual(revoked, { revoked: true });
    const revokedCall = businessCalls.find((call) => call.kind === "revoke");
    assert.ok(revokedCall);
    assert.equal(revokedCall.values.includes(token), false, "raw session token must not reach SQL");
    assert.match(String(revokedCall.values[0] || ""), /^[a-f0-9]{64}$/);

    const deleted = await deleteConsumerAccountAndRevokeSessions(resolvedRow.id);
    assert.deepEqual(deleted, { consumerId: resolvedRow.id, revokedSessionCount: 3 });
    assert.equal(businessCalls.some((call) => call.kind === "delete"), true);
  } finally {
    removeExecutor();
  }
});
