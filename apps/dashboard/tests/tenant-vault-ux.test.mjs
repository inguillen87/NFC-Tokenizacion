import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { requiredPermissionForAdminResource } from "../src/lib/permission-policy.ts";
import { selectTenantVaultPayload } from "../src/lib/tenant-vault-contract.ts";

const page = await readFile(new URL("../src/app/(app)/admin/tenant-vault/[tenantId]/page.tsx", import.meta.url), "utf8");
const browser = await readFile(new URL("../src/components/tenant-vault-browser.tsx", import.meta.url), "utf8");
const downloadControl = await readFile(new URL("../src/components/tenant-vault-download-control.tsx", import.meta.url), "utf8");
const ordersPage = await readFile(new URL("../src/app/(app)/supplier-orders/page.tsx", import.meta.url), "utf8");
const detailPage = await readFile(new URL("../src/app/(app)/supplier-orders/[orderId]/page.tsx", import.meta.url), "utf8");

function fixture(overrides = {}) {
  return {
    ok: true,
    generated_at: "2026-08-02T12:00:00.000Z",
    viewer: { mode: "tenant", can_view_export_audit: false, can_download_supplier_packs: false },
    custody: {
      classification: "application_envelope_encryption",
      managed_kms: false,
      hsm_backed: false,
      plaintext_artifact_persisted: false,
      tenant_key_export_allowed: false,
      download_status: "tenant_key_pack_download_forbidden",
    },
    tenant: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "syngenta-ar", name: "Syngenta AR" },
    hierarchy: { root: "syngenta-ar", supplier_orders: "supplier-orders", folders: ["sub-batches", "exports", "manifests", "qa-reports", "proofs"] },
    summary: { orders: 0, sub_batches: 0, planned_tags: 0, manifested_tags: 0, qa_passed_sub_batches: 0, active_tags: 0, artifacts: 0 },
    pagination: { order_limit: 25, orders_truncated: false, artifact_limit: 1000, artifacts_truncated: false },
    orders: [],
    ...overrides,
  };
}

test("tenant vault page binds non-superadmin navigation to the validated session tenant", () => {
  assert.match(page, /requireDashboardSession\("supplier_orders:read"\)/);
  assert.match(page, /session\.role !== "super-admin" && !sessionIdentifiers\.includes\(requestedTenant\)/);
  assert.match(page, /createAdminPageContext\(session/);
  assert.match(page, /fetchAdminPage\(context, `tenant-vault\/\$\{encodeURIComponent\(requestedTenant\)\}`\)/);
  assert.match(page, /No se muestran datos de demostración como reemplazo/);
});

test("vault BFF read requires the supplier-order read permission", () => {
  assert.equal(requiredPermissionForAdminResource("GET", "tenant-vault/syngenta-ar"), "supplier_orders:read");
  assert.equal(requiredPermissionForAdminResource("POST", "tenant-vault/syngenta-ar"), null);
});

test("payload selector rejects tenant mismatch, fake KMS claims and tenant audit projection", () => {
  assert.equal(selectTenantVaultPayload(fixture(), ["syngenta-ar"], "tenant")?.tenant.slug, "syngenta-ar");
  assert.equal(selectTenantVaultPayload(fixture({
    viewer: { mode: "operator", can_view_export_audit: true, can_download_supplier_packs: true },
    custody: { ...fixture().custody, download_status: "privileged_idempotent_audited_delivery" },
    export_audit: [],
  }), ["syngenta-ar"], "operator")?.viewer.mode, "operator");
  assert.equal(selectTenantVaultPayload(fixture({
    viewer: { mode: "operator", can_view_export_audit: true, can_download_supplier_packs: false },
    custody: { ...fixture().custody, download_status: "operator_mfa_required" },
    export_audit: [],
  }), ["syngenta-ar"], "operator")?.viewer.can_download_supplier_packs, false);
  assert.equal(selectTenantVaultPayload(fixture({
    viewer: { mode: "operator", can_view_export_audit: true, can_download_supplier_packs: false },
    custody: { ...fixture().custody, download_status: "privileged_idempotent_audited_delivery" },
    export_audit: [],
  }), ["syngenta-ar"], "operator"), null);
  assert.equal(selectTenantVaultPayload(fixture(), ["another-tenant"], "tenant"), null);
  assert.equal(selectTenantVaultPayload(fixture(), ["syngenta-ar"], "operator"), null);
  assert.equal(selectTenantVaultPayload(fixture({ custody: { managed_kms: true, hsm_backed: true } }), ["syngenta-ar"], "tenant"), null);
  assert.equal(selectTenantVaultPayload(fixture({ export_audit: [] }), ["syngenta-ar"], "tenant"), null);
});

test("tenant payload rejects operator-only supplier pack fields at the UI boundary", () => {
  const unsafeArtifact = {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    supplier_order_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    supplier_sub_batch_id: null,
    folder: "exports",
    artifact_type: "encrypted_supplier_pack",
    content_hash: "a".repeat(64),
    mime_type: null,
    encrypted: true,
    status: "active",
    created_at: null,
    metadata: { key_fingerprint: "must-not-render" },
    download: { available: false, reason: "tenant_key_pack_download_forbidden", count: 0, last_downloaded_at: null },
    delivery: { status: "ready", attempt_count: 1, last_attempt_at: null },
  };
  const unsafeOrder = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    pack_purpose: "production",
    next_action: { code: "complete_qa", label: "Complete QA", href: "/supplier-orders/b" },
    sub_batches: [],
    folders: { exports: [unsafeArtifact], manifests: [], "qa-reports": [], proofs: [] },
  };

  assert.equal(selectTenantVaultPayload(fixture({ orders: [unsafeOrder] }), ["syngenta-ar"], "tenant"), null);
});

test("folder browser exposes truthful custody and a superadmin-only audited download control", () => {
  for (const folder of ["sub-batches", "exports", "manifests", "qa-reports", "proofs"]) {
    assert.match(browser, new RegExp(folder));
  }
  assert.match(browser, /No es KMS gestionado ni HSM/);
  assert.match(browser, /TenantVaultDownloadControl/);
  assert.match(browser, /operator && artifact\.download\.available/);
  assert.match(browser, /El tenant no puede descargar packs de claves/);
  assert.match(browser, /operator_mfa_required/);
  assert.match(browser, /superadmin con MFA verificado/);
  assert.match(downloadControl, /Motivo obligatorio de la entrega privilegiada/);
  assert.match(downloadControl, /idempotency-key/);
  assert.match(downloadControl, /x-nexid-audit-receipt/);
  assert.match(downloadControl, /Descargar pack cifrado/);
});

test("supplier order surfaces link to the tenant vault", () => {
  assert.match(ordersPage, /\/admin\/tenant-vault\/\$\{encodeURIComponent\(String\(adminContext\.tenantSlug \|\| row\.tenant_slug \|\| row\.customer_slug/);
  assert.match(detailPage, /\/admin\/tenant-vault\/\$\{encodeURIComponent\(order\.tenant_slug\)\}/);
});
