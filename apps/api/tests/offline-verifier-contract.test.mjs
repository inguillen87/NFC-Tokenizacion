import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWorkspaceFile(...parts) {
  return readFileSync(path.join(repoRoot, ...parts), "utf8");
}

test("offline verifier schema stores devices, bundles and hashed sync events without key material", () => {
  const migration = readWorkspaceFile("apps/api/db/migrations/20260630120000_0039_offline_verifier_sync.sql");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS offline_verifier_devices/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS offline_verifier_bundles/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS offline_scan_events/);
  assert.match(migration, /uid_hash text/);
  assert.match(migration, /sun_payload_hash text/);
  assert.match(migration, /server_verdict text NOT NULL DEFAULT 'SYNC_PENDING'/);
  assert.doesNotMatch(migration, /K_META_BATCH|K_FILE_BATCH|master_key|plaintext_key/i);
});

test("offline bundle endpoint returns fingerprints and policy only, never raw or encrypted keys", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/offline-verifier/bundles/route.ts");

  assert.match(source, /contains_key_material: false/);
  assert.match(source, /provisional_until_backend_sync/);
  assert.match(source, /key_material_included: false/);
  assert.match(source, /does not include K_META_BATCH, K_FILE_BATCH or tenant master keys/);
  assert.doesNotMatch(source, /decryptBatchKeyHex|decryptKey16|encrypted_key_ct/);
});

test("offline sync endpoint rejects raw sensitive payloads and keeps verdicts provisional", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/offline-verifier/sync/route.ts");

  assert.match(source, /findForbiddenProofPayloadKey\(event\)/);
  assert.match(source, /raw_or_sensitive_payload_rejected/);
  assert.match(source, /hashed_evidence_required/);
  assert.match(source, /final_verdict: false/);
  assert.match(source, /does not certify ownership, warranty, CRM or proof anchors offline/);
  assert.match(source, /serverVerdict = localVerdict === "OFFLINE_LOCAL_FAIL" \? "SYNC_REVIEW_REQUIRED" : "SYNC_PENDING"/);
  assert.doesNotMatch(source, /SYNC_CONFIRMED|final_verdict:\s*true/);
});

test("api client exposes offline verifier contracts without raw key or raw SUN fields", () => {
  const source = readWorkspaceFile("packages/api-client/src/index.ts");

  assert.match(source, /offlineVerifierBundleSchema/);
  assert.match(source, /key_material_included: z\.literal\(false\)/);
  assert.match(source, /final_verdict: z\.literal\(false\)/);
  assert.match(source, /adminListOfflineVerifierDevices/);
  assert.match(source, /adminEnrollOfflineVerifierDevice/);
  assert.match(source, /adminIssueOfflineVerifierBundle/);
  assert.match(source, /adminSyncOfflineVerifierEvents/);
  assert.match(source, /uid_hash\?: string/);
  assert.match(source, /sun_payload_hash\?: string/);
  assert.doesNotMatch(source, /uid_hex|picc_data|K_META_BATCH|K_FILE_BATCH|master_key|plaintext_key/i);
});

test("dashboard offline verifier console is permissioned and framed as provisional", () => {
  const source = readWorkspaceFile("apps/dashboard/src/components/supplier-order-console.tsx");

  assert.match(source, /supplier:offline_verifier/);
  assert.match(source, /safeResponseForPath\(path: string, data: unknown\)/);
  assert.match(source, /path\.includes\("\/offline-verifier"\)/);
  assert.match(source, /key_material_included: false/);
  assert.match(source, /Final sync backend/);
  assert.match(source, /Este modo no certifica ownership, warranty, CRM ni proof anchors sin backend/);
});
