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
    CREATE TABLE ${s}.consumers (id uuid PRIMARY KEY);
    CREATE TABLE ${s}.loyalty_programs (
      id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id), name text NOT NULL,
      status ${s}.loyalty_program_status NOT NULL DEFAULT 'draft',
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
      network_visible boolean NOT NULL DEFAULT false,
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
        assert.equal(row.can_claim, false);
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
