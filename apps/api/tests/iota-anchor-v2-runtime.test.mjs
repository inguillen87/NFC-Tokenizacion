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
  assert.match(reconciler, /if \(target\.alreadyAnchored\)[\s\S]*clearTransaction: true/);
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

test("staging migration gates preserve the PostgreSQL enum transaction boundary", async () => {
  const dryRun = await readFile(new URL("../../../scripts/staging-migration-dry-run.mjs", import.meta.url), "utf8");
  const apply = await readFile(new URL("../../../scripts/apply-staging-v2-migrations.mjs", import.meta.url), "utf8");
  const runbook = await readFile(new URL("../../../docs/staging-migration-runbook.md", import.meta.url), "utf8");
  assert.ok(dryRun.indexOf("20260723193000_0050_evidence_anchor_reconciling_status.sql") < dryRun.indexOf("20260723193500_0051_iota_evidence_anchor_v2_writer.sql"));
  assert.ok(runbook.indexOf("20260723193000_0050_evidence_anchor_reconciling_status.sql") < runbook.indexOf("20260723193500_0051_iota_evidence_anchor_v2_writer.sql"));
  assert.match(dryRun, /ENUM_VALUE_REQUIRES_COMMITTED_0050/);
  assert.match(apply, /STAGING_MIGRATION_APPROVED/);
  assert.match(apply, /production_migration_blocked/);
  assert.match(runbook, /ROLLBACK/);
});

test("public verification no longer promotes a DB confirmed flag without RPC verification", async () => {
  const verifyRoute = await source("../src/app/public/proof/verify/route.ts");
  const anchorRoute = await source("../src/app/public/proof/[anchorId]/route.ts");
  const verifier = await source("../src/lib/iota-evm-proof.ts");
  assert.match(verifyRoute, /verifyIotaAnchorPublication/);
  assert.match(verifyRoute, /verifyHashInMerkleAnchor/);
  assert.match(verifyRoute, /LIMIT 8/);
  assert.match(verifyRoute, /proof_id_matches/);
  assert.match(verifyRoute, /persisted_chain_matches/);
  assert.doesNotMatch(verifyRoute, /contractAddress:\s*anchor\.contract_address/);
  assert.doesNotMatch(verifyRoute, /publisherAddress:\s*anchor\.publisher_address/);
  assert.doesNotMatch(anchorRoute, /contractAddress:\s*anchor\.contract_address/);
  assert.doesNotMatch(anchorRoute, /publisherAddress:\s*anchor\.publisher_address/);
  assert.match(verifier, /inspectIotaEvidenceTarget/);
  assert.match(verifier, /inspectIotaEvidenceTransaction/);
  assert.match(verifier, /MAX_TRANSACTION_CACHE_ENTRIES = 256/);
  assert.match(verifier, /MAX_CONCURRENT_RPC_VERIFICATIONS = 4/);
  assert.doesNotMatch(verifyRoute, /!match\.demo_fixture[\s\S]*status[\s\S]*confirmed[\s\S]*tx_hash/);
});
