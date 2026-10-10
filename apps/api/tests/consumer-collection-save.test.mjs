import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DEFAULT_REQUIRED_SCHEMA_MIGRATIONS, installEphemeralE2eSqlExecutor } from "../src/lib/db.ts";
import { saveTapForConsumer } from "../src/lib/consumer-portal-service.ts";

const fixtureEvent = {
  id: "900001", tenant_id: "10000000-0000-4000-8000-000000000001",
  batch_id: "10000000-0000-4000-8000-000000000002",
  uid_hex: "04AABBCCDD0011", result: "VALID_CLOSED", tenant_slug: "synthetic-brand",
  current_tag_status: "inactive", current_tag_lifecycle_state: "suspended",
};
const fixtureProfile = {
  id: "30000000-0000-4000-8000-000000000001",
  batch_id: fixtureEvent.batch_id, tenant_id: fixtureEvent.tenant_id, uid_hex: fixtureEvent.uid_hex,
  product_name: "Synthetic product", winery: "Synthetic brand", image_url: "https://example.invalid/collection.png",
};
const fixtureConsumer = "20000000-0000-4000-8000-000000000001";
const qaEnvironment = {
  NODE_ENV: "test", VERCEL_ENV: "test",
  NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",
  NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:synthetic@127.0.0.1/nexid_e2e_collection",
};

async function runFixture({ outcomes = [[{ id: "product-1" }]], event = fixtureEvent, profiles = [fixtureProfile] } = {}, verify) {
  const calls = { membership: 0, history: 0, product: [], profile: 0, profileQueries: [] };
  const remove = installEphemeralE2eSqlExecutor(async (strings, ...values) => {
    const text = strings.join("?");
    if (/FROM schema_migrations/.test(text)) return DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.map(id => ({ id }));
    if (/commercial-runtime-schema\.[cm]?[jt]s/.test(new Error().stack || "")) return [];
    if (/SELECT e\.id, e\.tenant_id/.test(text)) return event ? [event] : [];
    if (/SELECT id FROM loyalty_programs/.test(text)) return [];
    if (/INSERT INTO tenant_consumer_memberships/.test(text)) { calls.membership += 1; return [{ id: "membership-1" }]; }
    if (/INSERT INTO consumer_tap_history/.test(text)) {
      calls.history += 1;
      // SQL is mocked here. Suppress the returned projection row so this unit
      // suite never invokes the separate realtime/provider side effect.
      return [];
    }
    if (/LEFT JOIN tag_profiles/.test(text)) {
      calls.profile += 1;
      calls.profileQueries.push({ text, values });
      // Model literal, casefold and canonical UID joins over synthetic rows. This is
      // an in-memory SQL fixture, not a PostgreSQL execution or live DB read.
      const canonical = /UPPER\(TRIM\(t\.uid_hex\)\)\s*=\s*UPPER\(TRIM\(e\.uid_hex\)\)/.test(text);
      const casefold = canonical || /UPPER\(t\.uid_hex\)\s*=\s*UPPER\(e\.uid_hex\)/.test(text);
      const sameBatch = /t\.batch_id\s*=\s*e\.batch_id/.test(text);
      assert.ok(casefold || /t\.uid_hex\s*=\s*e\.uid_hex/.test(text), "Expected a supported UID join in collection fixture");
      const normalizeUid = value => canonical ? value.trim().toUpperCase() : casefold ? value.toUpperCase() : value;
      assert.match(text, /WHERE e\.id = \?[\s\S]*AND b\.tenant_id = \?/);
      assert.equal(values[0], event.id);
      assert.equal(values[1], event.tenant_id);
      return profiles.filter(profile => profile.tenant_id === event.tenant_id
        && (!sameBatch || profile.batch_id === event.batch_id)
        && normalizeUid(profile.uid_hex) === normalizeUid(event.uid_hex)).slice(0, 1);
    }
    if (/WITH existing AS MATERIALIZED/.test(text) && /INSERT INTO consumer_products/.test(text)) {
      calls.product.push({ text, values });
      const outcome = outcomes[Math.min(calls.product.length - 1, outcomes.length - 1)];
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }
    throw new Error("Unexpected SQL in collection fixture");
  }, qaEnvironment, { migrationManaged: true });
  try { await verify(() => saveTapForConsumer({ consumerId: fixtureConsumer, eventId: "900001" }), calls); }
  finally { remove(); }
}

function sqlError(code) { return Object.assign(new Error("Synthetic SQL failure"), { code }); }

test("historical collection save uses one product statement and remains viewed without lifecycle gating", async () => {
  await runFixture({}, async (save, calls) => {
    assert.equal(await save(), fixtureEvent);
    assert.equal(calls.membership, 1);
    assert.equal(calls.history, 1);
    assert.equal(calls.product.length, 1);
    const { text, values } = calls.product[0];
    assert.match(text, /updated AS \([\s\S]*UPDATE consumer_products[\s\S]*inserted AS \([\s\S]*INSERT INTO consumer_products/);
    assert.match(text, /WHERE NOT EXISTS \(SELECT 1 FROM existing\)/);
    assert.match(text, /'viewed', 'wine'/);
    assert.doesNotMatch(text, /acquired_at|points_balance|consumer_product_ownerships|lifecycle_state|ON CONFLICT/);
    assert.ok(values.includes(fixtureConsumer) && values.includes(fixtureEvent.tenant_id) && values.includes(fixtureEvent.uid_hex));
    const source = await readFile(new URL("../src/lib/consumer-portal-service.ts", import.meta.url), "utf8");
    assert.match(source, /const productRows = await sqlSerializable/);
  });
});

for (const [eventUid, tagUid] of [[fixtureEvent.uid_hex, fixtureEvent.uid_hex.toLowerCase()], [fixtureEvent.uid_hex.toLowerCase(), fixtureEvent.uid_hex]]) {
  test(`historical save preserves product metadata with ${eventUid === fixtureEvent.uid_hex ? "uppercase event/lowercase tag" : "lowercase event/uppercase tag"} in the same batch`, async () => {
    const event = { ...fixtureEvent, uid_hex: eventUid };
    const profile = { ...fixtureProfile, uid_hex: tagUid };
    await runFixture({ event, profiles: [profile] }, async (save, calls) => {
      assert.equal(await save(), event);
      assert.equal(calls.membership, 1); assert.equal(calls.history, 1); assert.equal(calls.product.length, 1);
      const { values } = calls.product[0];
      for (const value of [profile.id, profile.product_name, profile.winery, profile.image_url]) assert.ok(values.includes(value), "Matched profile metadata must reach the saved product");
      assert.equal(values.includes(`Producto ${event.uid_hex}`), false);
    });
  });
}

test("historical save never borrows a matching UID profile from a different batch in the same tenant", async () => {
  const wrongBatchProfile = { ...fixtureProfile, batch_id: "10000000-0000-4000-8000-000000000003" };
  await runFixture({ profiles: [wrongBatchProfile] }, async (save, calls) => {
    assert.equal(await save(), fixtureEvent);
    assert.equal(calls.membership, 1); assert.equal(calls.history, 1); assert.equal(calls.product.length, 1);
    const { values } = calls.product[0];
    for (const value of [wrongBatchProfile.id, wrongBatchProfile.product_name, wrongBatchProfile.winery, wrongBatchProfile.image_url]) assert.equal(values.includes(value), false, "A different batch cannot supply product metadata");
    assert.ok(values.includes(`Producto ${fixtureEvent.uid_hex}`));
    assert.ok(values.includes(fixtureEvent.tenant_slug));
  });
});

test("historical save resolves legacy UID spaces with the canonical global UID index expression", async () => {
  const event = { ...fixtureEvent, uid_hex: ` ${fixtureEvent.uid_hex.toLowerCase()} ` };
  const profile = { ...fixtureProfile, uid_hex: `  ${fixtureEvent.uid_hex}  ` };
  await runFixture({ event, profiles: [profile] }, async (save, calls) => {
    assert.equal(await save(), event);
    assert.equal(calls.membership, 1); assert.equal(calls.history, 1); assert.equal(calls.product.length, 1);
    const { values } = calls.product[0];
    for (const value of [profile.id, profile.product_name, profile.winery, profile.image_url]) assert.ok(values.includes(value), "Canonical UID metadata must reach the saved product");
    assert.equal(values.includes(`Producto ${event.uid_hex}`), false);
    const indexSource = await readFile(new URL("../db/migrations/20260802160000_0081_supplier_manifest_atomic_import.sql", import.meta.url), "utf8");
    assert.match(indexSource, /CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_uid_hex_global\s+ON tags \(upper\(trim\(uid_hex\)\)\)/);
  });
});

test("serialization conflicts retry only the product statement, at most three attempts", async () => {
  await runFixture({ outcomes: [sqlError("40001"), sqlError("40001"), [{ id: "product-1" }]] }, async (save, calls) => {
    assert.equal(await save(), fixtureEvent);
    assert.equal(calls.product.length, 3);
    assert.equal(calls.membership, 1);
    assert.equal(calls.history, 1);
    assert.equal(calls.profile, 1);
    assert.deepEqual(calls.product[0], calls.product[1]);
    assert.deepEqual(calls.product[0], calls.product[2]);
  });
});

test("serialization exhaustion propagates failure instead of returning a saved event", async () => {
  const failure = sqlError("40001");
  await runFixture({ outcomes: [failure] }, async (save, calls) => {
    await assert.rejects(save(), error => error === failure);
    assert.equal(calls.product.length, 3);
    assert.equal(calls.membership, 1);
    assert.equal(calls.history, 1);
  });
});

for (const code of ["23505", "08006", "40P01"]) {
  test(`SQL ${code} is propagated without pretending a successful save or retrying associations`, async () => {
    const failure = sqlError(code);
    await runFixture({ outcomes: [failure] }, async (save, calls) => {
      await assert.rejects(save(), error => error === failure);
      assert.equal(calls.product.length, 1);
      assert.equal(calls.membership, 1);
      assert.equal(calls.history, 1);
    });
  });
}

test("a product statement returning no row cannot report save success", async () => {
  await runFixture({ outcomes: [[]] }, async (save, calls) => {
    await assert.rejects(save(), /consumer_product_save_failed/);
    assert.equal(calls.product.length, 1);
  });
});

test("an absent historical event creates no membership, history or product", async () => {
  await runFixture({ event: null }, async (save, calls) => {
    assert.equal(await save(), null);
    assert.equal(calls.membership, 0);
    assert.equal(calls.history, 0);
    assert.equal(calls.product.length, 0);
  });
});
