import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("IOTA runtime is V2-only and reserves durable identity before processing", async () => {
  const route = await source("../src/app/admin/proof/anchors/route.ts");
  const reconciler = await source("../src/lib/iota-evidence-reconciler.ts");
  assert.match(route, /public_resource_id/);
  assert.match(route, /proof_id/);
  assert.match(route, /memo_hash/);
  assert.match(route, /idempotency-key/);
  assert.match(route, /INSERT INTO evidence_anchors[\s\S]*processIotaEvidenceAnchor/);
  assert.match(route, /WITH inserted_anchor AS[\s\S]*inserted_members AS[\s\S]*SELECT inserted_anchor\.\*/);
  assert.match(reconciler, /status = 'submitted'[\s\S]*tx_hash/);
  assert.match(reconciler, /WITH submitted_attempt AS[\s\S]*UPDATE evidence_anchors[\s\S]*FROM submitted_attempt/);
  assert.match(reconciler, /active_attempt AS MATERIALIZED[\s\S]*interval '2 minutes'[\s\S]*FOR UPDATE/);
  assert.match(reconciler, /CASE WHEN tx_hash IS NULL THEN 'failed' ELSE 'submitted' END/);
  assert.match(reconciler, /iota_anchor_busy/);
  assert.match(reconciler, /iota_contract_address_mismatch/);
  assert.match(reconciler, /inspectIotaEvidenceTarget/);
  assert.match(reconciler, /inspectIotaEvidenceTransaction/);
  assert.doesNotMatch(route, /anchorRoot/);
});

test("V2 persistence includes proof identity, attempts, members and reconciliation indexes", async () => {
  const enumMigration = await source("../db/migrations/20260723193000_0050_evidence_anchor_reconciling_status.sql");
  const migration = await source("../db/migrations/20260723193500_0051_iota_evidence_anchor_v2_writer.sql");
  assert.match(enumMigration, /pg_type[\s\S]*ALTER TYPE evidence_anchor_status[\s\S]*reconciling/);
  assert.doesNotMatch(migration, /ALTER TYPE evidence_anchor_status/);
  for (const field of [
    "proof_id",
    "memo_hash",
    "contract_address",
    "publisher_address",
    "idempotency_key",
    "block_number",
    "confirmations",
    "next_attempt_at",
  ]) assert.match(migration, new RegExp(field));
  assert.match(migration, /CREATE TABLE IF NOT EXISTS evidence_anchor_attempts/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS evidence_anchor_members/);
  assert.match(migration, /uq_evidence_anchors_iota_proof_id/);
  assert.match(migration, /uq_evidence_anchor_attempts_signer_nonce/);
});

test("public verification no longer promotes a DB confirmed flag without RPC verification", async () => {
  const verifyRoute = await source("../src/app/public/proof/verify/route.ts");
  assert.match(verifyRoute, /verifyIotaAnchorPublication/);
  assert.match(verifyRoute, /proof_id_matches/);
  assert.match(verifyRoute, /persisted_chain_matches/);
  assert.doesNotMatch(verifyRoute, /!match\.demo_fixture[\s\S]*status[\s\S]*confirmed[\s\S]*tx_hash/);
});
