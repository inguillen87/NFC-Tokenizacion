import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  createSunFreshHandoffToken,
  createSunSnapshotAccessToken,
  requireSunFreshHandoff,
} = await import("../src/lib/sun-fresh-handoff.ts");
const { isPublicExperienceContextBlocked } = await import("../src/lib/public-experience-events.ts");

const routeUrl = new URL("../src/app/public/cta/experience-event/route.ts", import.meta.url);
const originalSecret = process.env.SUN_HANDOFF_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

test.before(() => {
  process.env.SUN_HANDOFF_SECRET = "public-experience-fresh-handoff-test-secret-2026";
  process.env.NODE_ENV = "test";
});

test.after(() => {
  if (originalSecret === undefined) delete process.env.SUN_HANDOFF_SECRET;
  else process.env.SUN_HANDOFF_SECRET = originalSecret;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

function freshToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return createSunFreshHandoffToken({
    bid: "BID-WINE",
    eventId: "8842",
    diagnosticId: 8842,
    traceId: "trace-wine-8842",
    exp: now + 60,
    ...overrides,
  });
}

function requireCapability(token, expected = { bid: "BID-WINE", eventId: "8842" }) {
  return requireSunFreshHandoff(
    new Request("https://api.nexid.test/public/cta/experience-event"),
    token ? { fresh_token: token } : {},
    expected,
  );
}

test("experience event route verifies fresh capability after public scope auth and before context/write", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /import \{ requireSunFreshHandoff \} from .*sun-fresh-handoff/);
  assert.match(source, /requireSunFreshHandoff\(req, body, \{ bid: target\.bid, eventId: target\.eventId \}\)/);
  assert.match(source, /reason: "fresh_tap_capability_required",\s+fresh_token_status: fresh\.reason/);
  assert.doesNotMatch(source, /consumeSunFreshHandoff/);
  assert.doesNotMatch(source, /body\.(?:freshTap|isFreshCommercialTap|allowSensitiveEvents)/);

  const shareAuth = source.indexOf("const auth = requireShareToken(");
  const capability = source.indexOf("const fresh = requireSunFreshHandoff(");
  const context = source.indexOf("const context = await loadPublicExperienceContext(");
  const sink = source.indexOf("const saved = await recordPublicExperienceEvent(");
  assert.ok(shareAuth >= 0 && capability > shareAuth);
  assert.ok(context > capability);
  assert.ok(sink > context);

  assert.match(source, /if \(isPublicExperienceContextBlocked\(context\)\)/);
  assert.doesNotMatch(source, /isSensitivePublicExperienceEvent\(eventType\) && isPublicExperienceContextBlocked/);
});

test("server boundary rejects QR or ordinary public requests without the signed physical-tap capability", () => {
  assert.deepEqual(requireCapability(""), { ok: false, reason: "fresh_token_missing" });
  assert.deepEqual(
    requireSunFreshHandoff(
      new Request("https://api.nexid.test/public/cta/experience-event?channel=qr"),
      { channel: "qr", freshTap: true, isFreshCommercialTap: true },
      { bid: "BID-WINE", eventId: "8842" },
    ),
    { ok: false, reason: "fresh_token_missing" },
  );
});

test("server boundary rejects snapshot capability, forged signature and scope mismatches", () => {
  const now = Math.floor(Date.now() / 1000);
  const snapshot = createSunSnapshotAccessToken({
    diagnosticId: 8842,
    traceId: "trace-wine-8842",
    iat: now,
    exp: now + 60,
  });
  assert.deepEqual(requireCapability(snapshot), { ok: false, reason: "fresh_token_malformed" });

  const valid = freshToken();
  const forged = `${valid.slice(0, -1)}${valid.endsWith("a") ? "b" : "a"}`;
  assert.deepEqual(requireCapability(forged), { ok: false, reason: "fresh_token_invalid_signature" });
  assert.deepEqual(
    requireCapability(valid, { bid: "BID-OTHER", eventId: "8842" }),
    { ok: false, reason: "fresh_token_bid_mismatch" },
  );
  assert.deepEqual(
    requireCapability(valid, { bid: "BID-WINE", eventId: "8843" }),
    { ok: false, reason: "fresh_token_event_mismatch" },
  );
});

test("server boundary rejects expired capability", { concurrency: false }, () => {
  const originalNow = Date.now;
  const issuedAt = 2_000_000_000;
  try {
    Date.now = () => issuedAt * 1000;
    const token = freshToken({ iat: issuedAt, exp: issuedAt + 5 });
    Date.now = () => (issuedAt + 6) * 1000;
    assert.deepEqual(requireCapability(token), { ok: false, reason: "fresh_token_expired" });
  } finally {
    Date.now = originalNow;
  }
});

test("server-side trust context blocks replay while valid closed/opened taps remain eligible", () => {
  const base = {
    result: "VALID_CLOSED",
    verdict: "valid",
    riskLevel: "none",
    reason: "",
    productState: "VALID_CLOSED",
  };
  assert.equal(isPublicExperienceContextBlocked(base), false);
  assert.equal(isPublicExperienceContextBlocked({ ...base, result: "REPLAY_SUSPECT", reason: "replay_detected" }), true);
  assert.equal(isPublicExperienceContextBlocked({ ...base, result: "VALID_OPENED", verdict: "valid_opened", productState: "VALID_OPENED" }), false);
});
