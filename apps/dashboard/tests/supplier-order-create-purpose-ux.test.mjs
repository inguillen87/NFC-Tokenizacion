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
const stylesSource = await readFile(new URL("../src/app/(app)/supplier-orders/create/supplier-order-create.module.css", import.meta.url), "utf8");
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
  assert.match(pageSource, /validateSupplierOrderDraft\(draft, exactPurpose\)/);
  assert.match(pageSource, /body: JSON\.stringify\(validated\.payload\)/);
  assert.match(pageSource, /disabled=\{frozen \|\| !accessResolved \|\| !canCreateSupplierOrder \|\| secureAccessMissing \|\| !parseSupplierOrderCreationPurpose\(packPurpose\)\}/);

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
  assert.match(pageSource, /if \(!accessResolved \|\| !canCreateSupplierOrder\) \{[\s\S]*?return;[\s\S]*?\}/);
  assert.match(pageSource, /validated\.secureSun && \(!canGenerateBatchKeys \|\| !mfaVerified\)/);
  assert.match(pageSource, /Crear un pedido no concede permiso para exportar el paquete de fábrica/);
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
  assert.match(pageSource, /No vendible\. Sólo para integración y validación física/);
  assert.match(pageSource, /no permite venta, reclamación de propiedad, tokenización ni activación/);
  assert.match(pageSource, /plan de calidad AQL aprobado por la empresa[\s\S]*?recepción de producción QA v2/);
  assert.match(pageSource, /Crear no activa las etiquetas/);
  assert.match(pageSource, /No se deduce de la empresa, el material ni la cantidad/);
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
  assert.match(stylesSource, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(stylesSource, /@media\(max-width:700px\)[\s\S]*grid-template-columns:1fr/);
  assert.match(stylesSource, /html\.theme-light/);
  assert.match(stylesSource, /focus-visible/);
});

test("supplier preparation requires a real successful session and retains its company", () => {
  assert.match(pageSource, /responseOk: response\.ok/);
  assert.match(pageSource, /responseOk && payload\?\.ok === true && session && session\.isDemo !== true/);
  assert.match(pageSource, /tenant_slug: tenant/);
  assert.match(pageSource, /readOnly=\{Boolean\(sessionTenantSlug\)\}/);
  assert.match(pageSource, /if \(field === "tenant_slug" && sessionTenantSlug\) return/);
  assert.match(pageSource, /data\?\.order\?\.tenant_slug !== validated\.payload\.tenant_slug/);
});

test("supplier presets apply explicitly and keep preparation separate from acceptance", () => {
  assert.match(pageSource, /data-testid="supplier-construction-apply"[\s\S]*?applySupplierConstruction\(current, construction\.id\)/);
  assert.match(pageSource, /data-testid="supplier-order-draft-summary"/);
  assert.match(pageSource, /data-sub-batch-count=\{review\.ok \? review\.subBatchCount : undefined\}/);
  assert.match(pageSource, /Modelo UHF confirmado por el proveedor/);
  assert.match(pageSource, /Las primeras 3–5 muestras no equivalen a aprobar todo el pedido ni a activar etiquetas/);
  assert.doesNotMatch(pageSource, /localStorage|sessionStorage|K_META|K_FILE|UCODE_9/);
});

test("supplier submission holds a synchronous lock and preserves uncertainty for explicit review", () => {
  assert.match(pageSource, /const submitting = useRef\(false\)/);
  assert.match(pageSource, /if \(submitting\.current \|\| uncertain\) return/);
  const lock = pageSource.indexOf("submitting.current = true");
  const request = pageSource.indexOf('fetch("/api/admin/supplier-orders"');
  assert.ok(lock >= 0 && lock < request);
  assert.match(pageSource, /response\.status >= 500/);
  assert.match(pageSource, /response\.status === 408/);
  assert.match(pageSource, /setTimeout\(\(\) => controller\.abort\(\), 20_000\)/);
  assert.match(pageSource, /clearTimeout\(timeout\)/);
  assert.match(pageSource, /if \(!keepLocked\) submitting\.current = false/);
  assert.match(pageSource, /data-testid="supplier-order-uncertain"/);
  assert.match(pageSource, /Consultar pedidos/);
  assert.match(pageSource, /data-testid="supplier-order-review-uncertain"[\s\S]*?submitting\.current = false; setUncertain\(false\)/);
  assert.doesNotMatch(pageSource, /setDraft\(emptySupplierOrderDraft|setInterval\(/);
});

test("touched supplier purpose files contain no customer-brand examples", () => {
  const touchedSources = `${pageSource}\n${policySource}`;
  assert.doesNotMatch(touchedSources, /syngenta|bayer/i);
});
