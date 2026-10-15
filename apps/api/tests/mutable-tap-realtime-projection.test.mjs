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
  const coreStart = portal.indexOf("export async function saveConsumerTapActionForConsumer(");
  const coreEnd = portal.indexOf("export async function saveTapForConsumer(", coreStart);
  assert.ok(coreStart >= 0 && coreEnd > coreStart);
  const core = portal.slice(coreStart, coreEnd);
  const sqlStart = core.indexOf("const rows = await sqlSerializable/*sql*/`");
  const sqlEnd = core.indexOf("`;", sqlStart);
  const postCommitStart = core.indexOf("const reason = committed?.error;", sqlEnd);
  assert.ok(sqlStart >= 0 && sqlEnd > sqlStart && postCommitStart > sqlEnd);
  const transaction = core.slice(sqlStart, sqlEnd);
  const postCommit = core.slice(postCommitStart);
  const cte = (start, end) => {
    const from = transaction.indexOf(start);
    const to = transaction.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `missing bounded CTE: ${start}`);
    return transaction.slice(from, to);
  };

  const lockedEvent = cte("WITH locked_event AS MATERIALIZED (", "), locked_batch AS MATERIALIZED (");
  assert.match(lockedEvent, /FROM events source_event JOIN tenants tenant ON tenant\.id = source_event\.tenant_id/);
  assert.match(lockedEvent, /WHERE source_event\.id = \$\{input\.eventId\}::bigint/);
  const eligible = cte("), eligible AS MATERIALIZED (", "), inserted_title AS (");
  assert.match(eligible, /FROM locked_event event[\s\S]*CROSS JOIN decision\s+WHERE decision\.error IS NULL/);
  const membership = cte("), written_membership AS (", "), written_history AS (");
  assert.match(membership, /INSERT INTO tenant_consumer_memberships \(tenant_id, consumer_id,[\s\S]*SELECT tenant_id, \$\{input\.consumerId\}::uuid,[\s\S]*FROM eligible\s+WHERE NOT \$\{claiming\}::boolean OR EXISTS \(SELECT 1 FROM saved_title\)/);
  const history = cte("), written_history AS (", "), updated_product AS (");
  assert.match(history, /INSERT INTO consumer_tap_history \(consumer_id, tenant_id, tap_event_id,/);
  assert.match(history, /SELECT \$\{input\.consumerId\}::uuid, event\.tenant_id, event\.id,/);
  assert.match(history, /FROM eligible event JOIN written_membership membership ON membership\.tenant_id = event\.tenant_id/);
  assert.match(history, /ON CONFLICT \(consumer_id, tap_event_id\) DO NOTHING RETURNING tenant_id, tap_event_id/);
  assert.match(transaction, /\(SELECT tap_event_id FROM written_history LIMIT 1\) AS association_event_id/);

  assert.match(core.slice(sqlEnd, postCommitStart), /committed = rows\[0\];\s+break;/);
  assert.doesNotMatch(core.slice(sqlStart, postCommitStart), /publishActorAssociationProjection/);
  const receiptGate = postCommit.indexOf('if (reason || !committed?.membership?.id || !committed.product_id || claiming && !committed.ownership?.id) throw new Error("consumer_tap_core_result_unavailable");');
  const publication = postCommit.indexOf("if (committed.association_event_id) await publishActorAssociationProjection(committed.association_event_id);");
  assert.ok(receiptGate >= 0 && publication > receiptGate);
  assert.equal((core.match(/await publishActorAssociationProjection\(/g) || []).length, 1);
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
