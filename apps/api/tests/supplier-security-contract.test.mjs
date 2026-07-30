import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWorkspaceFile(...parts) {
  return readFileSync(path.join(repoRoot, ...parts), "utf8");
}

test("supplier operations docs reflect the immutable purpose gate without claiming production QA", () => {
  const overview = readWorkspaceFile("docs/supplier-operations-overview.md");

  assert.match(overview, /implementa un `pack_purpose` inmutable/);
  assert.match(overview, /aplica el gate de propósito antes de cualquier override/);
  assert.match(overview, /no puede convertir un trial `NON_SELLABLE`/);
  assert.doesNotMatch(overview, /todavía no implementa `pack_purpose`/);
});

test("supplier export requires operator password and never returns it", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/export-pack/route.ts");

  assert.match(source, /supplier_pack_export_forbidden/);
  assert.match(source, /supplier:export_pack/);
  assert.doesNotMatch(source, /security_operator/);
  assert.match(source, /forcedTenantSlug/);
  assert.match(source, /supplier_pack_password_required/);
  assert.match(source, /encryptSupplierZipArchive\(zipBuffer,\s*packPassword/);
  assert.match(source, /returned:\s*false/);
  assert.doesNotMatch(source, /password\s*:\s*passwordRecommendation/);
  assert.doesNotMatch(source, /password\s*:\s*packPassword/);
  assert.doesNotMatch(source, /randomBytes\(8\)/);
});

test("supplier export rejects non-trial purposes before decrypting keys and binds NON_SELLABLE disposition", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/export-pack/route.ts");
  const purposeGateIndex = source.indexOf("const effectivePackPurpose");
  const legacyGateIndex = source.indexOf('reason: "supplier_pack_purpose_unclassified"');
  const productionGateIndex = source.indexOf('reason: "supplier_production_qa_plan_required"');
  const decryptIndex = source.indexOf("decryptBatchKeyHex(String");

  assert.match(source, /nexid_effective_supplier_pack_purpose_v1\(so\.id\) AS effective_pack_purpose/);
  assert.ok(purposeGateIndex >= 0 && purposeGateIndex < decryptIndex);
  assert.ok(legacyGateIndex > purposeGateIndex && legacyGateIndex < decryptIndex);
  assert.ok(productionGateIndex > legacyGateIndex && productionGateIndex < decryptIndex);
  assert.match(source, /effectivePackPurpose !== "trial_integration"/);
  assert.match(source, /const commercialDisposition = "NON_SELLABLE" as const/);
  assert.match(source, /const activationAllowed = false as const/);
  assert.match(source, /PACK_PURPOSE:\s*packPurpose/);
  assert.match(source, /COMMERCIAL_DISPOSITION:\s*commercialDisposition/);
  assert.match(source, /ACTIVATION_ALLOWED:\s*activationAllowed/);
  assert.match(source, /physical_packaging_approved:\s*true/);
  assert.doesNotMatch(source, /\bproduction_ready\s*:/);
  assert.match(source, /commercial_disposition:\s*commercialDisposition/);
  assert.match(source, /activation_allowed:\s*activationAllowed/);
  assert.match(source, /NON_SELLABLE - TRIAL INTEGRATION ONLY - DO NOT SELL, SHIP, OR ACTIVATE/);
  assert.match(source, /buildSupplierPackPdfSummary\(\{[\s\S]*packPurpose,[\s\S]*commercialDisposition,[\s\S]*activationAllowed,/);
  assert.match(source, /managed_kms:\s*false/);
  assert.match(source, /hsm_backed:\s*false/);
});

test("supplier export consumes one-time counters only with the persisted encrypted artifact", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/export-pack/route.ts");
  const migration = readWorkspaceFile("apps/api/db/migrations/20260726190000_0061_supplier_export_artifact_delivery.sql");
  const reservationIndex = source.indexOf("reserved_sub_batches AS");
  const decryptIndex = source.indexOf("decryptBatchKeyHex(String");
  const encryptionIndex = source.indexOf("encryptSupplierZipArchive(zipBuffer");

  assert.notEqual(reservationIndex, -1);
  assert.ok(decryptIndex >= 0 && decryptIndex < reservationIndex);
  assert.ok(encryptionIndex > decryptIndex && encryptionIndex < reservationIndex);
  assert.match(source, /ssb\.key_export_count = 0/);
  assert.match(source, /bk\.export_count = 0/);
  assert.match(source, /reservation_gate AS MATERIALIZED/);
  assert.match(source, /inserted_artifacts AS/);
  assert.match(source, /inserted_evidence AS/);
  assert.match(source, /encrypted_payload_base64/);
  assert.match(source, /no one-time export counter was consumed/);
  assert.match(source, /UPDATE batch_key_material[\s\S]*exported_by/);
  assert.doesNotMatch(source, /SET export_count = export_count \+ 1[\s\S]*WHERE supplier_sub_batch_id = \$\{row\.supplier_sub_batch_id\}/);
  assert.match(migration, /encrypted_payload_base64 text/);
  assert.match(migration, /delivery_status/);
});

test("supplier order creation writes lifecycle records without returning raw batch keys", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/route.ts");
  const lifecycle = readWorkspaceFile("apps/api/src/lib/batch-keys.ts");

  assert.match(source, /buildBatchKeyLifecycleRecords/);
  assert.match(source, /INSERT INTO batch_key_material/);
  assert.match(source, /pair_fingerprint/);
  assert.match(lifecycle, /BATCH_KEY_ROLES/);
  assert.match(lifecycle, /redactSecretsDeep/);
  const successResponse = source.slice(source.indexOf("return json({\n      ok: true"));
  assert.doesNotMatch(successResponse, /kMetaHex/);
  assert.doesNotMatch(successResponse, /kFileHex/);
});

test("supplier key rotation is gated pre-export and never returns raw batch keys", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/sub-batches/[bid]/keys/rotate/route.ts");
  const helper = readWorkspaceFile("apps/api/src/lib/supplier-key-rotation.ts");
  const migration = readWorkspaceFile("apps/api/db/migrations/20260730150000_0074_supplier_key_rotation_atomic.sql");
  const client = readWorkspaceFile("packages/api-client/src/index.ts");

  assert.match(source, /supplier_key_rotation_forbidden/);
  assert.match(source, /supplier:key_rotate/);
  assert.doesNotMatch(source, /security_operator/);
  assert.match(source, /canRotateSupplierSubBatchKeys/);
  assert.match(source, /hasSupplierKeyRotationV2/);
  assert.match(source, /rotateSupplierBatchKeysV2/);
  assert.match(source, /buildBatchKeyLifecycleRecords/);
  assert.match(source, /assertBatchKeyEnvelopeContext/);
  assert.match(helper, /FROM public\.nexid_rotate_supplier_batch_keys_v2/);
  assert.match(migration, /key_export_count <> 0 OR v_locked\.pair_export_count <> 0/);
  assert.match(migration, /manifest_status = 'imported' OR v_locked\.manifest_count <> 0/);
  assert.match(migration, /qa_status = 'passed'/);
  assert.match(migration, /batch_status IN \('active', 'active_in_market'\)/);
  assert.match(migration, /status = 'rotated'/);
  assert.match(migration, /rotated_from_key_id/);
  assert.match(migration, /'batch_keys_rotated'/);
  assert.match(migration, /'batch_key_rotation_report'/);
  assert.doesNotMatch(source, /decryptBatchKeyHex|decryptKey16/);
  const successResponse = source.slice(source.indexOf("return json({\n    ok: true"));
  assert.doesNotMatch(successResponse, /kMetaHex|kFileHex|encryptedKeyCt|meta_key_ct|file_key_ct/);
  assert.match(client, /supplierKeyRotationResponseSchema/);
  assert.match(client, /adminRotateSupplierSubBatchKeys/);
});

test("public proof and anchor input stay hash-only", () => {
  const anchorSource = readWorkspaceFile("apps/api/src/app/admin/proof/anchor/route.ts");
  const anchorsSource = readWorkspaceFile("apps/api/src/app/admin/proof/anchors/route.ts");
  const verifySource = readWorkspaceFile("apps/api/src/app/public/proof/verify/route.ts");
  const schemaSource = readWorkspaceFile("apps/api/src/lib/supplier-ops-schema.ts");

  assert.match(anchorSource, /findForbiddenProofPayloadKey\(payload\)/);
  assert.match(anchorSource, /proof_payload_sensitive_key_rejected/);
  assert.match(anchorsSource, /event_ids_required/);
  assert.match(anchorsSource, /direct_event_hashes_forbidden/);
  assert.match(anchorsSource, /event_hashes_json/);
  assert.match(anchorsSource, /prepareIotaEvidence/);
  assert.match(anchorsSource, /resolveIotaEvidenceRuntimeConfig/);
  assert.match(anchorsSource, /mock-iota-/);
  assert.doesNotMatch(anchorsSource, /mock[\s\S]{0,160}status\s*=\s*"confirmed"/);
  assert.doesNotMatch(anchorsSource, /json-rpc\.evm\.testnet\.iotaledger\.net/);
  assert.match(schemaSource, /ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS resource_type/);
  assert.match(schemaSource, /ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS event_hashes_json/);
  assert.match(schemaSource, /ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'legacy'/);
  assert.match(schemaSource, /ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'legacy'/);
  assert.match(schemaSource, /ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS key_role text NOT NULL DEFAULT 'K_META_BATCH'/);
  assert.match(schemaSource, /ALTER TABLE offline_scan_events ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(schemaSource, /ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Proof provider'/);
  assert.match(schemaSource, /ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'Proof provider'/);
  assert.match(schemaSource, /ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '\{\}'::jsonb/);
  assert.match(schemaSource, /INSERT INTO ledger_providers \(code, name, network, rpc_url_env_name, chain_id, enabled, purpose, metadata_json\)/);
  assert.match(schemaSource, /WHERE NOT EXISTS \(\s*SELECT 1 FROM ledger_providers WHERE code = \$\{provider\.code\}/);
  assert.match(schemaSource, /ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(schemaSource, /ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(schemaSource, /ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS sequence_index integer/);
  assert.match(schemaSource, /row_number\(\) OVER \(PARTITION BY supplier_order_id ORDER BY created_at ASC, id ASC\)/);
  assert.match(verifySource, /isSha256Hash\(eventHash\)/);
  assert.match(verifySource, /event_hash_invalid/);
  assert.match(verifySource, /event_hashes_json/);
  assert.match(verifySource, /export async function POST\(req: Request\)/);
  assert.match(verifySource, /body\.event_hash \|\| body\.eventHash \|\| body\.hash/);
  assert.match(verifySource, /body\.anchor_id \|\| body\.anchorId/);
  assert.match(verifySource, /const included = effectiveMatches\.length > 0/);
  assert.match(verifySource, /included,/);
  assert.match(verifySource, /provider:\s*firstMatch\?\.provider \|\| null/);
  assert.match(verifySource, /Verification is hash-only/);
});

test("secure delivery recipient verification cannot hardcode a healthy delivery", () => {
  const adminSource = readWorkspaceFile("apps/api/src/app/admin/logistics/scan/route.ts");
  const publicSource = readWorkspaceFile("apps/api/src/app/api/v1/logistics/recipient-verify/route.ts");
  const policySource = readWorkspaceFile("apps/api/src/lib/secure-delivery-policy.ts");

  assert.match(policySource, /recipientVerificationStatusForSealStatus/);
  assert.match(policySource, /shouldCreateDeliveryClaimForStatus/);
  assert.match(adminSource, /recipientVerificationStatusForSealStatus\(result\.newStatus\)/);
  assert.match(publicSource, /recipientVerificationStatusForSealStatus\(result\.newStatus\)/);
  assert.match(adminSource, /INSERT INTO delivery_claims/);
  assert.match(publicSource, /INSERT INTO delivery_claims/);
  assert.doesNotMatch(publicSource, /,\s*'verified',\s*now\(\)/);
});

test("dashboard supplier console keeps pack password client-side only", () => {
  const source = readWorkspaceFile("apps/dashboard/src/components/supplier-order-console.tsx");

  assert.match(source, /crypto\.getRandomValues/);
  assert.match(source, /body:\s*JSON\.stringify\(\{\s*password:\s*effectivePassword\s*\}\)/);
  assert.match(source, /currentRole/);
  assert.match(source, /supplier:export_pack/);
  assert.match(source, /hasScopedPermission/);
  assert.doesNotMatch(source, /security-operator/);
  assert.match(source, /canExportPack/);
  assert.match(source, /Bloqueado para este perfil/);
  assert.match(source, /packagingApproved/);
  assert.match(source, /packagingStatus/);
  assert.doesNotMatch(source, /encrypted_pack\?\.password/);
  assert.doesNotMatch(source, /pack\.encrypted_pack\.password/);
});

test("legacy uid import cannot bypass supplier manifest and QA gates", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/batches/[bid]/import-uids/route.ts");
  const registerSource = readWorkspaceFile("apps/api/src/app/admin/batches/register/route.ts");

  assert.match(source, /checkAdmin\(req,\s*\["super_admin",\s*"tenant_admin"\]\)/);
  assert.match(source, /getAdminTenantScope/);
  assert.match(source, /legacy_import_disabled_for_supplier_batch/);
  assert.match(source, /import-manifest/);
  assert.match(registerSource, /legacy_supplier_registration_disabled/);
  assert.match(registerSource, /canRegisterInternalBatch/);
  assert.match(registerSource, /batch:register_internal/);
  assert.match(registerSource, /internal_batch_registration_forbidden/);
});

test("supplier manifest import requires SUN tenant profile only for secure SUN carriers", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/batches/[bid]/import-manifest/route.ts");

  assert.match(source, /requiresSecureSunEncoding/);
  assert.match(source, /if \(requiresSecureSunEncoding\(batchCarrierCode\)\)/);
  assert.doesNotMatch(source, /Complete tenant SUN profile before importing manifests\./);
});

test("tenant vault endpoint returns only safe supplier artifact metadata", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/vault/route.ts");

  assert.match(source, /SAFE_METADATA_KEYS/);
  assert.match(source, /sanitizeMetadata/);
  assert.match(source, /getAdminTenantScope/);
  assert.match(source, /forcedTenantSlug/);
  assert.doesNotMatch(source, /SELECT[\s\S]*storage_ref/i);
  assert.doesNotMatch(source, /raw_key|K_META_BATCH|K_FILE_BATCH|pack_password/i);
  assert.doesNotMatch(source, /metadata:\s*row\.metadata_json/);
});

test("supplier QA derives canonical SUN evidence and publishes a sanitized vault report", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/qa/route.ts");
  const commitSource = readWorkspaceFile("apps/api/src/lib/supplier-qa-commit.ts");
  const atomicMigration = readWorkspaceFile("apps/api/db/migrations/20260729130000_0070_supplier_qa_atomic_receipts.sql");
  const contextV2Migration = readWorkspaceFile("apps/api/db/migrations/20260730110000_0073_supplier_qa_verification_context_v2.sql");
  const evidenceSource = readWorkspaceFile("apps/api/src/lib/supplier-qa-evidence.ts");
  const contextSource = readWorkspaceFile("apps/api/src/lib/supplier-qa-verification-context.ts");
  const sunRoute = readWorkspaceFile("apps/api/src/app/sun/route.ts");
  const sunService = readWorkspaceFile("apps/api/src/lib/sun-service.ts");

  assert.match(source, /checkAdminPermission\(req, "supplier:qa"\)/);
  assert.match(source, /checkAdminPermission\(req, "batches:qa"\)/);
  assert.doesNotMatch(source, /checkAdminPermission\(req, "batches:write"\)/);
  assert.match(source, /readBoundedJsonBody<Record<string, unknown>>\(req, MAX_QA_BODY_BYTES\)/);
  assert.match(source, /const passed = parseQaDecision\(body\)/);
  assert.doesNotMatch(source, /Boolean\(body\.passed/);
  assert.match(source, /FROM sun_diagnostics d/);
  assert.match(source, /JOIN batch_keys bk ON bk\.supplier_sub_batch_id = ssb\.id/);
  assert.match(source, /bk\.key_fingerprint/);
  assert.doesNotMatch(source, /ssb\.key_fingerprint/);
  assert.match(source, /LEFT JOIN events e/);
  assert.match(source, /e\.meta->>'replay_original_event_id'/);
  assert.match(source, /manifest_uid_match/);
  assert.match(source, /req\.headers\.get\("idempotency-key"\)/);
  assert.match(source, /validSupplierQaIdempotencyKey/);
  assert.match(source, /commitSupplierQa\(/);
  assert.doesNotMatch(source, /ensureSupplierOpsSchema|logAuditEvent/);
  assert.doesNotMatch(source, /INSERT INTO supplier_qa_checks|INSERT INTO vault_artifacts|UPDATE supplier_sub_batches|UPDATE batches|INSERT INTO evidence_events/);
  assert.match(commitSource, /FROM public\.nexid_commit_supplier_qa_v2/);
  assert.match(commitSource, /supplier_qa_snapshot_already_consumed/);
  assert.match(atomicMigration, /CREATE OR REPLACE FUNCTION public\.nexid_commit_supplier_qa_v1/);
  assert.match(atomicMigration, /FOR UPDATE OF ssb, so, b, bk/);
  assert.match(atomicMigration, /supplier_qa_diagnostic_consumptions/);
  assert.match(atomicMigration, /supplier_qa_already_passed/);
  assert.match(atomicMigration, /supplier_qa_pre_release_state_required/);
  assert.match(contextV2Migration, /CREATE OR REPLACE FUNCTION public\.nexid_commit_supplier_qa_v2/);
  assert.match(contextV2Migration, /CREATE TABLE IF NOT EXISTS supplier_qa_verification_context_receipts/);
  assert.match(contextV2Migration, /FOR UPDATE OF ssb, so, b, bk/);
  assert.match(contextV2Migration, /supplier_qa_verification_context_changed/);
  assert.ok(
    source.indexOf("hasSupplierQaVerificationContextV2()")
      < source.indexOf("so.pack_purpose AS declared_pack_purpose"),
    "QA must fail closed before reading 0071 columns during a rolling rollout",
  );
  assert.match(source, /qa_carrier_profile_scope_mismatch/);
  assert.match(source, /qa_carrier_evidence_strategy_not_implemented/);
  assert.match(source, /server_verified_sun_evidence/);
  assert.match(source, /physical_ceremony_verified:\s*false/);
  assert.match(atomicMigration, /artifact_type, content_hash, mime_type, metadata_json/);
  assert.match(atomicMigration, /'qa_report'/);
  assert.match(source, /evidence_digest/);
  assert.doesNotMatch(source, /body\.replay_checked|body\.replayChecked/);
  assert.doesNotMatch(source, /body\.ttstatus_checked|body\.ttstatusChecked/);
  assert.doesNotMatch(source, /sample_urls:\s*normalizedSampleUrls/);
  assert.doesNotMatch(source, /physical_tap_verified:\s*true/);
  assert.match(source, /actorId:\s*actor\.id/);
  assert.match(evidenceSource, /replayOriginalEventId === candidate\.eventId/);
  assert.match(evidenceSource, /event_source/);
  assert.match(evidenceSource, /qa_canonical_event_scope_mismatch/);
  assert.match(evidenceSource, /qa_snapshot_result_identity_mismatch/);
  assert.match(evidenceSource, /qa_verification_context_mismatch/);
  assert.match(evidenceSource, /qa_snapshot_result_state_mismatch/);
  assert.match(source, /buildSupplierQaVerificationContext\(/);
  assert.match(sunService, /buildSupplierQaVerificationContext\(/);
  assert.match(contextSource, /SUPPLIER_QA_VERIFICATION_CONTEXT_DOMAIN/);
  assert.match(contextSource, /SUPPLIER_QA_VERIFICATION_CONTEXT_VERSION/);
  assert.match(contextSource, /pack_purpose: packPurpose/);
  assert.match(contextSource, /canonicalSupplierQaJson/);
  assert.match(contextSource, /binding,/);
  assert.match(contextSource, /canonicalPayload,/);
  assert.match(contextSource, /not a signature, KMS operation, HSM/);
  assert.match(sunService, /to_jsonb\(so\)->>'pack_purpose'/);
  assert.match(sunService, /supplier_context\.declared_pack_purpose/);
  assert.match(sunService, /normalizedDeclared && normalizedDeclared !== "legacy_unclassified"/);
  const purposeCapabilityIndex = sunService.indexOf("to_regprocedure('public.nexid_effective_supplier_pack_purpose_v1(uuid)')");
  const purposeReadIndex = sunService.indexOf("SELECT public.nexid_effective_supplier_pack_purpose_v1(");
  assert.ok(purposeCapabilityIndex >= 0 && purposeReadIndex > purposeCapabilityIndex);
  assert.match(sunService, /verification_context_domain:\s*verificationContext\?\.domain/);
  assert.match(sunService, /verification_context_version:\s*verificationContext\?\.schemaVersion/);
  assert.match(sunService, /verification_context_digest:\s*verificationContextDigest/);
  const canonicalTimestampProjection = /to_char\([^\n]+AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS\.US"Z"'\)/g;
  assert.equal((source.match(canonicalTimestampProjection) || []).length, 4);
  assert.equal((sunService.match(canonicalTimestampProjection) || []).length, 2);
  assert.doesNotMatch(evidenceSource, /VALID_MANUAL_OPENED|MANUAL_OPENED/);
  assert.match(sunRoute, /evidence_source:\s*"public_sun_route"/);
  assert.doesNotMatch(sunRoute, /uidHex:\s*sunDiagnostics\.uid_hex/);
  assert.doesNotMatch(sunService, /\[sun_tamper_decode\][\s\S]{0,240}uid:\s*resolvedUidHex/);
  assert.match(sunService, /uid_masked:\s*maskedUidForLog/);
});

test("supplier activate-all override is restricted to super-admin or explicit permission", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/batches/[bid]/activate-all/route.ts");

  assert.match(source, /supplier:activate_override/);
  assert.doesNotMatch(source, /security_operator/);
  assert.match(source, /supplier_activation_override_forbidden/);
  assert.match(source, /canUseActivationOverride/);
  assert.match(source, /overrideReason:\s*overrideAllowed \? overrideReason : ''/);
});

test("SUN debug diagnostics are redacted unless an explicit lab gate is enabled", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/sun/debug-verify/route.ts");

  assert.match(source, /ALLOW_SENSITIVE_SUN_DEBUG/);
  assert.match(source, /includeSensitiveDiagnostics/);
  assert.match(source, /x-nexid-debug-sensitive/);
  assert.match(source, /sensitive_redacted:\s*true/);
  assert.match(source, /picc_plain_hex:\s*null/);
  assert.match(source, /enc_plain_hex:\s*null/);
  assert.match(source, /cmac_candidates:\s*\[\]/);
});

test("supplier manifest import and activation write audit events without raw UID lists", () => {
  const manifestSource = readWorkspaceFile("apps/api/src/app/admin/batches/[bid]/import-manifest/route.ts");
  const activateSource = readWorkspaceFile("apps/api/src/app/admin/tags/activate/route.ts");

  assert.match(manifestSource, /logAuditEvent/);
  assert.match(manifestSource, /supplier_manifest_imported/);
  assert.match(manifestSource, /imported_by:\s*getAdminActor\(req\)\.email/);

  assert.match(activateSource, /logAuditEvent/);
  assert.match(activateSource, /supplier_tags_activated/);
  assert.match(activateSource, /activated_by:\s*getAdminActor\(req\)\.email/);
  assert.doesNotMatch(activateSource, /afterData:\s*{\s*uids/);
});
