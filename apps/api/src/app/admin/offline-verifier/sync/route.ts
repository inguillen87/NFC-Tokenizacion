export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, checkAdminPermission, getAdminActor, getAdminTenantScope } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import {
  decodeOfflineHistoryCursor,
  encodeOfflineHistoryCursor,
  normalizeOfflineHash,
  normalizeOfflineHistoryLimit,
  normalizeOfflineLocalVerdict,
  normalizeOfflineObservedAt,
  OFFLINE_ADMIN_SYNC_BODY_MAX_BYTES,
  requireOfflineJsonObject,
} from "../../../../lib/offline-verifier";
import { findForbiddenProofPayloadKey, hashEvidencePayload } from "../../../../lib/proof-layer";

const NO_STORE = { "cache-control": "no-store" };
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function readEvents(value: unknown) {
  if (!Array.isArray(value)) throw new Error("events_required");
  if (!value.length) throw new Error("events_required");
  if (value.length > 500) throw new Error("events_max_500");
  if (value.some((event) => !event || typeof event !== "object" || Array.isArray(event))) {
    throw new Error("events_invalid");
  }
  return value as Record<string, unknown>[];
}

type SyncResult = {
  ok: boolean;
  client_event_id: string | null;
  bid?: string;
  reason?: string | null;
  key?: string;
  sync_status?: "received" | "duplicate";
  server_verdict?: string;
  final?: false;
  payload_hash?: string;
};

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "supplier:offline_verifier");
  if (permission) return permission;

  const url = new URL(req.url);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const requestedTenantSlug = firstString(
    url.searchParams.get("tenant"),
    url.searchParams.get("tenant_slug"),
  ).toLowerCase();
  const tenantSlug = forcedTenantSlug || requestedTenantSlug;
  if (!tenantSlug) {
    return json({ ok: false, reason: "tenant_scope_required" }, 400, NO_STORE);
  }
  if (!TENANT_SLUG_PATTERN.test(tenantSlug)) {
    return json({ ok: false, reason: "tenant_scope_invalid" }, 400, NO_STORE);
  }

  let limit: number;
  let cursor: ReturnType<typeof decodeOfflineHistoryCursor>;
  try {
    limit = normalizeOfflineHistoryLimit(url.searchParams.get("limit"));
    cursor = decodeOfflineHistoryCursor(url.searchParams.get("cursor"));
  } catch (error) {
    return json({
      ok: false,
      reason: error instanceof Error ? error.message : "offline_history_query_invalid",
    }, 400, NO_STORE);
  }

  const tenantRows = await sql/*sql*/`
    SELECT id, slug
    FROM tenants
    WHERE slug = ${tenantSlug}
    LIMIT 1
  `;
  const tenant = tenantRows[0];
  if (!tenant) return json({ ok: false, reason: "tenant_not_found" }, 404, NO_STORE);

  const rows = cursor
    ? await sql/*sql*/`
        SELECT
          ose.id,
          ose.bid,
          ose.local_verdict,
          ose.sync_status,
          ose.server_verdict,
          ose.reason,
          ose.observed_at,
          ose.received_at,
          ovd.id AS device_id,
          ovd.device_label,
          ovd.device_type,
          ovb.id AS bundle_id,
          ovb.bundle_ref,
          t.slug AS tenant_slug
        FROM offline_scan_events ose
        JOIN offline_verifier_devices ovd ON ovd.id = ose.device_id AND ovd.tenant_id = ose.tenant_id
        JOIN offline_verifier_bundles ovb ON ovb.id = ose.bundle_id AND ovb.tenant_id = ose.tenant_id
        JOIN tenants t ON t.id = ose.tenant_id
        WHERE ose.tenant_id = ${tenant.id}
          AND (ose.received_at, ose.id) < (${cursor.receivedAt}::timestamptz, ${cursor.id}::uuid)
        ORDER BY ose.received_at DESC, ose.id DESC
        LIMIT ${limit + 1}
      `
    : await sql/*sql*/`
        SELECT
          ose.id,
          ose.bid,
          ose.local_verdict,
          ose.sync_status,
          ose.server_verdict,
          ose.reason,
          ose.observed_at,
          ose.received_at,
          ovd.id AS device_id,
          ovd.device_label,
          ovd.device_type,
          ovb.id AS bundle_id,
          ovb.bundle_ref,
          t.slug AS tenant_slug
        FROM offline_scan_events ose
        JOIN offline_verifier_devices ovd ON ovd.id = ose.device_id AND ovd.tenant_id = ose.tenant_id
        JOIN offline_verifier_bundles ovb ON ovb.id = ose.bundle_id AND ovb.tenant_id = ose.tenant_id
        JOIN tenants t ON t.id = ose.tenant_id
        WHERE ose.tenant_id = ${tenant.id}
        ORDER BY ose.received_at DESC, ose.id DESC
        LIMIT ${limit + 1}
      `;

  const events = rows.slice(0, limit);
  const last = events.at(-1);
  const hasMore = rows.length > limit;
  const nextCursor = hasMore && last
    ? encodeOfflineHistoryCursor({
        receivedAt: new Date(String(last.received_at)).toISOString(),
        id: String(last.id),
      })
    : null;

  return json({
    ok: true,
    tenant_slug: String(tenant.slug),
    events,
    page: {
      limit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  }, 200, NO_STORE);
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "supplier:offline_verifier");
  if (permission) return permission;

  let body: Record<string, unknown>;
  try {
    body = requireOfflineJsonObject(
      await readBoundedJsonBody<unknown>(req, OFFLINE_ADMIN_SYNC_BODY_MAX_BYTES),
    );
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400, NO_STORE);
  }
  await ensureSupplierOpsSchema();
  const bundleRef = firstString(body.bundle_ref, body.bundleRef);
  const bundleId = firstString(body.bundle_id, body.bundleId);
  if (!bundleRef && !/^[0-9a-f-]{36}$/i.test(bundleId)) {
    return json({ ok: false, reason: "bundle_ref_or_id_required" }, 400);
  }

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const bundleRows = bundleRef
    ? forcedTenantSlug
      ? await sql/*sql*/`
          SELECT ovb.*, ovd.device_label, ovd.device_fingerprint, t.slug AS tenant_slug
          FROM offline_verifier_bundles ovb
          JOIN offline_verifier_devices ovd ON ovd.id = ovb.device_id
          JOIN tenants t ON t.id = ovb.tenant_id
          WHERE ovb.bundle_ref = ${bundleRef} AND t.slug = ${forcedTenantSlug}
          LIMIT 1
        `
      : await sql/*sql*/`
          SELECT ovb.*, ovd.device_label, ovd.device_fingerprint, t.slug AS tenant_slug
          FROM offline_verifier_bundles ovb
          JOIN offline_verifier_devices ovd ON ovd.id = ovb.device_id
          JOIN tenants t ON t.id = ovb.tenant_id
          WHERE ovb.bundle_ref = ${bundleRef}
          LIMIT 1
        `
    : forcedTenantSlug
      ? await sql/*sql*/`
          SELECT ovb.*, ovd.device_label, ovd.device_fingerprint, t.slug AS tenant_slug
          FROM offline_verifier_bundles ovb
          JOIN offline_verifier_devices ovd ON ovd.id = ovb.device_id
          JOIN tenants t ON t.id = ovb.tenant_id
          WHERE ovb.id = ${bundleId}::uuid AND t.slug = ${forcedTenantSlug}
          LIMIT 1
        `
      : await sql/*sql*/`
          SELECT ovb.*, ovd.device_label, ovd.device_fingerprint, t.slug AS tenant_slug
          FROM offline_verifier_bundles ovb
          JOIN offline_verifier_devices ovd ON ovd.id = ovb.device_id
          JOIN tenants t ON t.id = ovb.tenant_id
          WHERE ovb.id = ${bundleId}::uuid
          LIMIT 1
        `;
  const bundle = bundleRows[0];
  if (!bundle) return json({ ok: false, reason: "offline_bundle_not_found" }, 404);
  if (bundle.status !== "active" || new Date(bundle.expires_at).getTime() <= Date.now()) {
    return json({
      ok: false,
      reason: "offline_bundle_not_active",
      status: bundle.status,
      expires_at: bundle.expires_at,
    }, 409);
  }

  let events: Record<string, unknown>[];
  try {
    events = readEvents(body.events);
  } catch (error) {
    return json({ ok: false, reason: error instanceof Error ? error.message : "events_invalid" }, 400);
  }

  const allowedBids = new Set((Array.isArray(bundle.allowed_bids_json) ? bundle.allowed_bids_json : []).map((item: unknown) => String(item)));
  const results: SyncResult[] = [];
  for (const event of events) {
    const forbiddenKey = findForbiddenProofPayloadKey(event);
    if (forbiddenKey) {
      results.push({
        ok: false,
        client_event_id: firstString(event.client_event_id, event.clientEventId, event.id) || null,
        reason: "raw_or_sensitive_payload_rejected",
        key: forbiddenKey,
      });
      continue;
    }

    const clientEventId = firstString(event.client_event_id, event.clientEventId, event.id);
    const bid = firstString(event.bid, event.batch_id, event.batchId);
    if (!clientEventId || !bid) {
      results.push({ ok: false, client_event_id: clientEventId || null, reason: "client_event_id_and_bid_required" });
      continue;
    }
    if (!allowedBids.has(bid)) {
      results.push({ ok: false, client_event_id: clientEventId, bid, reason: "bid_not_allowed_by_bundle" });
      continue;
    }

    try {
      const localVerdict = normalizeOfflineLocalVerdict(event.local_verdict || event.localVerdict);
      const observedAt = normalizeOfflineObservedAt(event.observed_at || event.observedAt);
      const uidHash = normalizeOfflineHash(event.uid_hash || event.uidHash, "uid_hash");
      const sunPayloadHash = normalizeOfflineHash(event.sun_payload_hash || event.sunPayloadHash, "sun_payload_hash");
      if (!uidHash && !sunPayloadHash) {
        results.push({ ok: false, client_event_id: clientEventId, bid, reason: "hashed_evidence_required" });
        continue;
      }
      const serverVerdict = localVerdict === "OFFLINE_LOCAL_FAIL" ? "SYNC_REVIEW_REQUIRED" : "SYNC_PENDING";
      const payloadHash = hashEvidencePayload({
        tenantId: String(bundle.tenant_id),
        resourceType: "offline_scan_event",
        resourceId: clientEventId,
        eventType: "offline_scan_synced",
        payload: {
          bundle_id: bundle.id,
          bid,
          uid_hash: uidHash,
          sun_payload_hash: sunPayloadHash,
          local_verdict: localVerdict,
          observed_at: observedAt,
        },
      });

      const inserted = await sql/*sql*/`
        INSERT INTO offline_scan_events (
          tenant_id, device_id, bundle_id, client_event_id, bid, uid_hash, sun_payload_hash,
          local_verdict, sync_status, server_verdict, reason, payload_hash, observed_at, metadata_json
        ) VALUES (
          ${bundle.tenant_id}, ${bundle.device_id}, ${bundle.id}, ${clientEventId}, ${bid}, ${uidHash},
          ${sunPayloadHash}, ${localVerdict}, 'received', ${serverVerdict}, null, ${payloadHash},
          ${observedAt}::timestamptz, ${JSON.stringify({
            synced_by: getAdminActor(req).email,
            app_version: firstString(event.app_version, event.appVersion) || null,
          })}::jsonb
        )
        ON CONFLICT (tenant_id, device_id, client_event_id) DO NOTHING
        RETURNING id
      `;

      results.push({
        ok: inserted.length > 0,
        client_event_id: clientEventId,
        bid,
        sync_status: inserted.length > 0 ? "received" : "duplicate",
        server_verdict: serverVerdict,
        final: false,
        payload_hash: payloadHash,
        reason: inserted.length > 0 ? null : "duplicate_client_event_id",
      });
    } catch (error) {
      results.push({
        ok: false,
        client_event_id: clientEventId,
        bid,
        reason: error instanceof Error ? error.message : "offline_event_invalid",
      });
    }
  }

  await sql/*sql*/`
    UPDATE offline_verifier_devices
    SET last_seen_at = now(), updated_at = now()
    WHERE id = ${bundle.device_id}
  `;

  await logAuditEvent({
    actorId: null,
    tenantId: String(bundle.tenant_id),
    action: "offline_verifier_events_synced",
    resourceType: "offline_verifier_bundle",
    resourceId: String(bundle.id),
    afterData: {
      bundle_id: bundle.id,
      bundle_ref: bundle.bundle_ref,
      received: results.filter((item) => item.ok).length,
      rejected: results.filter((item) => !item.ok).length,
      synced_by: getAdminActor(req).email,
      final_verdict: false,
    },
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({
    ok: true,
    bundle_ref: bundle.bundle_ref,
    tenant_slug: bundle.tenant_slug,
    received: results.filter((item) => item.ok).length,
    rejected: results.filter((item) => !item.ok).length,
    final_verdict: false,
    warning: "Offline events are provisional. This endpoint stores hashed evidence and queues backend policy/replay review; it does not certify ownership, warranty, CRM or proof anchors offline.",
    results,
  });
}
