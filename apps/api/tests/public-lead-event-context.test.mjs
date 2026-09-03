import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PublicLeadEventContextError,
  resolvePublicLeadEventContext,
} from "../src/lib/public-lead-event-context.ts";

const tenantAEvent = {
  eventId: "41",
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tenantSlug: "tenant-a",
  batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  bid: "LOT-A-2026",
  tagId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  uidHex: "04AABBCCDD1122",
  productName: "Canonical product A",
};

function rejectsWith(code) {
  return (error) => error instanceof PublicLeadEventContextError && error.code === code;
}

test("public lead event attribution is copied from the exact persisted tenant/event/batch identity", async () => {
  let lookedUp = null;
  const resolved = await resolvePublicLeadEventContext({
    eventId: tenantAEvent.eventId,
    tenantSlug: tenantAEvent.tenantSlug,
    bid: tenantAEvent.bid,
    uidHex: tenantAEvent.uidHex.toLowerCase(),
    productName: "Attacker product",
  }, async (eventId) => {
    lookedUp = eventId;
    return [tenantAEvent];
  });

  assert.equal(lookedUp, tenantAEvent.eventId);
  assert.deepEqual(resolved, tenantAEvent);
});

test("cross-tenant, cross-batch and cross-unit lead attribution fails closed", async () => {
  for (const [input, code] of [
    [{ eventId: "41", tenantSlug: "tenant-b", bid: tenantAEvent.bid }, "lead_event_scope_mismatch"],
    [{ eventId: "41", tenantSlug: tenantAEvent.tenantSlug, bid: "LOT-B-2026" }, "lead_event_scope_mismatch"],
    [{ eventId: "41", tenantSlug: tenantAEvent.tenantSlug, bid: tenantAEvent.bid, uidHex: "04DEADBEEF0001" }, "lead_event_uid_mismatch"],
    [{ eventId: "41", tenantSlug: "", bid: tenantAEvent.bid }, "lead_event_scope_required"],
  ]) {
    await assert.rejects(
      () => resolvePublicLeadEventContext(input, async () => [tenantAEvent]),
      rejectsWith(code),
    );
  }
});

test("public lead route never derives tenant or product attribution from browser claims", async () => {
  const route = await readFile(new URL("../src/app/public/leads/route.ts", import.meta.url), "utf8");

  assert.match(route, /resolvePublicLeadEventContext/);
  assert.match(route, /JOIN batches batch[\s\S]*?batch\.tenant_id = e\.tenant_id/);
  assert.match(route, /JOIN tenants tenant ON tenant\.id = e\.tenant_id/);
  assert.match(route, /identityAuthority: eventContext \? "canonical_event" : "unattributed_public_lead"/);
  assert.match(route, /locatorClaimsIgnored: !eventContext/);
  assert.match(route, /productName = eventContext\?\.productName \|\| null/);
  assert.match(route, /tenant_id IS NOT DISTINCT FROM \$\{tenantId\}::uuid/);
  assert.match(route, /meta->>'contactDigest' = \$\{contactDigest\}/);
  assert.match(route, /lead_event_persistence_unavailable/);
  assert.doesNotMatch(route, /function publishLead[\s\S]{0,500}contact: context\.contact/);
  assert.doesNotMatch(route, /async function resolveTenantId/);
});
