import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const downloadRoute = await readFile(
  new URL("../src/app/admin/tenant-vault/[tenantId]/artifacts/[artifactId]/download/route.ts", import.meta.url),
  "utf8",
);
const vaultMigration = await readFile(
  new URL("../db/migrations/20260802190000_0084_tenant_vault_audited_download.sql", import.meta.url),
  "utf8",
);
const exportRoute = await readFile(
  new URL("../src/app/admin/supplier-orders/[orderId]/export-pack/route.ts", import.meta.url),
  "utf8",
);
const vercelIgnore = await readFile(new URL("../../../.vercelignore", import.meta.url), "utf8");
const statusBridge = await readFile(
  new URL("../db/migrations/20260802185000_0083b_vault_artifact_status_bridge.sql", import.meta.url),
  "utf8",
);
const canonicalBridge = await readFile(
  new URL("../db/migrations/20260802255000_0090b_vault_artifact_canonical_bridge.sql", import.meta.url),
  "utf8",
);

test("legacy Vault artifacts gain an explicit fail-closed lifecycle before audited downloads", () => {
  assert.match(statusBridge, /ADD COLUMN IF NOT EXISTS status text/);
  assert.match(statusBridge, /SET status = 'active'[\s\S]*WHERE status IS NULL/);
  assert.match(statusBridge, /status NOT IN \('active', 'archived'\)/);
  assert.match(statusBridge, /ALTER COLUMN status SET NOT NULL/);
  assert.match(statusBridge, /VALIDATE CONSTRAINT vault_artifacts_status_check/);
});

test("legacy Vault artifacts reconcile to the canonical supplier contract without inventing hashes", () => {
  assert.match(canonicalBridge, /ADD COLUMN IF NOT EXISTS supplier_sub_batch_id uuid/);
  assert.match(canonicalBridge, /ADD COLUMN IF NOT EXISTS content_hash text/);
  assert.match(canonicalBridge, /vault_artifact_content_hash_conflict/);
  assert.match(canonicalBridge, /vault_artifact_content_hash_unrecoverable/);
  assert.match(canonicalBridge, /artifact_type TYPE text USING artifact_type::text/);
  assert.match(canonicalBridge, /ALTER COLUMN content_hash SET NOT NULL/);
  assert.match(canonicalBridge, /VALIDATE CONSTRAINT vault_artifacts_supplier_sub_batch_id_fkey/);
});

test("Vercel upload keeps the dynamic Tenant Vault artifact route", () => {
  const activePatterns = vercelIgnore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  assert.ok(activePatterns.includes("/artifacts"));
  assert.ok(activePatterns.includes("/apps/api/artifacts"));
  assert.ok(!activePatterns.includes("artifacts"));
  assert.match(downloadRoute, /vault_artifact_downloads/);
});

test("only a persisted superadmin session can request an encrypted Vault artifact", () => {
  assert.match(downloadRoute, /checkAdmin\(req, \["super_admin"\]\)/);
  assert.match(downloadRoute, /getAdminActor\(req\)/);
  assert.match(downloadRoute, /principal\.mfaVerified/);
  assert.match(downloadRoute, /tenant_vault_download_mfa_required/);
  assert.match(downloadRoute, /normalizeTenantVaultDownloadIdempotencyKey/);
  assert.match(downloadRoute, /normalizeTenantVaultDownloadReason/);
  assert.match(downloadRoute, /readBoundedJsonBody/);
  assert.match(downloadRoute, /rateClass: "proof_write"/);
  assert.doesNotMatch(downloadRoute, /tenant_admin/);
});

test("download reservation, counter and audit share one PostgreSQL statement", () => {
  assert.match(downloadRoute, /WITH authorized_session AS MATERIALIZED/);
  assert.match(downloadRoute, /auth_session\.mfa_verified IS TRUE/);
  assert.match(downloadRoute, /auth_session\.revoked_at IS NULL/);
  assert.match(downloadRoute, /auth_session\.expires_at > now\(\)/);
  assert.match(downloadRoute, /FOR SHARE OF auth_session, session_actor, membership/);
  assert.match(downloadRoute, /target AS MATERIALIZED/);
  assert.match(downloadRoute, /FOR UPDATE OF artifact/);
  assert.match(downloadRoute, /INSERT INTO vault_artifact_downloads/);
  assert.match(downloadRoute, /UPDATE vault_artifacts artifact[\s\S]*download_count = artifact\.download_count \+ 1/);
  assert.match(downloadRoute, /INSERT INTO audit_logs[\s\S]*'supplier_pack_downloaded'/);
  assert.match(downloadRoute, /ON CONFLICT \(artifact_id, idempotency_key\) DO NOTHING/);
  assert.match(downloadRoute, /effective_download[\s\S]*replayed/);
});

test("download verifies the encrypted envelope before delivery and never returns a password", () => {
  assert.match(downloadRoute, /digest\(decode\(artifact\.encrypted_payload_base64, 'base64'\), 'sha256'\)/);
  assert.match(downloadRoute, /tenant_vault_artifact_integrity_failed/);
  assert.match(downloadRoute, /MAX_ENCRYPTED_PACK_BYTES/);
  assert.match(downloadRoute, /target\.payload_bytes BETWEEN 1 AND/);
  assert.match(downloadRoute, /Number\(row\.payload_bytes \|\| 0\) < 1/);
  assert.match(downloadRoute, /content-disposition/);
  assert.match(downloadRoute, /x-nexid-audit-receipt/);
  assert.match(downloadRoute, /cache-control/);
  assert.doesNotMatch(downloadRoute, /pack_password|password_delivery|K_META_BATCH|K_FILE_BATCH/);
});

test("Vault download history is append-only and contains no payload or plaintext key column", () => {
  assert.match(vaultMigration, /CREATE TABLE IF NOT EXISTS vault_artifact_downloads/);
  assert.match(vaultMigration, /UNIQUE \(artifact_id, idempotency_key\)/);
  assert.match(vaultMigration, /vault_artifact_download_history_is_immutable/);
  assert.match(vaultMigration, /BEFORE UPDATE OR DELETE ON vault_artifact_downloads/);
  assert.match(vaultMigration, /download_count integer NOT NULL DEFAULT 0/);
  assert.doesNotMatch(vaultMigration, /(?:payload|plaintext|raw_key|k_meta|k_file)\s+(?:text|bytea|jsonb)/i);
});

test("supplier export commits its audit receipt with artifact persistence and counters", () => {
  assert.match(exportRoute, /inserted_artifacts AS/);
  assert.match(exportRoute, /inserted_audit AS/);
  assert.match(exportRoute, /INSERT INTO audit_logs[\s\S]*'supplier_pack_exported'/);
  assert.match(exportRoute, /Number\(persisted\.inserted_audit \|\| 0\) !== 1/);
  assert.doesNotMatch(exportRoute, /await logAuditEvent\(/);
});
