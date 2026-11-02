import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { saveAdminReward } from "../../src/lib/admin-reward-service.ts";
import { parseAdminRewardCommand } from "../../src/lib/admin-reward-policy.ts";
import { assertQaPostgresClientIdentity } from "./ownership-current-state-postgres-harness.mjs";

const files = ["../../src/lib/admin-reward-policy.ts", "../../src/lib/admin-reward-service.ts", "../../src/app/admin/loyalty/rewards/route.ts"];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, createHash("sha256").update(await readFile(new URL(file, import.meta.url))).digest("hex")])));

export function validateAdminRewardQaIdentity(identity, client = null, options = {}) {
  return assertQaPostgresClientIdentity(client, { ...identity, database: identity.database ?? identity.db }, options);
}

export async function runAdminRewardPostgresQa({ connect, dockerAttestation } = {}) {
  if (typeof connect !== "function") throw new Error("explicit_owned_qa_connection_factory_required");
  const sourceHashes = await hashes();
  const schema = `qa_admin_reward_${randomUUID().replaceAll("-", "")}`;
  const clients = []; const cases = []; const connectionEvidence = [];
  let schemaCreated = false;
  async function open() {
    const client = await connect(); clients.push(client);
    const identity = (await client.query("SELECT current_database() AS database,current_user AS role,pg_backend_pid() AS pid,host(inet_server_addr()) AS address,current_setting('server_version_num')::integer AS server_version_number,current_setting('neon.endpoint_id',true) AS neon_endpoint_id,current_setting('transaction_read_only') AS transaction_read_only")).rows[0];
    connectionEvidence.push(validateAdminRewardQaIdentity(identity, client, { dockerAttestation }));
    if (clients.length > 1) assert.equal(identity.database, (await clients[0].query("SELECT current_database() AS db")).rows[0].db);
    await client.query("SET statement_timeout='15000'"); await client.query("SET lock_timeout='10000'");
    return client;
  }
  const tenant = "10000000-0000-4000-8000-000000000001", otherTenant = "10000000-0000-4000-8000-000000000002";
  const oldProgram = "20000000-0000-4000-8000-000000000001", newProgram = "20000000-0000-4000-8000-000000000002";
  const rewardId = "30000000-0000-4000-8000-000000000001";
  const executeFor = client => async (strings, ...values) => (await client.query(strings.reduce((query, part, i) => query + (i ? `$${i}` : "") + part, ""), values)).rows;
  try {
    const first = await open();
    await first.query(`CREATE SCHEMA "${schema}"`); schemaCreated = true;
    await first.query(`SET search_path TO "${schema}",pg_catalog`);
    await first.query(`CREATE TYPE reward_type AS ENUM('DISCOUNT','EXPERIENCE','TASTING','TOUR','FREE_SHIPPING','EARLY_ACCESS','DIGITAL_COLLECTIBLE','CONTENT_UNLOCK','GIFT','SERVICE','WARRANTY_EXTENSION','REFILL','VIP_ACCESS','WINE_BOTTLE','WINE_BOX')`);
    await first.query(`CREATE TABLE loyalty_programs(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,name text,status text,created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE rewards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,program_id uuid NOT NULL REFERENCES loyalty_programs(id),code text NOT NULL,title text NOT NULL,description text,type reward_type NOT NULL,status text NOT NULL,points_cost integer NOT NULL,stock_total integer,stock_remaining integer,image_url text,requires_age_gate boolean NOT NULL,network_visible boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(program_id,code))`);
    await first.query("INSERT INTO loyalty_programs VALUES($1,$2,'Paused existing','paused','2020-01-01'),($3,$2,'Newest existing','active','2021-01-01')", [oldProgram, tenant, newProgram]);
    await first.query("INSERT INTO rewards(id,tenant_id,program_id,code,title,type,status,points_cost,stock_total,stock_remaining,requires_age_gate,network_visible) VALUES($1,$2,$3,'VISIT','Old title','TOUR','active',50,10,2,true,false)", [rewardId, tenant, oldProgram]);
    const execute = executeFor(first);
    const save = (overrides = {}, tenantId = tenant) => saveAdminReward(tenantId, parseAdminRewardCommand({ code: "VISIT", title: "Updated title", reward_id: rewardId, program_id: oldProgram, ...overrides }), execute);

    const meta = await save(); assert.equal(meta.stock_remaining, 2); assert.equal(meta.stock_total, 10); assert.equal(meta.requires_age_gate, true); assert.equal(meta.network_visible, false); cases.push("metadata_preserves_stock_and_policy");
    assert.equal(meta.program_id, oldProgram); assert.equal((await first.query("SELECT status FROM loyalty_programs WHERE id=$1", [oldProgram])).rows[0].status, "paused"); cases.push("paused_program_identity_preserved");
    const increased = await save({ stock_total: 12, stock_remaining: 12 }); assert.equal(increased.stock_remaining, 4); cases.push("legacy_remaining_never_resets_consumption");
    await first.query("UPDATE rewards SET stock_remaining=stock_remaining-1 WHERE id=$1", [rewardId]);
    assert.equal((await save({ stock_total: 12 })).stock_remaining, 3); cases.push("already_committed_redemption_preserved");
    await assert.rejects(save({ stock_total: 8 }), /stock_total_below_consumed/); cases.push("consumed_floor_rejected_without_changes");
    assert.equal((await save({ stock_total: 9 })).stock_remaining, 0); cases.push("zero_stock_preserved");
    await save({ stock_total: 12 });
    await assert.rejects(save({}, otherTenant), /reward_not_found/); cases.push("foreign_tenant_edit_denied");
    await assert.rejects(save({ program_id: newProgram }), /reward_not_found/); cases.push("different_program_edit_denied");
    const legacy = await saveAdminReward(tenant, parseAdminRewardCommand({ code: "VISIT", title: "Legacy edit" }), execute);
    assert.equal(legacy.program_id, oldProgram); assert.equal(legacy.stock_remaining, 3); cases.push("legacy_code_keeps_original_program");
    const created = await saveAdminReward(tenant, parseAdminRewardCommand({ code: "NEW", title: "New reward", stock_total: 0, stock_remaining: 0 }), execute);
    assert.equal(created.program_id, newProgram); assert.equal(created.stock_remaining, 0); cases.push("creation_uses_latest_persisted_program");
    await saveAdminReward(tenant, parseAdminRewardCommand({ code: "VISIT", title: "Other program", program_id: newProgram }), execute);
    await assert.rejects(saveAdminReward(tenant, parseAdminRewardCommand({ code: "VISIT", title: "Ambiguous" }), execute), /reward_program_ambiguous/); cases.push("legacy_cross_program_ambiguity_rejected");
    await assert.rejects(saveAdminReward(otherTenant, parseAdminRewardCommand({ code: "NEW", title: "No configured program" }), execute), /loyalty_program_not_found/); cases.push("absent_program_never_bootstrapped");

    const second = await open(); await second.query(`SET search_path TO "${schema}",pg_catalog`);
    const secondPid = (await second.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const strictCreate = (overrides = {}, client = first) => saveAdminReward(tenant, parseAdminRewardCommand({
      code: "VISIT", title: "Explicit new benefit", creationIntent: "admin-reward-first-create.v1", ...overrides,
    }), executeFor(client));
    const beforeStrictConflict = (await first.query("SELECT * FROM rewards WHERE id=$1", [rewardId])).rows[0];
    await assert.rejects(strictCreate(), /reward_create_conflict/);
    assert.deepEqual((await first.query("SELECT * FROM rewards WHERE id=$1", [rewardId])).rows[0], beforeStrictConflict);
    cases.push("explicit_creation_duplicate_never_updates_existing_reward");

    const strictNew = await strictCreate({ code: "STRICT_NEW", program_id: oldProgram, status: "draft", stock_total: 0 });
    assert.equal(strictNew.program_id, oldProgram); assert.equal(strictNew.status, "draft"); assert.equal(strictNew.stock_remaining, 0);
    assert.equal((await first.query("SELECT status FROM loyalty_programs WHERE id=$1", [oldProgram])).rows[0].status, "paused");
    cases.push("explicit_creation_keeps_selected_program_and_publication_status");

    await first.query("BEGIN");
    const firstCreated = await strictCreate({ code: "STRICT_RACE", program_id: oldProgram, title: "Winner", stock_total: 0 });
    const competing = strictCreate({ code: "STRICT_RACE", program_id: oldProgram, title: "Loser", stock_total: 99 }, second)
      .then(value => ({ value, error: null }), error => ({ value: null, error }));
    let creationLocked = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const state = (await first.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [secondPid])).rows[0];
      if (state?.wait_event_type === "Lock") { creationLocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await first.query("COMMIT");
    const competed = await competing;
    assert.equal(creationLocked, true, "the second INSERT must actually wait on the persisted unique key");
    assert.equal(competed.value, null); assert.equal(competed.error?.message, "reward_create_conflict");
    const racedRows = (await first.query("SELECT id,title,stock_total,stock_remaining FROM rewards WHERE program_id=$1 AND code='STRICT_RACE'", [oldProgram])).rows;
    assert.deepEqual(racedRows, [{ id: firstCreated.id, title: "Winner", stock_total: 0, stock_remaining: 0 }]);
    cases.push("concurrent_explicit_creation_unique_key_conflict_never_overwrites_winner");

    await first.query("BEGIN"); await first.query("UPDATE rewards SET stock_remaining=stock_remaining-1 WHERE id=$1", [rewardId]);
    const pending = saveAdminReward(tenant, parseAdminRewardCommand({ code: "VISIT", title: "Concurrent total", reward_id: rewardId, program_id: oldProgram, stock_total: 20, stock_remaining: 20 }), executeFor(second));
    let locked = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const state = (await first.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [secondPid])).rows[0];
      if (state?.wait_event_type === "Lock") { locked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await first.query("COMMIT");
    const concurrent = await pending; assert.equal(locked, true, "mutation must actually wait on the redemption lock");
    assert.equal(concurrent.stock_total, 20); assert.equal(concurrent.stock_remaining, 10); cases.push("concurrent_redemption_lock_preserves_actual_consumption");
    assert.equal((await first.query("SELECT status FROM loyalty_programs WHERE id=$1", [oldProgram])).rows[0].status, "paused");
    assert.deepEqual(await hashes(), sourceHashes, "source must remain pinned throughout SQL verification");
    return { ok: true, evidence: "synthetic_owned_postgresql", cases, sourceHashes, connectionEvidence, schemaCleaned: true };
  } finally {
    for (const client of clients) await client.query("ROLLBACK").catch(() => {});
    if (schemaCreated) await clients[0].query(`DROP SCHEMA "${schema}" CASCADE`);
    await Promise.all(clients.map(client => client.end()));
  }
}
