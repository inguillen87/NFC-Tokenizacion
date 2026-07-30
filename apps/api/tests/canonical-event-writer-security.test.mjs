import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { canonicalEventRequestFingerprint } from "../src/lib/canonical-event-writer.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");

async function source(relativePath) {
  return readFile(path.join(apiRoot, relativePath), "utf8");
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesBelow(absolute));
    else result.push(absolute);
  }
  return result;
}

function baseEvent() {
  return {
    operationKey: "ownership:00000000-0000-0000-0000-000000000001:activated",
    eventName: "ownership.activated",
    mode: "live",
    family: "lifecycle",
    referenceEventId: 42,
    referenceEventCreatedAt: "2026-07-29T03:00:00.000Z",
    batchId: "00000000-0000-0000-0000-000000000002",
    uidHex: "04AABBCCDD",
    eventType: "OWNERSHIP_ACTIVATED",
    result: "OWNERSHIP_ACTIVATED",
    verdict: "valid",
    riskLevel: "low",
    reason: "off_chain_digital_title_activated",
    readCounter: 7,
    sdmReadCtr: 7,
    cmacOk: true,
    allowlisted: true,
    userAgent: "test-agent",
    city: "Mendoza",
    countryCode: "AR",
    lat: -32.89,
    lng: -68.84,
    geoPrecision: "browser_rounded",
    productName: "Test product",
    piccDataHash: "sha256:a",
    cmacHash: "sha256:b",
    rawUrlHash: "sha256:c",
    ipHash: "sha256:d",
    deviceLabel: "mobile",
    rawQuery: { safe: "value" },
    meta: { policy: "strict", trace_id: "trace-a" },
    webhookData: { ownershipId: "00000000-0000-0000-0000-000000000003", status: "claimed" },
  };
}

test("canonical fingerprint binds every persisted semantic field and ignores only trace identity", () => {
  const base = baseEvent();
  const original = canonicalEventRequestFingerprint(base);
  const mutations = [
    { readCounter: 8 },
    { sdmReadCtr: 8 },
    { cmacOk: false },
    { allowlisted: false },
    { userAgent: "other-agent" },
    { city: "Rosario" },
    { countryCode: "UY" },
    { lat: -31.42 },
    { lng: -64.18 },
    { geoPrecision: "ip" },
    { productName: "Other product" },
    { piccDataHash: "sha256:changed" },
    { cmacHash: "sha256:changed" },
    { rawUrlHash: "sha256:changed" },
    { ipHash: "sha256:changed" },
    { deviceLabel: "desktop" },
    { rawQuery: { safe: "changed" } },
    { meta: { policy: "relaxed", trace_id: "trace-a" } },
    { webhookData: { ownershipId: "00000000-0000-0000-0000-000000000003", status: "revoked" } },
  ];
  for (const mutation of mutations) {
    assert.notEqual(canonicalEventRequestFingerprint({ ...base, ...mutation }), original, JSON.stringify(mutation));
  }
  assert.equal(
    canonicalEventRequestFingerprint({ ...base, meta: { ...base.meta, trace_id: "trace-b" } }),
    original,
    "a retry may carry a new trace id without changing the business operation",
  );
});

test("canonical database writer derives tenancy, rejects ambiguous evidence and commits event plus outbox together", async () => {
  const migration = await source("db/migrations/20260728183000_0067_canonical_event_outbox.sql");
  assert.match(migration, /FOREIGN KEY \(source_event_id, source_event_created_at\)[\s\S]*REFERENCES events \(id, created_at\)/);
  assert.match(migration, /SELECT count\(\*\)::integer[\s\S]*v_reference_matches/);
  assert.match(migration, /canonical_event_reference_event_ambiguous/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /INSERT INTO events[\s\S]*INSERT INTO canonical_event_operations[\s\S]*INSERT INTO webhook_deliveries/);
  assert.match(migration, /v_webhook_event_id := 'evt_canonical_' \|\| v_operation_id::text/);
  assert.match(migration, /'schemaVersion', '1\.0'[\s\S]*'id', v_webhook_event_id/);
  assert.doesNotMatch(migration, /v_webhook_event_id := 'canonical:'/);
  assert.doesNotMatch(migration, /p_input->>'tenant_id'/);
  assert.match(migration, /canonical_event_raw_query_invalid/);
  assert.match(migration, /jsonb_typeof\(p_input->'raw_query'\) <> 'object'/);
  assert.match(migration, /v_event_mode IN \('demo', 'simulated'\)[\s\S]*'demo'::scan_source/);
  assert.doesNotMatch(migration, /UPDATE\s+tags|nexid_persist_sun_scan_v1/i);
});

test("runtime code cannot insert directly into canonical events", async () => {
  const runtimeRoot = path.join(apiRoot, "src");
  const runtimeFiles = (await filesBelow(runtimeRoot)).filter((file) => /\.(?:ts|tsx)$/.test(file));
  const offenders = [];
  for (const file of runtimeFiles) {
    const body = await readFile(file, "utf8");
    if (/\bINSERT\s+INTO\s+(?:public\.)?events\b/i.test(body)) {
      offenders.push(path.relative(apiRoot, file).replaceAll("\\", "/"));
    }
  }
  assert.deepEqual(offenders, [], `Direct events writers found: ${offenders.join(", ")}`);
});

test("demo, ownership, warranty and tokenization routes use the canonical writer contract", async () => {
  const simulation = await source("src/app/sun/simulate/route.ts");
  assert.match(simulation, /writeCanonicalEvent/);
  assert.match(simulation, /eventName:\s*"demo\.tap\.simulated"/);
  assert.match(simulation, /mode:\s*"simulated"/);
  assert.doesNotMatch(simulation, /INSERT INTO events/);

  const ownership = await source("src/lib/consumer-portal-service.ts");
  assert.match(ownership, /eventName:\s*"ownership\.activated"/);
  assert.match(ownership, /operationCommitted:\s*true/);

  const warranty = await source("src/app/public/cta/register-warranty/route.ts");
  assert.match(warranty, /eventName:\s*"warranty\.review_requested"/);
  assert.doesNotMatch(warranty, /recordDemoCta/);

  const tokenization = await source("src/lib/tokenization-engine.ts");
  assert.match(tokenization, /recordTokenizationCanonicalEvent/);
  assert.match(tokenization, /canonical_event_confirmed:\s*false/);
  assert.doesNotMatch(tokenization, /INSERT INTO demo_cta_actions/);
});

test("default operational metrics exclude explicitly simulated events", async () => {
  const overview = await source("src/app/admin/overview/route.ts");
  const diagnostics = await source("src/app/admin/diagnostics/live-pipeline/route.ts");
  const analytics = await source("src/app/admin/analytics/route.ts");
  assert.equal((overview.match(/COALESCE\(e\.source::text, 'real'\) <> 'demo'/g) || []).length, 2);
  assert.match(diagnostics, /COALESCE\((?:e\.)?source::text, 'real'\) <> 'demo'/);
  assert.match(analytics, /const source = requestedSource \|\| "real"/);
});
