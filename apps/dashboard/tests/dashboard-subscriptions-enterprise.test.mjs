import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../src/app/(app)/subscriptions/page.tsx", import.meta.url), "utf8");
const tenantDirectorySource = readFileSync(new URL("../src/lib/tenant-directory.ts", import.meta.url), "utf8");
const tenantsPageSource = readFileSync(new URL("../src/app/(app)/tenants/page.tsx", import.meta.url), "utf8");
const tenantDetailSource = readFileSync(new URL("../src/app/(app)/tenants/[slug]/page.tsx", import.meta.url), "utf8");

test("subscriptions page is tenant-aware and labels its fixture source", () => {
  assert.match(pageSource, /import Link from "next\/link"/);
  assert.match(pageSource, /requireDashboardSession/);
  assert.match(pageSource, /TENANT_DIRECTORY/);
  assert.match(pageSource, /demobodega/);
  assert.match(tenantDirectorySource, /Demo Bodega Balmec/);
  assert.match(tenantDirectorySource, /slug: "demobodega"/);
  assert.match(tenantDirectorySource, /TENANT_DIRECTORY_SOURCE = "illustrative"/);
  assert.match(tenantDirectorySource, /source: "demo"/);
  assert.match(tenantDirectorySource, /source: "illustrative"/);
  assert.match(pageSource, /searchParams\?: Promise<Record<string, string \| string\[\] \| undefined>>/);
  assert.match(pageSource, /const requestedTenant = normalizeTenantParam\(query\.tenant\)/);
  assert.match(pageSource, /const scopedTenant = requireDashboardTenantScope\(session, requestedTenant\)\.tenantSlug/);
  assert.match(pageSource, /const visibleAccounts = scopedTenant \? accounts\.filter\(\(account\) => account\.slug === scopedTenant\) : accounts/);
  assert.doesNotMatch(pageSource, /const rows = \[\s*\{ tenant: "Bodega Andes"/);
});

test("subscriptions never aggregates fixtures as real revenue or renewals", () => {
  assert.match(pageSource, /const PLAN_CATALOG/);
  assert.match(pageSource, /monthlyListPrice: 12500/);
  assert.match(pageSource, /DPP-ready workflows/);
  assert.match(pageSource, /Precio mensual modelado; no es MRR contratado/);
  assert.match(pageSource, /MRR real/);
  assert.match(pageSource, /No disponible/);
  assert.match(pageSource, /Renovaciones reales/);
  assert.match(pageSource, /No conectadas/);
  assert.match(pageSource, /Escenario seleccionado/);
  assert.match(pageSource, /Escenarios ilustrativos de suscripcion/);
  assert.doesNotMatch(pageSource, /const totalMrr =/);
  assert.doesNotMatch(pageSource, /MRR visible/);
  assert.doesNotMatch(pageSource, /Renewals sanos/);
  assert.doesNotMatch(pageSource, /Cuentas activas con continuidad operativa/);
});

test("subscriptions page links billing decisions to tenant, integrations and CRM actions", () => {
  assert.match(pageSource, /href=\{`\/tenants\/\$\{primaryAccount\.slug\}`\}/);
  assert.match(pageSource, /href=\{`\/api-keys\$\{tenantQuery\}`\}/);
  assert.match(pageSource, /href=\{`\/leads-tickets\$\{tenantQuery\}`\}/);
  assert.match(pageSource, /href="\/sales-playbook"/);
  assert.match(pageSource, /title="Escenarios ilustrativos de suscripcion"/);
  assert.match(pageSource, /filterKey="status"/);
});

test("tenant directory and detail cannot be mistaken for a customer list", () => {
  assert.match(tenantsPageSource, /Directorio ilustrativo de tenants/);
  assert.match(tenantsPageSource, /No representan clientes, contratos, revenue ni health productivo/);
  assert.match(tenantsPageSource, /Escenarios de tenant \(no clientes reales\)/);
  assert.match(tenantsPageSource, /tenant\.source\.toUpperCase\(\)/);
  assert.doesNotMatch(tenantsPageSource, /mapa de cuentas activas/);
  assert.doesNotMatch(tenantsPageSource, /multi-tenant real/);
  assert.doesNotMatch(tenantsPageSource, /cartera activa y potencial/);
  assert.match(tenantDetailSource, /data-tenant-source=\{tenant\.source\}/);
  assert.match(tenantDetailSource, /No representa un cliente, contrato, plan activo ni health productivo/);
});
