export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { RequestBodyTooLargeError, readRequestTextBounded } from "../../../../../lib/bounded-request-body";
import { enforceSdkAuthenticationRateLimit, enforceSdkRateLimit } from "../../../../../lib/critical-rate-limit";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { hashEvidencePayload } from "../../../../../lib/proof-layer";
import { getRequestMeta } from "../../../../../lib/request-meta";
import { authenticateSdkRequest } from "../../../../../lib/sdk-auth";
import {
  assertOfflineCaptureWithinBundleWindow,
  OfflineSyncValidationError,
  normalizeSdkOfflineSyncEvent,
  readStoredOfflineSyncReceipt,
  redactOfflineSunVerification,
  SDK_OFFLINE_SYNC_EXPIRY_GRACE_MS,
  SDK_OFFLINE_SYNC_MAX_BODY_BYTES,
  SDK_OFFLINE_SYNC_MAX_EVENTS,
  SDK_OFFLINE_SYNC_PROCESSING_LEASE_MS,
  SDK_OFFLINE_SYNC_SCHEMA_VERSION,
} from "../../../../../lib/sdk-offline-sync";
import { processSunScan } from "../../../../../lib/sun-service";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";

const MAX_BODY_BYTES = SDK_OFFLINE_SYNC_MAX_BODY_BYTES;
const MAX_EVENTS = SDK_OFFLINE_SYNC_MAX_EVENTS;
const NO_STORE = { "cache-control": "no-store", "x-nexid-offline-level": "operator-2" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUNDLE_REF_RE = /^ovb_[0-9a-f]{36}$/i;
const UPLOAD_IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._~:/+=-]{0,254}$/;
const SAFE_CLIENT_EVENT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._~:+/-]{0,159}$/;
const SAFE_BID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;
const TOP_LEVEL_KEYS = new Set([
  "schemaVersion",
  "schema_version",
  "tenantId",
  "tenant_id",
  "tenant",
  "bundleId",
  "bundle_id",
  "bundleRef",
  "bundle_ref",
  "deviceId",
  "device_id",
  "events",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => firstString(item)).filter(Boolean);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? stringList(parsed) : [];
  } catch {
    return [];
  }
}

function processingReceipt(clientEventId: string, bid: string) {
  return {
    ok: true,
    client_event_id: clientEventId,
    bid,
    sync_status: "SYNC_PROCESSING",
    final_verdict: false,
    verdict: "PENDING_BACKEND_VERIFICATION",
    cryptographic_verification: false,
    uid_masked: null,
    read_counter: null,
    seal_status: "UNKNOWN",
    sun_event_id: null,
    reason: "offline_sync_in_progress",
    replayed: true,
  };
}

function rejectedReceipt(clientEventId: string | null, bid: string | null, reason: string, status = "SYNC_FAILED") {
  return {
    ok: false,
    client_event_id: clientEventId && SAFE_CLIENT_EVENT_ID_RE.test(clientEventId) ? clientEventId : null,
    bid: bid && SAFE_BID_RE.test(bid) ? bid : null,
    sync_status: status,
    final_verdict: false,
    verdict: "PENDING_BACKEND_VERIFICATION",
    cryptographic_verification: false,
    uid_masked: null,
    read_counter: null,
    seal_status: "UNKNOWN",
    sun_event_id: null,
    reason,
    replayed: false,
  };
}

export async function POST(req: Request) {
  const authRateLimited = await enforceSdkAuthenticationRateLimit(req);
  if (authRateLimited) return authRateLimited;

  const auth = await authenticateSdkRequest(req, "sdk:logistics");
  if (!auth.ok) return auth.response;
  const rateLimited = await enforceSdkRateLimit(req, auth.context);
  if (rateLimited) return rateLimited;
  const uploadIdempotencyKey = firstString(req.headers.get("idempotency-key"));
  if (!UPLOAD_IDEMPOTENCY_KEY_RE.test(uploadIdempotencyKey)) {
    return json({ ok: false, reason: "offline_sync_idempotency_key_required" }, 400, NO_STORE);
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await readRequestTextBounded(req, MAX_BODY_BYTES);
    const parsed = JSON.parse(rawBody || "null") as unknown;
    if (!isRecord(parsed) || Object.keys(parsed).some((key) => !TOP_LEVEL_KEYS.has(key))) {
      throw new OfflineSyncValidationError("offline_sync_payload_invalid");
    }
    body = parsed;
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json(
      { ok: false, reason: tooLarge ? "offline_sync_body_too_large" : "offline_sync_payload_invalid" },
      tooLarge ? 413 : 400,
      NO_STORE,
    );
  }

  const schemaVersion = body.schemaVersion ?? body.schema_version ?? SDK_OFFLINE_SYNC_SCHEMA_VERSION;
  if (schemaVersion !== SDK_OFFLINE_SYNC_SCHEMA_VERSION) {
    return json({ ok: false, reason: "offline_sync_schema_version_unsupported" }, 400, NO_STORE);
  }
  const requestedTenant = firstString(body.tenantId, body.tenant_id, body.tenant).toLowerCase();
  if (
    requestedTenant
    && requestedTenant !== auth.context.tenantId.toLowerCase()
    && requestedTenant !== auth.context.tenantSlug.toLowerCase()
  ) {
    return json({ ok: false, reason: "offline_sync_tenant_mismatch" }, 403, NO_STORE);
  }

  const events = Array.isArray(body.events) ? body.events : [];
  if (!events.length) return json({ ok: false, reason: "offline_sync_events_required" }, 400, NO_STORE);
  if (events.length > MAX_EVENTS) {
    return json({ ok: false, reason: "offline_sync_event_limit_exceeded", max_events: MAX_EVENTS }, 413, NO_STORE);
  }

  const bundleIdentifier = firstString(body.bundleId, body.bundle_id, body.bundleRef, body.bundle_ref);
  const deviceIdentifier = firstString(body.deviceId, body.device_id);
  if (!(UUID_RE.test(bundleIdentifier) || BUNDLE_REF_RE.test(bundleIdentifier)) || !UUID_RE.test(deviceIdentifier)) {
    return json({ ok: false, reason: "offline_sync_bundle_and_device_invalid" }, 400, NO_STORE);
  }

  try {
    await ensureSupplierOpsSchema();
    const bundleRows = await sql/*sql*/`
      SELECT
        bundle.id::text AS bundle_id,
        bundle.device_id::text AS device_id,
        bundle.allowed_bids_json,
        bundle.status AS bundle_status,
        bundle.created_at,
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
    if (!bundle) return json({ ok: false, reason: "offline_sync_bundle_not_found" }, 404, NO_STORE);
    const expiresAt = new Date(String(bundle.expires_at || "")).getTime();
    if (
      !["active", "expired"].includes(firstString(bundle.bundle_status).toLowerCase())
      || firstString(bundle.device_status).toLowerCase() !== "active"
      || !Number.isFinite(expiresAt)
      || Date.now() > expiresAt + SDK_OFFLINE_SYNC_EXPIRY_GRACE_MS
    ) {
      return json({ ok: false, reason: "offline_sync_bundle_not_active" }, 409, NO_STORE);
    }

    const allowedBids = new Set(stringList(bundle.allowed_bids_json));
    const results: Array<Record<string, unknown>> = [];
    const requestEventIds = new Set<string>();
    for (const rawEvent of events) {
      let event;
      try {
        event = normalizeSdkOfflineSyncEvent(rawEvent, {
          expectedDeviceId: deviceIdentifier,
          expectedTenantId: auth.context.tenantId,
          expectedTenantSlug: auth.context.tenantSlug,
        });
        assertOfflineCaptureWithinBundleWindow({
          capturedAt: event.capturedAt,
          bundleCreatedAt: bundle.created_at,
          bundleExpiresAt: bundle.expires_at,
        });
      } catch (error) {
        const record = isRecord(rawEvent) ? rawEvent : {};
        results.push(rejectedReceipt(
          firstString(record.clientEventId, record.client_event_id, record.localId, record.local_id) || null,
          firstString(record.bid, record.batchId, record.batch_id) || null,
          error instanceof OfflineSyncValidationError ? error.reason : "offline_sync_event_invalid",
        ));
        continue;
      }

      if (!allowedBids.has(event.bid)) {
        results.push(rejectedReceipt(event.clientEventId, event.bid, "offline_sync_bid_not_allowed"));
        continue;
      }
      if (requestEventIds.has(event.clientEventId)) {
        results.push(rejectedReceipt(event.clientEventId, event.bid, "offline_sync_duplicate_client_event_in_request"));
        continue;
      }
      requestEventIds.add(event.clientEventId);

      const payloadHash = hashEvidencePayload({
        tenantId: auth.context.tenantId,
        resourceType: "offline_scan_event",
        resourceId: event.clientEventId,
        eventType: "offline_scan_backend_verification",
        payload: {
          bundle_id: bundle.bundle_id,
          device_id: bundle.device_id,
          bid: event.bid,
          sun_payload_hash: event.sunPayloadHash,
          captured_at: event.capturedAt,
          approximate_location: event.approximateLocation,
        },
      });
      const initialMetadata = {
        source: "sdk_offline_sync",
        schema_version: SDK_OFFLINE_SYNC_SCHEMA_VERSION,
        offline_level: 2,
        api_key_id: auth.context.apiKeyId,
        operator_ref: bundle.operator_ref || null,
        app_version: event.appVersion,
        approximate_location: event.approximateLocation,
        processing_started_at: new Date().toISOString(),
      };
      const inserted = await sql/*sql*/`
        INSERT INTO offline_scan_events (
          tenant_id, device_id, bundle_id, client_event_id, bid, uid_hash, sun_payload_hash,
          local_verdict, sync_status, server_verdict, reason, payload_hash, observed_at, metadata_json
        ) VALUES (
          ${auth.context.tenantId}::uuid, ${String(bundle.device_id)}::uuid, ${String(bundle.bundle_id)}::uuid,
          ${event.clientEventId}, ${event.bid}, null, ${event.sunPayloadHash}, 'SYNC_PENDING', 'received',
          'SYNC_PROCESSING', null, ${payloadHash}, ${event.capturedAt}::timestamptz, ${JSON.stringify(initialMetadata)}::jsonb
        )
        ON CONFLICT (tenant_id, device_id, client_event_id) DO NOTHING
        RETURNING id::text AS id
      `;

      let offlineScanEventId = firstString(inserted[0]?.id);
      let freshReservation = Boolean(offlineScanEventId);
      if (!offlineScanEventId) {
        const existingRows = await sql/*sql*/`
          SELECT id::text AS id, bundle_id::text AS bundle_id, bid, sun_payload_hash, payload_hash,
                 server_verdict, metadata_json, observed_at, received_at
          FROM offline_scan_events
          WHERE tenant_id = ${auth.context.tenantId}::uuid
            AND device_id = ${String(bundle.device_id)}::uuid
            AND client_event_id = ${event.clientEventId}
          LIMIT 1
        `;
        const existing = existingRows[0] as Record<string, unknown> | undefined;
        const existingObservedAt = existing?.observed_at ? new Date(String(existing.observed_at)).toISOString() : "";
        const legacyEvidenceMatch = existingObservedAt === event.capturedAt
          && [event.sunPayloadHash, event.legacyCapturedUrlHash].includes(firstString(existing?.sun_payload_hash));
        if (
          !existing
          || firstString(existing.bundle_id) !== String(bundle.bundle_id)
          || firstString(existing.bid) !== event.bid
          || (firstString(existing.payload_hash) !== payloadHash && !legacyEvidenceMatch)
        ) {
          results.push(rejectedReceipt(event.clientEventId, event.bid, "offline_sync_idempotency_conflict", "SYNC_CONFLICT"));
          continue;
        }
        offlineScanEventId = firstString(existing.id);
        const storedReceipt = readStoredOfflineSyncReceipt(existing.metadata_json);
        if (
          storedReceipt
          && storedReceipt.client_event_id === event.clientEventId
          && storedReceipt.bid === event.bid
        ) {
          results.push(storedReceipt);
          continue;
        }
        const existingVerdict = firstString(existing.server_verdict).toUpperCase();
        const recoveredRows = await sql/*sql*/`
          SELECT event.id::text AS event_id, event.result, event.cmac_ok, event.allowlisted,
                 event.uid_hex, event.sdm_read_ctr, event.created_at
          FROM events event
          JOIN batches batch ON batch.id = event.batch_id
          WHERE batch.tenant_id = ${auth.context.tenantId}::uuid
            AND batch.bid = ${event.bid}
            AND event.raw_url_hash = ${event.sunPayloadHash}
            AND event.meta->>'offline_scan_event_id' = ${offlineScanEventId}
          ORDER BY event.created_at ASC, event.id ASC
          LIMIT 1
        `;
        const recovered = recoveredRows[0] as Record<string, unknown> | undefined;
        if (recovered) {
          const recoveredResult = firstString(recovered.result).toUpperCase();
          const recoveredStatus = recoveredResult.includes("REPLAY") ? 409 : recovered.cmac_ok === true ? 200 : 403;
          const receipt = redactOfflineSunVerification({
            clientEventId: event.clientEventId,
            bid: event.bid,
            verifiedAt: new Date(String(recovered.created_at)).toISOString(),
            replayed: true,
            result: {
              status: recoveredStatus,
              body: {
                ok: recoveredStatus === 200,
                result: recoveredResult,
                product_state: recoveredResult,
                cryptographic_verification: recovered.cmac_ok === true,
                allowlisted: recovered.allowlisted,
                uid: recovered.uid_hex,
                ctr: recovered.sdm_read_ctr,
                event_id: recovered.event_id,
              },
            },
          });
          await sql/*sql*/`
            UPDATE offline_scan_events
            SET server_verdict = ${receipt.sync_status}, reason = ${receipt.reason},
                metadata_json = metadata_json || ${JSON.stringify({
                  verification_receipt: receipt,
                  sync_completed_at: receipt.verified_at,
                  recovered_from_canonical_sun_event: true,
                })}::jsonb
            WHERE id = ${offlineScanEventId}::uuid
              AND tenant_id = ${auth.context.tenantId}::uuid
          `;
          results.push(receipt);
          continue;
        }
        if (["SYNCED_VALID", "SYNCED_INVALID", "REPLAY_SUSPECT"].includes(existingVerdict)) {
          results.push(rejectedReceipt(event.clientEventId, event.bid, "offline_sync_terminal_receipt_unavailable"));
          continue;
        }
        if (["SYNC_PENDING", "SYNC_REVIEW_REQUIRED", "SYNC_FAILED"].includes(existingVerdict)) {
          const claimed = await sql/*sql*/`
            UPDATE offline_scan_events
            SET server_verdict = 'SYNC_PROCESSING', reason = null,
                received_at = now(),
                sun_payload_hash = ${event.sunPayloadHash}, payload_hash = ${payloadHash},
                metadata_json = metadata_json || ${JSON.stringify({
                  ...initialMetadata,
                  processing_started_at: new Date().toISOString(),
                })}::jsonb
            WHERE id = ${offlineScanEventId}::uuid
              AND tenant_id = ${auth.context.tenantId}::uuid
              AND server_verdict IN ('SYNC_PENDING', 'SYNC_REVIEW_REQUIRED', 'SYNC_FAILED')
            RETURNING id::text AS id
          `;
          freshReservation = claimed.length > 0;
        }
        if (existingVerdict === "SYNC_PROCESSING") {
          const receivedAt = new Date(String(existing.received_at || "")).getTime();
          if (Number.isFinite(receivedAt) && Date.now() - receivedAt >= SDK_OFFLINE_SYNC_PROCESSING_LEASE_MS) {
            const reclaimed = await sql/*sql*/`
              UPDATE offline_scan_events
              SET received_at = now(), reason = null,
                  metadata_json = metadata_json || ${JSON.stringify({
                    processing_started_at: new Date().toISOString(),
                    processing_lease_recovered: true,
                  })}::jsonb
              WHERE id = ${offlineScanEventId}::uuid
                AND tenant_id = ${auth.context.tenantId}::uuid
                AND server_verdict = 'SYNC_PROCESSING'
                AND received_at < now() - interval '5 minutes'
              RETURNING id::text AS id
            `;
            freshReservation = reclaimed.length > 0;
          }
        }
        if (!freshReservation) {
          results.push(processingReceipt(event.clientEventId, event.bid));
          continue;
        }
      }

      try {
        const requestMeta = getRequestMeta(req);
        const syncStartedAt = new Date().toISOString();
        const sunResult = await processSunScan({
          bid: event.bid,
          piccDataHex: event.piccDataHex,
          encHex: event.encHex,
          cmacHex: event.cmacHex,
          rawQuery: {
            bid: event.bid,
            picc_data: event.piccDataHex,
            enc: event.encHex,
            cmac: event.cmacHex,
          },
          expectedTenantId: auth.context.tenantId,
          context: {
            source: "real",
            requestId: auth.context.traceId,
            ip: requestMeta.ip,
            userAgent: req.headers.get("user-agent"),
            lat: event.approximateLocation?.lat,
            lng: event.approximateLocation?.lng,
            deviceLabel: "nexid-sdk-offline-operator",
            meta: {
              sdk: true,
              offline_level: 2,
              offline_scan_event_id: offlineScanEventId,
              offline_client_event_id: event.clientEventId,
              offline_captured_at: event.capturedAt,
              offline_sync_started_at: syncStartedAt,
              api_key_id: auth.context.apiKeyId,
              tenant_slug: auth.context.tenantSlug,
              device_id: bundle.device_id,
              bundle_id: bundle.bundle_id,
              operator_ref: bundle.operator_ref || null,
              approximate_location_accuracy_m: event.approximateLocation?.accuracy_m ?? null,
            },
          },
        });
        const receipt = redactOfflineSunVerification({
          clientEventId: event.clientEventId,
          bid: event.bid,
          result: sunResult,
        });
        const finalized = await sql/*sql*/`
          UPDATE offline_scan_events
          SET server_verdict = ${receipt.sync_status}, reason = ${receipt.reason},
              metadata_json = metadata_json || ${JSON.stringify({
                verification_receipt: receipt,
                sync_completed_at: receipt.verified_at,
              })}::jsonb
          WHERE id = ${offlineScanEventId}::uuid
            AND tenant_id = ${auth.context.tenantId}::uuid
            AND server_verdict = 'SYNC_PROCESSING'
          RETURNING id::text AS id
        `;
        if (!finalized[0]?.id) throw new Error("offline_sync_finalize_conflict");
        results.push(receipt);
      } catch {
        await sql/*sql*/`
          UPDATE offline_scan_events
          SET server_verdict = 'SYNC_FAILED', reason = 'backend_verification_unavailable',
              metadata_json = metadata_json || ${JSON.stringify({
                last_failure: "backend_verification_unavailable",
                last_failure_at: new Date().toISOString(),
              })}::jsonb
          WHERE id = ${offlineScanEventId}::uuid
            AND tenant_id = ${auth.context.tenantId}::uuid
            AND server_verdict = 'SYNC_PROCESSING'
        `;
        results.push(rejectedReceipt(event.clientEventId, event.bid, "backend_verification_unavailable"));
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
      schema_version: SDK_OFFLINE_SYNC_SCHEMA_VERSION,
      final_verdict_source: "backend_sun_sdm",
      received: results.filter((item) => item.ok === true && item.replayed !== true).length,
      duplicates: results.filter((item) => item.replayed === true).length,
      verified: results.filter((item) => item.final_verdict === true).length,
      valid: results.filter((item) => item.sync_status === "SYNCED_VALID").length,
      invalid: results.filter((item) => ["SYNCED_INVALID", "REPLAY_SUSPECT"].includes(String(item.sync_status))).length,
      pending: results.filter((item) => item.final_verdict !== true && item.ok === true).length,
      rejected: results.filter((item) => item.ok !== true).length,
      results,
      trace_id: auth.context.traceId,
    }, 200, { ...NO_STORE, "x-nexid-trace-id": auth.context.traceId });
  } catch {
    console.error("[sdk_offline_sync_failed]");
    return json({ ok: false, reason: "offline_sync_unavailable", trace_id: auth.context.traceId }, 500, NO_STORE);
  }
}
