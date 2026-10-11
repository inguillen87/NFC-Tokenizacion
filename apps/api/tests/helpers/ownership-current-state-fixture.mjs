import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verticalWriterFixture } from "./consumer-vertical-writer-fixture.mjs";

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

// Capture the current core statement through the REAL precheck, signed
// capability, PIN issuer and service. Zero synthetic rows stop before canonical
// publication. This is statement inspection, never PostgreSQL rollback proof.
export async function captureOwnershipMutation({ event = ownershipFixture(), update = false, rightsError = false, mutationError = null } = {}) {
  const db = await import("../../src/lib/db.ts");
  const policy = await import("../../src/lib/consumer-vertical-writer-policy.ts");
  const { createSunFreshHandoffToken } = await import("../../src/lib/sun-fresh-handoff.ts");
  const { claimOwnershipForConsumer } = await import("../../src/lib/consumer-portal-service.ts");
  const consumerId = "00000000-0000-0000-0000-000000000104";
  const ownershipId = "00000000-0000-0000-0000-000000000105";
  const pin = "Synthetic-Current-Ownership-PIN-42";
  const row = verticalWriterFixture("wine", event.result), snapshot = row.snapshot;
  Object.assign(snapshot.tenant, { id: event.tenant_id, slug: event.tenant_slug });
  Object.assign(snapshot.batch, { id: event.batch_id, tenant_id: event.current_tag_tenant_id, bid: event.bid,
    active_for_claim: true, claim_pin_required: true, hash_pin: createHash("sha256").update(pin).digest("hex") });
  Object.assign(snapshot.profile, { tenant_id: event.tenant_id, claim_policy: "inside_pack_secret" });
  Object.assign(snapshot.event, { id: String(event.id), tenant_id: event.tenant_id, batch_id: event.batch_id,
    uid_hex: event.uid_hex, reason: event.reason, sdm_read_ctr: 1 });
  Object.assign(snapshot.product, { tag_id: event.current_tag_id });
  snapshot.tag = event.current_tag_id ? { ...snapshot.tag, id: event.current_tag_id,
    batch_id: event.current_tag_batch_id, uid_hex: event.current_tag_uid_hex, status: event.current_tag_status,
    lifecycle_state: event.current_tag_lifecycle_state } : null;
  row.identity_count = event.current_tag_identity_count;
  if (event.manual_tamper_status) snapshot.manual = { batch_id: event.batch_id, uid_hex: event.uid_hex, tamper_status: event.manual_tamper_status };
  const configured = { SUN_HANDOFF_SECRET: "synthetic-current-ownership-handoff-20261010",
    RATE_LIMIT_KEY_PEPPER: "synthetic-current-ownership-pepper-20261010", NODE_ENV: "test", VERCEL_ENV: "test" };
  const previous = Object.fromEntries(Object.keys(configured).map(key => [key, process.env[key]]));
  Object.assign(process.env, configured);
  const statements = [];
  let mutation;
  let capabilityConsumed = false, proofIssued = false;
  const remove = db.installEphemeralE2eSqlExecutor(async (strings, ...parameters) => {
    const query = strings.reduce((result, part, i) => result + (i ? `$${i}` : "") + part, "");
    const statement = { query, parameters };
    statements.push(statement);
    if (/FROM schema_migrations/.test(query)) return db.DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.map(id => ({ id }));
    if (/SELECT jsonb_build_object/.test(query)) {
      if (rightsError) throw new Error("synthetic rights read failure");
      return [row];
    }
    if (/AS ownership_claimed/.test(query)) return [{ membership_active: true, ownership_claimed: update, claim_record_exists: update, pos: null }];
    if (/INSERT INTO sun_rate_limit_buckets/.test(query)) {
      if (parameters[1] === "sun_fresh_capability_once") capabilityConsumed = true;
      return [{ hits: 1, limited: false, retry_after_seconds: 300, lease_window_started_at: "2030-01-01T00:00:00Z" }];
    }
    if (/UPDATE sun_rate_limit_buckets/.test(query)) return [];
    if (/WITH locked_identity AS MATERIALIZED/.test(query)) {
      assert.match(query, /INSERT INTO consumer_product_ownerships/);
      mutation = statement;
      if (mutationError) throw mutationError;
      return [];
    }
    throw new Error("Unexpected synthetic ownership statement");
  }, ownershipTestEnv, { migrationManaged: true });
  try {
    const checked = await policy.readConsumerOwnershipClaimContext(String(event.id), consumerId);
    let result = checked;
    if (checked.ok) {
      const now = Math.floor(Date.now() / 1000), capability = createSunFreshHandoffToken({ eventId: String(event.id), bid: event.bid,
        uidHex: event.uid_hex, readCounter: snapshot.event.sdm_read_ctr, diagnosticId: 930002, traceId: "synthetic-current-ownership", iat: now - 1, exp: now + 299 });
      const authorized = await policy.consumeAndAuthorizeConsumerOwnershipClaim(new Request("https://synthetic.invalid/claim", { method: "POST" }),
        { fresh_token: capability, pin }, checked.context, "consumer_claim_ownership");
      result = authorized;
      if (authorized.ok) {
        proofIssued = true;
        result = await claimOwnershipForConsumer({ consumerId, eventId: String(event.id), bid: event.bid, uidHex: event.uid_hex,
          source: "sun_passport", authorization: authorized.authorization });
      }
    }
    return { result, statements, mutation, consumerId, ownershipId, snapshot, capabilityConsumed, proofIssued };
  } finally {
    remove();
    for (const key of Object.keys(configured)) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
}
