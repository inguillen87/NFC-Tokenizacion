import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const originalAdminApiKey = process.env.ADMIN_API_KEY;
const originalFetch = globalThis.fetch;

async function loadRoute() {
  let source = await readFile(new URL("../src/app/api/demo/summary/route.ts", import.meta.url), "utf8");
  const nextServerImport = /import\s+\{\s*NextResponse\s*\}\s+from\s+"next\/server";/;
  const productConfigImport = /import\s+\{\s*productUrls\s*\}\s+from\s+"@product\/config";/;

  assert.match(source, nextServerImport);
  assert.match(source, productConfigImport);

  source = source
    .replace(nextServerImport, "const NextResponse = { json: (body) => Response.json(body) };")
    .replace(productConfigImport, 'const productUrls = { api: "https://api.test" };');

  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const { GET } = await loadRoute();

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalAdminApiKey === undefined) {
    delete process.env.ADMIN_API_KEY;
  } else {
    process.env.ADMIN_API_KEY = originalAdminApiKey;
  }
});

test("public demo summary replaces CRM PII with non-identifiable demo records", async () => {
  process.env.ADMIN_API_KEY = "test-admin-key";

  const privateValues = [
    "lead-real-id",
    "Ana Persona Real",
    "ana.real@example.com",
    "+54 9 11 5555 0101",
    "Bodega Cliente Privada SA",
    "lead-private-notes",
    "ticket-real-id",
    "cliente.ticket@example.com",
    "Ticket for Ana Persona Real",
    "Call +54 9 11 5555 0202",
    "order-real-id",
    "compras.privadas@example.com",
    "Distribuidor Cliente Reservado",
    "order-private-notes",
    "tenant-private-id",
    "server-only-secret",
  ];

  const internalSummary = {
    ok: true,
    exists: true,
    tenant: { id: "tenant-private-id", slug: "customer-private", name: "Private customer" },
    batch: { id: "batch-private-id", bid: "PRIVATE-BATCH", status: "active" },
    internalSecret: "server-only-secret",
    tagCount: 128,
    crm: { leads: 41, tickets: 7, orders: 5 },
    recentLeads: [{
      id: "lead-real-id",
      locale: "es-AR",
      contact: "ana.real@example.com / +54 9 11 5555 0101",
      name: "Ana Persona Real",
      email: "ana.real@example.com",
      phone: "+54 9 11 5555 0101",
      company: "Bodega Cliente Privada SA",
      country: "Argentina",
      vertical: "wine",
      role_interest: "owner",
      estimated_volume: "private-volume",
      tag_type: "private-tag-type",
      volume: 9876,
      source: "private-referral",
      status: "new",
      message: "lead-private-message",
      notes: "lead-private-notes",
      assigned_to: "private-sales-owner",
      created_at: "2026-07-11T12:00:00.000Z",
    }],
    recentTickets: [{
      id: "ticket-real-id",
      locale: "es-AR",
      contact: "cliente.ticket@example.com",
      title: "Ticket for Ana Persona Real",
      detail: "Call +54 9 11 5555 0202",
      status: "open",
      source: "private-support-channel",
      assigned_to: "private-support-owner",
      created_at: "2026-07-11T12:05:00.000Z",
      updated_at: "2026-07-11T12:06:00.000Z",
    }],
    recentOrders: [{
      id: "order-real-id",
      locale: "es-AR",
      contact: "compras.privadas@example.com",
      company: "Distribuidor Cliente Reservado",
      tag_type: "private-order-tag",
      volume: 6543,
      notes: "order-private-notes",
      status: "pending",
      source: "private-order-channel",
      assigned_to: "private-ops-owner",
      created_at: "2026-07-11T12:10:00.000Z",
      updated_at: "2026-07-11T12:11:00.000Z",
    }],
    events: [{
      id: "event-1",
      result: "AUTHENTICATED",
      uid_hex: "04AABBCCDDEE",
      created_at: "2026-07-11T12:15:00.000Z",
      city: "Mendoza",
      country_code: "AR",
      lat: -32.8895,
      lng: -68.8458,
      product_name: "Gran Reserva Demo",
      sku: "DEMO-001",
      vertical: "wine",
    }],
  };

  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.test/internal/demo/summary");
    assert.equal(init?.headers?.Authorization, "Bearer test-admin-key");
    assert.equal(init?.cache, "no-store");
    return Response.json(internalSummary);
  };

  const response = await GET();
  const body = await response.json();
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body).sort(), [
    "crm",
    "events",
    "exists",
    "generatedAt",
    "ok",
    "recentLeads",
    "recentOrders",
    "recentTickets",
    "source",
    "tagCount",
  ]);
  assert.equal(body.source, "internal-demo-sanitized");
  assert.equal(body.tagCount, 128);
  assert.deepEqual(body.crm, { leads: 41, tickets: 7, orders: 5 });
  assert.equal(body.recentLeads.length, 1);
  assert.equal(body.recentTickets.length, 1);
  assert.equal(body.recentOrders.length, 1);

  assert.equal(body.recentLeads[0].id, "demo-lead-1");
  assert.equal(body.recentLeads[0].contact, "Contacto demo 01");
  assert.equal(body.recentLeads[0].email, null);
  assert.equal(body.recentLeads[0].phone, null);
  assert.equal(body.recentTickets[0].id, "demo-ticket-1");
  assert.equal(body.recentTickets[0].contact, "Cuenta demo 01");
  assert.equal(body.recentOrders[0].id, "demo-order-1");
  assert.equal(body.recentOrders[0].contact, "Canal demo 01");

  assert.equal(body.events[0].id, "event-1");
  assert.equal(body.events[0].uidMasked, "04AA****DDEE");
  assert.equal(body.events[0].product_name, "Gran Reserva Demo");

  for (const privateValue of privateValues) {
    assert.equal(serialized.includes(privateValue), false, `response leaked: ${privateValue}`);
  }
});

test("public proof fallback keeps the Demo Lab summary contract", async () => {
  delete process.env.ADMIN_API_KEY;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.test/public/proof/summary");
    assert.equal(init?.cache, "no-store");
    return Response.json({
      ok: true,
      latestPublicEvents: [{
        occurredAt: "2026-07-11T13:00:00.000Z",
        uidMasked: "04AA****DDEE",
        verdict: "VERIFIED",
        city: "Mendoza",
        country: "AR",
      }],
    });
  };

  const response = await GET();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.exists, true);
  assert.equal(body.source, "public-proof");
  assert.deepEqual(body.crm, { leads: 0, tickets: 0, orders: 0 });
  assert.deepEqual(body.recentLeads, []);
  assert.deepEqual(body.recentTickets, []);
  assert.deepEqual(body.recentOrders, []);
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].uidMasked, "04AA****DDEE");
});
