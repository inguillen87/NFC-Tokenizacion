import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [portal, privacyConsent, whatsappInbound, sunContext] = await Promise.all([
  readFile(new URL("../src/lib/consumer-portal-service.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/consumer/privacy/consent/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/twilio/whatsapp/inbound/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/sun/context/route.ts", import.meta.url), "utf8"),
]);

test("a newly persisted actor association republishes that exact tenant tap projection", () => {
  assert.match(portal, /import \{ publishTenantTapRealtimeProjection \} from "\.\/realtime-tap-projection"/);
  assert.match(portal, /ON CONFLICT \(consumer_id, tap_event_id\) DO NOTHING\s+RETURNING tenant_id, tap_event_id/);
  assert.match(portal, /String\(actorAssociation\.tenant_id \|\| ""\) === String\(event\.tenant_id \|\| ""\)/);

  const associationWrite = portal.indexOf("const actorAssociationRows = await sql");
  const postCommitPublish = portal.indexOf("await publishActorAssociationProjection(actorAssociation.tap_event_id)", associationWrite);
  assert.ok(associationWrite >= 0 && postCommitPublish > associationWrite);
  assert.match(portal, /\[consumer_actor_realtime_projection_failed\]/);
  assert.doesNotMatch(portal, /consumer_actor_realtime_projection_failed[\s\S]{0,180}(consumerId|uid_hex|email|phone)/i);
});

test("privacy consent republishes only persisted taps linked to the same tenant and consumer", () => {
  assert.match(privacyConsent, /publishTenantTapRealtimeProjection/);
  assert.match(privacyConsent, /JOIN events event[\s\S]*event\.tenant_id = history\.tenant_id/);
  assert.match(privacyConsent, /history\.tenant_id = \$\{input\.tenantId\}/);
  assert.match(privacyConsent, /history\.consumer_id = \$\{input\.consumerId\}/);
  assert.match(privacyConsent, /LIMIT \$\{REALTIME_CONSENT_PROJECTION_LIMIT \+ 1\}/);
  assert.match(privacyConsent, /\[consumer_consent_realtime_projection_truncated\]/);

  const patchHandler = privacyConsent.slice(privacyConsent.indexOf("export async function PATCH"));
  assert.ok(patchHandler.indexOf("RETURNING *") < patchHandler.indexOf("await publishAffectedConsentProjections"));
  assert.match(privacyConsent, /\[consumer_consent_realtime_projection_failed\]/);
});

test("WhatsApp grant and revoke project only the membership's persisted tenant tap", () => {
  assert.match(whatsappInbound, /lastTapEventId: context\.last_tap_event_id/);
  assert.match(whatsappInbound, /history\.tenant_id = \$\{input\.tenantId\}/);
  assert.match(whatsappInbound, /history\.consumer_id = \$\{input\.consumerId\}/);
  assert.match(whatsappInbound, /history\.tap_event_id = \$\{input\.lastTapEventId\}/);
  assert.match(whatsappInbound, /await publishTenantTapRealtimeProjection\(affectedEventId\)/);

  const updateConsent = whatsappInbound.slice(
    whatsappInbound.indexOf("async function updateConsent"),
    whatsappInbound.indexOf("async function recordCampaignIntent"),
  );
  assert.ok(updateConsent.indexOf("INSERT INTO consumer_tenant_consents") < updateConsent.indexOf("await publishWhatsAppConsentProjection"));
  assert.match(whatsappInbound, /\[whatsapp_consent_realtime_projection_failed\]/);
});

test("consented location republishes the event returned by the atomic durable write", () => {
  assert.match(sunContext, /import \{ publishTenantTapRealtimeProjection \} from "\.\.\/\.\.\/\.\.\/lib\/realtime-tap-projection"/);
  assert.match(sunContext, /const persistedEventId = persistenceRows\[0\]\?\.event_id/);
  assert.match(sunContext, /publishTenantTapRealtimeProjection\(eventId, traceId\)/);

  const postPersistence = sunContext.slice(sunContext.indexOf("if (persistenceRows.length !== 1)"));
  assert.ok(postPersistence.indexOf("const persistedEventId") < postPersistence.indexOf("await publishLocationProjection"));
  assert.match(sunContext, /\[sun_context_realtime_projection_failed\]/);
  assert.doesNotMatch(sunContext, /sun_context_realtime_projection_failed[\s\S]{0,180}(lat|lng|accuracy|uid|consumer)/i);
});
