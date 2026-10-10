import assert from "node:assert/strict";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import test from "node:test";
import ts from "typescript";
import { verificationHarness, loadConsumerVerification, CHALLENGE_IDS, EMAIL, PHONE, CODE, MAGIC, sha } from "./consumer-auth-verification-fixture.mjs";

// Synthetic fixtures only. Dependencies reject any unexpected SQL or network.
const IP = "198.51.100.42", CONSUMER_ID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const meta = { ip: IP, userAgent: "synthetic-audit-privacy-user-agent" };
const auditEntries = logs => logs.filter(args => args[0] === "[consumer_auth_audit]").map(args => JSON.parse(args[1]));
function assertPrivate(logs, extra = []) {
  const text = JSON.stringify(logs);
  for (const value of [EMAIL, PHONE, IP, CONSUMER_ID, CODE, MAGIC, meta.userAgent, ...CHALLENGE_IDS, ...extra]) assert.equal(text.includes(value), false, "raw synthetic private fixture must not enter logs");
  for (const entry of auditEntries(logs)) {
    for (const key of ["contact", "ip", "consumerId", "token", "code", "sessionToken", "challengeId", "sessionId", "sun", "signature", "userAgent"]) assert.equal(Object.hasOwn(entry, key), false);
    assert.match(entry.at, /^\d{4}-\d{2}-\d{2}T/);
  }
}

for (const mode of ["otp", "magic"]) {
  test(`${mode} success logs only correlation hashes while preserving the account/session response`, async () => {
    const h = verificationHarness();
    h.state.consumer = { id: CONSUMER_ID, email: EMAIL, phone: PHONE, status: "registered" };
    const result = mode === "otp" ? await h.auth.verifyConsumerAuth(EMAIL, CODE, meta) : await h.auth.verifyConsumerAuthToken(MAGIC, meta);
    assert.equal(result.ok, true); assert.equal(result.consumer.id, CONSUMER_ID); assert.match(result.sessionToken, /^[a-f0-9]{48}$/); assert.equal(h.state.sessions, 1);
    const entry = auditEntries(h.logs).at(-1);
    assert.equal(entry.event, mode === "otp" ? "consumer_auth_verify_ok" : "consumer_auth_token_verify_ok");
    assert.equal(entry.ipHash, sha(IP).slice(0, 16)); assert.equal(entry.consumerHash, sha(CONSUMER_ID).slice(0, 16)); assert.equal(entry.linkedContacts, 2);
    if (mode === "otp") assert.equal(entry.contactHash, sha(EMAIL).slice(0, 16));
    assertPrivate(h.logs, [result.sessionToken]);
  });
  for (const [reason, rateResult] of [["unavailable", { unavailable: true }], ["rate_limited", { limited: true }]]) {
    test(`${mode} ${reason} retains its response and diagnostic without raw contact/IP`, async () => {
      const h = verificationHarness({ rateResult });
      const result = mode === "otp" ? await h.auth.verifyConsumerAuth(PHONE, CODE, meta) : await h.auth.verifyConsumerAuthToken(MAGIC, meta);
      assert.deepEqual(result, { ok: false, error: reason }); assert.equal(h.state.queries.length, 0); assert.equal(h.state.sessions, 0);
      const entry = auditEntries(h.logs).at(-1); assert.equal(entry.reason, reason); assert.equal(entry.ipHash, sha(IP).slice(0, 16));
      if (mode === "otp") assert.equal(entry.contactHash, sha(PHONE).slice(0, 16));
      assertPrivate(h.logs);
    });
  }
}

test("wrong OTP and lockout preserve attempts while logging only hashes and reasons", async () => {
  const h = verificationHarness();
  for (let i = 0; i < 5; i++) assert.deepEqual(await h.auth.verifyConsumerAuth(EMAIL, "000000", meta), { ok: false, error: i === 4 ? "locked" : "invalid_code" });
  const entries = auditEntries(h.logs); assert.equal(entries.length, 5); assert.equal(entries.at(-1).reason, "locked");
  assert(entries.every(entry => entry.contactHash === sha(EMAIL).slice(0, 16) && entry.ipHash === sha(IP).slice(0, 16))); assert.equal(h.state.sessions, 0); assertPrivate(h.logs, ["000000"]);
});

test("demo, logout and deletion audit identifiers are hashed without changing their results", async () => {
  const sql = async (parts, ...values) => {
    const text = parts.join("?").replace(/\s+/g, " ").trim();
    if (text.startsWith("INSERT INTO consumers")) return [{ id: CONSUMER_ID, email: values[0] }];
    if (text.startsWith("INSERT INTO consumer_identities")) return [];
    if (text.startsWith("UPDATE consumer_sessions")) return [{ id: CHALLENGE_IDS[0], consumer_id: CONSUMER_ID }];
    if (text.startsWith("WITH deleted_consumer AS MATERIALIZED")) return [{ consumer_id: CONSUMER_ID, revoked_session_count: 2 }];
    throw new Error("unexpected_privacy_fixture_sql");
  };
  const h = loadConsumerVerification(sql);
  assert.equal((await h.auth.getOrCreateDemoConsumer(EMAIL)).id, CONSUMER_ID);
  const sessionToken = "ac".repeat(24);
  assert.deepEqual(await h.auth.revokeConsumerSessionFromRequest(new Request("https://nexid.invalid/logout", { headers: { cookie: `nexid_consumer_session=${sessionToken}` } })), { revoked: true });
  assert.deepEqual(await h.auth.deleteConsumerAccountAndRevokeSessions(CONSUMER_ID), { consumerId: CONSUMER_ID, revokedSessionCount: 2 });
  const entries = auditEntries(h.logs); assert.equal(entries.length, 3); assert(entries.every(entry => entry.consumerHash === sha(CONSUMER_ID).slice(0, 16))); assert.equal(entries[0].contactHash, sha(EMAIL).slice(0, 16)); assert.equal(entries[1].revoked, true); assert.equal(entries[2].revokedSessionCount, 2); assertPrivate(h.logs, [sessionToken]);
});

test("provider payload extras and freeform reasons cannot leak into auth audit logs", async () => {
  const logs = [], sent = [], privateValues = { token: "fixture-provider-access-token", sessionToken: "fixture-session-token", challengeId: CHALLENGE_IDS[0], signature: "fixture-fresh-NFC-signature", sun: "fixture-fresh-SUN-message", code: CODE, userAgent: meta.userAgent };
  const maliciousDelivery = { channel: "email", provider: "resend", status: "accepted", ...privateValues, secondaryDelivery: { channel: "whatsapp", status: "failed", ...privateValues }, reason: `untrusted ${EMAIL} ${IP} ${MAGIC}` };
  const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/consumer-auth.ts", import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const require = name => {
    if (name === "node:crypto") return { createHash, randomBytes, randomInt: () => Number(CODE) };
    if (name === "node:net") return { isIP };
    if (name === "./db") return { sql: async parts => { const text = parts.join("?"); if (text.includes("SELECT phone FROM consumers")) return []; if (text.includes("INSERT INTO consumer_auth_challenges")) return []; throw new Error("unexpected_start_privacy_sql"); } };
    if (name === "./commercial-runtime-schema") return { ensureConsumerAuthSchema: async () => {} };
    if (name === "./consumer-auth-continuation") return { normalizeConsumerAuthReturnPath: () => "/me" };
    if (name === "./sun-rate-limit-store") return { hitSunRateLimit: async () => ({ limited: false }), shouldFailClosedSunRateLimit: () => true };
    if (name === "./consumer-auth-provider") return { isConsumerOtpProduction: () => true, consumerOtpDeliveryMode: () => "smart", consumerOtpDeliveryChannel: () => "email", resolveConsumerOtpProvider: () => ({ sendOtp: async payload => { sent.push(payload); return { delivery: maliciousDelivery }; } }) };
    throw new Error("unexpected_start_privacy_dependency");
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", "console", "fetch", compiled)(require, module, module.exports, { env: { NODE_ENV: "production" } }, { log: (...args) => logs.push(args) }, () => { throw new Error("privacy_fixture_network_forbidden"); });
  const result = await module.exports.startConsumerAuth(EMAIL, { ip: IP }); assert.equal(result.ok, true); assert.equal(result.code, CODE); assert.equal(sent.length, 1);
  const entry = auditEntries(logs).at(-1); assert.equal(entry.contactHash, sha(EMAIL).slice(0, 16)); assert.equal(entry.reason, "otp_delivery_failed"); assert.equal(entry.mode, "smart"); assert.equal(entry.provider, "resend"); assert.equal(entry.channel, "email"); assert.equal(entry.status, "accepted"); assert.deepEqual(entry.secondaryDelivery, { channel: "whatsapp", status: "failed" });
  assertPrivate(logs, [...Object.values(privateValues), sent[0].magicToken]);
});
