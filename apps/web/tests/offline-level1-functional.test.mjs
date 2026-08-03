import assert from "node:assert/strict";
import test from "node:test";

const {
  buildConfiguredSunTarget,
  canonicalOfflineSunPath,
  executeConfiguredOfflineSunSync,
  normalizeOfflineSunParams,
  offlineSunIdFromParams,
  redactOfflineSunUpstream,
} = await import("../src/lib/offline-sun-contract.ts");

const VALID_PARAMS = {
  v: "1",
  bid: "PILOT-2026-001",
  picc_data: "0011223344556677",
  enc: "00112233445566778899AABBCCDDEEFF",
  cmac: "0011223344556677",
};

test("offline SUN input is strictly allowlisted and canonicalized without an origin", async () => {
  const normalized = normalizeOfflineSunParams(VALID_PARAMS);
  assert.equal(normalized.ok, true);
  if (!normalized.ok) return;

  assert.deepEqual(normalized.params, VALID_PARAMS);
  const path = canonicalOfflineSunPath(normalized.params);
  assert.match(path, /^\/sun\?/);
  assert.doesNotMatch(path, /^https?:\/\//);
  assert.equal(new URL(path, "https://web.example.test").searchParams.get("bid"), VALID_PARAMS.bid);

  const firstId = await offlineSunIdFromParams(normalized.params);
  const secondId = await offlineSunIdFromParams(normalized.params);
  assert.match(firstId, /^[0-9a-f]{64}$/);
  assert.equal(firstId, secondId);
});

test("offline SUN input rejects URL controls, malformed crypto fields and duplicate envelope tricks", () => {
  assert.deepEqual(
    normalizeOfflineSunParams({ ...VALID_PARAMS, url: "https://attacker.invalid/sun" }),
    { ok: false, reason: "unexpected_param" },
  );
  assert.equal(normalizeOfflineSunParams({ ...VALID_PARAMS, origin: "https://attacker.invalid" }).ok, false);
  assert.equal(normalizeOfflineSunParams({ ...VALID_PARAMS, enc: "AA" }).ok, false);
  assert.equal(normalizeOfflineSunParams({ ...VALID_PARAMS, cmac: "GG11223344556677" }).ok, false);
  assert.equal(normalizeOfflineSunParams({ ...VALID_PARAMS, picc_data: "ABC" }).ok, false);
  assert.equal(normalizeOfflineSunParams({ ...VALID_PARAMS, v: "2" }).ok, false);
});

test("configured target construction cannot be redirected by scan input", () => {
  const normalized = normalizeOfflineSunParams(VALID_PARAMS);
  assert.equal(normalized.ok, true);
  if (!normalized.ok) return;

  const target = buildConfiguredSunTarget("https://configured-api.example.test/base", normalized.params);
  assert.equal(target.origin, "https://configured-api.example.test");
  assert.equal(target.pathname, "/sun");
  assert.deepEqual([...target.searchParams.keys()], ["v", "bid", "picc_data", "enc", "cmac"]);
});

test("sync result maps valid, invalid and replay outcomes to a redacted public contract", () => {
  const secretShapedValue = "DO_NOT_RETURN_UPSTREAM_PRIVATE_VALUE";
  const valid = redactOfflineSunUpstream({
    ok: true,
    status: { code: "VALID", productState: "VALID_CLOSED", internal: secretShapedValue },
    identity: { uid: secretShapedValue, tenantId: secretShapedValue, readCounter: 91 },
    technical: { raw: { cmacPrefix: secretShapedValue } },
    product: { name: "Producto piloto", storage: "Mantener seco" },
    tenant: { name: "Marca piloto", id: secretShapedValue },
    provenance: { origin: "Origen declarado" },
  }, VALID_PARAMS.bid, "2026-08-02T12:00:00.000Z");
  assert.equal(valid.status, "SYNCED_VALID");
  assert.equal(valid.verdict, "MESSAGE_VALID");
  assert.equal(valid.publicProduct?.name, "Producto piloto");
  assert.doesNotMatch(JSON.stringify(valid), new RegExp(secretShapedValue));
  assert.doesNotMatch(JSON.stringify(valid), /uid|tenantId|readCounter|cmacPrefix/);

  const replay = redactOfflineSunUpstream({ ok: false, status: { code: "REPLAY_SUSPECT" } }, VALID_PARAMS.bid);
  assert.equal(replay.status, "REPLAY_SUSPECT");

  const invalid = redactOfflineSunUpstream({ ok: false, status: { code: "INVALID" } }, VALID_PARAMS.bid);
  assert.equal(invalid.status, "SYNCED_INVALID");
});

test("offline sync execution performs one configured-origin call and returns a redacted result", async () => {
  const normalized = normalizeOfflineSunParams(VALID_PARAMS);
  assert.equal(normalized.ok, true);
  if (!normalized.ok) return;
  const calls = [];
  const fetcher = async (target, init) => {
    calls.push({ target: String(target), init });
    return Response.json({
      ok: true,
      status: { code: "VALID", productState: "VALID_CLOSED" },
      identity: { uid: "PRIVATE_UID_MUST_NOT_LEAVE_BFF" },
      product: { name: "Producto público" },
    });
  };
  const execution = await executeConfiguredOfflineSunSync(
    "https://configured-api.example.test/base",
    normalized.params,
    { fetcher, checkedAt: "2026-08-02T12:00:00.000Z" },
  );
  assert.equal(execution.ok, true);
  if (!execution.ok) return;
  assert.equal(execution.result.status, "SYNCED_VALID");
  assert.equal(calls.length, 1);
  const target = new URL(calls[0].target);
  assert.equal(target.origin, "https://configured-api.example.test");
  assert.equal(target.pathname, "/sun");
  assert.deepEqual([...target.searchParams.keys()], ["v", "bid", "picc_data", "enc", "cmac"]);
  assert.equal(calls[0].init.redirect, "error");
  assert.doesNotMatch(JSON.stringify(execution), /PRIVATE_UID_MUST_NOT_LEAVE_BFF/);
});

test("offline sync execution bounds upstream responses and preserves retry guidance", async () => {
  const normalized = normalizeOfflineSunParams(VALID_PARAMS);
  assert.equal(normalized.ok, true);
  if (!normalized.ok) return;

  const oversized = await executeConfiguredOfflineSunSync(
    "https://configured-api.example.test",
    normalized.params,
    {
      maxResponseBytes: 32,
      fetcher: async () => Response.json({ ok: true, padding: "x".repeat(256) }),
    },
  );
  assert.deepEqual(oversized, { ok: false, reason: "invalid_upstream_response", status: 502 });

  const limited = await executeConfiguredOfflineSunSync(
    "https://configured-api.example.test",
    normalized.params,
    {
      fetcher: async () => new Response("{}", { status: 429, headers: { "retry-after": "12" } }),
    },
  );
  assert.deepEqual(limited, { ok: false, reason: "rate_limited", status: 429, retryAfter: 12 });
});
