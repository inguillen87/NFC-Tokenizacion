import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  deriveAdminOrderRequestId,
  normalizeAdminIdempotencyKey,
  resolveAdminWriteTenant,
  tenantReference,
} = await import("../src/lib/admin-commercial-policy.ts");

const TENANT_A_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_B_ID = "22222222-2222-4222-8222-222222222222";

function principal(overrides = {}) {
  return {
    authenticationType: "human_session",
    sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "admin@tenant-a.example",
    label: "Tenant A admin",
    role: "tenant-admin",
    scope: "tenant_admin",
    tenantId: TENANT_A_ID,
    tenantSlug: "tenant-a",
    permissions: [],
    mfaVerified: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rotatedSessionToken: null,
    ...overrides,
  };
}

async function source(path) {
  return readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
}

test("tenant-bound admin writes derive tenant from the verified principal and reject caller crossover", async () => {
  let lookups = 0;
  const lookup = async () => {
    lookups += 1;
    return [];
  };

  assert.deepEqual(await resolveAdminWriteTenant({ principal: principal(), references: [], lookup }), {
    ok: true,
    tenant: { tenantId: TENANT_A_ID, tenantSlug: "tenant-a" },
  });
  assert.equal(lookups, 0);

  assert.deepEqual(await resolveAdminWriteTenant({
    principal: principal(),
    references: [{ tenantId: TENANT_B_ID }, { tenantSlug: "tenant-b" }],
    lookup,
  }), { ok: false, status: 403, reason: "tenant_scope_forbidden" });
  assert.equal(lookups, 0);
});

test("global admin writes require one server-resolved tenant and reject conflicting references", async () => {
  const superAdmin = principal({
    role: "super-admin",
    scope: "super_admin",
    tenantId: null,
    tenantSlug: null,
  });

  assert.deepEqual(await resolveAdminWriteTenant({ principal: superAdmin, references: [], lookup: async () => [] }), {
    ok: false,
    status: 400,
    reason: "tenant_required",
  });
  assert.deepEqual(await resolveAdminWriteTenant({
    principal: superAdmin,
    references: [{ tenantSlug: "tenant-a" }, { tenantSlug: "tenant-b" }],
    lookup: async () => [],
  }), { ok: false, status: 403, reason: "tenant_scope_conflict" });

  let lookupInput = null;
  const resolved = await resolveAdminWriteTenant({
    principal: superAdmin,
    references: [tenantReference("Tenant-A")],
    lookup: async (input) => {
      lookupInput = input;
      return [{ id: TENANT_A_ID, slug: "tenant-a" }];
    },
  });
  assert.deepEqual(lookupInput, { tenantId: "", tenantSlug: "tenant-a" });
  assert.deepEqual(resolved, {
    ok: true,
    tenant: { tenantId: TENANT_A_ID, tenantSlug: "tenant-a" },
  });
});

test("order request idempotency keys are validated and namespaced by tenant", () => {
  assert.equal(normalizeAdminIdempotencyKey("order:pilot-0001"), "order:pilot-0001");
  assert.equal(normalizeAdminIdempotencyKey("short"), null);
  assert.equal(normalizeAdminIdempotencyKey("order key with spaces"), null);

  const first = deriveAdminOrderRequestId(TENANT_A_ID, "order:pilot-0001");
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(first, deriveAdminOrderRequestId(TENANT_A_ID, "order:pilot-0001"));
  assert.notEqual(first, deriveAdminOrderRequestId(TENANT_B_ID, "order:pilot-0001"));
  assert.notEqual(first, deriveAdminOrderRequestId(TENANT_A_ID, "order:pilot-0002"));
});

test("global portfolio routes require the super-admin scope", async () => {
  const routes = await Promise.all([
    source("app/superadmin/consumer-network/overview/route.ts"),
    source("app/superadmin/loyalty/portfolio/route.ts"),
  ]);
  for (const route of routes) {
    assert.match(route, /checkAdmin\(req, \["super_admin"\]\)/);
  }
});

test("admin lead creation authenticates first, binds tenant server-side, and keeps public intake separate", async () => {
  const [adminLeads, publicLeads] = await Promise.all([
    source("app/admin/leads/route.ts"),
    source("app/public/leads/route.ts"),
  ]);
  const post = adminLeads.slice(adminLeads.indexOf("export async function POST"));

  assert.match(post, /checkAdminWithPermission\(req, "leads\.manage"\)/);
  assert.ok(post.indexOf("checkAdminWithPermission(req") < post.indexOf("readBoundedJsonBody"));
  assert.match(post, /resolveAdminWriteTenant\(/);
  assert.match(post, /tenantReference\(new URL\(req\.url\)\.searchParams\.get\("tenant"\)\)/);
  assert.match(post, /VALUES \([^]*\$\{tenantId\}::uuid/);
  assert.match(post, /rateClass: "public_write"/);
  assert.doesNotMatch(post, /tenantIdInput|INSERT INTO leads \(locale, contact, company/);
  assert.doesNotMatch(publicLeads, /checkAdmin\(/);
});

test("admin order creation is authenticated, bounded, tenant-scoped, rate-limited and replay-safe", async () => {
  const [orders, schema] = await Promise.all([
    source("app/admin/orders/route.ts"),
    source("lib/commercial-runtime-schema.ts"),
  ]);
  const post = orders.slice(orders.indexOf("export async function POST"));

  assert.match(post, /checkAdmin\(req, \["super_admin", "tenant_admin"\]\)/);
  assert.ok(post.indexOf("checkAdmin(req") < post.indexOf("readBoundedJsonBody"));
  assert.match(post, /resolveAdminWriteTenant\(/);
  assert.match(post, /normalizeAdminIdempotencyKey\(/);
  assert.match(post, /deriveAdminOrderRequestId\(tenantId, idempotencyKey\)/);
  assert.match(post, /INSERT INTO order_requests \(id, tenant_id,/);
  assert.match(post, /ON CONFLICT \(id\) DO NOTHING/);
  assert.match(post, /idempotency_key_conflict/);
  assert.match(post, /rateClass: "public_write"/);
  assert.match(schema, /ALTER TABLE order_requests ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants/);
});

test("WhatsApp sandbox requires granular permission and persisted unrevoked consent", async () => {
  const route = await source("app/admin/campaigns/test-whatsapp/route.ts");
  const post = route.slice(route.indexOf("export async function POST"));

  assert.match(post, /checkAdmin\(req, \["super_admin", "tenant_admin"\]\)/);
  assert.match(post, /checkAdminPermission\(req, "campaigns:test_whatsapp"\)/);
  assert.ok(post.indexOf("checkAdminPermission(req") < post.indexOf("readBoundedJsonBody"));
  assert.match(post, /rateClass: "ai_expensive"/);
  assert.match(route, /\^\[1-9\]\\d\{7,14\}\$/);
  assert.match(post, /membership\.status = 'active'/);
  assert.match(post, /consumer\.phone = \$\{toPhone\}/);
  assert.match(post, /consumer_tenant_consents consent/);
  assert.match(post, /consent\.granted = true/);
  assert.match(post, /consent\.revoked_at IS NULL/);
  assert.match(post, /recipient_persisted_opt_in_required/);
  assert.match(post, /campaign_test_whatsapp_(?:denied|failed|queued)/);
  assert.doesNotMatch(post, /confirmRecipientOptIn/);
});
