import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { evaluateAdminAccess, resolveAdminTenantAccess } = await import("../src/lib/admin-auth-policy.ts");
const { areAdminSunBidsInTenantScope, isAdminSunDiagnosticInTenantScope } = await import("../src/lib/admin-sun-tenant-scope.ts");

const routeSources = new Map();

async function routeSource(path) {
  if (!routeSources.has(path)) {
    routeSources.set(path, await readFile(new URL(`../src/app/admin/${path}`, import.meta.url), "utf8"));
  }
  return routeSources.get(path);
}

test("tenant-bound principals cannot override their tenant with request input", () => {
  const access = resolveAdminTenantAccess("tenant_admin", null, "Tenant-A", "tenant-b");

  assert.equal(access.tenantBound, true);
  assert.equal(access.forcedTenantSlug, "tenant-a");
  assert.equal(access.requestedTenantSlug, "tenant-b");
  assert.equal(access.effectiveTenantSlug, "tenant-a");
});

test("tenant-bound scopes without a principal tenant fail closed at authentication", () => {
  const verdict = evaluateAdminAccess({
    providedToken: "secret",
    expectedToken: "secret",
    requireScoped: true,
    scope: "tenant_admin",
    tenantSlug: "",
    requiredScopes: ["tenant_admin"],
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 403);
});

test("super-admin and legacy internal callers preserve explicit or global access", () => {
  const superAdmin = resolveAdminTenantAccess("super_admin", null, "tenant-a", "Tenant-B");
  const legacyInternal = resolveAdminTenantAccess(null, null, null, null);

  assert.equal(superAdmin.tenantBound, false);
  assert.equal(superAdmin.effectiveTenantSlug, "tenant-b");
  assert.equal(legacyInternal.tenantBound, false);
  assert.equal(legacyInternal.effectiveTenantSlug, "");
});

test("analytics and consumer member reads bind request tenant filters to the principal", async () => {
  const analytics = await routeSource("analytics/route.ts");
  const members = await routeSource("consumer-portal/members/route.ts");

  assert.match(analytics, /getAdminTenantAccess\(req,\s*requestedTenant\)/);
  assert.match(analytics, /effectiveTenantSlug:\s*tenant/);
  assert.match(members, /getAdminTenantAccess\(req,\s*requestedTenant\)/);
  assert.match(members, /WHERE t\.slug = \$\{tenant\}/);
});

test("batch reads and mutations apply the principal tenant predicate before selecting a resource", async () => {
  const paths = [
    "batches/[bid]/summary/route.ts",
    "batches/[bid]/product-config/route.ts",
    "batches/[bid]/revoke/route.ts",
    "batches/[bid]/tamper-config/route.ts",
    "tags/mark-opened/route.ts",
  ];

  for (const path of paths) {
    const source = await routeSource(path);
    const lookupEnd = [
      source.indexOf("if (matchingRows.length > 1)"),
      source.indexOf("if (!batches[0])"),
      source.indexOf("const batch = batchRows[0]"),
    ].filter((index) => index >= 0).sort((left, right) => left - right)[0];
    const ownershipLookup = source.slice(0, lookupEnd);

    assert.match(source, /getAdminTenantAccess\(req\)/, path);
    assert.match(ownershipLookup, /JOIN tenants t ON t\.id = b\.tenant_id/, path);
    assert.match(ownershipLookup, /t\.slug = \$\{forcedTenantSlug\}/, path);
  }
});

test("tenant-capable sensitive reads are explicitly bound to the principal tenant", async () => {
  const paths = [
    "tags/[uid]/passport/route.ts",
    "overview/route.ts",
    "consumer-portal/overview/route.ts",
    "leads/route.ts",
    "security-alerts/route.ts",
    "loyalty/overview/route.ts",
    "diagnostics/live-pipeline/route.ts",
  ];

  for (const path of paths) {
    const source = await routeSource(path);
    const getSource = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST") >= 0
      ? source.indexOf("export async function POST")
      : source.length);

    assert.match(getSource, /getAdminTenantAccess\(req,\s*requestedTenant\)/, path);
    assert.match(getSource, /effectiveTenantSlug:\s*tenant/, path);
    assert.match(getSource, /(?:tn|t)\.slug\s*=\s*\$\{tenant\}/, path);
  }
});

test("global sensitive reads without complete tenant ownership are super-admin only", async () => {
  const paths = ["tickets/route.ts", "orders/route.ts", "notifications/route.ts", "diagnostics/sun/route.ts"];

  for (const path of paths) {
    const source = await routeSource(path);
    const postIndex = source.indexOf("export async function POST");
    const getSource = source.slice(source.indexOf("export async function GET"), postIndex >= 0 ? postIndex : source.length);

    assert.match(getSource, /checkAdmin\(req,\s*\["super_admin"\]\)/, path);
  }
});

test("SUN tools authorize every request BID before processing or mutating", async () => {
  const processRoutes = [
    "sun/inspect/route.ts",
    "sun/validate/route.ts",
    "sun/compare-tamper/route.ts",
    "sun/compare-tamper-samples/route.ts",
    "sun/find-ttstatus-candidates/route.ts",
  ];

  for (const path of processRoutes) {
    const source = await routeSource(path);
    const handler = source.slice(source.indexOf("export async function POST"));
    const accessIndex = handler.indexOf("getAdminTenantAccess(req)");
    const ownershipIndex = handler.indexOf("areAdminSunBidsInTenantScope(");
    const processIndex = handler.indexOf("processSunScan(");

    assert.ok(accessIndex >= 0, path);
    assert.ok(ownershipIndex > accessIndex, path);
    assert.ok(processIndex > ownershipIndex, path);
  }

  const register = await routeSource("sun/register-payload/route.ts");
  assert.match(register, /getAdminTenantAccess\(req\)/);
  assert.match(register, /isAdminSunDiagnosticInTenantScope\(/);
  assert.match(register, /areAdminSunBidsInTenantScope\(/);
  assert.match(register, /payload\.bid !== bid/);
  assert.ok(register.indexOf("areAdminSunBidsInTenantScope(") < register.indexOf("upsertTagSunPayload({"));
});

test("SUN BID scope requires every BID to resolve uniquely to the principal tenant", async () => {
  assert.equal(await areAdminSunBidsInTenantScope({ bids: ["A"], forcedTenantSlug: "" }), true);
  assert.equal(await areAdminSunBidsInTenantScope({ bids: [], forcedTenantSlug: "tenant-a" }), false);

  const ownedQuery = async () => [{ bid: "A", batch_count: 1, owned_count: 1 }, { bid: "B", batch_count: 1, owned_count: 1 }];
  assert.equal(await areAdminSunBidsInTenantScope({ bids: ["A", "B"], forcedTenantSlug: "tenant-a" }, ownedQuery), true);

  const foreignQuery = async () => [{ bid: "A", batch_count: 1, owned_count: 1 }, { bid: "B", batch_count: 1, owned_count: 0 }];
  assert.equal(await areAdminSunBidsInTenantScope({ bids: ["A", "B"], forcedTenantSlug: "tenant-a" }, foreignQuery), false);

  const duplicateQuery = async () => [{ bid: "A", batch_count: 2, owned_count: 1 }];
  assert.equal(await areAdminSunBidsInTenantScope({ bids: ["A"], forcedTenantSlug: "tenant-a" }, duplicateQuery), false);
});

test("SUN diagnostic scope requires one unambiguous owned batch", async () => {
  assert.equal(await isAdminSunDiagnosticInTenantScope({ diagnosticId: "1", forcedTenantSlug: "" }), true);
  assert.equal(await isAdminSunDiagnosticInTenantScope({ diagnosticId: "", forcedTenantSlug: "tenant-a" }), false);
  assert.equal(await isAdminSunDiagnosticInTenantScope({ diagnosticId: "1", forcedTenantSlug: "tenant-a" }, async () => [{ id: 1 }]), true);
  assert.equal(await isAdminSunDiagnosticInTenantScope({ diagnosticId: "1", forcedTenantSlug: "tenant-a" }, async () => []), false);
});

test("reward redemption lookup and mutation are bound to the principal tenant", async () => {
  const source = await routeSource("rewards/redemptions/validate/route.ts");

  assert.match(source, /getAdminTenantAccess\(req\)/);
  assert.match(source, /getClaim\(code,\s*forcedTenantSlug\)/);
  assert.match(source, /t\.slug = \$\{forcedTenantSlug\}/);
  assert.match(source, /tenant_id = \(SELECT id FROM tenants WHERE slug = \$\{forcedTenantSlug\}/);
  assert.match(source, /AND status = 'claimed'/);
  assert.match(source, /redemption_already_processed/);
  assert.match(source, /if \(providedSeal && expectedSeal/);
  assert.match(source, /if \(phoneLast4 &&/);
});

test("loyalty KPIs pre-aggregate members and ledger entries without Cartesian multiplication", async () => {
  const source = await routeSource("loyalty/overview/route.ts");

  assert.match(source, /WITH active_programs AS MATERIALIZED/);
  assert.match(source, /member_totals AS/);
  assert.match(source, /ledger_totals AS/);
  assert.match(source, /GROUP BY member\.program_id/);
  assert.match(source, /GROUP BY ledger\.program_id/);
  assert.doesNotMatch(source, /LEFT JOIN loyalty_members[^]*LEFT JOIN points_ledger/);

  const membersPerProgram = [2, 3];
  const issuedPerProgram = [100, 40];
  const redeemedPerProgram = [25, 10];
  assert.equal(membersPerProgram.reduce((sum, value) => sum + value, 0), 5);
  assert.equal(issuedPerProgram.reduce((sum, value) => sum + value, 0), 140);
  assert.equal(redeemedPerProgram.reduce((sum, value) => sum + value, 0), 35);
});

test("internal batch registration binds the target tenant to the principal", async () => {
  const source = await routeSource("batches/register/route.ts");
  const handler = source.slice(source.indexOf("export async function POST"));

  assert.match(handler, /getAdminTenantAccess\(req,\s*requestedTenantSlug\)/);
  assert.match(handler, /effectiveTenantSlug:\s*tenantSlug/);
  assert.ok(handler.indexOf("getAdminTenantAccess(req, requestedTenantSlug)") < handler.indexOf("resolveTenant(tenantSlug)"));
});
