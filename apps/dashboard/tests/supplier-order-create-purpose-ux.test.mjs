import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseSupplierOrderCreationPurpose } from "../src/lib/supplier-pack-purpose-policy.ts";

const pageSource = await readFile(
  new URL("../src/app/(app)/supplier-orders/create/page.tsx", import.meta.url),
  "utf8",
);
const policySource = await readFile(
  new URL("../src/lib/supplier-pack-purpose-policy.ts", import.meta.url),
  "utf8",
);
const listSource = await readFile(
  new URL("../src/app/(app)/supplier-orders/page.tsx", import.meta.url),
  "utf8",
);
const detailSource = await readFile(
  new URL("../src/app/(app)/supplier-orders/[orderId]/page.tsx", import.meta.url),
  "utf8",
);

test("supplier order creation purpose accepts only the exact API contract", () => {
  assert.equal(parseSupplierOrderCreationPurpose("trial_integration"), "trial_integration");
  assert.equal(parseSupplierOrderCreationPurpose("production"), "production");

  for (const invalid of [
    "",
    "trial",
    "Production",
    " production ",
    "legacy_unclassified",
    "enterprise-customer",
    10_000,
    null,
    undefined,
  ]) {
    assert.equal(parseSupplierOrderCreationPurpose(invalid), null);
  }
});

test("standalone supplier order creation starts unclassified and fails closed before fetch", () => {
  assert.match(pageSource, /useState<SupplierOrderCreationPurpose \| "">\(""\)/);
  assert.match(pageSource, /const exactPurpose = parseSupplierOrderCreationPurpose\(packPurpose\)/);
  assert.match(pageSource, /if \(!exactPurpose\) \{[\s\S]*?return;[\s\S]*?\}/);
  assert.match(pageSource, /pack_purpose:\s*exactPurpose/);
  assert.match(pageSource, /disabled=\{loading \|\| !accessResolved \|\| !canCreateSupplierOrder \|\| !parseSupplierOrderCreationPurpose\(packPurpose\)\}/);

  const validationIndex = pageSource.indexOf(
    "const exactPurpose = parseSupplierOrderCreationPurpose(packPurpose)",
  );
  const fetchIndex = pageSource.indexOf('fetch("/api/admin/supplier-orders"');
  assert.ok(validationIndex >= 0 && fetchIndex > validationIndex);
});

test("standalone supplier order creation evaluates order creation and key generation independently", () => {
  assert.match(pageSource, /fetch\("\/api\/session\/current"/);
  assert.match(pageSource, /dashboardHighImpactPermissionMatches\([\s\S]*"supplier_order\.create"[\s\S]*session\?\.deniedPermissions/);
  assert.match(pageSource, /dashboardHighImpactPermissionMatches\([\s\S]*"batch\.keys\.generate"[\s\S]*session\?\.deniedPermissions/);
  assert.match(pageSource, /if \(!canCreateSupplierOrder\) \{[\s\S]*?return;[\s\S]*?\}/);
  assert.match(pageSource, /creating an order never grants factory-pack export/);
});

test("supplier list and detail use canonical deny-aware high-impact boundaries", () => {
  assert.match(listSource, /dashboardHighImpactPermissionMatches\([\s\S]*"supplier_order\.create"[\s\S]*session\.deniedPermissions/);
  assert.match(listSource, /\{canCreateSupplierOrder \? \([\s\S]*?href="\/supplier-orders\/create"[\s\S]*?\) : null\}/);
  assert.match(detailSource, /dashboardHighImpactPermissionMatches\([\s\S]*"supplier_pack\.export"[\s\S]*session\.deniedPermissions/);
  assert.match(detailSource, /dashboardHighImpactPermissionMatches\([\s\S]*"supplier_pack\.export"[\s\S]*actionSession\.deniedPermissions/);
  assert.match(detailSource, /throw new Error\("supplier_pack_export_required"\)/);
  assert.match(detailSource, /disabled=\{!canExportFactoryPack \|\| !packagingApproved\}/);
  assert.match(detailSource, /Creating an order never grants key export/);
});

test("purpose selector explains the commercial and activation consequences", () => {
  assert.match(pageSource, /name="pack_purpose"[\s\S]*?value="trial_integration"/);
  assert.match(pageSource, /name="pack_purpose"[\s\S]*?value="production"/);
  assert.match(pageSource, /NON_SELLABLE\. Integration and physical validation only/);
  assert.match(pageSource, /tags cannot be sold, claimed, tokenized, or activated/);
  assert.match(pageSource, /tenant-approved AQL plan and production receiving QA v2/);
  assert.match(pageSource, /Creation leaves every tag blocked and does not activate it/);
  assert.match(pageSource, /never infers this choice from the tenant, brand, product, or quantity/);
  assert.match(pageSource, /data-testid="supplier-order-create-purpose-contract"/);
});

test("supplier order fields keep explicit accessible names and mobile-safe layout", () => {
  for (const id of [
    "supplier-order-tenant-slug",
    "supplier-order-customer-slug",
    "supplier-order-name",
    "supplier-order-base-batch-id",
    "supplier-order-total-quantity",
    "supplier-order-sub-batch-size",
    "supplier-order-chip-model",
    "supplier-order-carrier-profile",
    "supplier-order-material-type",
    "supplier-order-notes",
  ]) {
    assert.match(pageSource, new RegExp(`htmlFor="${id}"`));
    assert.match(pageSource, new RegExp(`id="${id}"`));
  }
  assert.match(pageSource, /grid grid-cols-1 gap-4 sm:grid-cols-2/);
});

test("touched supplier purpose files contain no customer-brand examples", () => {
  const touchedSources = `${pageSource}\n${policySource}`;
  assert.doesNotMatch(touchedSources, /syngenta|bayer/i);
});
