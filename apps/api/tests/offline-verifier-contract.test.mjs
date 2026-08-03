import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const offlineVerifier = await import("../src/lib/offline-verifier.ts");

function readWorkspaceFile(...parts) {
  return readFileSync(path.join(repoRoot, ...parts), "utf8");
}

test("offline verifier schema stores devices, bundles and hashed sync events without key material", () => {
  const migration = readWorkspaceFile("apps/api/db/migrations/20260630120000_0039_offline_verifier_sync.sql");
  const historyIndex = readWorkspaceFile("apps/api/db/migrations/20260802153000_0080_offline_scan_history_index.sql");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS offline_verifier_devices/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS offline_verifier_bundles/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS offline_scan_events/);
  assert.match(migration, /uid_hash text/);
  assert.match(migration, /sun_payload_hash text/);
  assert.match(migration, /server_verdict text NOT NULL DEFAULT 'SYNC_PENDING'/);
  assert.doesNotMatch(migration, /K_META_BATCH|K_FILE_BATCH|master_key|plaintext_key/i);
  assert.match(historyIndex, /offline_scan_events \(tenant_id, received_at DESC, id DESC\)/);
  assert.doesNotMatch(historyIndex.slice(historyIndex.indexOf("CREATE INDEX")), /uid_hash|sun_payload_hash|payload|key_material/i);
});

test("offline bundle endpoint returns fingerprints and policy only, never raw or encrypted keys", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/offline-verifier/bundles/route.ts");

  assert.match(source, /contains_key_material: false/);
  assert.match(source, /provisional_until_backend_sync/);
  assert.match(source, /key_material_included: false/);
  assert.match(source, /does not include K_META_BATCH, K_FILE_BATCH or tenant master keys/);
  assert.doesNotMatch(source, /decryptBatchKeyHex|decryptKey16|encrypted_key_ct/);
});

test("offline device and bundle issuance fail closed behind superadmin and an explicit feature gate", () => {
  const devices = readWorkspaceFile("apps/api/src/app/admin/offline-verifier/devices/route.ts");
  const bundles = readWorkspaceFile("apps/api/src/app/admin/offline-verifier/bundles/route.ts");
  const environmentExample = readWorkspaceFile("apps/api/.env.example");
  const devicePost = devices.slice(devices.indexOf("export async function POST"));
  const bundlePost = bundles.slice(bundles.indexOf("export async function POST"));

  for (const source of [devicePost, bundlePost]) {
    assert.match(source, /checkAdmin\(req, \["super_admin"\]\)/);
    assert.match(source, /offlineVerifierBundleIssuanceEnabled\(\)/);
    assert.match(source, /offline_verifier_bundles_disabled/);
    assert.match(source, /readBoundedJsonBody<unknown>/);
    assert.match(source, /requireOfflineJsonObject/);
    assert.match(source, /RequestBodyTooLargeError/);
    assert.ok(source.indexOf("checkAdmin(req") < source.indexOf("readBoundedJsonBody"));
    assert.ok(source.indexOf("offlineVerifierBundleIssuanceEnabled()") < source.indexOf("readBoundedJsonBody"));
  }

  assert.equal(offlineVerifier.offlineVerifierBundleIssuanceEnabled({}), false);
  assert.equal(offlineVerifier.offlineVerifierBundleIssuanceEnabled({ OFFLINE_VERIFIER_BUNDLES_ENABLED: "false" }), false);
  assert.equal(offlineVerifier.offlineVerifierBundleIssuanceEnabled({ OFFLINE_VERIFIER_BUNDLES_ENABLED: "true" }), true);
  assert.match(environmentExample, /^OFFLINE_VERIFIER_BUNDLES_ENABLED=false$/m);
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

test("offline sync exposes a tenant-scoped, permissioned and keyset-paginated safe history read", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/offline-verifier/sync/route.ts");
  const getSource = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));

  assert.match(getSource, /checkAdminPermission\(req, "supplier:offline_verifier"\)/);
  assert.match(getSource, /forcedTenantSlug \|\| requestedTenantSlug/);
  assert.match(getSource, /tenant_scope_required/);
  assert.match(getSource, /decodeOfflineHistoryCursor/);
  assert.match(getSource, /ORDER BY ose\.received_at DESC, ose\.id DESC/);
  assert.match(getSource, /\(ose\.received_at, ose\.id\) < \(/);
  assert.match(getSource, /LIMIT \$\{limit \+ 1\}/);
  assert.match(getSource, /next_cursor: nextCursor/);
  assert.match(getSource, /NO_STORE/);
  assert.doesNotMatch(getSource, /ose\.client_event_id/);
  assert.doesNotMatch(getSource, /ose\.(uid_hash|sun_payload_hash|payload_hash|metadata_json)/);
  assert.doesNotMatch(getSource, /captured_url|key_fingerprints|encrypted_key|master_key/i);
  assert.doesNotMatch(getSource, /ensureSupplierOpsSchema\(\)/);
});

test("offline history cursor and page bounds reject malformed input", () => {
  const id = "d877a64d-5a44-4a02-8d33-efb9f4bc0c74";
  const receivedAt = "2026-08-02T12:00:00.000Z";
  const encoded = offlineVerifier.encodeOfflineHistoryCursor({ id, receivedAt });

  assert.deepEqual(offlineVerifier.decodeOfflineHistoryCursor(encoded), { id, receivedAt });
  assert.equal(offlineVerifier.normalizeOfflineHistoryLimit(null), 50);
  assert.equal(offlineVerifier.normalizeOfflineHistoryLimit("100"), 100);
  assert.throws(() => offlineVerifier.normalizeOfflineHistoryLimit("101"), /offline_history_limit_invalid/);
  assert.throws(() => offlineVerifier.decodeOfflineHistoryCursor("not+a+cursor"), /offline_history_cursor_invalid/);
  assert.deepEqual(offlineVerifier.requireOfflineJsonObject({ ok: true }), { ok: true });
  assert.throws(() => offlineVerifier.requireOfflineJsonObject([]), /invalid_json/);
  assert.throws(() => offlineVerifier.requireOfflineJsonObject(null), /invalid_json/);
});

test("offline admin mutations enforce route-specific bounded request bodies", () => {
  const devices = readWorkspaceFile("apps/api/src/app/admin/offline-verifier/devices/route.ts");
  const bundles = readWorkspaceFile("apps/api/src/app/admin/offline-verifier/bundles/route.ts");
  const sync = readWorkspaceFile("apps/api/src/app/admin/offline-verifier/sync/route.ts");

  assert.match(devices, /OFFLINE_DEVICE_ENROLLMENT_BODY_MAX_BYTES/);
  assert.match(bundles, /OFFLINE_BUNDLE_ISSUANCE_BODY_MAX_BYTES/);
  assert.match(sync, /OFFLINE_ADMIN_SYNC_BODY_MAX_BYTES/);
  for (const source of [devices, bundles, sync]) {
    assert.match(source, /request_body_too_large/);
    assert.match(source, /tooLarge \? 413 : 400/);
  }
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
