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
const successRows = () => [{ error: null, membership: { id: "membership-1", status: "active" }, product_id: "product-1", association_event_id: null }];

async function runFixture({ outcomes = [successRows()], event = fixtureEvent, profiles = [fixtureProfile] } = {}, verify) {
  const calls = { event: 0, core: [], committed: { membership: 0, history: 0, product: 0 }, metadata: null };
  const remove = installEphemeralE2eSqlExecutor(async (strings, ...values) => {
    const text = strings.join("?");
    if (/FROM schema_migrations/.test(text)) return DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.map(id => ({ id }));
    if (/commercial-runtime-schema\.[cm]?[jt]s/.test(new Error().stack || "")) return [];
    if (/SELECT e\.id, e\.tenant_id/.test(text)) { calls.event += 1; return event ? [event] : []; }
    if (/WITH locked_event AS MATERIALIZED/.test(text)) {
      assert.match(text, /written_membership AS \([\s\S]*INSERT INTO tenant_consumer_memberships/);
      assert.match(text, /written_history AS \([\s\S]*INSERT INTO consumer_tap_history/);
      assert.match(text, /updated_product AS \([\s\S]*UPDATE consumer_products/);
      assert.match(text, /inserted_product AS \([\s\S]*INSERT INTO consumer_products/);
      calls.core.push({ text, values });
      const outcome = outcomes[Math.min(calls.core.length - 1, outcomes.length - 1)];
      if (outcome instanceof Error) throw outcome;
      // This adapter does not execute SQL or establish PostgreSQL rollback/locks.
      // Its effect ledger models only a successful compound receipt. Failed
      // attempts have no synthetic committed effects; real atomicity is PG QA.
      const row = outcome[0];
      if (row?.error === null && row.membership?.id && row.product_id) {
        calls.committed.membership += 1; calls.committed.history += 1; calls.committed.product += 1;
        assert.match(text, /batch\.id = event\.batch_id AND batch\.tenant_id = event\.tenant_id/);
        assert.match(text, /FROM tags tag JOIN locked_batch batch ON batch\.id = tag\.batch_id/);
        assert.match(text, /UPPER\(BTRIM\(tag\.uid_hex\)\) = UPPER\(BTRIM\(event\.uid_hex\)\)/);
        assert.match(text, /FROM locked_tags tag LEFT JOIN tag_profiles profile ON profile\.tag_id = tag\.id/);
        // Only model metadata after asserting the same-tenant, same-batch and
        // canonical UID join text. This is not execution of that projection.
        const profile = profiles.find(p => p.tenant_id === event.tenant_id && p.batch_id === event.batch_id
          && p.uid_hex.trim().toUpperCase() === event.uid_hex.trim().toUpperCase());
        calls.metadata = profile ? { tagId: profile.id, name: profile.product_name, brand: profile.winery, image: profile.image_url }
          : { tagId: null, name: `Producto ${event.uid_hex}`, brand: event.tenant_slug, image: null };
      }
      return outcome;
    }
    throw new Error("Unexpected separate SQL in collection fixture");
  }, qaEnvironment, { migrationManaged: true });
  try { await verify(() => saveTapForConsumer({ consumerId: fixtureConsumer, eventId: "900001" }), calls); }
  finally { remove(); }
}

function sqlError(code) { return Object.assign(new Error("Synthetic SQL failure"), { code }); }
const oneAssociation = { membership: 1, history: 1, product: 1 };
const noAssociation = { membership: 0, history: 0, product: 0 };

test("historical collection save uses one compound statement and remains viewed without mobile lifecycle gating", async () => {
  await runFixture({}, async (save, calls) => {
    assert.equal(await save(), fixtureEvent);
    assert.deepEqual(calls.committed, oneAssociation);
    assert.equal(calls.event, 1); assert.equal(calls.core.length, 1);
    const { text, values } = calls.core[0];
    assert.match(text, /WHERE NOT EXISTS \(SELECT 1 FROM locked_product\)/);
    assert.match(text, /'viewed', 'wine'/);
    assert.doesNotMatch(text, /acquired_at|points_balance|consumer_product_ownerships/);
    assert.ok(values.includes(fixtureConsumer) && values.includes(fixtureEvent.id));
    assert.equal(values.filter(v => v === true).length, 0, "History never enables the strict mobile branches");
    assert.ok(values.filter(v => v === false).length >= 3);
    assert.match(text, /FROM eligible event JOIN written_membership membership/);
    const source = await readFile(new URL("../src/lib/consumer-portal-service.ts", import.meta.url), "utf8");
    assert.match(source, /const rows = await sqlSerializable/);
    assert.match(source, /saveConsumerTapActionForConsumer\(\{ \.\.\.input, mode: \{ kind: "history" \} \}\)/);
  });
});

for (const [eventUid, tagUid] of [[fixtureEvent.uid_hex, fixtureEvent.uid_hex.toLowerCase()], [fixtureEvent.uid_hex.toLowerCase(), fixtureEvent.uid_hex]]) {
  test(`historical save preserves the metadata join with ${eventUid === fixtureEvent.uid_hex ? "uppercase event/lowercase tag" : "lowercase event/uppercase tag"} in the same batch`, async () => {
    const event = { ...fixtureEvent, uid_hex: eventUid }, profile = { ...fixtureProfile, uid_hex: tagUid };
    await runFixture({ event, profiles: [profile] }, async (save, calls) => {
      assert.equal(await save(), event);
      assert.deepEqual(calls.committed, oneAssociation); assert.equal(calls.core.length, 1);
      assert.deepEqual(calls.metadata, { tagId: profile.id, name: profile.product_name, brand: profile.winery, image: profile.image_url });
      assert.match(calls.core[0].text, /event\.product_name, event\.brand_name, event\.image_url/);
    });
  });
}

test("historical save never borrows a matching UID profile from a different batch in the same tenant", async () => {
  const wrongBatchProfile = { ...fixtureProfile, batch_id: "10000000-0000-4000-8000-000000000003" };
  await runFixture({ profiles: [wrongBatchProfile] }, async (save, calls) => {
    assert.equal(await save(), fixtureEvent); assert.deepEqual(calls.committed, oneAssociation);
    assert.deepEqual(calls.metadata, { tagId: null, name: `Producto ${fixtureEvent.uid_hex}`, brand: fixtureEvent.tenant_slug, image: null });
  });
});

test("historical save resolves legacy UID spaces with the canonical global UID index expression", async () => {
  const event = { ...fixtureEvent, uid_hex: ` ${fixtureEvent.uid_hex.toLowerCase()} ` };
  const profile = { ...fixtureProfile, uid_hex: `  ${fixtureEvent.uid_hex}  ` };
  await runFixture({ event, profiles: [profile] }, async (save, calls) => {
    assert.equal(await save(), event); assert.deepEqual(calls.committed, oneAssociation);
    assert.deepEqual(calls.metadata, { tagId: profile.id, name: profile.product_name, brand: profile.winery, image: profile.image_url });
    const indexSource = await readFile(new URL("../db/migrations/20260802160000_0081_supplier_manifest_atomic_import.sql", import.meta.url), "utf8");
    assert.match(indexSource, /CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_uid_hex_global\s+ON tags \(upper\(trim\(uid_hex\)\)\)/);
  });
});

test("serialization conflicts retry the entire compound statement, at most three attempts", async () => {
  await runFixture({ outcomes: [sqlError("40001"), sqlError("40001"), successRows()] }, async (save, calls) => {
    assert.equal(await save(), fixtureEvent); assert.equal(calls.core.length, 3); assert.equal(calls.event, 1);
    assert.deepEqual(calls.committed, oneAssociation);
    assert.deepEqual(calls.core[0], calls.core[1]); assert.deepEqual(calls.core[0], calls.core[2]);
  });
});

test("serialization exhaustion propagates failure without a synthetic partial association", async () => {
  const failure = sqlError("40001");
  await runFixture({ outcomes: [failure] }, async (save, calls) => {
    await assert.rejects(save(), error => error === failure);
    assert.equal(calls.core.length, 3); assert.equal(calls.event, 1); assert.deepEqual(calls.committed, noAssociation);
  });
});

for (const code of ["23505", "08006", "40P01"]) {
  test(`SQL ${code} is propagated without success or retrying the compound association`, async () => {
    const failure = sqlError(code);
    await runFixture({ outcomes: [failure] }, async (save, calls) => {
      await assert.rejects(save(), error => error === failure);
      assert.equal(calls.core.length, 1); assert.deepEqual(calls.committed, noAssociation);
    });
  });
}

test("a compound statement returning no receipt cannot report save success", async () => {
  await runFixture({ outcomes: [[]] }, async (save, calls) => {
    await assert.rejects(save(), /consumer_tap_core_result_unavailable/);
    assert.equal(calls.core.length, 1); assert.deepEqual(calls.committed, noAssociation);
  });
});

test("an absent historical event creates no membership, history or product", async () => {
  await runFixture({ event: null }, async (save, calls) => {
    assert.equal(await save(), null); assert.equal(calls.event, 1); assert.equal(calls.core.length, 0);
    assert.deepEqual(calls.committed, noAssociation);
  });
});

test("an inactive membership makes the historical adapter return null without a partial success", async () => {
  await runFixture({ outcomes: [[{ error: "consumer_membership_inactive", membership: null, product_id: null, association_event_id: null }]] }, async (save, calls) => {
    assert.equal(await save(), null); assert.equal(calls.core.length, 1); assert.deepEqual(calls.committed, noAssociation);
  });
});

test("history retains tag-less and invalid reading support without claiming ownership or benefits", async () => {
  const event = { ...fixtureEvent, result: "REPLAY_SUSPECT" };
  await runFixture({ event, profiles: [] }, async (save, calls) => {
    assert.equal(await save(), event); assert.deepEqual(calls.committed, oneAssociation);
    assert.equal(calls.core[0].values.some(value => value === true), false);
    assert.doesNotMatch(calls.core[0].text, /INSERT INTO consumer_product_ownerships|UPDATE loyalty_members/);
    assert.equal(calls.metadata.tagId, null);
  });
});
