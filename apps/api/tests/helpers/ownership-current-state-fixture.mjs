import assert from "node:assert/strict";

export const ownershipFixture = (overrides = {}) => ({
  id: "930001", tenant_id: "00000000-0000-0000-0000-000000000101",
  batch_id: "00000000-0000-0000-0000-000000000102", uid_hex: "04AABBCCDDEE11",
  result: "VALID_CLOSED", reason: "tagtamper_closed:4343", bid: "QA-OWNERSHIP", tenant_slug: "qa-ownership",
  current_tag_id: "00000000-0000-0000-0000-000000000103",
  current_tag_tenant_id: "00000000-0000-0000-0000-000000000101",
  current_tag_batch_id: "00000000-0000-0000-0000-000000000102",
  current_tag_uid_hex: "04AABBCCDDEE11", current_tag_status: "active",
  current_tag_lifecycle_state: "active", current_tag_identity_count: 1, current_tag_revision: "1", sdm_read_ctr: 1, ...overrides,
});

export const ownershipTestEnv = {
  NODE_ENV: "test", VERCEL_ENV: "test",
  NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",
  NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:synthetic@127.0.0.1/nexid_e2e_ownership_current",
};

// Capture the real service statement without a database or external effects.
// A synthetic revoked receipt stops the caller before its canonical event sink.
// This is source/receipt-only: SQL and COMMIT are not executed here. The new
// PostgreSQL helper runs the complete service with a real SERIALIZABLE executor.
// update is retained solely as the caller's fixture label, not a legacy SQL path.
export async function captureOwnershipMutation({ event = ownershipFixture(), update = false, rightsError = false, mutationError = null } = {}) {
  const db = await import("../../src/lib/db.ts");
  const { claimOwnershipForConsumer } = await import("../../src/lib/consumer-portal-service.ts");
  const consumerId = "00000000-0000-0000-0000-000000000104";
  const ownershipId = "00000000-0000-0000-0000-000000000105";
  const statements = [];
  let mutation;
  const remove = db.installEphemeralE2eSqlExecutor(async (strings, ...parameters) => {
    const query = strings.reduce((result, part, i) => result + (i ? `$${i}` : "") + part, "");
    const statement = { query, parameters };
    statements.push(statement);
    if (/FROM schema_migrations/.test(query)) return db.DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.map(id => ({ id }));
    if (/commercial-runtime-schema\.[cm]?[jt]s/.test(new Error().stack || "")) return [];
    if (/current_tag\.id AS current_tag_id/.test(query)) return [event];
    if (/FROM events event/.test(query)) {
      if (rightsError) throw new Error("synthetic rights read failure");
      return [event];
    }
    if (/WITH locked_event AS MATERIALIZED/.test(query)) {
      // Capture the actual strict ownership core. A synthetic revoked result
      // stops publication; it is not evidence of SQL execution or atomicity.
      assert.match(query, /inserted_title AS \([\s\S]*INSERT INTO consumer_product_ownerships/);
      assert.match(query, /saved_title AS MATERIALIZED/);
      assert.match(query, /written_membership AS \([\s\S]*INSERT INTO tenant_consumer_memberships/);
      assert.match(query, /written_history AS \([\s\S]*FROM eligible event JOIN written_membership membership/);
      assert.match(query, /updated_product AS \([\s\S]*UPDATE consumer_products/);
      assert.match(query, /inserted_product AS \([\s\S]*INSERT INTO consumer_products/);
      assert.match(query, /FROM write_integrity WHERE valid = 1/);
      assert.equal(parameters.some(value => value === true), true, "Ownership must use strict claiming mode");
      assert.ok(parameters.includes(consumerId) && parameters.includes(String(event.id)));
      mutation = statement;
      if (mutationError) throw mutationError;
      return [{ error: null,
        membership: { id: "00000000-0000-0000-0000-000000000107", tenant_id: event.tenant_id, consumer_id: consumerId, status: "active" },
        product_id: "00000000-0000-0000-0000-000000000106",
        ownership: { id: ownershipId, consumer_id: consumerId, status: "revoked" },
        // No realtime/provider effect in this non-SQL capture fixture.
        association_event_id: null,
      }];
    }
    if (/WITH current_tag AS MATERIALIZED/.test(query)) {
      assert.match(query, /(?:INSERT INTO|UPDATE) consumer_product_ownerships/);
      mutation = statement;
      if (mutationError) throw mutationError;
      return [{ id: ownershipId, consumer_id: consumerId, status: "revoked" }];
    }
    if (/FROM loyalty_programs|INSERT INTO tenant_consumer_memberships|INSERT INTO consumer_tap_history|UPDATE consumer_products/.test(query)) return [];
    throw new Error(`Unexpected synthetic statement: ${query.trim().slice(0, 90)}`);
  }, ownershipTestEnv, { migrationManaged: true });
  try {
    const result = await claimOwnershipForConsumer({ consumerId, eventId: String(event.id), bid: event.bid, uidHex: event.uid_hex,
      expected: { tenantId: event.tenant_id, batchId: event.batch_id, bid: event.bid, uidHex: event.uid_hex, readCounter: event.sdm_read_ctr, tagId: event.current_tag_id, tagRevision: event.current_tag_revision },
      authorization: { tagRevision: event.current_tag_revision, batchRevision: "1", tenantPolicyRevision: null, posRequired: false },
    });
    return { result, statements, mutation, consumerId, ownershipId, fixtureLabel: update ? "existing-title" : "new-title", sqlExecuted: false };
  } finally {
    remove();
  }
}
