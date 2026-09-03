import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CampaignAudienceError,
  campaignAudienceCandidateIsEligible,
  requiredCampaignConsentScope,
  resolveCampaignAudience,
} from "../src/lib/campaign-audience.ts";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CONSUMER_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-09-03T12:00:00.000Z");

function eligibleCandidate(overrides = {}) {
  return {
    tenant_id: TENANT_ID,
    consumer_id: CONSUMER_ID,
    membership_status: "active",
    consent_scope: "whatsapp_marketing",
    consent_granted: true,
    granted_at: "2026-09-01T12:00:00.000Z",
    revoked_at: null,
    contact_value: "+5491160000000",
    last_activity_at: "2026-09-03T11:00:00.000Z",
    ...overrides,
  };
}

test("campaign audience requires an explicit tenant and an exact channel-purpose scope", async () => {
  assert.equal(requiredCampaignConsentScope("email", "marketing"), "email_marketing");
  assert.equal(requiredCampaignConsentScope("whatsapp", "marketing"), "whatsapp_marketing");
  await assert.rejects(
    () => resolveCampaignAudience({ tenantSlug: "", channel: "whatsapp", purpose: "marketing" }, async () => []),
    (error) => error instanceof CampaignAudienceError && error.message === "campaign_audience_tenant_required",
  );
});
test("tenant mismatch, revoked grant, inactive membership and future grant all fail closed", () => {
  const base = { tenantId: TENANT_ID, requiredScope: "whatsapp_marketing", now: NOW };
  assert.equal(campaignAudienceCandidateIsEligible({ ...base, candidate: eligibleCandidate() }), true);
  assert.equal(campaignAudienceCandidateIsEligible({ ...base, candidate: eligibleCandidate({ tenant_id: "tenant-b" }) }), false);
  assert.equal(campaignAudienceCandidateIsEligible({ ...base, candidate: eligibleCandidate({ revoked_at: "2026-09-02T00:00:00.000Z" }) }), false);
  assert.equal(campaignAudienceCandidateIsEligible({ ...base, candidate: eligibleCandidate({ membership_status: "paused" }) }), false);
  assert.equal(campaignAudienceCandidateIsEligible({ ...base, candidate: eligibleCandidate({ consent_scope: "whatsapp" }) }), false);
  assert.equal(campaignAudienceCandidateIsEligible({ ...base, candidate: eligibleCandidate({ granted_at: "2026-09-04T00:00:00.000Z" }) }), false);
});

test("resolver returns only tenant-scoped pseudonymous actors and masked contacts", async () => {
  const calls = [];
  const fakeSql = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{
      tenant_id: TENANT_ID,
      tenant_slug: "bodega-balmes",
      audience_count: 1,
      members: [eligibleCandidate()],
    }];
  };
  const audience = await resolveCampaignAudience({
    tenantSlug: "bodega-balmes",
    channel: "whatsapp",
    purpose: "marketing",
    limit: 20,
    now: NOW,
  }, fakeSql);

  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /membership\.tenant_id = tenant\.id/);
  assert.match(calls[0].statement, /membership\.status = 'active'/);
  assert.match(calls[0].statement, /consent\.tenant_id = tenant\.id/);
  assert.match(calls[0].statement, /consent\.consumer_id = consumer\.id/);
  assert.match(calls[0].statement, /consent\.revoked_at IS NULL/);
  assert.ok(calls[0].values.includes("bodega-balmes"));
  assert.ok(calls[0].values.includes("whatsapp_marketing"));
  assert.equal(audience.count, 1);
  assert.equal(audience.items.length, 1);
  assert.match(audience.items[0].actorRef, /^actor-[0-9a-f]{20}$/);
  assert.equal(audience.items[0].contactMasked, "+549***0000");
  assert.doesNotMatch(JSON.stringify(audience), /22222222-2222-4222-8222-222222222222|\+5491160000000/);
});

test("resolver rejects a database sample that violates tenant or revocation boundaries", async () => {
  const fakeSql = async () => [{
    tenant_id: TENANT_ID,
    tenant_slug: "bodega-balmes",
    audience_count: 1,
    members: [eligibleCandidate({ revoked_at: "2026-09-02T00:00:00.000Z" })],
  }];
  await assert.rejects(
    () => resolveCampaignAudience({
      tenantSlug: "bodega-balmes",
      channel: "whatsapp",
      purpose: "marketing",
      now: NOW,
    }, fakeSql),
    (error) => error instanceof CampaignAudienceError && error.message === "campaign_audience_integrity_violation",
  );
});

test("audience endpoint uses campaign read permission and never invokes a sender", async () => {
  const route = await readFile(new URL("../src/app/admin/campaigns/audience/route.ts", import.meta.url), "utf8");
  assert.match(route, /checkAdminWithPermission\(req, "campaigns:read"\)/);
  assert.match(route, /campaign_audience_tenant_required/);
  assert.doesNotMatch(route, /twilio|messages\.create|sendMail|fetch\(/i);
});
