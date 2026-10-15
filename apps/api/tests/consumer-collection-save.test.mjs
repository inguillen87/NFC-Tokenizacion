import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { CLAIMABLE_OWNERSHIP_RESULTS } from "../src/lib/ownership-policy.ts";
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

// Execute the real service with closed spies, not a copied save implementation.
// A resolved sqlSerializable adapter receipt models its post-commit boundary;
// this software fixture does not execute PostgreSQL or prove real durability.
function publicationDeferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function publicationPhaseReached(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error("Synthetic core phase was not reached")), 5000);
  })]); }
  finally { clearTimeout(timer); }
}
async function loadHistoricalPublicationFixture({ outcomes, projection = async () => ({ projected: true, distributed: true }) } = {}) {
  const returnedAssociation = "900077";
  const rows = association => [{ ...successRows()[0], association_event_id: association }];
  outcomes ??= [rows(returnedAssociation)];
  const started = outcomes.map(() => publicationDeferred());
  const calls = { schema: 0, events: [], core: [], publications: [], order: [] };
  const unused = () => { throw Error("Unexpected dependency outside historical publication fixture"); };
  const dependencies = {
    "./db": { sql: unused, sqlSerializable: async (strings, ...values) => {
      const index = calls.core.length, attempt = index + 1;
      calls.core.push({ text: strings.join("?"), values }); calls.order.push(`core:${attempt}:started`);
      started[Math.min(index, started.length - 1)].resolve();
      try {
        const outcome = await outcomes[Math.min(index, outcomes.length - 1)];
        if (outcome instanceof Error) throw outcome;
        calls.order.push(`core:${attempt}:resolved`); return outcome;
      } catch (error) { calls.order.push(`core:${attempt}:rejected`); throw error; }
    } },
    "./loyalty-service": { getTapEvent: async id => { calls.events.push(id); return fixtureEvent; }, claimTapPoints: unused },
    "./ownership-policy": { CLAIMABLE_OWNERSHIP_RESULTS, evaluateOwnershipEligibility: unused },
    "./commercial-runtime-schema": { ensureConsumerPortalSchema: async () => { calls.schema += 1; } },
    "./canonical-event-writer": { CanonicalEventWriteError: class extends Error {}, writeCanonicalEvent: unused },
    "./tap-commercial-rights": { evaluateTapCommercialRights: unused, readCurrentTapCommercialRights: unused },
    "./realtime-tap-projection": { publishTenantTapRealtimeProjection: async id => {
      calls.publications.push(id); calls.order.push("publication"); return await projection(id);
    } },
  };
  const ts = createRequire(import.meta.url)("typescript");
  const source = await readFile(new URL("../src/lib/consumer-portal-service.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected service dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return { calls, started, returnedAssociation, rows,
    save: () => module.exports.saveTapForConsumer({ consumerId: fixtureConsumer, eventId: fixtureEvent.id }) };
}

test("historical save waits for the compound receipt before publishing its returned association once", { timeout: 10000 }, async () => {
  const receipt = publicationDeferred(), f = await loadHistoricalPublicationFixture({ outcomes: [receipt.promise] });
  const pending = f.save();
  try {
    await publicationPhaseReached(f.started[0].promise);
    assert.deepEqual(f.calls.order, ["core:1:started"]); assert.deepEqual(f.calls.publications, []);
    receipt.resolve(f.rows(f.returnedAssociation));
    assert.equal(await pending, fixtureEvent);
    assert.deepEqual(f.calls.order, ["core:1:started", "core:1:resolved", "publication"]);
    assert.deepEqual(f.calls.publications, [f.returnedAssociation]);
    assert.notEqual(f.returnedAssociation, fixtureEvent.id, "The spy distinguishes the returned association ID from the request ID");
    assert.equal(f.calls.core.length, 1); assert.deepEqual(f.calls.events, [fixtureEvent.id]); assert.equal(f.calls.schema, 1);
  } finally { receipt.resolve(f.rows(f.returnedAssociation)); await pending.catch(() => {}); }
});

test("historical publication happens once only after the successful receipt following serialization retries", async () => {
  const f = await loadHistoricalPublicationFixture({ outcomes: [sqlError("40001"), sqlError("40001"), [{ ...successRows()[0], association_event_id: "900077" }]] });
  assert.equal(await f.save(), fixtureEvent);
  assert.deepEqual(f.calls.order, ["core:1:started", "core:1:rejected", "core:2:started", "core:2:rejected", "core:3:started", "core:3:resolved", "publication"]);
  assert.deepEqual(f.calls.publications, ["900077"]); assert.equal(f.calls.core.length, 3);
  assert.deepEqual(f.calls.core[0], f.calls.core[1]); assert.deepEqual(f.calls.core[1], f.calls.core[2]);
  assert.deepEqual(f.calls.events, [fixtureEvent.id]); assert.equal(f.calls.schema, 1);
});

test("failed, exhausted, denied or missing historical receipts never request realtime publication", async () => {
  const permanent = sqlError("22012"), exhausted = sqlError("40001");
  for (const [outcomes, attempts, error] of [
    [[permanent], 1, permanent], [[exhausted], 3, exhausted], [[[]], 1, /consumer_tap_core_result_unavailable/],
  ]) {
    const f = await loadHistoricalPublicationFixture({ outcomes });
    await assert.rejects(f.save(), expected => error instanceof RegExp ? error.test(expected.message) : expected === error);
    assert.equal(f.calls.core.length, attempts); assert.deepEqual(f.calls.publications, []);
    assert.equal(f.calls.order.includes("publication"), false);
  }
  const denied = await loadHistoricalPublicationFixture({ outcomes: [[{ error: "consumer_membership_inactive", membership: null, product_id: null, association_event_id: "900077" }]] });
  assert.equal(await denied.save(), null); assert.equal(denied.calls.core.length, 1); assert.deepEqual(denied.calls.publications, []);
});

test("an existing historical association does not cause a second publication on another successful save", async () => {
  const f = await loadHistoricalPublicationFixture({ outcomes: [[{ ...successRows()[0], association_event_id: "900077" }], successRows()] });
  assert.equal(await f.save(), fixtureEvent); assert.equal(await f.save(), fixtureEvent);
  assert.equal(f.calls.core.length, 2); assert.deepEqual(f.calls.publications, ["900077"]);
  assert.deepEqual(f.calls.order, ["core:1:started", "core:1:resolved", "publication", "core:2:started", "core:2:resolved"]);
  const existing = await loadHistoricalPublicationFixture({ outcomes: [successRows()] });
  assert.equal(await existing.save(), fixtureEvent); assert.deepEqual(existing.calls.publications, []);
});

for (const [label, projection, warning] of [
  ["publisher error including 40001", async () => { throw sqlError("40001"); }, "[consumer_actor_realtime_projection_failed]"],
  ["unavailable projection", async () => ({ projected: false, distributed: false }), "[consumer_actor_realtime_projection_unavailable]"],
]) test(`historical ${label} keeps the durable receipt and never retries the core`, async () => {
  const f = await loadHistoricalPublicationFixture({ projection }), warnings = [], previous = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    assert.equal(await f.save(), fixtureEvent);
    assert.equal(f.calls.core.length, 1); assert.deepEqual(f.calls.publications, [f.returnedAssociation]);
    assert.deepEqual(f.calls.order, ["core:1:started", "core:1:resolved", "publication"]);
    assert.equal(warnings.length, 1); assert.equal(warnings[0][0], warning);
    const details = JSON.parse(warnings[0][1]); assert.equal(details.eventId, f.returnedAssociation);
    assert.equal(Object.hasOwn(details, "consumerId"), false); assert.equal(Object.hasOwn(details, "uid_hex"), false);
  } finally { console.warn = previous; }
});
