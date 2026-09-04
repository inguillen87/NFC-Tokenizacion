export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { publishTenantTapRealtimeProjection } from "../../../../lib/realtime-tap-projection";

const REALTIME_CONSENT_PROJECTION_LIMIT = 40;
const REALTIME_CONSENT_PROJECTION_CONCURRENCY = 4;

async function publishConsentProjection(eventId: unknown) {
  try {
    const publication = await publishTenantTapRealtimeProjection(eventId);
    if (!publication.projected || !publication.distributed) {
      console.warn("[consumer_consent_realtime_projection_unavailable]", JSON.stringify({
        eventId: String(eventId || ""),
        projected: publication.projected,
        distributed: publication.distributed,
      }));
    }
  } catch (error) {
    console.warn("[consumer_consent_realtime_projection_failed]", JSON.stringify({
      eventId: String(eventId || ""),
      reason: error instanceof Error ? error.name : "unknown_error",
    }));
  }
}

async function publishAffectedConsentProjections(input: { tenantId: unknown; consumerId: unknown }) {
  let affectedRows: Array<Record<string, unknown>>;
  try {
    affectedRows = await sql/*sql*/`
      SELECT DISTINCT history.tap_event_id
      FROM consumer_tap_history history
      JOIN events event
        ON event.id = history.tap_event_id
       AND event.tenant_id = history.tenant_id
      WHERE history.tenant_id = ${input.tenantId}
        AND history.consumer_id = ${input.consumerId}
        AND history.tap_event_id IS NOT NULL
      ORDER BY history.tap_event_id DESC
      LIMIT ${REALTIME_CONSENT_PROJECTION_LIMIT + 1}
    `;
  } catch (error) {
    console.warn("[consumer_consent_realtime_projection_lookup_failed]", JSON.stringify({
      reason: error instanceof Error ? error.name : "unknown_error",
    }));
    return;
  }

  const affectedEventIds = affectedRows
    .slice(0, REALTIME_CONSENT_PROJECTION_LIMIT)
    .map((row) => row.tap_event_id)
    .filter((eventId) => eventId !== null && eventId !== undefined && String(eventId).trim() !== "");

  for (let index = 0; index < affectedEventIds.length; index += REALTIME_CONSENT_PROJECTION_CONCURRENCY) {
    await Promise.all(
      affectedEventIds
        .slice(index, index + REALTIME_CONSENT_PROJECTION_CONCURRENCY)
        .map((eventId) => publishConsentProjection(eventId)),
    );
  }

  if (affectedRows.length > REALTIME_CONSENT_PROJECTION_LIMIT) {
    console.warn("[consumer_consent_realtime_projection_truncated]", JSON.stringify({
      tenantId: String(input.tenantId || ""),
      publishedCount: affectedEventIds.length,
      limit: REALTIME_CONSENT_PROJECTION_LIMIT,
    }));
  }
}

export async function PATCH(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:privacy-consent` });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 8 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  await ensureConsumerPortalSchema();
  if (!body.tenantId || !body.scope) return json({ ok: false, error: "tenantId_scope_required" }, 400);
  const granted = Boolean(body.granted);
  const rows = await sql/*sql*/`
    INSERT INTO consumer_tenant_consents (tenant_id, consumer_id, scope, granted, granted_at, revoked_at, source)
    VALUES (${body.tenantId}, ${consumer.id}, ${body.scope}, ${granted}, ${granted ? new Date().toISOString() : null}, ${granted ? null : new Date().toISOString()}, 'consumer_privacy')
    ON CONFLICT (tenant_id, consumer_id, scope)
    DO UPDATE SET granted = EXCLUDED.granted, granted_at = EXCLUDED.granted_at, revoked_at = EXCLUDED.revoked_at
    RETURNING *
  `;
  const consent = rows[0];
  if (consent?.tenant_id) {
    // Consent changes alter the actor/channel projection of every associated
    // tap. Re-publish the bounded live window using persisted tenant links.
    await publishAffectedConsentProjections({ tenantId: consent.tenant_id, consumerId: consumer.id });
  }
  return json({ ok: true, consent });
}
