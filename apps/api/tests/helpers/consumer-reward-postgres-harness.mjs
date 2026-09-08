import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const QA_DATABASE = /^(?:nexid_e2e[a-z0-9_]*|codex_qa_[a-z0-9_]+)$/;
const OWN_SCHEMA = /^consumer_rewards_qa_[0-9a-f]{32}$/;

function identifier(value) {
  assert.match(value, OWN_SCHEMA, "Only this harness's generated schema may be mutated");
  return `"${value}"`;
}

function queryAdapter(client) {
  return async (strings, ...values) => {
    const text = strings.reduce((sql, part, index) => sql + (index ? `$${index}` : "") + part, "");
    assert.doesNotMatch(text, /\bpublic\s*\./i, "Reward QA must never query public tables");
    return (await client.query(text, values)).rows;
  };
}

// Relevant columns, enum values, keys, and indexes mirror loyalty-schema.ts and
// 0013_consumer_reward_claims.sql. Deliberately do not add CHECKs for nonnegative
// balances or stock: the real queries themselves must enforce those invariants.
async function createFixtureSchema(client, schema) {
  const s = identifier(schema);
  await client.query(`
    CREATE TYPE ${s}.points_source AS ENUM (
      'TAP_VALID', 'PROVENANCE_VIEWED', 'OWNERSHIP_ACTIVATED', 'WARRANTY_REGISTERED',
      'QUIZ_COMPLETED', 'EXPERIENCE_ATTENDED', 'REFERRAL_SIGNUP', 'REWARD_REDEEMED',
      'ADMIN_ADJUSTMENT', 'FRAUD_REVERSAL', 'EXPIRATION'
    );
    CREATE TYPE ${s}.loyalty_member_status AS ENUM ('anonymous', 'enrolled', 'verified', 'blocked', 'deleted');
    CREATE TYPE ${s}.consumer_reward_claim_status AS ENUM ('claimed', 'redeemed', 'cancelled', 'expired');
    CREATE TABLE ${s}.tenants (id uuid PRIMARY KEY);
    CREATE TABLE ${s}.consumers (id uuid PRIMARY KEY);
    CREATE TABLE ${s}.loyalty_programs (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE
    );
    CREATE TABLE ${s}.loyalty_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      program_id uuid NOT NULL REFERENCES ${s}.loyalty_programs(id) ON DELETE CASCADE,
      consumer_id uuid, member_key text, email text,
      status ${s}.loyalty_member_status NOT NULL DEFAULT 'anonymous',
      points_balance integer NOT NULL DEFAULT 0,
      lifetime_points integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX uq_loyalty_members_program_email ON ${s}.loyalty_members(program_id, email);
    CREATE UNIQUE INDEX uq_loyalty_members_program_member_key ON ${s}.loyalty_members(program_id, member_key);
    CREATE UNIQUE INDEX uq_loyalty_members_program_consumer ON ${s}.loyalty_members(program_id, consumer_id) WHERE consumer_id IS NOT NULL;
    CREATE INDEX idx_loyalty_members_consumer_program ON ${s}.loyalty_members(consumer_id, program_id);
    CREATE TABLE ${s}.rewards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      program_id uuid NOT NULL REFERENCES ${s}.loyalty_programs(id) ON DELETE CASCADE,
      code text NOT NULL, title text NOT NULL,
      status text NOT NULL DEFAULT 'draft', points_cost integer NOT NULL DEFAULT 0,
      stock_total integer, stock_remaining integer,
      starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(program_id, code)
    );
    CREATE TABLE ${s}.points_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      program_id uuid NOT NULL REFERENCES ${s}.loyalty_programs(id) ON DELETE CASCADE,
      member_id uuid NOT NULL REFERENCES ${s}.loyalty_members(id) ON DELETE CASCADE,
      tap_event_id bigint, source ${s}.points_source NOT NULL,
      delta integer NOT NULL, balance_after integer NOT NULL,
      idempotency_key text UNIQUE, reason text,
      metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE ${s}.consumer_reward_claims (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      consumer_id uuid NOT NULL REFERENCES ${s}.consumers(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES ${s}.tenants(id) ON DELETE CASCADE,
      reward_id uuid NOT NULL REFERENCES ${s}.rewards(id) ON DELETE CASCADE,
      tap_event_id bigint,
      status ${s}.consumer_reward_claim_status NOT NULL DEFAULT 'claimed',
      points_spent integer NOT NULL,
      redemption_code text NOT NULL UNIQUE, idempotency_key text NOT NULL UNIQUE,
      metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_consumer_reward_claims_consumer ON ${s}.consumer_reward_claims(consumer_id, created_at DESC);
  `);
}

/**
 * Synthetic integration QA against an explicitly selected, disposable PostgreSQL
 * database. Importing this module does no I/O. No env files, credentials, URLs,
 * production migrations, extensions, or public tables are read or written.
 *
 * connect() must return a fresh, already-connected pg Client/PoolClient each time,
 * outside any caller transaction. All three connections must target the same QA
 * database (name beginning nexid_e2e or codex_qa_). The harness owns and closes
 * these clients, creates one random schema, and drops ONLY that schema finally.
 * Call with a TypeScript-aware loader such as `node --import tsx` so the exact
 * production query helpers can be imported. The returned report contains only
 * synthetic test results; the caller decides whether an unsuccessful report
 * should fail its command. Connection/setup/safety failures reject the promise.
 *
 * @param {{connect: () => Promise<{query: Function, end?: Function, release?: Function}>}} options
 */
export async function runConsumerRewardPostgresQa({ connect } = {}) {
  assert.equal(typeof connect, "function", "An explicit QA connection factory is required");
  const clients = [];
  const schema = `consumer_rewards_qa_${randomUUID().replaceAll("-", "")}`;
  const s = identifier(schema);
  const report = { kind: "synthetic-postgresql-integration", ok: false, checks: [], cleanup: { schemaDropped: false, connectionsClosed: false } };
  let schemaCreated = false;
  let executionError;
  try {
    // Connect sequentially so an unsafe first target is rejected before opening
    // more sessions; finally also covers an interrupted connection sequence.
    let database;
    const pids = [];
    for (let index = 0; index < 3; index += 1) {
      const client = await connect();
      assert.ok(!clients.includes(client), "Concurrency QA requires independent clients");
      clients.push(client);
      assert.ok(typeof client?.query === "function" && (typeof client?.end === "function" || typeof client?.release === "function"), "connect must return a connected pg client that can be closed");
      const { rows: [identity] } = await client.query("SELECT current_database() AS database, pg_backend_pid() AS backend_pid");
      assert.match(identity?.database ?? "", QA_DATABASE, "Refusing a database without an explicit nexid_e2e or codex_qa_ name");
      database ??= identity.database;
      assert.equal(identity.database, database, "All QA clients must use the same database");
      assert.ok(Number.isInteger(identity.backend_pid) && !pids.includes(identity.backend_pid), "Concurrency QA requires separate PostgreSQL backends");
      pids.push(identity.backend_pid);
    }
    const { insertConsumerRewardClaim, refundConsumerRewardClaim } = await import("../../src/lib/consumer-reward-queries.ts");
    const [admin, first, second] = clients;
    const [firstQuery, secondQuery] = [first, second].map(queryAdapter);
    await admin.query(`CREATE SCHEMA ${s}`);
    schemaCreated = true;
    for (const client of clients) {
      await client.query(`SET search_path TO ${s}, pg_catalog`);
      await client.query("SELECT set_config('statement_timeout', '12000', false), set_config('lock_timeout', '10000', false)");
      const { rows: [path] } = await client.query("SELECT current_schema() AS schema");
      assert.equal(path.schema, schema, "The fixture schema must be the active search path");
    }
    await createFixtureSchema(admin, schema);

    async function fixture(options = {}) {
      const f = Object.fromEntries(["tenantId", "otherTenantId", "programId", "otherProgramId", "consumerId", "memberId", "rewardId"].map((key) => [key, randomUUID()]));
      await admin.query(`INSERT INTO ${s}.tenants(id) VALUES ($1), ($2)`, [f.tenantId, f.otherTenantId]);
      await admin.query(`INSERT INTO ${s}.loyalty_programs(id, tenant_id) VALUES ($1, $3), ($2, $3)`, [f.programId, f.otherProgramId, f.tenantId]);
      await admin.query(`INSERT INTO ${s}.consumers(id) VALUES ($1)`, [f.consumerId]);
      await admin.query(`INSERT INTO ${s}.loyalty_members(id, tenant_id, program_id, consumer_id, status, points_balance, lifetime_points)
        VALUES ($1, $2, $3, $4, $5, $6, $6)`, [f.memberId, options.wrongTenant ? f.otherTenantId : f.tenantId, options.wrongProgram ? f.otherProgramId : f.programId, f.consumerId, options.memberStatus ?? "enrolled", options.points ?? 100]);
      await addReward(f, f.rewardId, options);
      return f;
    }

    async function addReward(f, rewardId, options = {}) {
      const stock = options.stock === undefined ? 2 : options.stock;
      await admin.query(`INSERT INTO ${s}.rewards(id, tenant_id, program_id, code, title, status, points_cost, stock_total, stock_remaining, starts_at, ends_at)
        VALUES ($1::uuid, $2::uuid, $3::uuid, ($1::uuid)::text, 'Synthetic QA reward', $4, $5, $6, $6, now() + $7::interval, CASE WHEN $8::boolean THEN now() - interval '1 day' ELSE NULL END)`,
      [rewardId, f.tenantId, f.programId, options.rewardStatus ?? "active", options.cost ?? 40, stock, options.future ? "1 day" : "-1 day", options.expired ?? false]);
    }

    function claim(f, query = firstQuery, overrides = {}) {
      const consumerId = overrides.consumerId ?? f.consumerId;
      const rewardId = overrides.rewardId ?? f.rewardId;
      return insertConsumerRewardClaim(query, {
        consumerId, rewardId, idempotencyKey: `consumer-reward-claim:${consumerId}:${rewardId}`,
        redemptionCode: `QA-${randomUUID()}`, locale: "es-AR", ...overrides,
      });
    }

    function refund(f, claimId, query = firstQuery, overrides = {}) {
      return refundConsumerRewardClaim(query, {
        consumerId: f.consumerId, claimId, rewardId: f.rewardId,
        idempotencyKey: `consumer-reward-cancel:${f.consumerId}:${claimId}`, ...overrides,
      });
    }

    async function state(f) {
      const tables = ["loyalty_members", "rewards", "points_ledger", "consumer_reward_claims"];
      const rows = await Promise.all(tables.map(async (table) => (await admin.query(
        `SELECT * FROM ${s}."${table}" WHERE tenant_id = ANY($1::uuid[]) ORDER BY id`, [ [f.tenantId, f.otherTenantId] ],
      )).rows));
      return { members: rows[0], rewards: rows[1], ledger: rows[2], claims: rows[3] };
    }

    async function check(name, execute) {
      try {
        await execute();
        report.checks.push({ name, ok: true });
      } catch (error) {
        report.checks.push({ name, ok: false, error: String(error.message).slice(0, 1400), ...(error.code ? { code: error.code } : {}) });
      }
    }

    async function unchanged(f, operation) {
      const before = await state(f);
      assert.equal((await operation()).length, 0, "The operation must return no new row");
      assert.deepEqual(await state(f), before, "Rejected operations must not change balances, stock, claims, or ledger");
    }

    // Hold a real row lock while both independent backends enter their query.
    // Observe both waiting in PostgreSQL before release; Promise.all alone does
    // not prove overlap. The barrier and SQL timeouts are deliberately bounded.
    async function concurrent(table, id, operations) {
      assert.ok(["loyalty_members", "rewards", "consumer_reward_claims"].includes(table));
      let pending;
      let barrierError;
      await admin.query("BEGIN");
      try {
        await admin.query(`SELECT id FROM ${s}."${table}" WHERE id = $1 FOR UPDATE`, [id]);
        pending = Promise.allSettled(operations.map((operation) => Promise.resolve().then(operation)));
        const deadline = Date.now() + 6000;
        let bothWaiting = false;
        while (Date.now() < deadline) {
          // Clear the transaction's statistics snapshot before every observation.
          await admin.query("SELECT pg_stat_clear_snapshot()");
          const { rows } = await admin.query("SELECT pid FROM pg_stat_activity WHERE pid = ANY($1::integer[]) AND wait_event_type = 'Lock'", [pids.slice(1)]);
          if (rows.length === 2) { bothWaiting = true; break; }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.ok(bothWaiting, "Both PostgreSQL backends must overlap while waiting for the fixture lock");
      } catch (error) {
        barrierError = error;
      } finally {
        await admin.query("ROLLBACK");
      }
      const results = pending ? await pending : [];
      if (barrierError) throw barrierError;
      for (const result of results) if (result.status === "rejected") throw result.reason;
      return results.map((result) => result.value);
    }

    function assertSingleClaim(current, { balance = 60, stock = 1, cost = 40 } = {}) {
      assert.equal(current.claims.length, 1);
      assert.equal(current.claims[0].status, "claimed");
      assert.equal(current.claims[0].points_spent, cost);
      assert.equal(current.members[0].points_balance, balance);
      assert.equal(current.rewards[0].stock_remaining, stock);
      assert.equal(current.ledger.length, 1);
      assert.equal(current.ledger[0].source, "REWARD_REDEEMED");
      assert.equal(current.ledger[0].delta, -cost);
      assert.equal(current.ledger[0].balance_after, balance);
    }

    await check("claim_debits_points_stock_and_ledger_atomically", async () => {
      const f = await fixture();
      assert.equal((await claim(f)).length, 1);
      assertSingleClaim(await state(f));
    });

    await check("same_consumer_reward_concurrently_claimed_once", async () => {
      const f = await fixture();
      const results = await concurrent("rewards", f.rewardId, [() => claim(f, firstQuery), () => claim(f, secondQuery)]);
      assert.equal(results.flat().length, 1);
      assertSingleClaim(await state(f));
      await unchanged(f, () => claim(f));
    });

    await check("two_consumers_compete_for_one_stock_unit", async () => {
      const f = await fixture({ stock: 1 });
      const otherConsumerId = randomUUID();
      await admin.query(`INSERT INTO ${s}.consumers(id) VALUES ($1)`, [otherConsumerId]);
      await admin.query(`INSERT INTO ${s}.loyalty_members(tenant_id, program_id, consumer_id, status, points_balance) VALUES ($1, $2, $3, 'enrolled', 100)`, [f.tenantId, f.programId, otherConsumerId]);
      const results = await concurrent("rewards", f.rewardId, [() => claim(f, firstQuery), () => claim(f, secondQuery, { consumerId: otherConsumerId })]);
      assert.equal(results.flat().length, 1);
      const current = await state(f);
      assert.equal(current.claims.length, 1);
      assert.equal(current.rewards[0].stock_remaining, 0);
      assert.deepEqual(current.members.map((member) => member.points_balance).sort((a, b) => a - b), [60, 100]);
      assert.equal(current.ledger.length, 1);
      assert.equal(current.ledger[0].delta, -40);
      assert.equal(current.ledger[0].balance_after, 60);
    });

    await check("two_rewards_cannot_overdraw_one_member", async () => {
      const f = await fixture({ cost: 70 });
      const otherRewardId = randomUUID();
      await addReward(f, otherRewardId, { cost: 70 });
      const results = await concurrent("loyalty_members", f.memberId, [() => claim(f, firstQuery), () => claim(f, secondQuery, { rewardId: otherRewardId })]);
      assert.equal(results.flat().length, 1);
      const current = await state(f);
      assert.equal(current.members[0].points_balance, 30);
      assert.deepEqual(current.rewards.map((reward) => reward.stock_remaining).sort(), [1, 2]);
      assert.equal(current.claims.length, 1);
      assert.equal(current.ledger.length, 1);
      assert.equal(current.ledger[0].delta, -70);
      assert.equal(current.ledger[0].balance_after, 30);
    });

    await check("two_affordable_rewards_record_serialized_balances", async () => {
      const f = await fixture();
      const otherRewardId = randomUUID();
      await addReward(f, otherRewardId);
      const results = await concurrent("loyalty_members", f.memberId, [() => claim(f, firstQuery), () => claim(f, secondQuery, { rewardId: otherRewardId })]);
      assert.equal(results.flat().length, 2);
      const current = await state(f);
      assert.equal(current.members[0].points_balance, 20);
      assert.deepEqual(current.rewards.map((reward) => reward.stock_remaining), [1, 1]);
      assert.equal(current.claims.length, 2);
      assert.equal(current.ledger.length, 2);
      assert.deepEqual(current.ledger.map((entry) => entry.balance_after).sort((a, b) => a - b), [20, 60]);
      assert.ok(current.ledger.every((entry) => entry.delta === -40));
    });

    await check("concurrent_and_repeated_cancel_refunds_once", async () => {
      const f = await fixture();
      const [created] = await claim(f);
      assert.ok(created?.id, "A claim must exist before cancellation");
      const results = await concurrent("consumer_reward_claims", created.id, [() => refund(f, created.id, firstQuery), () => refund(f, created.id, secondQuery)]);
      assert.equal(results.flat().length, 1);
      const current = await state(f);
      assert.equal(current.members[0].points_balance, 100);
      assert.equal(current.rewards[0].stock_remaining, 2);
      assert.equal(current.claims[0].status, "cancelled");
      assert.equal(current.ledger.length, 2);
      const refundLedger = current.ledger.filter((entry) => entry.source === "ADMIN_ADJUSTMENT");
      assert.equal(refundLedger.length, 1);
      assert.equal(refundLedger[0].delta, 40);
      assert.equal(refundLedger[0].balance_after, 100);
      await unchanged(f, () => refund(f, created.id));
    });

    for (const [name, options] of [
      ["insufficient_points", { points: 39 }], ["expired_reward", { expired: true }],
      ["future_reward", { future: true }], ["inactive_reward", { rewardStatus: "draft" }],
      ["blocked_member", { memberStatus: "blocked" }], ["deleted_member", { memberStatus: "deleted" }],
      ["empty_stock", { stock: 0 }], ["wrong_tenant", { wrongTenant: true }],
      ["wrong_program", { wrongProgram: true }], ["negative_cost", { cost: -40 }],
    ]) {
      await check(`${name}_claim_has_no_writes`, async () => {
        const f = await fixture(options);
        await unchanged(f, () => claim(f));
      });
    }

    await check("wrong_consumer_cannot_claim_or_cancel", async () => {
      const f = await fixture();
      await unchanged(f, () => claim(f, firstQuery, { consumerId: randomUUID() }));
      const [created] = await claim(f);
      assert.ok(created?.id);
      await unchanged(f, () => refund(f, created.id, firstQuery, { consumerId: randomUUID() }));
      await unchanged(f, () => refund(f, created.id, firstQuery, { rewardId: randomUUID() }));
    });

    for (const scope of ["claim_tenant", "reward_tenant", "member_program"]) {
      await check(`${scope}_mismatch_cannot_refund`, async () => {
        const f = await fixture();
        const [created] = await claim(f);
        assert.ok(created?.id);
        if (scope === "claim_tenant") await admin.query(`UPDATE ${s}.consumer_reward_claims SET tenant_id = $1 WHERE id = $2`, [f.otherTenantId, created.id]);
        if (scope === "reward_tenant") await admin.query(`UPDATE ${s}.rewards SET tenant_id = $1 WHERE id = $2`, [f.otherTenantId, f.rewardId]);
        if (scope === "member_program") await admin.query(`UPDATE ${s}.loyalty_members SET program_id = $1 WHERE id = $2`, [f.otherProgramId, f.memberId]);
        await unchanged(f, () => refund(f, created.id));
      });
    }

    await check("redeemed_claim_cannot_refund", async () => {
      const f = await fixture();
      const [created] = await claim(f);
      assert.ok(created?.id);
      await admin.query(`UPDATE ${s}.consumer_reward_claims SET status = 'redeemed' WHERE id = $1`, [created.id]);
      await unchanged(f, () => refund(f, created.id));
    });

    await check("negative_points_spent_cannot_refund", async () => {
      const f = await fixture();
      const [created] = await claim(f);
      assert.ok(created?.id);
      await admin.query(`UPDATE ${s}.consumer_reward_claims SET points_spent = -40 WHERE id = $1`, [created.id]);
      await unchanged(f, () => refund(f, created.id));
    });

    await check("unlimited_stock_remains_null_on_claim_and_cancel", async () => {
      const f = await fixture({ stock: null });
      const [created] = await claim(f);
      assert.ok(created?.id);
      assertSingleClaim(await state(f), { stock: null });
      assert.equal((await refund(f, created.id)).length, 1);
      const current = await state(f);
      assert.equal(current.rewards[0].stock_remaining, null);
      assert.equal(current.members[0].points_balance, 100);
      assert.equal(current.claims[0].status, "cancelled");
    });

    await check("redemption_code_collision_rolls_back_all_claim_writes", async () => {
      const f = await fixture();
      const code = `QA-COLLISION-${randomUUID()}`;
      assert.equal((await claim(f, firstQuery, { redemptionCode: code })).length, 1);
      const otherRewardId = randomUUID();
      await addReward(f, otherRewardId);
      const before = await state(f);
      await assert.rejects(() => claim(f, firstQuery, { rewardId: otherRewardId, redemptionCode: code }), (error) => error.code === "23505");
      assert.deepEqual(await state(f), before, "Unique redemption-code failure must roll back every part of the SQL statement");
    });

    await check("existing_receipt_without_ledger_cannot_charge_again", async () => {
      const f = await fixture();
      await admin.query(`INSERT INTO ${s}.consumer_reward_claims(consumer_id, tenant_id, reward_id, points_spent, redemption_code, idempotency_key)
        VALUES ($1, $2, $3, 40, $4, $5)`, [f.consumerId, f.tenantId, f.rewardId, `QA-${randomUUID()}`, `consumer-reward-claim:${f.consumerId}:${f.rewardId}`]);
      await unchanged(f, () => claim(f));
    });

    await check("cancel_failure_rolls_back_refund_stock_and_ledger", async () => {
      const f = await fixture();
      const [created] = await claim(f);
      assert.ok(created?.id);
      await admin.query(`UPDATE ${s}.consumer_reward_claims SET metadata_json = metadata_json || '{"qaRejectCancellation":"true"}'::jsonb WHERE id = $1`, [created.id]);
      await admin.query(`ALTER TABLE ${s}.consumer_reward_claims ADD CONSTRAINT qa_cancel_failure CHECK (status <> 'cancelled' OR metadata_json->>'qaRejectCancellation' IS DISTINCT FROM 'true')`);
      try {
        const before = await state(f);
        await assert.rejects(() => refund(f, created.id), (error) => error.code === "23514");
        assert.deepEqual(await state(f), before, "A final claim-status failure must roll back the refund and stock increase");
      } finally {
        await admin.query(`ALTER TABLE ${s}.consumer_reward_claims DROP CONSTRAINT qa_cancel_failure`);
      }
    });
    report.ok = report.checks.every((result) => result.ok);
  } catch (error) {
    executionError = error;
  } finally {
    if (schemaCreated) {
      try {
        await clients[0].query("ROLLBACK");
        await clients[0].query(`DROP SCHEMA ${identifier(schema)} CASCADE`);
        report.cleanup.schemaDropped = true;
      } catch (error) {
        report.ok = false;
        report.cleanup.error = "Could not drop the harness's generated QA schema";
        executionError ??= error;
      }
    }
    const closed = await Promise.allSettled(clients.map(async (client) => {
      // Destroy pooled sessions so changed search_path/timeouts never leak.
      if (typeof client?.release === "function") await client.release(true);
      else if (typeof client?.end === "function") await client.end();
    }));
    report.cleanup.connectionsClosed = closed.every((result) => result.status === "fulfilled");
    if (!report.cleanup.connectionsClosed) {
      report.ok = false;
      executionError ??= closed.find((result) => result.status === "rejected").reason;
    }
  }
  if (executionError) throw executionError;
  return report;
}
