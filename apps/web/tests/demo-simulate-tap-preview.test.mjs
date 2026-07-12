import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const routeUrl = new URL("../src/app/api/demo/simulate-tap/route.ts", import.meta.url);
const originalFetch = globalThis.fetch;

async function loadRoute() {
  let source = await readFile(routeUrl, "utf8");
  const nextServerImport = /import\s+\{\s*NextResponse\s*\}\s+from\s+"next\/server";/;

  assert.match(source, nextServerImport);
  assert.doesNotMatch(source, /ADMIN_API_KEY|productUrls|\/internal\/demo\/simulate-tap|\bfetch\s*\(/);

  source = source.replace(
    nextServerImport,
    "const NextResponse = { json: (body, init = {}) => Response.json(body, init) };",
  );

  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const { POST } = await loadRoute();

function request(payload, ip, extraHeaders = {}) {
  return new Request("https://nexid.test/api/demo/simulate-tap", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...extraHeaders,
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("public tap simulation is deterministic, synthetic and never persists", async () => {
  globalThis.fetch = async () => assert.fail("simulate-tap must not call an upstream API");
  const payload = {
    mode: "valid",
    city: "Zurich",
    countryCode: "CH",
    lat: 47.3769,
    lng: 8.5417,
    deviceLabel: "Laboratorio nexID - Toque del cliente",
  };

  const first = await POST(request(payload, "198.51.100.10"));
  const second = await POST(request(payload, "198.51.100.10"));
  const firstBody = await first.json();
  const secondBody = await second.json();

  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal(first.headers.get("x-nexid-demo-mode"), "preview");
  assert.deepEqual(firstBody, secondBody);
  assert.equal(firstBody.ok, true);
  assert.equal(firstBody.degraded, true);
  assert.equal(firstBody.source, "synthetic_sun");
  assert.equal(firstBody.execution, "preview");
  assert.equal(firstBody.preview, true);
  assert.equal(firstBody.persisted, false);
  assert.equal(firstBody.chain_write, false);
  assert.equal(firstBody.bid, "DEMO-PUBLIC-LAB");
  assert.equal(firstBody.uidHex, "04D3A0B0C0D0E0");
  assert.equal(firstBody.synthetic_sun, "SYNTHETIC-SUN-VALID-0001");
  assert.deepEqual(firstBody.payload, {
    source: "synthetic_sun",
    execution: "preview",
    preview: true,
    persisted: false,
    chain_write: false,
    event_id: null,
    bid: "DEMO-PUBLIC-LAB",
    uid_hex: "04D3A0B0C0D0E0",
    verdict: "AUTHENTICATED",
    tag_state: "closed",
    synthetic_sun: "SYNTHETIC-SUN-VALID-0001",
  });
});

test("public tap simulation validates preview mode and demo identity", async () => {
  const invalidMode = await POST(request({ mode: "mint" }, "198.51.100.20"));
  assert.equal(invalidMode.status, 400);
  assert.equal((await invalidMode.json()).reason, "invalid_demo_mode");

  const inheritedMode = await POST(request({ mode: "toString" }, "198.51.100.24"));
  assert.equal(inheritedMode.status, 400);
  assert.equal((await inheritedMode.json()).reason, "invalid_demo_mode");

  const invalidBid = await POST(request({ mode: "valid", bid: "PROD-001" }, "198.51.100.21"));
  assert.equal(invalidBid.status, 400);
  assert.equal((await invalidBid.json()).reason, "invalid_demo_bid");

  const invalidUid = await POST(request({ mode: "valid", uidHex: "not-a-uid" }, "198.51.100.22"));
  assert.equal(invalidUid.status, 400);
  assert.equal((await invalidUid.json()).reason, "invalid_demo_uid");

  const replay = await POST(request({
    mode: "replay",
    bid: "demo-public-pack-01",
    uid_hex: "04aabbccddee",
  }, "198.51.100.23"));
  const replayBody = await replay.json();
  assert.equal(replay.status, 200);
  assert.equal(replayBody.bid, "DEMO-PUBLIC-PACK-01");
  assert.equal(replayBody.uidHex, "04AABBCCDDEE");
  assert.equal(replayBody.verdict, "REPLAY_BLOCKED");
  assert.equal(replayBody.synthetic_sun, "SYNTHETIC-SUN-REPLAY-0001");
});

test("public tap simulation rejects oversized payloads", async () => {
  const response = await POST(request({
    mode: "valid",
    deviceLabel: "x".repeat(4_100),
  }, "198.51.100.30"));

  assert.equal(response.status, 413);
  assert.equal((await response.json()).reason, "payload_too_large");
});

test("public tap simulation rate limits repeated requests in memory", async () => {
  const ip = "198.51.100.40";
  for (let index = 0; index < 30; index += 1) {
    const response = await POST(request({ mode: "tamper" }, ip));
    assert.equal(response.status, 200, `request ${index + 1} should be allowed`);
  }

  const limited = await POST(request({ mode: "tamper" }, ip));
  const body = await limited.json();
  assert.equal(limited.status, 429);
  assert.equal(body.reason, "rate_limited");
  assert.equal(body.preview, true);
  assert.equal(body.persisted, false);
  assert.equal(body.chain_write, false);
  assert.ok(Number(limited.headers.get("retry-after")) >= 1);
});
