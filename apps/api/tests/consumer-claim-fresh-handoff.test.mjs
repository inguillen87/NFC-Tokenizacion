import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { createSunFreshHandoffToken, requireSunFreshHandoff } = await import("../src/lib/sun-fresh-handoff.ts");

const claimRouteUrl = new URL("../src/app/mobile/passport/[eventId]/consumer/claim/route.ts", import.meta.url);
const originalSecret = process.env.SUN_HANDOFF_SECRET;

test.before(() => {
  process.env.SUN_HANDOFF_SECRET = "consumer-claim-fresh-handoff-test-secret";
});

test.after(() => {
  if (originalSecret === undefined) delete process.env.SUN_HANDOFF_SECRET;
  else process.env.SUN_HANDOFF_SECRET = originalSecret;
});

function createFreshToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return createSunFreshHandoffToken({
    bid: "BID-HISTORY-001",
    eventId: "event-history-001",
    diagnosticId: 42,
    traceId: "trace-history-001",
    exp: now + 60,
    ...overrides,
  });
}

test("mobile ownership claim requires the fresh SUN handoff after auth and tenant checks but before the claim sink", async () => {
  const source = await readFile(claimRouteUrl, "utf8");

  assert.match(source, /import \{ requireSunFreshHandoff \} from .*sun-fresh-handoff/);
  assert.match(source, /const expectedEventId = String\(event\.id \|\| eventId\)\.trim\(\)/);
  assert.match(source, /const expectedBid = String\(body\.bid \|\| event\.bid \|\| ""\)\.trim\(\)/);
  assert.match(source, /const fresh = requireSunFreshHandoff\(req, body as Record<string, unknown>, \{ eventId: expectedEventId, bid: expectedBid \}\)/);
  assert.match(source, /const FRESH_OWNERSHIP_REQUIRED = "fresh_physical_tap_required_for_ownership"/);
  assert.match(source, /error: FRESH_OWNERSHIP_REQUIRED,\s+reason: FRESH_OWNERSHIP_REQUIRED,\s+fresh_token_status: freshTokenStatus,\s+\}, 403\)/);
  assert.match(source, /if \(!expectedBid\) return freshOwnershipForbidden\("fresh_token_bid_missing"\)/);
  assert.match(source, /if \(!fresh\.ok\) return freshOwnershipForbidden\(fresh\.reason\)/);

  const authCheck = source.indexOf("const consumer = await getConsumerFromRequest(req)");
  const tenantCheck = source.indexOf("if (!matchesOwnershipTenant(");
  const freshCheck = source.indexOf("const fresh = requireSunFreshHandoff(");
  const claimSink = source.indexOf("const claimed = await claimOwnershipForConsumer(");

  assert.ok(authCheck >= 0, "consumer authentication must remain enforced");
  assert.ok(tenantCheck > authCheck, "tenant validation must remain after consumer authentication");
  assert.ok(freshCheck > tenantCheck, "fresh handoff validation must run after auth and tenant checks");
  assert.ok(claimSink > freshCheck, "fresh handoff validation must run before ownership is claimed");
});

test("fresh SUN handoff rejects a missing token without database access", () => {
  const result = requireSunFreshHandoff(
    new Request("https://api.nexid.test/mobile/passport/event-history-001/consumer/claim"),
    {},
    { eventId: "event-history-001", bid: "BID-HISTORY-001" },
  );

  assert.deepEqual(result, { ok: false, reason: "fresh_token_missing" });
});

test("fresh SUN handoff accepts a signed token matching the event and batch", () => {
  const token = createFreshToken();
  const result = requireSunFreshHandoff(
    new Request("https://api.nexid.test/mobile/passport/event-history-001/consumer/claim"),
    { fresh_token: token },
    { eventId: "event-history-001", bid: "BID-HISTORY-001" },
  );

  assert.equal(result.ok, true);
  assert.equal(result.payload.eventId, "event-history-001");
  assert.equal(result.payload.bid, "BID-HISTORY-001");
});

test("fresh SUN handoff rejects event and batch mismatches without database access", () => {
  const token = createFreshToken();
  const request = new Request("https://api.nexid.test/mobile/passport/event-history-001/consumer/claim");

  const eventMismatch = requireSunFreshHandoff(request, { fresh_token: token }, {
    eventId: "event-history-002",
    bid: "BID-HISTORY-001",
  });
  const bidMismatch = requireSunFreshHandoff(request, { fresh_token: token }, {
    eventId: "event-history-001",
    bid: "BID-HISTORY-002",
  });

  assert.deepEqual(eventMismatch, { ok: false, reason: "fresh_token_event_mismatch" });
  assert.deepEqual(bidMismatch, { ok: false, reason: "fresh_token_bid_mismatch" });
});

test("fresh SUN handoff rejects an expired token without database access", { concurrency: false }, () => {
  const originalNow = Date.now;
  const issuedAt = 2_000_000_000;

  try {
    Date.now = () => issuedAt * 1000;
    const token = createFreshToken({ exp: issuedAt + 5 });
    Date.now = () => (issuedAt + 6) * 1000;

    const result = requireSunFreshHandoff(
      new Request("https://api.nexid.test/mobile/passport/event-history-001/consumer/claim"),
      { fresh_token: token },
      { eventId: "event-history-001", bid: "BID-HISTORY-001" },
    );

    assert.deepEqual(result, { ok: false, reason: "fresh_token_expired" });
  } finally {
    Date.now = originalNow;
  }
});
