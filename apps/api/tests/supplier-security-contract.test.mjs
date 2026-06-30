import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWorkspaceFile(...parts) {
  return readFileSync(path.join(repoRoot, ...parts), "utf8");
}

test("supplier export requires operator password and never returns it", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/export-pack/route.ts");

  assert.match(source, /supplier_pack_export_forbidden/);
  assert.match(source, /security_operator/);
  assert.match(source, /supplier:export_pack/);
  assert.match(source, /forcedTenantSlug/);
  assert.match(source, /supplier_pack_password_required/);
  assert.match(source, /encryptSupplierZipArchive\(zipBuffer,\s*packPassword/);
  assert.match(source, /returned:\s*false/);
  assert.doesNotMatch(source, /password\s*:\s*passwordRecommendation/);
  assert.doesNotMatch(source, /password\s*:\s*packPassword/);
  assert.doesNotMatch(source, /randomBytes\(8\)/);
});

test("supplier export reserves one-time packs with conditional updates before secret material is built", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/export-pack/route.ts");
  const reservationIndex = source.indexOf("reserved_sub_batches AS");
  const decryptIndex = source.indexOf("decryptBatchKeyHex(String");

  assert.notEqual(reservationIndex, -1);
  assert.ok(reservationIndex < decryptIndex);
  assert.match(source, /ssb\.key_export_count = 0/);
  assert.match(source, /bk\.export_count = 0/);
  assert.match(source, /reserved_sub_batches[\s\S]*reserved_keys/);
  assert.match(source, /reserved_sub_batches[\s\S]*!== rows\.length/);
  assert.match(source, /reserved_keys[\s\S]*!== rows\.length/);
  assert.match(source, /UPDATE batch_key_material[\s\S]*exported_by/);
  assert.doesNotMatch(source, /SET export_count = export_count \+ 1[\s\S]*WHERE supplier_sub_batch_id = \$\{row\.supplier_sub_batch_id\}/);
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

test("public proof and anchor input stay hash-only", () => {
  const anchorSource = readWorkspaceFile("apps/api/src/app/admin/proof/anchor/route.ts");
  const verifySource = readWorkspaceFile("apps/api/src/app/public/proof/verify/route.ts");

  assert.match(anchorSource, /findForbiddenProofPayloadKey\(payload\)/);
  assert.match(anchorSource, /proof_payload_sensitive_key_rejected/);
  assert.match(verifySource, /isSha256Hash\(eventHash\)/);
  assert.match(verifySource, /event_hash_invalid/);
});

test("dashboard supplier console keeps pack password client-side only", () => {
  const source = readWorkspaceFile("apps/dashboard/src/components/supplier-order-console.tsx");

  assert.match(source, /crypto\.getRandomValues/);
  assert.match(source, /body:\s*JSON\.stringify\(\{\s*password:\s*effectivePassword\s*\}\)/);
  assert.match(source, /currentRole/);
  assert.match(source, /supplier:export_pack/);
  assert.match(source, /hasScopedPermission/);
  assert.match(source, /security-operator/);
  assert.match(source, /Operador de seguridad activo/);
  assert.match(source, /canExportPack/);
  assert.match(source, /Bloqueado para tenant admin/);
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

test("supplier QA stores hashed evidence and publishes a sanitized vault report", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/[orderId]/qa/route.ts");

  assert.match(source, /sample_url_hashes/);
  assert.match(source, /artifact_type, content_hash, mime_type, metadata_json/);
  assert.match(source, /'qa_report'/);
  assert.match(source, /evidence_digest/);
  assert.doesNotMatch(source, /sample_urls:\s*normalizedSampleUrls/);
});

test("supplier activate-all override is restricted to security scope or explicit permission", () => {
  const source = readWorkspaceFile("apps/api/src/app/admin/batches/[bid]/activate-all/route.ts");

  assert.match(source, /security_operator/);
  assert.match(source, /supplier:activate_override/);
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
  assert.match(manifestSource, /imported_by:\s*safeActor\(req\)/);

  assert.match(activateSource, /logAuditEvent/);
  assert.match(activateSource, /supplier_tags_activated/);
  assert.match(activateSource, /activated_by:\s*safeActor\(req\)/);
  assert.doesNotMatch(activateSource, /afterData:\s*{\s*uids/);
});
