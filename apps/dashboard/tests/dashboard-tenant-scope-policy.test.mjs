import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const {
  DashboardTenantScopeError,
  resolveDashboardTenantScope,
} = await import("../src/lib/dashboard-tenant-scope-policy.ts");
const {
  DASHBOARD_HUMAN_ENTERPRISE_ROLES,
} = await import("../src/lib/enterprise-runtime-rbac.ts");

const TENANT_BOUND_HUMAN_ROLES = DASHBOARD_HUMAN_ENTERPRISE_ROLES.filter(
  (role) => role !== "super-admin",
);

function session(role, tenantSlug) {
  return { role, tenantSlug };
}

test("every non-super role is bound to its session tenant and cannot override it", () => {
  for (const role of TENANT_BOUND_HUMAN_ROLES) {
    assert.deepEqual(resolveDashboardTenantScope(session(role, "Tenant-One"), "tenant-two"), {
      tenantSlug: "tenant-one",
      isGlobal: false,
      canSelectTenant: false,
    });
  }
});

test("every tenant-bound human role without a valid tenant fails closed", () => {
  for (const role of TENANT_BOUND_HUMAN_ROLES) {
    assert.throws(
      () => resolveDashboardTenantScope(session(role, null), "attacker-selected"),
      (error) => error instanceof DashboardTenantScopeError && error.code === "tenant_scope_required",
    );
  }
});

test("only super-admin can intentionally select global or requested tenant scope", () => {
  assert.deepEqual(resolveDashboardTenantScope(session("super-admin", null)), {
    tenantSlug: "",
    isGlobal: true,
    canSelectTenant: true,
  });
  assert.deepEqual(resolveDashboardTenantScope(session("super-admin", null), " Customer-AR "), {
    tenantSlug: "customer-ar",
    isGlobal: false,
    canSelectTenant: true,
  });
  assert.throws(
    () => resolveDashboardTenantScope(session("super-admin", null), "../other"),
    (error) => error instanceof DashboardTenantScopeError && error.code === "tenant_scope_invalid",
  );
});

async function collectPages(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await collectPages(target));
    else if (entry.name === "page.tsx") output.push(target);
  }
  return output;
}

test("dashboard Server Component pages never forward ADMIN_API_KEY directly", async () => {
  const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
  const pagesDirectory = path.resolve(testsDirectory, "../src/app/(app)");
  for (const page of await collectPages(pagesDirectory)) {
    const source = await readFile(page, "utf8");
    assert.doesNotMatch(source, /process\.env\.ADMIN_API_KEY/, page);
    assert.doesNotMatch(source, /Authorization:\s*`Bearer\s+\$\{process\.env\.ADMIN_API_KEY/, page);
  }
});

test("layout and BFF both enforce the same tenant binding", async () => {
  const layout = await readFile(new URL("../src/app/(app)/layout.tsx", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");
  const stream = await readFile(new URL("../src/app/api/admin/events/stream/route.ts", import.meta.url), "utf8");

  assert.match(layout, /requireDashboardTenantScope\(session\)/);
  assert.match(proxy, /resolveDashboardTenantScope\(dashboardSession, reqUrl\.searchParams\.get\("tenant"\)\)/);
  assert.match(proxy, /reqUrl\.searchParams\.set\("tenant", tenantScope\.tenantSlug\)/);
  assert.match(stream, /resolveDashboardTenantScope\(session, requestedTenant\)/);
  assert.match(stream, /upstream\.searchParams\.delete\("tenant"\)/);
});

test("reseller CRM is super-admin-only and reads through the authenticated BFF", async () => {
  const source = await readFile(new URL("../src/app/(app)/resellers/page.tsx", import.meta.url), "utf8");
  const navigation = await readFile(new URL("../src/lib/dashboard-content.ts", import.meta.url), "utf8");
  const guard = source.indexOf('if (session.role !== "super-admin") notFound()');
  const fetches = source.indexOf("Promise.all");

  assert.ok(guard >= 0, "resellers page must have an explicit super-admin guard");
  assert.ok(fetches > guard, "resellers page must deny access before starting CRM reads");
  assert.match(source, /fetchAdminPage\(context, path\)/);
  assert.doesNotMatch(source, /ADMIN_API_KEY|NEXT_PUBLIC_API_URL|NEXT_PUBLIC_API_BASE_URL/);
  assert.doesNotMatch(navigation, /reseller:\s*\[[^\]]*"resellers"/);
});

test("demo presets remain explicit and never fill empty production tenant responses", async () => {
  const offers = await readFile(new URL("../src/app/(app)/consumer-network/offers/page.tsx", import.meta.url), "utf8");
  const rewards = await readFile(new URL("../src/app/(app)/loyalty/rewards/page.tsx", import.meta.url), "utf8");

  assert.match(offers, /session\.isDemo \? PRESETS : \[\]/);
  assert.match(rewards, /allowDemoData && meta\.demoMode/);
  assert.match(rewards, /reason: "illustrative_presets"/);
  assert.match(rewards, /availability: rewards\.length \? "ready" : "ready_empty"/);
});

test("offline page reads the tenant-scoped GET history without exposing captured URLs", async () => {
  const source = await readFile(new URL("../src/app/(app)/offline/page.tsx", import.meta.url), "utf8");
  const contract = await readFile(new URL("../docs/offline-verifier-read-contract.md", import.meta.url), "utf8");

  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.match(source, /requireDashboardSession\("supplier:offline_verifier"\)/);
  assert.match(source, /fetchAdminPage\(context, `offline-verifier\/sync\?/);
  assert.doesNotMatch(source, /capturedUrl|captured_url/);
  assert.match(contract, /GET \/admin\/offline-verifier\/sync/);
  assert.match(contract, /no ingestion, reconciliation, counter updates, or audit side effects/);
});
