export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { RequestBodyTooLargeError, readRequestTextBounded } from "../../../../../lib/bounded-request-body";
import { enforceSdkAuthenticationRateLimit, enforceSdkRateLimit } from "../../../../../lib/critical-rate-limit";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import {
  normalizeOfflineHash,
  normalizeOfflineLocalVerdict,
  normalizeOfflineObservedAt,
  sha256Hex,
} from "../../../../../lib/offline-verifier";
import { hashEvidencePayload } from "../../../../../lib/proof-layer";
import { authenticateSdkRequest } from "../../../../../lib/sdk-auth";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";

const MAX_BODY_BYTES = 256 * 1024;
const MAX_EVENTS = 100;

function clean(value: unknown, maximum = 240) {
  return String(value || "").trim().slice(0, maximum);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => clean(item, 120)).filter(Boolean);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? stringList(parsed) : [];
  } catch {
    return [];
  }
}

function bidFromCapturedUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return clean(new URL(raw).searchParams.get("bid"), 120);
  } catch {
    return "";
  }
}

function normalizedEvidenceHash(event: Record<string, unknown>, field: "uid" | "sun") {
  const provided = field === "uid"
    ? event.uid_hash || event.uidHash
    : event.sun_payload_hash || event.sunPayloadHash;
  const normalized = normalizeOfflineHash(provided, `${field}_hash`);
  if (normalized || field === "uid") return normalized;
  const capturedUrl = String(event.capturedUrl || event.captured_url || "").trim();
  return capturedUrl ? `sha256:${sha256Hex(capturedUrl)}` : null;
}

export async function POST(req: Request) {
  const authRateLimited = await enforceSdkAuthenticationRateLimit(req);
  if (authRateLimited) return authRateLimited;

  const auth = await authenticateSdkRequest(req, "sdk:logistics");
  if (!auth.ok) return auth.response;
  const rateLimited = await enforceSdkRateLimit(req, auth.context);
  if (rateLimited) return rateLimited;

  let body: Record<string, unknown>;
  try {
    const rawBody = await readRequestTextBounded(req, MAX_BODY_BYTES);
    body = asRecord(JSON.parse(rawBody || "{}"));
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json(
      { ok: false, reason: tooLarge ? "offline_sync_body_too_large" : "offline_sync_payload_invalid" },
      tooLarge ? 413 : 400,
      { "cache-control": "no-store" },
    );
  }

  const requestedTenant = clean(body.tenantId || body.tenant_id || body.tenant, 120).toLowerCase();
  if (requestedTenant
    && requestedTenant !== auth.context.tenantId.toLowerCase()
    && requestedTenant !== auth.context.tenantSlug.toLowerCase()) {
    return json({ ok: false, reason: "offline_sync_tenant_mismatch" }, 403, { "cache-control": "no-store" });
  }

  const events = Array.isArray(body.events) ? body.events.map(asRecord) : [];
  if (!events.length) return json({ ok: false, reason: "offline_sync_events_required" }, 400, { "cache-control": "no-store" });
  if (events.length > MAX_EVENTS) {
    return json({ ok: false, reason: "offline_sync_event_limit_exceeded", max_events: MAX_EVENTS }, 413, { "cache-control": "no-store" });
  }

  const bundleIdentifier = clean(body.bundleId || body.bundle_id || body.bundleRef || body.bundle_ref, 160);
  const deviceIdentifier = clean(body.deviceId || body.device_id, 160);
  if (!bundleIdentifier || !deviceIdentifier) {
    return json({ ok: false, reason: "offline_sync_bundle_and_device_required" }, 400, { "cache-control": "no-store" });
  }

  // Identity fields are rejected as a batch before schema/business writes.
  for (const event of events) {
    const eventTenant = clean(event.tenantId || event.tenant_id || event.tenant, 120).toLowerCase();
    const eventDevice = clean(event.deviceId || event.device_id, 160);
    if (eventTenant
      && eventTenant !== auth.context.tenantId.toLowerCase()
      && eventTenant !== auth.context.tenantSlug.toLowerCase()) {
      return json({ ok: false, reason: "offline_sync_tenant_mismatch" }, 403, { "cache-control": "no-store" });
    }
    if (eventDevice && eventDevice !== deviceIdentifier) {
      return json({ ok: false, reason: "offline_sync_device_mismatch" }, 403, { "cache-control": "no-store" });
    }
  }

  try {
    await ensureSupplierOpsSchema();
    const bundleRows = await sql/*sql*/`
      SELECT
        bundle.id::text AS bundle_id,
        bundle.device_id::text AS device_id,
        bundle.allowed_bids_json,
        bundle.status AS bundle_status,
        bundle.expires_at,
        device.status AS device_status,
        device.operator_ref
      FROM offline_verifier_bundles bundle
      JOIN offline_verifier_devices device ON device.id = bundle.device_id
      WHERE bundle.tenant_id = ${auth.context.tenantId}::uuid
        AND device.tenant_id = ${auth.context.tenantId}::uuid
        AND (bundle.id::text = ${bundleIdentifier} OR bundle.bundle_ref = ${bundleIdentifier})
        AND device.id::text = ${deviceIdentifier}
      LIMIT 1
    `;
    const bundle = bundleRows[0] as Record<string, unknown> | undefined;
    if (!bundle) return json({ ok: false, reason: "offline_sync_bundle_not_found" }, 404, { "cache-control": "no-store" });
    const expiresAt = new Date(String(bundle.expires_at || "")).getTime();
    if (bundle.bundle_status !== "active"
      || bundle.device_status !== "active"
      || !Number.isFinite(expiresAt)
      || expiresAt <= Date.now()) {
      return json({ ok: false, reason: "offline_sync_bundle_not_active" }, 409, { "cache-control": "no-store" });
    }

    const allowedBids = new Set(stringList(bundle.allowed_bids_json));
    const results: Array<Record<string, unknown>> = [];
    for (const event of events) {
      const clientEventId = clean(event.clientEventId || event.client_event_id || event.localId || event.local_id || event.id, 160);
      const capturedUrl = String(event.capturedUrl || event.captured_url || "").trim();
      const bid = clean(event.bid || event.batchId || event.batch_id || bidFromCapturedUrl(capturedUrl), 120);
      if (!clientEventId || !bid) {
        results.push({ ok: false, client_event_id: clientEventId || null, reason: "offline_sync_event_identity_required" });
        continue;
      }
      if (!allowedBids.has(bid)) {
        results.push({ ok: false, client_event_id: clientEventId, bid, reason: "offline_sync_bid_not_allowed" });
        continue;
      }

      try {
        const localVerdict = normalizeOfflineLocalVerdict(event.status || event.localVerdict || event.local_verdict || "SYNC_PENDING");
        const observedAt = normalizeOfflineObservedAt(event.capturedAt || event.captured_at || event.observedAt || event.observed_at);
        const uidHash = normalizedEvidenceHash(event, "uid");
        const sunPayloadHash = normalizedEvidenceHash(event, "sun");
        if (!uidHash && !sunPayloadHash) {
          results.push({ ok: false, client_event_id: clientEventId, bid, reason: "offline_sync_hashed_evidence_required" });
          continue;
        }
        const serverVerdict = localVerdict === "OFFLINE_LOCAL_FAIL" ? "SYNC_REVIEW_REQUIRED" : "SYNC_PENDING";
        const payloadHash = hashEvidencePayload({
          tenantId: auth.context.tenantId,
          resourceType: "offline_scan_event",
          resourceId: clientEventId,
          eventType: "offline_scan_synced",
          payload: { bid, uid_hash: uidHash, sun_payload_hash: sunPayloadHash, local_verdict: localVerdict, observed_at: observedAt },
        });
        const inserted = await sql/*sql*/`
          INSERT INTO offline_scan_events (
            tenant_id, device_id, bundle_id, client_event_id, bid, uid_hash, sun_payload_hash,
            local_verdict, sync_status, server_verdict, reason, payload_hash, observed_at, metadata_json
          ) VALUES (
            ${auth.context.tenantId}, ${String(bundle.device_id)}, ${String(bundle.bundle_id)}, ${clientEventId},
            ${bid}, ${uidHash}, ${sunPayloadHash}, ${localVerdict}, 'received', ${serverVerdict}, null,
            ${payloadHash}, ${observedAt}::timestamptz, ${JSON.stringify({
              source: "sdk_offline_sync",
              api_key_id: auth.context.apiKeyId,
              operator_ref: bundle.operator_ref || null,
              approximate_location: asRecord(event.approximateLocation || event.approximate_location),
            })}::jsonb
          )
          ON CONFLICT (tenant_id, device_id, client_event_id) DO NOTHING
          RETURNING id::text AS id
        `;
        results.push({
          ok: inserted.length > 0,
          client_event_id: clientEventId,
          bid,
          sync_status: inserted.length > 0 ? "received" : "duplicate",
          reason: inserted.length > 0 ? null : "duplicate_client_event_id",
        });
      } catch {
        results.push({ ok: false, client_event_id: clientEventId, bid, reason: "offline_sync_event_invalid" });
      }
    }

    await sql/*sql*/`
      UPDATE offline_verifier_devices
      SET last_seen_at = now(), updated_at = now()
      WHERE id = ${String(bundle.device_id)}::uuid
        AND tenant_id = ${auth.context.tenantId}::uuid
    `;
    return json({
      ok: true,
      received: results.filter((item) => item.sync_status === "received").length,
      duplicates: results.filter((item) => item.sync_status === "duplicate").length,
      rejected: results.filter((item) => item.ok !== true && item.sync_status !== "duplicate").length,
      results,
    }, 200, { "cache-control": "no-store" });
  } catch {
    console.error("[sdk_offline_sync_failed]");
    return json({ ok: false, reason: "offline_sync_unavailable" }, 500, { "cache-control": "no-store" });
  }
}
