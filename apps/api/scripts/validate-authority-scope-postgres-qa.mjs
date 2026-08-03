import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  assertSunAtomicPostgresQaTarget,
  readSunAtomicPostgresQaConfig,
  sanitizeSunAtomicQaFailure,
} from "./lib/sun-atomic-postgres-qa-safety.mjs";

export const AUTHORITY_SCOPE_REQUIRED_MIGRATIONS = Object.freeze([
  "20260802310000_0096_enterprise_rbac_risk_truth.sql",
]);

export const AUTHORITY_SCOPE_ISOLATION_LEVELS = Object.freeze([
  "READ COMMITTED",
  "REPEATABLE READ",
]);

const CONSTRAINT_BY_LANE = Object.freeze({
  permission_insert: "trg_resource_permissions_tenant_scope",
  membership_delete: "trg_memberships_permission_scope",
  membership_delete_a: "trg_memberships_permission_scope",
  membership_delete_b: "trg_memberships_permission_scope",
});

const EXPECTED_CONSTRAINT_ERRORS = new Set([
  "resource_permission_tenant_scope_requires_membership",
  "membership_change_would_orphan_resource_permission_scope",
]);

function bool(value) {
  return value === true || value === "t";
}

export function assertAuthorityScopeQaDirectEndpoint(config) {
  const hostname = String(config?.hostname || "").trim().toLowerCase();
  const endpointLabel = hostname.split(".", 1)[0];
  if (!hostname || endpointLabel.endsWith("-pooler")) {
    throw new Error("authority_scope_qa_direct_neon_endpoint_required");
  }
  return config;
}

function clientOptions(config, applicationName) {
  return {
    connectionString: config.databaseUrl,
    application_name: applicationName,
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
    ssl: { rejectUnauthorized: true },
  };
}

function withTimeout(promise, timeoutMs, reason) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(reason)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

function track(promise) {
  const tracker = {
    settled: false,
    result: null,
    promise: null,
  };
  tracker.promise = promise.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  ).then((result) => {
    tracker.settled = true;
    tracker.result = result;
    return result;
  });
  return tracker;
}

function safeErrorReceipt(error) {
  return Object.freeze({
    sqlstate: String(error?.code || "unknown"),
    reason: String(error?.message || "authority_scope_transaction_rejected").slice(0, 160),
  });
}

export function assertAuthorityScopeRejection(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (code === "40001") {
    return Object.freeze({
      outcome: "serialization_failure",
      stage: "scope_lock_row_write",
      ...safeErrorReceipt(error),
    });
  }
  assert.equal(code, "23514", "authority-scope loser must fail by constraint or serialization");
  assert.equal(
    EXPECTED_CONSTRAINT_ERRORS.has(message),
    true,
    `unexpected authority-scope constraint rejection: ${message}`,
  );
  return Object.freeze({
    outcome: "constraint_rejected",
    stage: "deferred_scope_constraint",
    ...safeErrorReceipt(error),
  });
}

export async function assertAuthorityScopePostgresQaCapabilities(client) {
  const capability = (await client.query(`SELECT
    to_regclass('public.users') IS NOT NULL AS users,
    to_regclass('public.tenants') IS NOT NULL AS tenants,
    to_regclass('public.memberships') IS NOT NULL AS memberships,
    to_regclass('public.resource_permissions') IS NOT NULL AS resource_permissions,
    to_regclass('public.enterprise_authority_scope_locks') IS NOT NULL AS authority_scope_locks,
    to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)') IS NOT NULL
      AS touch_function,
    to_regprocedure('public.nexid_serialize_authority_scope_v1()') IS NOT NULL
      AS serialize_function,
    to_regprocedure('public.nexid_validate_resource_permission_scope_v1()') IS NOT NULL
      AS permission_validator,
    to_regprocedure('public.nexid_validate_membership_permission_scope_v1()') IS NOT NULL
      AS membership_validator,
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger trigger_row
      WHERE trigger_row.tgrelid = to_regclass('public.resource_permissions')
        AND trigger_row.tgname = 'trg_resource_permissions_scope_serialize'
        AND trigger_row.tgfoid = to_regprocedure('public.nexid_serialize_authority_scope_v1()')
        AND trigger_row.tgtype = 23
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
    ) AS permission_serialize_trigger,
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger trigger_row
      WHERE trigger_row.tgrelid = to_regclass('public.memberships')
        AND trigger_row.tgname = 'trg_memberships_permission_scope_serialize'
        AND trigger_row.tgfoid = to_regprocedure('public.nexid_serialize_authority_scope_v1()')
        AND trigger_row.tgtype = 27
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
    ) AS membership_serialize_trigger,
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger trigger_row
      WHERE trigger_row.tgrelid = to_regclass('public.resource_permissions')
        AND trigger_row.tgname = 'trg_resource_permissions_tenant_scope'
        AND trigger_row.tgfoid = to_regprocedure('public.nexid_validate_resource_permission_scope_v1()')
        AND trigger_row.tgtype = 21
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND trigger_row.tgdeferrable
        AND trigger_row.tginitdeferred
    ) AS permission_constraint_trigger,
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger trigger_row
      WHERE trigger_row.tgrelid = to_regclass('public.memberships')
        AND trigger_row.tgname = 'trg_memberships_permission_scope'
        AND trigger_row.tgfoid = to_regprocedure('public.nexid_validate_membership_permission_scope_v1()')
        AND trigger_row.tgtype = 25
        AND NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND trigger_row.tgdeferrable
        AND trigger_row.tginitdeferred
    ) AS membership_constraint_trigger,
    COALESCE(position(
      'pg_advisory_xact_lock'
      IN pg_catalog.pg_get_functiondef(
        to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)')
      )
    ) > 0, false) AS advisory_lock_present,
    COALESCE(position(
      'ON CONFLICT (user_id, scope_key) DO UPDATE'
      IN pg_catalog.pg_get_functiondef(
        to_regprocedure('public.nexid_touch_authority_scope_lock_v1(uuid,uuid)')
      )
    ) > 0, false) AS versioned_lock_row_present,
    EXISTS (
      SELECT 1
      FROM public.schema_migrations migration
      WHERE migration.id = $1
    ) AS required_migration_applied`, [AUTHORITY_SCOPE_REQUIRED_MIGRATIONS[0]])).rows[0] || {};

  const required = [
    "users",
    "tenants",
    "memberships",
    "resource_permissions",
    "authority_scope_locks",
    "touch_function",
    "serialize_function",
    "permission_validator",
    "membership_validator",
    "permission_serialize_trigger",
    "membership_serialize_trigger",
    "permission_constraint_trigger",
    "membership_constraint_trigger",
    "advisory_lock_present",
    "versioned_lock_row_present",
    "required_migration_applied",
  ];
  if (required.some((field) => !bool(capability[field]))) {
    const missing = required.filter((field) => !bool(capability[field]));
    throw new Error(`authority_scope_qa_0096_capabilities_missing:${missing.join(",")}`);
  }

  const counts = (await client.query(`SELECT
    (SELECT count(*)::integer FROM public.users) AS user_count,
    (SELECT count(*)::integer FROM public.memberships) AS membership_count,
    (SELECT count(*)::integer FROM public.resource_permissions) AS permission_count,
    (SELECT count(*)::integer FROM public.enterprise_authority_scope_locks) AS lock_count`)).rows[0] || {};
  const authorityRowCount = [
    counts.user_count,
    counts.membership_count,
    counts.permission_count,
    counts.lock_count,
  ].reduce((total, value) => total + Number(value || 0), 0);
  if (authorityRowCount !== 0) {
    throw new Error(`authority_scope_qa_authority_tables_not_empty:${authorityRowCount}`);
  }

  return Object.freeze({
    appliedMigrations: AUTHORITY_SCOPE_REQUIRED_MIGRATIONS,
    authorityRowCount,
    serializationBoundary: "advisory_xact_lock_plus_versioned_scope_row",
  });
}

function buildCase(runId, kind, isolationLevel) {
  const caseName = `${kind}_${isolationLevel.toLowerCase().replaceAll(" ", "_")}`;
  const tenantId = randomUUID();
  const userId = randomUUID();
  const membershipIds = kind === "dual_delete"
    ? [randomUUID(), randomUUID()]
    : [randomUUID()];
  return Object.freeze({
    caseName,
    kind,
    isolationLevel,
    tenantId,
    userId,
    tenantSlug: `codex-qa-authority-${runId}-${caseName.replaceAll("_", "-")}`,
    userEmail: `qa-authority-${runId}-${caseName}@example.invalid`,
    membershipIds: Object.freeze(membershipIds),
    permissionId: randomUUID(),
    barrierKey: `nexid-authority-scope-qa:${runId}:${caseName}`,
  });
}

export function buildAuthorityScopeFixture() {
  const runId = randomBytes(8).toString("hex");
  return Object.freeze({
    runId,
    cases: Object.freeze([
      ...AUTHORITY_SCOPE_ISOLATION_LEVELS.map((level) => buildCase(runId, "insert_delete", level)),
      ...AUTHORITY_SCOPE_ISOLATION_LEVELS.map((level) => buildCase(runId, "dual_delete", level)),
    ]),
  });
}

async function seedFixture(client, fixture) {
  await client.query("BEGIN");
  try {
    for (const caseFixture of fixture.cases) {
      await client.query(`INSERT INTO public.tenants (id, slug, name, root_key_ct)
        VALUES ($1::uuid, $2, 'Authority scope PostgreSQL QA',
          'not-a-key:synthetic-validation-fixture')`, [
        caseFixture.tenantId,
        caseFixture.tenantSlug,
      ]);
      await client.query(`INSERT INTO public.users (id, email, full_name, admin_status)
        VALUES ($1::uuid, $2, 'Authority scope PostgreSQL QA', 'active')`, [
        caseFixture.userId,
        caseFixture.userEmail,
      ]);
      await client.query(`INSERT INTO public.memberships (id, user_id, tenant_id, role)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'tenant_admin'::public.membership_role)`, [
        caseFixture.membershipIds[0],
        caseFixture.userId,
        caseFixture.tenantId,
      ]);
      if (caseFixture.kind === "dual_delete") {
        await client.query(`INSERT INTO public.memberships (id, user_id, tenant_id, role)
          VALUES ($1::uuid, $2::uuid, $3::uuid, 'viewer'::public.membership_role)`, [
          caseFixture.membershipIds[1],
          caseFixture.userId,
          caseFixture.tenantId,
        ]);
        await client.query(`INSERT INTO public.resource_permissions (
          id, user_id, tenant_id, resource, action, effect
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, 'qa_authority_scope', 'read', 'allow'
        )`, [
          caseFixture.permissionId,
          caseFixture.userId,
          caseFixture.tenantId,
        ]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  }
}

async function backendPid(client) {
  return Number((await client.query("SELECT pg_backend_pid()::integer AS pid")).rows[0]?.pid || 0);
}

async function openLane(config, fixture, laneName) {
  const suffix = randomBytes(4).toString("hex");
  const client = new pg.Client(clientOptions(
    config,
    `nexid_authority_qa_${fixture.caseName}_${laneName}_${suffix}`.slice(0, 63),
  ));
  await client.connect();
  await client.query(`BEGIN ISOLATION LEVEL ${fixture.isolationLevel}`);
  await client.query("SET LOCAL lock_timeout = '8s'");
  await client.query("SET LOCAL statement_timeout = '15s'");
  const pid = await backendPid(client);
  return {
    name: laneName,
    client,
    pid,
    transactionOpen: true,
    constraintName: CONSTRAINT_BY_LANE[laneName],
  };
}

async function waitForBarrierWaiters(observer, pids, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = (await observer.query(`SELECT pid, wait_event_type, wait_event
      FROM pg_catalog.pg_stat_activity
      WHERE pid = ANY($1::integer[])
        AND state = 'active'`, [pids])).rows;
    const waiting = new Map(rows
      .filter((row) => row.wait_event_type === "Lock")
      .filter((row) => String(row.wait_event || "").toLowerCase() === "advisory")
      .map((row) => [Number(row.pid), String(row.wait_event)]));
    if (pids.every((pid) => waiting.has(pid))) {
      return pids.map((pid) => Object.freeze({ pid, waitEvent: waiting.get(pid) }));
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("authority_scope_qa_start_barrier_wait_not_observed");
}

async function waitForWinnerAndSerializedPeer(observer, lanes, trackers, timeoutMs = 6_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const settled = trackers
      .map((tracker, index) => ({ tracker, index }))
      .filter(({ tracker }) => tracker.settled);
    if (settled.length > 1) {
      throw new Error("authority_scope_qa_scope_serialization_wait_missing");
    }
    if (settled.length === 1) {
      const winner = settled[0];
      if (!winner.tracker.result?.ok) throw winner.tracker.result?.error;
      const peerIndex = winner.index === 0 ? 1 : 0;
      const activity = (await observer.query(`SELECT state, wait_event_type, wait_event
        FROM pg_catalog.pg_stat_activity
        WHERE pid = $1::integer`, [lanes[peerIndex].pid])).rows[0] || {};
      if (activity.state === "active" && activity.wait_event_type === "Lock") {
        return Object.freeze({
          winnerIndex: winner.index,
          peerIndex,
          peerWaitEvent: String(activity.wait_event || "unknown"),
        });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("authority_scope_qa_scope_serialization_wait_timeout");
}

function mutationSql(laneName) {
  const barrier = `SELECT pg_catalog.pg_advisory_xact_lock_shared(
      pg_catalog.hashtextextended($1::text, 0)
    )`;
  if (laneName === "permission_insert") {
    return `WITH qa_barrier AS MATERIALIZED (${barrier})
      INSERT INTO public.resource_permissions (
        id, user_id, tenant_id, resource, action, effect
      )
      SELECT $2::uuid, $3::uuid, $4::uuid, 'qa_authority_scope', 'read', 'allow'
      FROM qa_barrier
      RETURNING id::text AS id`;
  }
  return `WITH qa_barrier AS MATERIALIZED (${barrier})
    DELETE FROM public.memberships membership
    USING qa_barrier
    WHERE membership.id = $2::uuid
      AND membership.user_id = $3::uuid
      AND membership.tenant_id = $4::uuid
    RETURNING membership.id::text AS id`;
}

async function finalizeWinner(lane) {
  try {
    await lane.client.query(`SET CONSTRAINTS ${lane.constraintName} IMMEDIATE`);
    await lane.client.query("COMMIT");
    lane.transactionOpen = false;
    return Object.freeze({
      lane: lane.name,
      outcome: "committed",
      stage: "commit",
    });
  } catch (error) {
    await lane.client.query("ROLLBACK").catch(() => null);
    lane.transactionOpen = false;
    throw error;
  }
}

async function finalizeLoser(lane, mutationResult) {
  if (!mutationResult.ok) {
    const rejection = assertAuthorityScopeRejection(mutationResult.error);
    await lane.client.query("ROLLBACK").catch(() => null);
    lane.transactionOpen = false;
    return Object.freeze({ lane: lane.name, ...rejection });
  }

  try {
    await lane.client.query(`SET CONSTRAINTS ${lane.constraintName} IMMEDIATE`);
  } catch (error) {
    const rejection = assertAuthorityScopeRejection(error);
    await lane.client.query("ROLLBACK").catch(() => null);
    lane.transactionOpen = false;
    return Object.freeze({ lane: lane.name, ...rejection });
  }

  await lane.client.query("ROLLBACK").catch(() => null);
  lane.transactionOpen = false;
  throw new Error("authority_scope_qa_losing_transaction_was_not_rejected");
}

async function readCasePostcondition(observer, fixture) {
  const row = (await observer.query(`SELECT
    (SELECT count(*)::integer
      FROM public.memberships membership
      WHERE membership.user_id = $1::uuid
        AND membership.tenant_id = $2::uuid
        AND membership.role::text <> 'super_admin') AS membership_count,
    (SELECT count(*)::integer
      FROM public.resource_permissions permission
      WHERE permission.user_id = $1::uuid
        AND permission.tenant_id = $2::uuid) AS permission_count,
    (SELECT count(*)::integer
      FROM public.resource_permissions permission
      WHERE permission.user_id = $1::uuid
        AND permission.tenant_id = $2::uuid
        AND NOT EXISTS (
          SELECT 1
          FROM public.memberships membership
          WHERE membership.user_id = permission.user_id
            AND membership.tenant_id = permission.tenant_id
            AND membership.role::text <> 'super_admin'
        )) AS orphan_count,
    COALESCE((SELECT lock_version::text
      FROM public.enterprise_authority_scope_locks scope_lock
      WHERE scope_lock.user_id = $1::uuid
        AND scope_lock.scope_key = $2::uuid::text), '0') AS lock_version`, [
    fixture.userId,
    fixture.tenantId,
  ])).rows[0] || {};
  const postcondition = Object.freeze({
    membership_count: Number(row.membership_count || 0),
    permission_count: Number(row.permission_count || 0),
    orphan_count: Number(row.orphan_count || 0),
    lock_version: Number(row.lock_version || 0),
  });
  assert.equal(postcondition.orphan_count, 0, `${fixture.caseName} left an orphaned permission`);
  assert.ok(postcondition.lock_version >= 1, `${fixture.caseName} did not touch its scope lock row`);
  if (fixture.kind === "dual_delete") {
    assert.equal(postcondition.membership_count, 1, "exactly one qualifying membership must remain");
    assert.equal(postcondition.permission_count, 1, "the scoped permission must remain authorized");
  } else {
    assert.equal(
      postcondition.membership_count,
      postcondition.permission_count,
      "membership and permission must commit or reject as one valid authority state",
    );
  }
  return postcondition;
}

async function runCase({ config, observer, fixture }) {
  const laneNames = fixture.kind === "dual_delete"
    ? ["membership_delete_a", "membership_delete_b"]
    : ["permission_insert", "membership_delete"];
  const lanes = [];
  let barrierHeld = false;
  const trackers = [];
  try {
    lanes.push(...await Promise.all(laneNames.map((name) => openLane(config, fixture, name))));
    await observer.query(
      "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended($1::text, 0))",
      [fixture.barrierKey],
    );
    barrierHeld = true;

    for (let index = 0; index < lanes.length; index += 1) {
      const lane = lanes[index];
      const membershipId = lane.name === "membership_delete_b"
        ? fixture.membershipIds[1]
        : fixture.membershipIds[0];
      const id = lane.name === "permission_insert" ? fixture.permissionId : membershipId;
      trackers.push(track(lane.client.query(mutationSql(lane.name), [
        fixture.barrierKey,
        id,
        fixture.userId,
        fixture.tenantId,
      ])));
    }

    const barrierWaits = await waitForBarrierWaiters(observer, lanes.map((lane) => lane.pid));
    const unlocked = (await observer.query(
      "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended($1::text, 0)) AS unlocked",
      [fixture.barrierKey],
    )).rows[0]?.unlocked;
    barrierHeld = false;
    assert.equal(bool(unlocked), true, "authority-scope QA barrier was not released");

    const decision = await waitForWinnerAndSerializedPeer(observer, lanes, trackers);
    const winner = lanes[decision.winnerIndex];
    const loser = lanes[decision.peerIndex];
    const winnerReceipt = await finalizeWinner(winner);
    const loserMutation = await withTimeout(
      trackers[decision.peerIndex].promise,
      12_000,
      "authority_scope_qa_loser_mutation_timeout",
    );
    const loserReceipt = await finalizeLoser(loser, loserMutation);
    const outcomes = [winnerReceipt, loserReceipt].sort((a, b) => a.lane.localeCompare(b.lane));
    assert.equal(outcomes.filter((entry) => entry.outcome === "committed").length, 1);
    assert.equal(
      outcomes.filter((entry) => entry.outcome === "constraint_rejected"
        || entry.outcome === "serialization_failure").length,
      1,
    );
    const postcondition = await readCasePostcondition(observer, fixture);

    return Object.freeze({
      case: fixture.kind,
      isolation_level: fixture.isolationLevel,
      synchronized_start_waiters: barrierWaits.length,
      authority_scope_wait_observed: true,
      authority_scope_wait_event: decision.peerWaitEvent,
      transactions: Object.freeze(outcomes),
      exactly_one_transaction_committed: true,
      postcondition,
    });
  } finally {
    if (barrierHeld) {
      await observer.query(
        "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended($1::text, 0))",
        [fixture.barrierKey],
      ).catch(() => null);
    }
    await Promise.allSettled(trackers.map((tracker) => tracker.promise));
    for (const lane of lanes) {
      if (lane.transactionOpen) await lane.client.query("ROLLBACK").catch(() => null);
    }
    await Promise.allSettled(lanes.map((lane) => lane.client.end()));
  }
}

async function cleanupFixture(config, fixture) {
  const cleanup = new pg.Client(clientOptions(
    config,
    `nexid_authority_qa_cleanup_${fixture.runId}`,
  ));
  const userIds = fixture.cases.map((entry) => entry.userId);
  const tenantIds = fixture.cases.map((entry) => entry.tenantId);
  const permissionIds = fixture.cases.map((entry) => entry.permissionId);
  const membershipIds = fixture.cases.flatMap((entry) => entry.membershipIds);
  let transactionOpen = false;
  await cleanup.connect();
  try {
    await cleanup.query("BEGIN");
    transactionOpen = true;
    await cleanup.query("SET LOCAL lock_timeout = '8s'");
    await cleanup.query("SET LOCAL statement_timeout = '15s'");
    await cleanup.query(
      "DELETE FROM public.resource_permissions WHERE id = ANY($1::uuid[])",
      [permissionIds],
    );
    await cleanup.query(
      "DELETE FROM public.memberships WHERE id = ANY($1::uuid[])",
      [membershipIds],
    );
    await cleanup.query(
      "DELETE FROM public.enterprise_authority_scope_locks WHERE user_id = ANY($1::uuid[])",
      [userIds],
    );
    await cleanup.query("DELETE FROM public.users WHERE id = ANY($1::uuid[])", [userIds]);
    await cleanup.query("DELETE FROM public.tenants WHERE id = ANY($1::uuid[])", [tenantIds]);
    await cleanup.query("COMMIT");
    transactionOpen = false;

    const remaining = (await cleanup.query(`SELECT
      (SELECT count(*)::integer FROM public.resource_permissions WHERE id = ANY($1::uuid[]))
        + (SELECT count(*)::integer FROM public.memberships WHERE id = ANY($2::uuid[]))
        + (SELECT count(*)::integer FROM public.enterprise_authority_scope_locks
            WHERE user_id = ANY($3::uuid[]))
        + (SELECT count(*)::integer FROM public.users WHERE id = ANY($3::uuid[]))
        + (SELECT count(*)::integer FROM public.tenants WHERE id = ANY($4::uuid[]))
        AS remaining_count`, [permissionIds, membershipIds, userIds, tenantIds])).rows[0]?.remaining_count;
    assert.equal(Number(remaining || 0), 0, "authority-scope QA cleanup left synthetic rows");
    return Object.freeze({
      attempted: true,
      complete: true,
      strategy: "explicit_synthetic_ids_only",
      remaining_rows: 0,
    });
  } finally {
    if (transactionOpen) await cleanup.query("ROLLBACK").catch(() => null);
    await cleanup.end().catch(() => null);
  }
}

export async function runAuthorityScopePostgresQa(env = process.env) {
  // The observer holds a session advisory lock across multiple statements.
  // A transaction-pooled endpoint can switch backends between those statements
  // and must never be accepted for this validator.
  const config = assertAuthorityScopeQaDirectEndpoint(readSunAtomicPostgresQaConfig(env));
  const observer = new pg.Client(clientOptions(
    config,
    `nexid_authority_qa_observer_${randomBytes(4).toString("hex")}`,
  ));
  const fixture = buildAuthorityScopeFixture();
  let evidence = null;
  let primaryError = null;
  let basePreflight = null;
  let authorityPreflight = null;
  let cleanup = null;
  let fixtureWriteStarted = false;
  await observer.connect();
  try {
    basePreflight = await assertSunAtomicPostgresQaTarget(observer, config);
    authorityPreflight = await assertAuthorityScopePostgresQaCapabilities(observer);
    fixtureWriteStarted = true;
    await seedFixture(observer, fixture);
    const receipts = [];
    for (const caseFixture of fixture.cases) {
      receipts.push(await runCase({ config, observer, fixture: caseFixture }));
    }
    evidence = Object.freeze({
      permission_insert_vs_last_membership_delete: Object.freeze(
        receipts.filter((entry) => entry.case === "insert_delete"),
      ),
      concurrent_qualifying_membership_deletes: Object.freeze(
        receipts.filter((entry) => entry.case === "dual_delete"),
      ),
    });
  } catch (error) {
    primaryError = error;
  } finally {
    if (fixtureWriteStarted) {
      try {
        cleanup = await cleanupFixture(config, fixture);
      } catch (cleanupError) {
        if (!primaryError) primaryError = cleanupError;
        else primaryError.cleanupError = cleanupError;
      }
    } else {
      cleanup = Object.freeze({
        attempted: false,
        complete: true,
        strategy: "not_required_before_validated_fixture_write",
        remaining_rows: 0,
      });
    }
    await observer.end().catch(() => null);
  }

  if (primaryError) {
    primaryError.qaCleanup = cleanup || Object.freeze({
      attempted: true,
      complete: false,
      strategy: "explicit_synthetic_ids_only",
    });
    throw primaryError;
  }

  return Object.freeze({
    ok: true,
    validator: "enterprise_authority_scope_postgres_concurrency_v1",
    target: Object.freeze({
      endpoint_id: basePreflight.endpointId,
      database: basePreflight.databaseName,
      database_role: basePreflight.databaseRole,
      safe_target: config.safeTarget,
      postgres_version_number: basePreflight.postgresVersionNumber,
    }),
    migrations: Object.freeze([
      ...basePreflight.appliedMigrations,
      ...authorityPreflight.appliedMigrations,
    ]),
    serialization_boundary: authorityPreflight.serializationBoundary,
    evidence,
    boundaries: Object.freeze({
      production_touched: false,
      disposable_neon_postgresql_only: true,
      synthetic_authority_rows_only: true,
      physical_nfc_cryptographic_path_touched: false,
      managed_kms_validated: false,
      hsm_validated: false,
      http_authorization_routes: "not_covered_database_authority_scope_only",
    }),
    cleanup,
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  let config = null;
  try {
    config = readSunAtomicPostgresQaConfig(process.env);
    const result = await runAuthorityScopePostgresQa(process.env);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      validator: "enterprise_authority_scope_postgres_concurrency_v1",
      reason: sanitizeSunAtomicQaFailure(error, config),
      cleanup: error?.qaCleanup || {
        attempted: false,
        complete: true,
        reason: "not_required_before_validated_fixture_write",
      },
    }));
    process.exitCode = 1;
  }
}
