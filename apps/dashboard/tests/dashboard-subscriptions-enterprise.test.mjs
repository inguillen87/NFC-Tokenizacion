import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../src/app/(app)/subscriptions/page.tsx", import.meta.url), "utf8");
const tenantDirectorySource = readFileSync(new URL("../src/lib/tenant-directory.ts", import.meta.url), "utf8");

test("subscriptions page is tenant-aware instead of a flat demo table", () => {
  assert.match(pageSource, /import Link from "next\/link"/);
  assert.match(pageSource, /requireDashboardSession/);
  assert.match(pageSource, /TENANT_DIRECTORY/);
  assert.match(pageSource, /demobodega/);
  assert.match(tenantDirectorySource, /Bodega Balmec/);
  assert.match(tenantDirectorySource, /slug: "demobodega"/);
  assert.match(pageSource, /searchParams\?: Promise<Record<string, string \| string\[\] \| undefined>>/);
  assert.match(pageSource, /const requestedTenant = normalizeTenantParam\(query\.tenant\)/);
  assert.match(pageSource, /const scopedTenant = requireDashboardTenantScope\(session, requestedTenant\)\.tenantSlug/);
  assert.match(pageSource, /const visibleAccounts = scopedTenant \? accounts\.filter\(\(account\) => account\.slug === scopedTenant\) : accounts/);
  assert.doesNotMatch(pageSource, /const rows = \[\s*\{ tenant: "Bodega Andes"/);
});

test("subscriptions page exposes enterprise revenue, risk, usage and upgrade context", () => {
  assert.match(pageSource, /const PLAN_CATALOG/);
  assert.match(pageSource, /mrr: 12500/);
  assert.match(pageSource, /DPP-ready workflows/);
  assert.match(pageSource, /const totalMrr = visibleAccounts\.reduce/);
  assert.match(pageSource, /const atRisk = visibleAccounts\.filter/);
  assert.match(pageSource, /const renewalQueue = \[\.\.\.visibleAccounts\]\.sort/);
  assert.match(pageSource, /MRR visible/);
  assert.match(pageSource, /Riesgo comercial/);
  assert.match(pageSource, /Cuenta prioritaria/);
  assert.match(pageSource, /Uso/);
  assert.match(pageSource, /Expansion/);
});

test("subscriptions page links billing decisions to tenant, integrations and CRM actions", () => {
  assert.match(pageSource, /href=\{`\/tenants\/\$\{primaryAccount\.slug\}`\}/);
  assert.match(pageSource, /href=\{`\/api-keys\$\{tenantQuery\}`\}/);
  assert.match(pageSource, /href=\{`\/leads-tickets\$\{tenantQuery\}`\}/);
  assert.match(pageSource, /href="\/sales-playbook"/);
  assert.match(pageSource, /copy\.tables\.subscriptions\.title/);
  assert.match(pageSource, /filterKey="status"/);
});
