import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const QA_DATABASE = /^(?:nexid_e2e[a-z0-9_]*|codex_qa_[a-z0-9_]+)$/;
const OWN_SCHEMA = /^consumer_rewards_read_qa_[0-9a-f]{32}$/;

function identifier(value) {
  assert.match(value, OWN_SCHEMA, "Only this harness's generated schema may be mutated");
  return `"${value}"`;
}

function queryAdapter(client) {
  return async (strings, ...values) => {
    const text = strings.reduce((statement, part, index) => statement + (index ? `$${index}` : "") + part, "");
    assert.match(text.trim(), /^SELECT\b/i, "Consumer reward reads must use SELECT");
    assert.doesNotMatch(text, /\b(?:CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b|\bpublic\s*\./i, "Consumer reward reads must stay read-only inside the QA schema");
    return (await client.query(text, values)).rows;
  };
}

async function createFixtureSchema(client, schema) {
  const s = identifier(schema);
  // Columns and enum values come from loyalty-schema.ts and migrations 0012,
  // 0013 and 0014. No extension or production migration is executed here.
  await client.query(`
    CREATE TYPE ${s}.loyalty_program_status AS ENUM ('draft', 'active', 'paused', 'archived');
    CREATE TYPE ${s}.loyalty_member_status AS ENUM ('anonymous', 'enrolled', 'verified', 'blocked', 'deleted');
    CREATE TYPE ${s}.tenant_membership_status AS ENUM ('invited', 'active', 'paused', 'blocked', 'left');
    CREATE TYPE ${s}.consumer_reward_claim_status AS ENUM ('claimed', 'redeemed', 'cancelled', 'expired');
    CREATE TABLE ${s}.tenants (id uuid PRIMARY KEY, slug text NOT NULL UNIQUE, name text NOT NULL);
    CREATE TABLE ${s}.consumers (id uuid PRIMARY KEY, status text NOT NULL DEFAULT 'registered');
    CREATE TABLE ${s}.loyalty_programs (
      id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id), name text NOT NULL,
      status ${s}.loyalty_program_status NOT NULL DEFAULT 'draft',
      age_gate_required boolean NOT NULL DEFAULT false,
      start_at timestamptz NOT NULL DEFAULT now(), end_at timestamptz
    );
    CREATE TABLE ${s}.tenant_consumer_memberships (
      id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id),
      consumer_id uuid NOT NULL REFERENCES ${s}.consumers(id),
      status ${s}.tenant_membership_status NOT NULL DEFAULT 'active',
      points_balance integer NOT NULL DEFAULT 0, UNIQUE(tenant_id, consumer_id)
    );
    CREATE TABLE ${s}.loyalty_members (
      id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id),
      program_id uuid NOT NULL REFERENCES ${s}.loyalty_programs(id), consumer_id uuid,
      status ${s}.loyalty_member_status NOT NULL DEFAULT 'anonymous', points_balance integer NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX uq_loyalty_members_program_consumer ON ${s}.loyalty_members(program_id, consumer_id) WHERE consumer_id IS NOT NULL;
    CREATE TABLE ${s}.rewards (
      id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id),
      program_id uuid NOT NULL REFERENCES ${s}.loyalty_programs(id),
      title text NOT NULL, description text, status text NOT NULL DEFAULT 'draft',
      points_cost integer NOT NULL DEFAULT 0, stock_remaining integer,
      network_visible boolean NOT NULL DEFAULT false, requires_age_gate boolean NOT NULL DEFAULT false,
      eligibility_json jsonb NOT NULL DEFAULT '{}'::jsonb, redemption_limit_per_member integer,
      fulfillment_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE ${s}.consumer_reward_claims (
      id uuid PRIMARY KEY, consumer_id uuid NOT NULL REFERENCES ${s}.consumers(id),
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id), reward_id uuid NOT NULL REFERENCES ${s}.rewards(id),
      status ${s}.consumer_reward_claim_status NOT NULL DEFAULT 'claimed', points_spent integer NOT NULL,
      redemption_code text NOT NULL UNIQUE, idempotency_key text NOT NULL UNIQUE,
      metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_consumer_reward_claims_consumer ON ${s}.consumer_reward_claims(consumer_id, created_at DESC);
  `);
}

/**
 * Run the actual production SELECT with synthetic fixtures in one random schema.
 * Importing this harness does no I/O. The caller supplies one fresh connected pg
 * client pointing at nexid_e2e* or codex_qa_*; no env files or credentials are read.
 * Each production read runs in a PostgreSQL READ ONLY transaction. Fixture writes
 * and cleanup explicitly name only the generated schema; public is never on the
 * search path. The harness owns and closes/destroys its client in all outcomes.
 * Invoke under `node --import tsx` for the production TypeScript model import.
 * @param {{connect: () => Promise<{query: Function, end?: Function, release?: Function}>}} options
 */
export async function runConsumerRewardsReadPostgresQa({ connect } = {}) {
  assert.equal(typeof connect, "function", "An explicit QA connection factory is required");
  const schema = `consumer_rewards_read_qa_${randomUUID().replaceAll("-", "")}`;
  const s = identifier(schema);
  const report = { kind: "synthetic-postgresql-read-integration", ok: false, checks: [], cleanup: { schemaDropped: false, connectionsClosed: false } };
  let client;
  let schemaCreated = false;
  let executionError;
  try {
    client = await connect();
    assert.ok(typeof client?.query === "function" && (typeof client?.end === "function" || typeof client?.release === "function"), "connect must return a connected pg client that can be closed");
    const { rows: [identity] } = await client.query("SELECT current_database() AS database, pg_backend_pid() AS backend_pid");
    assert.match(identity?.database ?? "", QA_DATABASE, "Refusing a database without an explicit nexid_e2e or codex_qa_ name");
    const { getPrivateConsumerRewards } = await import("../../src/lib/consumer-rewards-read-model.ts");
    await client.query(`CREATE SCHEMA ${s}`);
    schemaCreated = true;
    await client.query(`SET search_path TO ${s}, pg_catalog`);
    await client.query("SELECT set_config('statement_timeout', '12000', false), set_config('lock_timeout', '10000', false)");
    const { rows: [path] } = await client.query("SELECT current_schema() AS schema");
    assert.equal(path?.schema, schema, "The fixture schema must be the active search path");
    await createFixtureSchema(client, schema);
    const executor = queryAdapter(client);

    async function read(consumerId) {
      await client.query("BEGIN READ ONLY");
      try {
        return await getPrivateConsumerRewards(consumerId, executor);
      } finally {
        await client.query("ROLLBACK");
      }
    }

    async function fixture() {
      const f = Object.fromEntries(["tenantId", "otherTenantId", "programId", "secondProgramId", "otherProgramId", "consumerId", "otherConsumerId", "memberId", "membershipId", "rewardId", "otherRewardId"]
        .map((key) => [key, randomUUID()]));
      await client.query(`INSERT INTO ${s}.tenants(id, slug, name) VALUES ($1::uuid, ($1::uuid)::text, 'Own QA Brand'), ($2::uuid, ($2::uuid)::text, 'Other QA Brand')`, [f.tenantId, f.otherTenantId]);
      await client.query(`INSERT INTO ${s}.consumers(id) VALUES ($1), ($2)`, [f.consumerId, f.otherConsumerId]);
      await client.query(`INSERT INTO ${s}.loyalty_programs(id, tenant_id, name, status, start_at)
        VALUES ($1, $4, 'Own QA Program', 'active', now() - interval '1 day'),
               ($2, $4, 'Second QA Program', 'active', now() - interval '1 day'),
               ($3, $5, 'Other QA Program', 'active', now() - interval '1 day')`,
      [f.programId, f.secondProgramId, f.otherProgramId, f.tenantId, f.otherTenantId]);
      await client.query(`INSERT INTO ${s}.tenant_consumer_memberships(id, tenant_id, consumer_id, status, points_balance)
        VALUES ($1, $2, $3, 'active', 10000), ($4, $5, $6, 'active', 10000)`,
      [f.membershipId, f.tenantId, f.consumerId, randomUUID(), f.otherTenantId, f.otherConsumerId]);
      await client.query(`INSERT INTO ${s}.loyalty_members(id, tenant_id, program_id, consumer_id, status, points_balance)
        VALUES ($1, $2, $3, $4, 'enrolled', 20), ($5, $6, $7, $8, 'verified', 1000)`,
      [f.memberId, f.tenantId, f.programId, f.consumerId, randomUUID(), f.otherTenantId, f.otherProgramId, f.otherConsumerId]);
      await addReward(f, { id: f.rewardId });
      await addReward(f, { id: f.otherRewardId, tenantId: f.otherTenantId, programId: f.otherProgramId, title: 'OTHER-PRIVATE-CATALOG', networkVisible: true });
      return f;
    }

    async function addReward(f, options = {}) {
      const id = options.id ?? randomUUID();
      await client.query(`INSERT INTO ${s}.rewards(id, tenant_id, program_id, title, description, status, points_cost, stock_remaining, network_visible, starts_at, ends_at, created_at)
        VALUES ($1, $2, $3, $4, 'Synthetic guided visit', $5, $6, $7, $8, now() + $9::interval, CASE WHEN $10::boolean THEN now() - interval '1 day' ELSE NULL END, now())`,
      [id, options.tenantId ?? f.tenantId, options.programId ?? f.programId, options.title ?? 'Own QA Reward', options.status ?? 'active',
        options.cost ?? 40, options.stock === undefined ? 3 : options.stock, options.networkVisible ?? false, options.future ? '1 day' : '-1 day', options.expired ?? false]);
      return id;
    }

    async function addClaim(f, options = {}) {
      const id = options.id ?? randomUUID();
      await client.query(`INSERT INTO ${s}.consumer_reward_claims(id, consumer_id, tenant_id, reward_id, status, points_spent, redemption_code, idempotency_key, metadata_json, created_at)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, ($1::uuid)::text, $8::jsonb, now() + $9::interval)`,
      [id, options.consumerId ?? f.consumerId, options.tenantId ?? f.tenantId, options.rewardId ?? f.rewardId,
        options.status ?? 'claimed', options.spent ?? 15, options.code ?? `QA-${id}`, JSON.stringify(options.metadata ?? {}), options.createdAgo ?? '-1 hour']);
      return id;
    }

    async function check(name, execute) {
      try {
        await execute();
        report.checks.push({ name, ok: true });
      } catch (error) {
        report.checks.push({ name, ok: false, error: String(error.message).slice(0, 1400), ...(error.code ? { code: error.code } : {}) });
      }
    }

    await check("own_catalog_isolated_from_private_or_network_visible_other_brands", async () => {
      const f = await fixture();
      await addClaim(f, { consumerId: f.otherConsumerId, code: 'OTHER-CONSUMER-CODE' });
      const rows = await read(f.consumerId);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, f.rewardId);
      assert.equal(rows[0].claim_id, null);
      assert.equal(rows[0].redemption_code, null);
      assert.equal(rows[0].tenant_name, 'Own QA Brand');
      assert.equal(JSON.stringify(rows).includes('OTHER-'), false);
    });

    await check("unknown_consumer_has_no_catalog_or_claims", async () => {
      await fixture();
      assert.deepEqual(await read(randomUUID()), []);
    });

    await check("inactive_reward_preserves_multiple_terminal_and_live_own_claims", async () => {
      const f = await fixture();
      await client.query(`UPDATE ${s}.rewards SET status = 'inactive', points_cost = 90 WHERE id = $1`, [f.rewardId]);
      const ids = [];
      for (const status of ['claimed', 'redeemed', 'cancelled', 'expired']) ids.push(await addClaim(f, { status }));
      const rows = await read(f.consumerId);
      assert.equal(rows.length, 4);
      assert.deepEqual(rows.map((row) => row.claim_id).sort(), ids.sort());
      for (const row of rows) {
        assert.equal(row.catalog_state, 'inactive');
        assert.equal(row.state, row.claim_status);
        assert.equal(row.points_cost, 90);
        assert.equal(row.points_spent, 15);
        assert.equal(typeof row.claimed_at, 'string');
        assert.equal(row.can_claim, false);
        assert.equal(row.claim_unavailable_reason, 'review_required');
        assert.equal(row.redemption_code !== null, row.state === 'claimed');
      }
    });

    await check("own_claim_without_membership_does_not_expand_private_brand_catalog", async () => {
      const f = await fixture();
      const ownClaimId = await addClaim(f, { rewardId: f.otherRewardId, tenantId: f.otherTenantId });
      const unrelatedId = await addReward(f, { tenantId: f.otherTenantId, programId: f.otherProgramId });
      const rows = await read(f.consumerId);
      assert.equal(rows.find((row) => row.claim_id === ownClaimId)?.id, f.otherRewardId);
      assert.equal(rows.some((row) => row.id === unrelatedId), false);
    });

    await check("claim_tenant_mismatch_never_exposes_claim_or_code", async () => {
      const f = await fixture();
      const wrongClaimId = await addClaim(f, { tenantId: f.otherTenantId, code: 'MISMATCHED-CLAIM-CODE' });
      const rows = await read(f.consumerId);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].claim_id, null);
      assert.equal(rows[0].redemption_code, null);
      assert.equal(JSON.stringify(rows).includes(wrongClaimId), false);
    });

    await check("malformed_expiry_metadata_does_not_break_list_or_expose_codes", async () => {
      const f = await fixture();
      for (const value of ['', 'invalid-timestamp', '2026-02-30T00:00:00Z', true, 0, {}, []]) {
        await addClaim(f, { metadata: { expires_at: value } });
      }
      const rows = await read(f.consumerId);
      assert.equal(rows.length, 7);
      for (const row of rows) {
        assert.equal(row.state, 'locked');
        assert.equal(row.claim_status, 'claimed');
        assert.equal(row.claim_expires_at, null);
        assert.equal(row.redemption_code, null);
      }
    });

    await check("default_and_explicit_expiry_match_issued_history", async () => {
      const f = await fixture();
      const defaultId = await addClaim(f);
      const oldId = await addClaim(f, { createdAgo: '-3 days' });
      const explicitTime = new Date(Date.now() - 60_000).toISOString();
      const explicitId = await addClaim(f, { metadata: { expires_at: explicitTime } });
      const rows = await read(f.consumerId);
      const own = rows.find((row) => row.claim_id === defaultId);
      assert.equal(Date.parse(own.claim_expires_at) - Date.parse(own.claimed_at), 48 * 60 * 60 * 1000);
      assert.equal(own.state, 'claimed');
      assert.equal(rows.find((row) => row.claim_id === oldId)?.state, 'expired');
      const expired = rows.find((row) => row.claim_id === explicitId);
      assert.equal(expired.state, 'expired');
      assert.equal(expired.claim_expires_at, explicitTime);
      assert.equal(expired.redemption_code, null);
    });

    await check("only_program_balance_and_enrolled_or_verified_members_inform_catalog", async () => {
      const f = await fixture();
      assert.equal((await read(f.consumerId))[0].state, 'locked', 'Membership balance 10000 cannot cover program balance 20 and cost 40');
      for (const [status, expected] of [['anonymous', 'locked'], ['blocked', 'locked'], ['deleted', 'locked'], ['enrolled', 'reported'], ['verified', 'reported']]) {
        await client.query(`UPDATE ${s}.loyalty_members SET points_balance = 100, status = $1 WHERE id = $2`, [status, f.memberId]);
        const row = (await read(f.consumerId))[0];
        assert.equal(row.state, expected);
        assert.equal(row.can_claim, status === 'enrolled' || status === 'verified');
      }
      await client.query(`UPDATE ${s}.loyalty_members SET tenant_id = $1 WHERE id = $2`, [f.otherTenantId, f.memberId]);
      assert.equal((await read(f.consumerId))[0].state, 'locked');
      await client.query(`UPDATE ${s}.loyalty_members SET tenant_id = $1, program_id = $2 WHERE id = $3`, [f.tenantId, f.secondProgramId, f.memberId]);
      assert.equal((await read(f.consumerId))[0].state, 'locked');
      await client.query(`UPDATE ${s}.rewards SET points_cost = 0 WHERE id = $1`, [f.rewardId]);
      assert.equal((await read(f.consumerId))[0].state, 'locked', 'Missing program membership must not imply zero-point eligibility');
    });

    await check("paused_membership_is_locked_and_blocked_or_left_membership_only_retains_own_claims", async () => {
      const f = await fixture();
      await client.query(`UPDATE ${s}.tenant_consumer_memberships SET status = 'paused' WHERE id = $1`, [f.membershipId]);
      assert.equal((await read(f.consumerId))[0].state, 'locked');
      for (const status of ['blocked', 'left', 'invited']) {
        await client.query(`UPDATE ${s}.tenant_consumer_memberships SET status = $1 WHERE id = $2`, [status, f.membershipId]);
        assert.deepEqual(await read(f.consumerId), []);
      }
      const id = await addClaim(f, { status: 'cancelled' });
      const rows = await read(f.consumerId);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].claim_id, id);
    });

    await check("catalog_time_stock_and_program_tenant_states_are_read_from_real_rows", async () => {
      const f = await fixture();
      const upcoming = await addReward(f, { future: true });
      const expired = await addReward(f, { expired: true });
      const noStock = await addReward(f, { stock: 0 });
      const wrongProgram = await addReward(f, { programId: f.otherProgramId });
      const rows = await read(f.consumerId);
      assert.equal(rows.find((row) => row.id === upcoming)?.state, 'upcoming');
      assert.equal(rows.find((row) => row.id === expired)?.state, 'expired');
      assert.equal(rows.find((row) => row.id === noStock)?.state, 'out_of_stock');
      assert.equal(rows.find((row) => row.id === wrongProgram)?.state, 'inactive');
      assert.equal(rows.find((row) => row.id === wrongProgram)?.program_name, null);
    });

    await check("cutoff_preserves_exactly_latest_100_own_claims_ahead_of_catalog", async () => {
      const f = await fixture();
      const claimIds = Array.from({ length: 105 }, () => randomUUID());
      await client.query(`INSERT INTO ${s}.consumer_reward_claims(id, consumer_id, tenant_id, reward_id, status, points_spent, redemption_code, idempotency_key, created_at)
        SELECT input.id, $2::uuid, $3::uuid, $4::uuid, 'cancelled', 15, 'QA-CUTOFF-' || input.id::text,
          input.id::text, now() - input.ordinality * interval '1 minute'
        FROM unnest($1::uuid[]) WITH ORDINALITY AS input(id, ordinality)`, [claimIds, f.consumerId, f.tenantId, f.rewardId]);
      await addReward(f);
      const rows = await read(f.consumerId);
      assert.equal(rows.length, 100);
      assert.deepEqual(rows.map((row) => row.claim_id), claimIds.slice(0, 100));
      assert.ok(rows.every((row) => row.id === f.rewardId && row.redemption_code === null && row.points_spent === 15));
    });

    await check("program_balance_zero_null_and_exact_consumer_tenant_program_scope", async () => {
      const f = await fixture();
      await client.query(`INSERT INTO ${s}.loyalty_members(id, tenant_id, program_id, consumer_id, status, points_balance)
        VALUES ($1, $3, $4, $5, 'verified', 7000), ($2, $3, $6, $7, 'enrolled', 9000)`,
      [randomUUID(), randomUUID(), f.tenantId, f.secondProgramId, f.consumerId, f.programId, f.otherConsumerId]);
      const initial = await read(f.consumerId);
      assert.equal(initial.length, 1);
      assert.equal(initial[0].id, f.rewardId);
      assert.equal(initial[0].program_points_balance, 20, 'Use the exact program member, not membership, other program or other consumer balances');
      const other = await read(f.otherConsumerId);
      assert.equal(other.length, 2);
      assert.deepEqual(other.map(row => row.id).sort(), [f.rewardId, f.otherRewardId].sort());
      const enrolledOwnProgram = other.find(row => row.id === f.rewardId);
      const otherBrandProgram = other.find(row => row.id === f.otherRewardId);
      assert.equal(enrolledOwnProgram.tenant_slug, f.tenantId);
      assert.equal(enrolledOwnProgram.program_name, 'Own QA Program');
      assert.equal(enrolledOwnProgram.program_points_balance, 9000);
      assert.equal(enrolledOwnProgram.state, 'locked', 'Own enrollment reads a catalog without granting CRM or claim eligibility');
      assert.equal(otherBrandProgram.tenant_slug, f.otherTenantId);
      assert.equal(otherBrandProgram.program_name, 'Other QA Program');
      assert.equal(otherBrandProgram.program_points_balance, 1000);
      for (const row of other) {
        assert.equal(row.can_claim, row.id === f.otherRewardId);
        assert.equal(row.claim_unavailable_reason, row.can_claim ? null : 'review_required');
        assert.equal(row.claim_id, null);
        assert.equal(row.redemption_code, null);
      }
      await client.query(`UPDATE ${s}.loyalty_members SET points_balance = 0 WHERE id = $1`, [f.memberId]);
      const zero = (await read(f.consumerId))[0];
      assert.equal(zero.program_points_balance, 0);
      assert.equal(zero.state, 'locked');
      assert.equal(zero.can_claim, false);
      assert.equal(zero.claim_unavailable_reason, 'review_required');
      for (const dimension of ['tenant', 'program', 'consumer']) {
        const g = await fixture();
        if (dimension === 'tenant') await client.query(`UPDATE ${s}.loyalty_members SET tenant_id = $1 WHERE id = $2`, [g.otherTenantId, g.memberId]);
        else if (dimension === 'program') await client.query(`UPDATE ${s}.loyalty_members SET program_id = $1 WHERE id = $2`, [g.secondProgramId, g.memberId]);
        else await client.query(`UPDATE ${s}.loyalty_members SET consumer_id = $1 WHERE id = $2`, [g.otherConsumerId, g.memberId]);
        const row = (await read(g.consumerId)).find((item) => item.id === g.rewardId);
        assert.ok(row, dimension);
        assert.equal(row.program_points_balance, null, dimension);
        assert.equal(row.state, 'locked', dimension);
        assert.equal(row.can_claim, false, dimension);
        assert.equal(row.claim_unavailable_reason, 'review_required', dimension);
      }
    });

    await check("inconsistent_program_tuple_has_no_balance_and_preserves_own_voucher", async () => {
      const f = await fixture();
      const wrongReward = await addReward(f, { programId: f.otherProgramId });
      await client.query(`INSERT INTO ${s}.loyalty_members(id, tenant_id, program_id, consumer_id, status, points_balance)
        VALUES ($1, $2, $3, $4, 'enrolled', 900)`, [randomUUID(), f.tenantId, f.otherProgramId, f.consumerId]);
      const claimId = await addClaim(f, { rewardId: wrongReward, spent: 15 });
      const rows = await read(f.consumerId);
      const voucher = rows.find((row) => row.claim_id === claimId);
      assert.ok(voucher);
      assert.equal(voucher.id, wrongReward);
      assert.equal(voucher.tenant_slug, f.tenantId);
      assert.equal(voucher.program_name, null);
      assert.equal(voucher.catalog_state, 'inactive');
      assert.equal(voucher.program_points_balance, null);
      assert.equal(voucher.state, 'claimed');
      assert.equal(voucher.claim_status, 'claimed');
      assert.equal(voucher.points_spent, 15);
      assert.equal(voucher.redemption_code, `QA-${claimId}`);
      assert.equal(voucher.can_claim, false);
      assert.equal(voucher.claim_unavailable_reason, 'review_required');
      assert.equal(Object.hasOwn(voucher, 'program_identity_matches'), false);
      assert.equal(rows.find((row) => row.id === f.rewardId)?.program_points_balance, 20);
    });

    await check("current_program_balance_changes_without_rewriting_historical_voucher_points", async () => {
      const f = await fixture();
      const claimId = await addClaim(f, { spent: 15 });
      const initial = (await read(f.consumerId)).find((row) => row.claim_id === claimId);
      assert.ok(initial);
      assert.equal(initial.program_points_balance, 20);
      assert.equal(initial.points_spent, 15);
      assert.equal(initial.redemption_code, `QA-${claimId}`);
      await client.query(`UPDATE ${s}.loyalty_members SET points_balance = 7 WHERE id = $1`, [f.memberId]);
      for (const status of ['active', 'paused', 'blocked']) {
        await client.query(`UPDATE ${s}.tenant_consumer_memberships SET status = $1 WHERE id = $2`, [status, f.membershipId]);
        const row = (await read(f.consumerId)).find((item) => item.claim_id === claimId);
        assert.ok(row, status);
        assert.equal(row.program_points_balance, 7, status);
        assert.equal(row.points_spent, 15, status);
        assert.equal(row.claimed_at, initial.claimed_at, status);
        assert.equal(row.claim_status, 'claimed', status);
        assert.equal(row.redemption_code, initial.redemption_code, status);
        assert.equal(row.can_claim, false, status);
        assert.equal(row.claim_unavailable_reason, 'review_required', status);
      }
      await client.query(`UPDATE ${s}.consumer_reward_claims SET status = 'cancelled' WHERE id = $1`, [claimId]);
      const cancelled = (await read(f.consumerId)).find((row) => row.claim_id === claimId);
      assert.ok(cancelled);
      assert.equal(cancelled.program_points_balance, 7);
      assert.equal(cancelled.points_spent, 15);
      assert.equal(cancelled.state, 'cancelled');
      assert.equal(cancelled.redemption_code, null);
      await client.query(`DELETE FROM ${s}.loyalty_members WHERE id = $1`, [f.memberId]);
      const missing = (await read(f.consumerId)).find((row) => row.claim_id === claimId);
      assert.ok(missing);
      assert.equal(missing.program_points_balance, null);
      assert.equal(missing.points_spent, 15);
      assert.equal(missing.state, 'cancelled');
      assert.equal(missing.redemption_code, null);
      assert.equal(missing.can_claim, false);
    });

    await check("own_current_published_program_catalog_is_readable_after_enrollment_without_crm", async () => {
      const f = await fixture();
      await client.query(`DELETE FROM ${s}.tenant_consumer_memberships WHERE id = $1`, [f.membershipId]);
      await client.query(`UPDATE ${s}.rewards SET points_cost = 0 WHERE id = $1`, [f.rewardId]);
      await client.query(`UPDATE ${s}.loyalty_members SET points_balance = 0 WHERE id = $1`, [f.memberId]);
      const observe = async () => (await client.query(`SELECT
        (SELECT count(*)::integer FROM ${s}.tenant_consumer_memberships WHERE tenant_id = $1 AND consumer_id = $2) AS crm_rows,
        (SELECT count(*)::integer FROM ${s}.consumer_reward_claims WHERE consumer_id = $2) AS claims,
        (SELECT points_balance FROM ${s}.loyalty_members WHERE id = $3) AS program_points,
        (SELECT stock_remaining FROM ${s}.rewards WHERE id = $4) AS stock`,
      [f.tenantId, f.consumerId, f.memberId, f.rewardId])).rows[0];
      for (const status of ['enrolled', 'verified']) {
        await client.query(`UPDATE ${s}.loyalty_members SET status = $1 WHERE id = $2`, [status, f.memberId]);
        const before = await observe();
        const rows = await read(f.consumerId);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].id, f.rewardId);
        assert.equal(rows[0].tenant_slug, f.tenantId);
        assert.equal(rows[0].program_name, 'Own QA Program');
        assert.equal(rows[0].program_points_balance, 0);
        assert.equal(rows[0].points_cost, 0);
        assert.equal(rows[0].state, 'locked');
        assert.equal(rows[0].can_claim, false);
        assert.equal(rows[0].claim_unavailable_reason, 'review_required');
        assert.equal(rows[0].claim_id, null);
        assert.equal(rows[0].redemption_code, null);
        assert.equal(JSON.stringify(rows).includes('OTHER-'), false);
        assert.deepEqual(await observe(), before, 'A catalog read cannot create CRM, claims, points or stock effects');
        assert.equal(before.crm_rows, 0);
        assert.equal(before.claims, 0);
      }
    });

    await check("enrolled_catalog_without_crm_requires_exact_consumer_tenant_and_program", async () => {
      for (const dimension of ['consumer', 'tenant', 'program']) {
        const f = await fixture();
        await client.query(`DELETE FROM ${s}.tenant_consumer_memberships WHERE id = $1`, [f.membershipId]);
        if (dimension === 'consumer') await client.query(`UPDATE ${s}.loyalty_members SET consumer_id = $1 WHERE id = $2`, [f.otherConsumerId, f.memberId]);
        else if (dimension === 'tenant') await client.query(`UPDATE ${s}.loyalty_members SET tenant_id = $1 WHERE id = $2`, [f.otherTenantId, f.memberId]);
        else await client.query(`UPDATE ${s}.loyalty_members SET program_id = $1 WHERE id = $2`, [f.secondProgramId, f.memberId]);
        assert.deepEqual(await read(f.consumerId), [], dimension);
      }
      const f = await fixture();
      await client.query(`DELETE FROM ${s}.tenant_consumer_memberships WHERE id = $1`, [f.membershipId]);
      const otherProgramReward = await addReward(f, { programId: f.secondProgramId });
      const rows = await read(f.consumerId);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, f.rewardId);
      assert.equal(rows.some(row => row.id === otherProgramReward), false);
    });

    await check("enrolled_catalog_without_crm_refuses_absent_anonymous_blocked_and_deleted_members", async () => {
      for (const status of ['anonymous', 'blocked', 'deleted']) {
        const f = await fixture();
        await client.query(`DELETE FROM ${s}.tenant_consumer_memberships WHERE id = $1`, [f.membershipId]);
        await client.query(`UPDATE ${s}.loyalty_members SET status = $1 WHERE id = $2`, [status, f.memberId]);
        assert.deepEqual(await read(f.consumerId), [], status);
      }
      const f = await fixture();
      await client.query(`DELETE FROM ${s}.tenant_consumer_memberships WHERE id = $1`, [f.membershipId]);
      await client.query(`DELETE FROM ${s}.loyalty_members WHERE id = $1`, [f.memberId]);
      assert.deepEqual(await read(f.consumerId), []);
    });

    await check("enrolled_catalog_without_crm_requires_published_current_program_and_reward", async () => {
      for (const target of ['program', 'reward']) {
        for (const status of ['draft', 'paused', 'archived']) {
          const f = await fixture();
          await client.query(`DELETE FROM ${s}.tenant_consumer_memberships WHERE id = $1`, [f.membershipId]);
          if (target === 'program') await client.query(`UPDATE ${s}.loyalty_programs SET status = $1 WHERE id = $2`, [status, f.programId]);
          else await client.query(`UPDATE ${s}.rewards SET status = $1 WHERE id = $2`, [status, f.rewardId]);
          assert.deepEqual(await read(f.consumerId), [], target + ':' + status);
        }
        for (const window of ['future', 'expired', 'end_elapsed']) {
          const f = await fixture();
          await client.query(`DELETE FROM ${s}.tenant_consumer_memberships WHERE id = $1`, [f.membershipId]);
          if (target === 'program') {
            if (window === 'future') await client.query(`UPDATE ${s}.loyalty_programs SET start_at = now() + interval '1 day' WHERE id = $1`, [f.programId]);
            else await client.query(`UPDATE ${s}.loyalty_programs SET end_at = now() - $1::interval WHERE id = $2`, [window === 'expired' ? '1 day' : '0 seconds', f.programId]);
          } else {
            if (window === 'future') await client.query(`UPDATE ${s}.rewards SET starts_at = now() + interval '1 day' WHERE id = $1`, [f.rewardId]);
            else await client.query(`UPDATE ${s}.rewards SET ends_at = now() - $1::interval WHERE id = $2`, [window === 'expired' ? '1 day' : '0 seconds', f.rewardId]);
          }
          assert.deepEqual(await read(f.consumerId), [], target + ':' + window);
        }
      }
    });

    await check("existing_nonactive_crm_membership_is_not_bypassed_by_own_program_enrollment", async () => {
      const f = await fixture();
      for (const status of ['blocked', 'left', 'invited']) {
        await client.query(`UPDATE ${s}.tenant_consumer_memberships SET status = $1 WHERE id = $2`, [status, f.membershipId]);
        assert.deepEqual(await read(f.consumerId), [], status);
      }
      await client.query(`UPDATE ${s}.tenant_consumer_memberships SET status = 'paused' WHERE id = $1`, [f.membershipId]);
      assert.equal((await read(f.consumerId))[0].state, 'locked', 'Preserve the existing paused-brand read branch');
      await client.query(`UPDATE ${s}.tenant_consumer_memberships SET status = 'blocked' WHERE id = $1`, [f.membershipId]);
      const claimId = await addClaim(f, { status: 'cancelled' });
      const history = await read(f.consumerId);
      assert.equal(history.length, 1);
      assert.equal(history[0].claim_id, claimId);
      assert.equal(history[0].state, 'cancelled');
      assert.equal(history[0].redemption_code, null);
      assert.equal(history[0].can_claim, false);
    });

    await check("unpublished_association_and_network_discovery_remain_blocked_own_history_preserved", async () => {
      const f = await fixture();
      await client.query(`DELETE FROM ${s}.tenant_consumer_memberships WHERE id = $1`, [f.membershipId]);
      const mismatchedReward = await addReward(f, { programId: f.otherProgramId });
      await client.query(`INSERT INTO ${s}.loyalty_members(id, tenant_id, program_id, consumer_id, status, points_balance)
        VALUES ($1, $2, $3, $4, 'verified', 1000)`, [randomUUID(), f.tenantId, f.otherProgramId, f.consumerId]);
      assert.equal((await read(f.consumerId)).some(row => row.id === mismatchedReward), false, 'Persisted reward and program tenants must agree even with a malformed member tuple');
      await client.query(`UPDATE ${s}.rewards SET network_visible = true WHERE id = $1`, [f.rewardId]);
      assert.deepEqual(await read(randomUUID()), [], 'Network visibility never supplies an enrollment relationship');
      const claimId = await addClaim(f, { rewardId: mismatchedReward, status: 'cancelled' });
      const rows = await read(f.consumerId);
      const historical = rows.find(row => row.claim_id === claimId);
      assert.ok(historical);
      assert.equal(historical.state, 'cancelled');
      assert.equal(historical.program_name, null);
      assert.equal(historical.program_points_balance, null);
      assert.equal(historical.can_claim, false);
      assert.equal(historical.redemption_code, null);
      assert.equal(rows.some(row => row.id === f.otherRewardId), false);
    });

    await check("own_published_evergreen_program_catalog_keeps_nullable_end_contract", async () => {
      const f = await fixture();
      await client.query(`DELETE FROM ${s}.tenant_consumer_memberships WHERE id = $1`, [f.membershipId]);
      await client.query(`UPDATE ${s}.loyalty_programs SET start_at = now() - interval '1 day', end_at = NULL WHERE id = $1`, [f.programId]);
      await client.query(`UPDATE ${s}.rewards SET starts_at = now() - interval '1 day', ends_at = NULL WHERE id = $1`, [f.rewardId]);
      const { rows: [window] } = await client.query(`SELECT program.start_at, program.end_at, reward.starts_at, reward.ends_at
        FROM ${s}.loyalty_programs program JOIN ${s}.rewards reward ON reward.program_id = program.id AND reward.tenant_id = program.tenant_id
        WHERE program.id = $1 AND reward.id = $2`, [f.programId, f.rewardId]);
      assert.ok(window.start_at);
      assert.ok(window.starts_at);
      assert.equal(window.end_at, null);
      assert.equal(window.ends_at, null);
      const rows = await read(f.consumerId);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, f.rewardId);
      assert.equal(rows[0].state, 'locked');
      assert.equal(rows[0].can_claim, false);
      assert.equal(rows[0].claim_id, null);
      assert.equal(rows[0].redemption_code, null);
    });

    await check("statement_clock_proves_inclusive_start_exclusive_end_and_exact_single_member", async () => {
      // Prepare every nominal fixture before the table-backed views. These
      // views live only in the harness's generated QA schema; each read still
      // imports the actual reader and executes its unchanged SELECT READ ONLY.
      // Dynamic date columns equal statement_timestamp() in the same SELECT,
      // so this checks equality instead of an earlier fixture-write timestamp.
      const fixtures = [];
      for (const label of ['program_start_equal', 'program_end_equal', 'reward_start_equal', 'reward_end_equal', 'duplicate_member']) {
        const f = await fixture();
        await client.query(`DELETE FROM ${s}.tenant_consumer_memberships WHERE id = $1`, [f.membershipId]);
        fixtures.push({ label, ...f });
      }
      const [programStart, programEnd, rewardStart, rewardEnd, duplicate] = fixtures;
      await client.query(`ALTER TABLE ${s}.loyalty_programs RENAME TO qa_clock_program_rows`);
      await client.query(`CREATE VIEW ${s}.loyalty_programs AS SELECT
        id, tenant_id, name, status,
        CASE WHEN id = '${programStart.programId}'::uuid THEN statement_timestamp() ELSE start_at END AS start_at,
        CASE WHEN id = '${programEnd.programId}'::uuid THEN statement_timestamp() ELSE end_at END AS end_at
        FROM ${s}.qa_clock_program_rows`);
      await client.query(`ALTER TABLE ${s}.rewards RENAME TO qa_clock_reward_rows`);
      await client.query(`CREATE VIEW ${s}.rewards AS SELECT
        id, tenant_id, program_id, title, description, status, points_cost, stock_remaining, network_visible,
        CASE WHEN id = '${rewardStart.rewardId}'::uuid THEN statement_timestamp() ELSE starts_at END AS starts_at,
        CASE WHEN id = '${rewardEnd.rewardId}'::uuid THEN statement_timestamp() ELSE ends_at END AS ends_at, created_at
        FROM ${s}.qa_clock_reward_rows`);
      await client.query(`ALTER TABLE ${s}.loyalty_members RENAME TO qa_clock_member_rows`);
      await client.query(`CREATE VIEW ${s}.loyalty_members AS
        SELECT id, tenant_id, program_id, consumer_id, status, points_balance FROM ${s}.qa_clock_member_rows
        UNION ALL SELECT id, tenant_id, program_id, consumer_id, status, points_balance
          FROM ${s}.qa_clock_member_rows WHERE id = '${duplicate.memberId}'::uuid`);
      for (const f of fixtures) {
        const rows = await read(f.consumerId);
        if (f.label.endsWith('start_equal')) {
          assert.equal(rows.length, 1, f.label);
          assert.equal(rows[0].id, f.rewardId, f.label);
          assert.equal(rows[0].claim_id, null);
          assert.equal(rows[0].can_claim, false);
          assert.equal(rows[0].redemption_code, null);
        } else {
          assert.deepEqual(rows, [], f.label);
        }
      }
    });
    report.ok = report.checks.every((result) => result.ok);
  } catch (error) {
    executionError = error;
  } finally {
    if (schemaCreated) {
      try {
        await client.query("ROLLBACK");
        await client.query(`DROP SCHEMA ${identifier(schema)} CASCADE`);
        report.cleanup.schemaDropped = true;
      } catch (error) {
        report.ok = false;
        report.cleanup.error = "Could not drop the harness's generated QA schema";
        executionError ??= error;
      }
    }
    try {
      if (typeof client?.release === "function") await client.release(true);
      else if (typeof client?.end === "function") await client.end();
      report.cleanup.connectionsClosed = true;
    } catch (error) {
      report.ok = false;
      executionError ??= error;
    }
  }
  if (executionError) throw executionError;
  return report;
}
