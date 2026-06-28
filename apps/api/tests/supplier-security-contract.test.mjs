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

  assert.match(source, /checkAdmin\(req,\s*\["super_admin",\s*"tenant_admin"\]\)/);
  assert.match(source, /getAdminTenantScope/);
  assert.match(source, /legacy_import_disabled_for_supplier_batch/);
  assert.match(source, /import-manifest/);
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
