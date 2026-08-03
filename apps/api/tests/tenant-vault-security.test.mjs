import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeTenantVaultDownloadIdempotencyKey,
  normalizeTenantVaultDownloadReason,
  projectTenantVaultArtifact,
  resolveTenantVaultNextAction,
  sanitizeTenantVaultMetadata,
  tenantVaultDownloadFilename,
  tenantVaultFolderForArtifact,
} from "../src/lib/tenant-vault.ts";

const routeSource = await readFile(
  new URL("../src/app/admin/tenant-vault/[tenantId]/route.ts", import.meta.url),
  "utf8",
);

test("tenant vault artifact projection only permits explicit non-secret metadata", () => {
  const projected = projectTenantVaultArtifact({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    supplier_order_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    artifact_type: "supplier_pack_zip_encrypted",
    content_hash: `sha256:${"a".repeat(64)}`,
    mime_type: "application/vnd.nexid.supplier-pack+json",
    status: "active",
    delivery_status: "ready",
    delivery_attempt_count: 1,
    metadata_json: {
      filename: "supplier-pack.enc",
      key_fingerprint: "fingerprint-only",
      plaintext_zip_sha256: `sha256:${"b".repeat(64)}`,
      database_url: "postgres://must-not-leak",
      raw_key: "must-not-leak",
      storage_path: "must-not-leak",
      encryption: { algorithm: "AES-256-GCM", nonce: "must-not-leak" },
    },
    created_at: "2026-08-02T12:00:00.000Z",
  }, "operator");

  assert.equal(projected.folder, "exports");
  assert.equal(projected.encrypted, true);
  assert.equal(projected.download.available, true);
  assert.equal(projected.download.count, 0);
  assert.equal(projected.download.last_downloaded_at, null);
  assert.equal(projected.delivery.status, "ready");
  assert.equal(projected.metadata.filename, "supplier-pack.enc");
  assert.equal(projected.metadata.key_fingerprint, "fingerprint-only");
  assert.equal(projected.metadata.encryption_algorithm, "AES-256-GCM");
  assert.equal("database_url" in projected.metadata, false);
  assert.equal("raw_key" in projected.metadata, false);
  assert.equal("storage_path" in projected.metadata, false);
  assert.equal("nonce" in projected.metadata, false);
});

test("tenant view receives generic pack status and never receives operator delivery metadata", () => {
  const projected = projectTenantVaultArtifact({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    supplier_order_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    artifact_type: "supplier_pack_zip_encrypted",
    content_hash: "c".repeat(64),
    mime_type: "application/vnd.nexid.supplier-pack+json",
    delivery_status: "ready",
    delivery_attempt_count: 4,
    metadata_json: {
      filename: "supplier-pack.enc",
      key_fingerprint: "operator-only",
      envelope_sha256: `sha256:${"d".repeat(64)}`,
      qa_status: "passed",
      pack_purpose: "production",
    },
  }, "tenant");

  assert.equal(projected.artifact_type, "encrypted_supplier_pack");
  assert.equal(projected.mime_type, null);
  assert.equal(projected.download.reason, "tenant_key_pack_download_forbidden");
  assert.equal(projected.download.available, false);
  assert.equal("delivery" in projected, false);
  assert.equal("key_fingerprint" in projected.metadata, false);
  assert.equal("envelope_sha256" in projected.metadata, false);
  assert.equal("filename" in projected.metadata, false);
  assert.equal("qa_status" in projected.metadata, false);
  assert.equal(projected.metadata.pack_purpose, "production");
});

test("vault download inputs are bounded and filenames cannot escape content disposition", () => {
  assert.equal(normalizeTenantVaultDownloadIdempotencyKey("vault-download:1234567890"), "vault-download:1234567890");
  assert.equal(normalizeTenantVaultDownloadIdempotencyKey("short"), "");
  assert.equal(normalizeTenantVaultDownloadIdempotencyKey("x".repeat(129)), "");
  assert.equal(normalizeTenantVaultDownloadReason("  Recovery after interrupted secure delivery  "), "Recovery after interrupted secure delivery");
  assert.equal(normalizeTenantVaultDownloadReason("too short"), "");
  assert.equal(tenantVaultDownloadFilename('../../factory\r\n".zip', "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), "factory-.zip.enc");
});

test("vault folder classification covers the authoritative hierarchy", () => {
  assert.equal(tenantVaultFolderForArtifact("supplier_pack_zip_encrypted"), "exports");
  assert.equal(tenantVaultFolderForArtifact("uid_manifest"), "manifests");
  assert.equal(tenantVaultFolderForArtifact("production_qa_receipt"), "qa-reports");
  assert.equal(tenantVaultFolderForArtifact("batch_key_rotation_report"), "proofs");
  assert.deepEqual(sanitizeTenantVaultMetadata(null, "tenant"), {});
});

test("tenant workflow is status-only while operator workflow retains privileged actions", () => {
  const order = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    effective_pack_purpose: "production",
    packaging_governance_status: "approved",
  };
  const baseSubBatch = {
    key_export_count: 1,
    manifest_status: "pending",
    qa_status: "pending",
    expected_quantity: 100,
    active_tag_count: 0,
  };

  assert.equal(resolveTenantVaultNextAction(order, [], "operator").code, "investigate_missing_sub_batches");
  assert.equal(resolveTenantVaultNextAction(order, [], "tenant").code, "await_nexid_order_repair");

  assert.equal(resolveTenantVaultNextAction(order, [baseSubBatch], "operator").code, "import_manifest");
  assert.equal(resolveTenantVaultNextAction(order, [baseSubBatch], "tenant").code, "await_supplier_manifest");

  const manifested = { ...baseSubBatch, manifest_status: "imported" };
  assert.equal(resolveTenantVaultNextAction(order, [manifested], "operator").code, "complete_qa");
  assert.equal(resolveTenantVaultNextAction(order, [manifested], "tenant").code, "await_receiving_qa");

  const qaPassed = { ...manifested, qa_status: "passed" };
  assert.equal(resolveTenantVaultNextAction(order, [qaPassed], "operator").code, "activate_tags");
  const tenantActivation = resolveTenantVaultNextAction(order, [qaPassed], "tenant");
  assert.equal(tenantActivation.code, "await_nexid_activation");
  assert.equal(tenantActivation.href, `/supplier-orders/${order.id}`);

  const trialOrder = { ...order, effective_pack_purpose: "trial_integration" };
  assert.equal(resolveTenantVaultNextAction(trialOrder, [qaPassed], "tenant").code, "trial_complete");
});

test("tenant vault route enforces role, permission, path binding, tenant SQL scope and no-store", () => {
  assert.match(routeSource, /checkAdmin\(req, \["super_admin", "tenant_admin"\]\)/);
  assert.match(routeSource, /checkAdminPermission\(req, "supplier_orders:read"\)/);
  assert.match(routeSource, /allowedIdentifiers\.has\(requestedTenant\)/);
  assert.match(routeSource, /WHERE va\.tenant_id = \$\{tenant\.id\}/);
  assert.match(routeSource, /WHERE ssb\.tenant_id = \$\{tenant\.id\}/);
  assert.match(routeSource, /viewer === "operator"[\s\S]*audit_logs/);
  assert.match(routeSource, /nexid_effective_supplier_pack_purpose_v1/);
  assert.match(routeSource, /resolveTenantVaultNextAction\(order, subBatches, viewer\)/);
  assert.match(routeSource, /left\(audit\.action, 9\) = 'supplier_'/);
  assert.doesNotMatch(routeSource, /audit\.action LIKE 'supplier_%'/);
  assert.match(routeSource, /"cache-control": "private, no-store, max-age=0"/);
  assert.match(routeSource, /plaintext_artifact_persisted:\s*false/);
  assert.match(routeSource, /canPrivilegedDownload = viewer === "operator" && principal\.mfaVerified/);
  assert.match(routeSource, /can_download_supplier_packs: canPrivilegedDownload/);
  assert.match(routeSource, /operator_mfa_required/);
  assert.match(routeSource, /va\.download_count/);
  assert.match(routeSource, /privileged_idempotent_audited_delivery/);
  assert.doesNotMatch(routeSource, /\b(?:encrypted_payload_base64|storage_ref|meta_key_ct|file_key_ct|encrypted_key_ct)\b/i);
  assert.doesNotMatch(routeSource, /metadata:\s*row\.metadata_json/);
});
