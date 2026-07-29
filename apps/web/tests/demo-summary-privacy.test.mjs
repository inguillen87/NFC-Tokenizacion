import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const originalFetch = globalThis.fetch;

async function loadRoute() {
  let source = await readFile(new URL("../src/app/api/demo/summary/route.ts", import.meta.url), "utf8");
  const nextServerImport = /import\s+\{\s*NextResponse\s*\}\s+from\s+"next\/server";/;
  const productConfigImport = /import\s+\{\s*productUrls\s*\}\s+from\s+"@product\/config";/;

  assert.match(source, nextServerImport);
  assert.match(source, productConfigImport);
  assert.doesNotMatch(source, /ADMIN_API_KEY|\/internal\/demo\/summary/);

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
});

test("public demo summary uses only the privacy-safe public proof projection", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.test/public/proof/summary");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.headers?.Authorization, undefined);
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

test("public demo summary fails to an empty public contract without private fallback", async () => {
  globalThis.fetch = async () => {
    throw new Error("upstream unavailable");
  };

  const response = await GET();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.source, "visual-demo");
  assert.deepEqual(body.crm, { leads: 0, tickets: 0, orders: 0 });
  assert.deepEqual(body.events, []);
});
