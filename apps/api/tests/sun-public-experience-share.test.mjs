import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";

import * as share from "../src/lib/public-experience-share.ts";
import { createDemoShareToken } from "../src/lib/demo-share.ts";
import { requireShareToken } from "../src/lib/public-cta-auth.ts";
import { createSunFreshHandoffToken, requireSunFreshHandoff } from "../src/lib/sun-fresh-handoff.ts";
import { verifyPublicCertificateShareToken } from "../src/lib/public-certificate-share.ts";
import { resolvePublicCtaTarget } from "../src/lib/public-cta-target.ts";
import * as engagement from "../src/lib/public-experience-events.ts";
import { json } from "../src/lib/http.ts";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../src/lib/bounded-request-body.ts";

const KEYS = ["PUBLIC_EXPERIENCE_SHARE_SECRET", "PUBLIC_DEMO_SHARE_SECRET", "SUN_HANDOFF_SECRET", "PUBLIC_CERTIFICATE_SIGNING_SECRET", "SUN_HANDOFF_ALLOW_LEGACY_SECRET_FALLBACK", "PUBLIC_CERTIFICATE_ALLOW_LEGACY_SECRET_FALLBACK", "NODE_ENV", "VERCEL_ENV"];
const old = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
const key = "synthetic-experience-share-test-key-20261004-only";
const bid = "BID-EXPERIENCE-QA", eventId = "900001", uid = "04AABBCCDDEE77";
const identity = { id: eventId, bid, uid_hex: uid, tenant_id: "11111111-1111-1111-1111-111111111111", batch_id: "22222222-2222-2222-2222-222222222222", batch_sdm_config: {}, sun_profile_metadata: {}, sun_profile_ownership_policy: {} };
test.before(() => {
  for (const name of KEYS) delete process.env[name];
  // Equal synthetic bytes deliberately prove cryptographic domain separation.
  process.env.PUBLIC_EXPERIENCE_SHARE_SECRET = key;
  process.env.PUBLIC_DEMO_SHARE_SECRET = key;
  process.env.SUN_HANDOFF_SECRET = "synthetic-separate-fresh-key-20261004-only";
  process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET = key;
  process.env.NODE_ENV = "production";
  process.env.VERCEL_ENV = "production";
});
test.after(() => { for (const name of KEYS) { if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name]; } });
const sign = () => share.createPublicExperienceShareToken({ bid, uid: `EVENT-${eventId}`, exp: Math.floor(Date.now() / 1000) + 60 });
const fresh = () => createSunFreshHandoffToken({ bid, eventId, diagnosticId: 3, traceId: "synthetic-experience-only", uidHex: uid, readCounter: 8, exp: Math.floor(Date.now() / 1000) + 60 });
function request(token = sign(), body = {}, action = "experience-event") {
  const url = new URL(`https://fixture.invalid/public/cta/${action}`);
  if (token) url.searchParams.set("share", token);
  return new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bid, event_id: eventId, event_type: "PRODUCT_VIEWED", idempotency_key: "experience-share-fixture-0001", ...body }) });
}

test("dedicated share binds purpose, audience, exact scope and expiry", () => {
  const token = sign(), payload = share.verifyPublicExperienceShareToken(token);
  assert.equal(payload.aud, "nexid:experience-event:v1");
  assert.equal(payload.purpose, "public_experience_event_share");
  assert.equal(share.requirePublicExperienceShare(request(token), bid, `EVENT-${eventId}`).ok, true);
  assert.equal(share.requirePublicExperienceShare(request(token), "BID-OTHER", `EVENT-${eventId}`).share_token_status, "mismatch");
  assert.equal(share.requirePublicExperienceShare(request(token), bid, "EVENT-900002").share_token_status, "mismatch");
  const modified = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert.equal(share.verifyPublicExperienceShareToken(modified), null);
  const originalNow = Date.now;
  try { Date.now = () => originalNow() + 120_000; assert.equal(share.verifyPublicExperienceShareToken(token), null); }
  finally { Date.now = originalNow; }
});

test("missing or weak key fails closed and never falls back to general/fresh/certificate keys", () => {
  const token = sign();
  delete process.env.PUBLIC_EXPERIENCE_SHARE_SECRET;
  try {
    assert.equal(share.createPublicExperienceShareToken({ bid, uid, exp: Math.floor(Date.now() / 1000) + 60 }), "");
    assert.equal(share.requirePublicExperienceShare(request(token), bid, `EVENT-${eventId}`).share_token_status, "missing");
    process.env.PUBLIC_EXPERIENCE_SHARE_SECRET = "short";
    assert.equal(share.verifyPublicExperienceShareToken(token), null);
  } finally { process.env.PUBLIC_EXPERIENCE_SHARE_SECRET = key; }
});

test("same key material cannot cross experience, general CTA, NFC or certificate domains", () => {
  const experience = sign();
  assert.equal(requireShareToken(request(experience, {}, "claim-ownership"), bid, `EVENT-${eventId}`).ok, false);
  assert.equal(verifyPublicCertificateShareToken(eventId, experience), false);
  assert.equal(requireSunFreshHandoff(request(experience), { fresh_token: experience }, { bid, eventId }).ok, false);
  const general = createDemoShareToken({ bid, uid: `EVENT-${eventId}`, exp: Math.floor(Date.now() / 1000) + 60 });
  assert.equal(share.verifyPublicExperienceShareToken(general), null);
  // A valid domain signature still cannot substitute a different aud/purpose.
  for (const overrides of [{ aud: "nexid:claim-ownership:v1" }, { purpose: "commercial_grant" }]) {
    const body = Buffer.from(JSON.stringify({ ...share.verifyPublicExperienceShareToken(experience), ...overrides })).toString("base64url");
    const mac = createHmac("sha256", key).update(`nexid:experience-event:v1\0${body}`).digest("base64url");
    assert.equal(share.verifyPublicExperienceShareToken(`${body}.${mac}`), null);
  }
});

test("real commercial CTA handlers deny an experience signature before consuming fresh or writing", async () => {
  for (const action of ["claim-ownership", "register-warranty", "tokenize-request", "receipt-ocr", "provenance"]) {
    const source = await readFile(new URL(`../src/app/public/cta/${action}/route.ts`, import.meta.url), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    let capabilityCalls = 0;
    const dependencies = {
      http: { json }, "public-cta-auth": { requireShareToken },
      "critical-rate-limit": { enforceCriticalRateLimit: async () => null },
      "bounded-request-body": { readBoundedJsonBody, RequestBodyTooLargeError },
      "public-cta-target": { resolvePublicCtaTarget: body => resolvePublicCtaTarget(body, { loadEventIdentity: async () => identity }) },
      "sun-fresh-handoff": { consumeSunFreshHandoff: () => { capabilityCalls++; throw new Error("Capability must not be consumed"); } },
    };
    const module = { exports: {} };
    new Function("require", "module", "exports", "fetch", code)(name => dependencies[name.split("/").at(-1)]
      || new Proxy({}, { get: () => () => { throw new Error("Unexpected commercial dependency call"); } }),
    module, module.exports, () => { throw new Error("Real network forbidden"); });
    let req = request(sign(), { fresh_token: fresh() }, action);
    if (action === "provenance") {
      const url = new URL(req.url);
      url.searchParams.set("bid", bid); url.searchParams.set("event_id", eventId);
      req = new Request(url);
    }
    const response = await module.exports[action === "provenance" ? "GET" : "POST"](req);
    assert.equal(response.status, 401); assert.equal(capabilityCalls, 0);
  }
});

async function routeFixture({ blocked = false, limited = false } = {}) {
  const source = await readFile(new URL("../src/app/public/cta/experience-event/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const fixture = { writes: 0, audits: 0, contextReads: 0, rateCalls: 0, rows: new Map(), statements: [] };
  const context = { eventId, tenantId: identity.tenant_id, batchId: identity.batch_id, tagId: null, bid, result: blocked ? "REPLAY_SUSPECT" : "VALID_CLOSED", verdict: "VALID", riskLevel: blocked ? "HIGH" : "LOW", reason: "", productState: "VALID_CLOSED" };
  // Execute the real writer against an explicit in-memory SQL fixture. This is
  // control-flow/idempotency coverage, not PostgreSQL durability certification.
  const execute = async (parts, ...values) => {
    const statement = parts.join("?");
    fixture.statements.push(statement);
    assert.match(statement, /pg_advisory_xact_lock/);
    assert.match(statement, /INSERT INTO sdk_external_events/);
    assert.match(statement, /INSERT INTO audit_logs/);
    const data = values.filter(value => typeof value === "string" && value.startsWith("{"))
      .map(value => JSON.parse(value)).find(value => value.publicIdempotencyKey);
    assert.equal(data.sourceTapEventId, eventId);
    assert.equal(data.provenance.tenantScope, "server_derived_from_tap_event");
    const existing = fixture.rows.get(data.publicIdempotencyKey);
    if (existing) return [{ ...existing, replayed: true, conflict: existing.request_fingerprint !== data.publicRequestFingerprint, audit_id: null }];
    fixture.writes++; fixture.audits++;
    const row = { id: String(fixture.writes), created_at: "2026-10-04T00:00:00.000Z", request_fingerprint: data.publicRequestFingerprint, audit_id: "synthetic-audit", replayed: false, conflict: false };
    fixture.rows.set(data.publicIdempotencyKey, row);
    return [row];
  };
  const dependencies = {
    "bounded-request-body": { readBoundedJsonBody, RequestBodyTooLargeError },
    "critical-rate-limit": { enforceCriticalRateLimit: async () => { fixture.rateCalls++; return limited ? json({ ok: false, reason: "rate_limited" }, 429) : null; } },
    http: { json }, "public-experience-share": share,
    "public-cta-target": { resolvePublicCtaTarget: body => resolvePublicCtaTarget(body, { loadEventIdentity: async () => identity }) },
    "sun-fresh-handoff": { requireSunFreshHandoff },
    "public-experience-events": { ...engagement, loadPublicExperienceContext: async () => { fixture.contextReads++; return context; }, recordPublicExperienceEvent: input => engagement.recordPublicExperienceEvent(input, execute) },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", compiled)(name => {
    const dependency = name.split("/").at(-1);
    assert.ok(Object.hasOwn(dependencies, dependency), `Unexpected dependency ${name}`);
    return dependencies[dependency];
  }, module, module.exports, () => { throw new Error("Real network forbidden"); });
  return { handler: module.exports.POST, fixture };
}

test("real route denies signed activity scope without independent fresh NFC before context/write", async () => {
  const { handler, fixture } = await routeFixture();
  const response = await handler(request());
  assert.equal(response.status, 403);
  assert.equal((await response.json()).reason, "fresh_tap_capability_required");
  assert.equal(fixture.contextReads, 0); assert.equal(fixture.writes, 0); assert.equal(fixture.audits, 0);
});

test("real activity route denies missing dedicated configuration without context or write", async () => {
  const token = sign(), body = { fresh_token: fresh() };
  const { handler, fixture } = await routeFixture();
  delete process.env.PUBLIC_EXPERIENCE_SHARE_SECRET;
  try {
    const response = await handler(request(token, body));
    assert.equal(response.status, 401); assert.equal((await response.json()).share_token_status, "missing");
    assert.equal(fixture.contextReads, 0); assert.equal(fixture.writes, 0);
  } finally { process.env.PUBLIC_EXPERIENCE_SHARE_SECRET = key; }
});

test("real route validates fresh scope, trust and authoritative event types before any fixture write", async () => {
  const valid = fresh();
  const wrongEvent = createSunFreshHandoffToken({ bid, eventId: "900002", diagnosticId: 3, traceId: "synthetic-other-event", exp: Math.floor(Date.now() / 1000) + 60 });
  for (const body of [{ fresh_token: sign() }, { fresh_token: wrongEvent }, { fresh_token: valid, bid: "BID-OTHER" }, { fresh_token: valid, uid: "04FFFFFFFFFFFF" }, { fresh_token: valid, event_type: "LOYALTY_JOINED" }, { fresh_token: valid, event_type: "LEAD_CREATED" }]) {
    const { handler, fixture } = await routeFixture();
    const response = await handler(request(sign(), body));
    assert.ok([401, 403, 409].includes(response.status));
    assert.equal(fixture.writes, 0); assert.equal(fixture.audits, 0);
  }
  const { handler, fixture } = await routeFixture({ blocked: true });
  assert.equal((await handler(request(sign(), { fresh_token: valid }))).status, 409);
  assert.equal(fixture.writes, 0);
});

test("valid signature plus fresh records exactly one activity and audit on an identical retry", async () => {
  const { handler, fixture } = await routeFixture();
  const body = { fresh_token: fresh(), data: { surface: "synthetic_fixture", contact: "excluded" } };
  const first = await handler(request(sign(), body));
  assert.equal(first.status, 201); assert.equal((await first.json()).replayed, false);
  const second = await handler(request(sign(), body));
  assert.equal(second.status, 200); assert.equal((await second.json()).replayed, true);
  assert.equal(fixture.writes, 1); assert.equal(fixture.audits, 1); assert.equal(fixture.rows.size, 1);
  const conflict = await handler(request(sign(), { ...body, data: { surface: "changed_payload" } }));
  assert.equal(conflict.status, 409); assert.equal(fixture.writes, 1);
});

test("real route keeps critical rate limit before body and signing checks", async () => {
  const { handler, fixture } = await routeFixture({ limited: true });
  const req = request();
  req.json = () => { throw new Error("Body must not be read"); };
  assert.equal((await handler(req)).status, 429);
  assert.equal(fixture.rateCalls, 1); assert.equal(fixture.writes, 0); assert.equal(req.bodyUsed, false);
});
