import assert from "node:assert/strict";

export const ownershipFixture = (overrides = {}) => ({
  id: "930001", tenant_id: "00000000-0000-0000-0000-000000000101",
  batch_id: "00000000-0000-0000-0000-000000000102", uid_hex: "04AABBCCDDEE11",
  result: "VALID_CLOSED", reason: "tagtamper_closed:4343", bid: "QA-OWNERSHIP", tenant_slug: "qa-ownership",
  current_tag_id: "00000000-0000-0000-0000-000000000103",
  current_tag_tenant_id: "00000000-0000-0000-0000-000000000101",
  current_tag_batch_id: "00000000-0000-0000-0000-000000000102",
  current_tag_uid_hex: "04AABBCCDDEE11", current_tag_status: "active",
  current_tag_lifecycle_state: "active", current_tag_identity_count: 1, ...overrides,
});

export const ownershipTestEnv = {
  NODE_ENV: "test", VERCEL_ENV: "test",
  NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",
  NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:synthetic@127.0.0.1/nexid_e2e_ownership_current",
};

// Capture the real service statement without a database or external effects.
// A synthetic revoked receipt stops the caller before its canonical event sink.
// The PostgreSQL harness executes the captured SQL and parameters separately.
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
    if (/WITH current_tag AS MATERIALIZED/.test(query)) {
      assert.match(query, /(?:INSERT INTO|UPDATE) consumer_product_ownerships/);
      mutation = statement;
      if (mutationError) throw mutationError;
      return [{ id: ownershipId, consumer_id: consumerId, status: "revoked" }];
    }
    if (/FROM consumer_product_ownerships o/.test(query)) return update ? [{ id: ownershipId, consumer_id: consumerId }] : [];
    if (/WITH existing AS MATERIALIZED/.test(query)) return [{ id: "00000000-0000-0000-0000-000000000106" }];
    if (/FROM events e\s+JOIN tags t/.test(query)) return [{ id: event.current_tag_id, bid: event.bid, product_name: "Synthetic product" }];
    if (/FROM loyalty_programs|INSERT INTO tenant_consumer_memberships|INSERT INTO consumer_tap_history|UPDATE consumer_products/.test(query)) return [];
    throw new Error(`Unexpected synthetic statement: ${query.trim().slice(0, 90)}`);
  }, ownershipTestEnv, { migrationManaged: true });
  try {
    const result = await claimOwnershipForConsumer({ consumerId, eventId: String(event.id), bid: event.bid, uidHex: event.uid_hex });
    return { result, statements, mutation, consumerId, ownershipId };
  } finally {
    remove();
  }
}
