export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminActor, getAdminTenantScope } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import {
  buildOfflineBundleRef,
  normalizeOfflineBids,
  normalizeOfflineBundleExpiry,
  OFFLINE_BUNDLE_ISSUANCE_BODY_MAX_BYTES,
  offlineVerifierBundleIssuanceEnabled,
  requireOfflineJsonObject,
} from "../../../../lib/offline-verifier";
import { hashEvidencePayload } from "../../../../lib/proof-layer";

const NO_STORE = { "cache-control": "no-store" };

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;
  if (!offlineVerifierBundleIssuanceEnabled()) {
    return json({ ok: false, reason: "offline_verifier_bundles_disabled" }, 503, NO_STORE);
  }

  let body: Record<string, unknown>;
  try {
    body = requireOfflineJsonObject(
      await readBoundedJsonBody<unknown>(req, OFFLINE_BUNDLE_ISSUANCE_BODY_MAX_BYTES),
    );
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400, NO_STORE);
  }
  await ensureSupplierOpsSchema();
  const deviceId = firstString(body.device_id, body.deviceId);
  if (!/^[0-9a-f-]{36}$/i.test(deviceId)) return json({ ok: false, reason: "device_id_required" }, 400);

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const deviceRows = forcedTenantSlug
    ? await sql/*sql*/`
        SELECT ovd.*, t.slug AS tenant_slug
        FROM offline_verifier_devices ovd
        JOIN tenants t ON t.id = ovd.tenant_id
        WHERE ovd.id = ${deviceId}::uuid AND t.slug = ${forcedTenantSlug}
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT ovd.*, t.slug AS tenant_slug
        FROM offline_verifier_devices ovd
        JOIN tenants t ON t.id = ovd.tenant_id
        WHERE ovd.id = ${deviceId}::uuid
        LIMIT 1
      `;
  const device = deviceRows[0];
  if (!device) return json({ ok: false, reason: "offline_device_not_found" }, 404);
  if (device.status !== "active") return json({ ok: false, reason: "offline_device_not_active" }, 409);

  let bids: string[];
  let expiresAt: string;
  try {
    bids = normalizeOfflineBids(body.bids || body.bid || body.batch_ids || body.batchIds);
    expiresAt = normalizeOfflineBundleExpiry(body.expires_at || body.expiresAt);
  } catch (error) {
    return json({ ok: false, reason: error instanceof Error ? error.message : "offline_bundle_invalid" }, 400);
  }

  const subBatchRows = await sql/*sql*/`
    SELECT
      ssb.id,
      ssb.bid,
      ssb.expected_quantity,
      ssb.manifest_status,
      ssb.qa_status,
      bk.key_fingerprint AS pair_key_fingerprint,
      COALESCE(
        jsonb_object_agg(bkm.key_role, bkm.key_fingerprint) FILTER (WHERE bkm.id IS NOT NULL),
        '{}'::jsonb
      ) AS role_key_fingerprints
    FROM supplier_sub_batches ssb
    LEFT JOIN batch_keys bk ON bk.supplier_sub_batch_id = ssb.id
    LEFT JOIN batch_key_material bkm ON bkm.supplier_sub_batch_id = ssb.id AND bkm.status = 'active'
    WHERE ssb.tenant_id = ${device.tenant_id} AND ssb.bid = ANY(${bids})
    GROUP BY ssb.id, ssb.bid, ssb.expected_quantity, ssb.manifest_status, ssb.qa_status, bk.key_fingerprint
    ORDER BY ssb.bid ASC
  `;
  const found = new Set(subBatchRows.map((row) => String(row.bid)));
  const missing = bids.filter((bid) => !found.has(bid));
  if (missing.length) {
    return json({
      ok: false,
      reason: "offline_bundle_bid_not_found",
      missing_bids: missing,
      message: "Offline bundles can only reference supplier sub-batches owned by the device tenant.",
    }, 404);
  }

  const keyFingerprints = Object.fromEntries(subBatchRows.map((row) => [
    String(row.bid),
    {
      pair: row.pair_key_fingerprint || null,
      roles: row.role_key_fingerprints || {},
    },
  ]));
  const policy = {
    contains_key_material: false,
    local_verdict_model: "provisional_until_backend_sync",
    allowed_local_verdicts: ["OFFLINE_LOCAL_PASS", "OFFLINE_LOCAL_FAIL", "SYNC_PENDING"],
    requires_backend_sync_for: ["replay", "ownership", "warranty", "crm", "proof_anchor"],
  };
  const bundleRef = buildOfflineBundleRef();
  const bundleHash = hashEvidencePayload({
    tenantId: String(device.tenant_id),
    resourceType: "offline_verifier_bundle",
    resourceId: bundleRef,
    eventType: "offline_bundle_issued",
    payload: {
      device_id: device.id,
      bids,
      key_fingerprints: keyFingerprints,
      expires_at: expiresAt,
      policy,
    },
  });

  const bundleRows = await sql/*sql*/`
    INSERT INTO offline_verifier_bundles (
      tenant_id, device_id, bundle_ref, allowed_bids_json, key_fingerprints_json,
      policy_json, bundle_hash, status, issued_by, expires_at
    ) VALUES (
      ${device.tenant_id}, ${device.id}, ${bundleRef}, ${JSON.stringify(bids)}::jsonb,
      ${JSON.stringify(keyFingerprints)}::jsonb, ${JSON.stringify(policy)}::jsonb, ${bundleHash},
      'active', ${getAdminActor(req).email}, ${expiresAt}::timestamptz
    )
    RETURNING id, bundle_ref, allowed_bids_json, key_fingerprints_json, policy_json, bundle_hash, status, expires_at, created_at
  `;
  const bundle = bundleRows[0];

  await logAuditEvent({
    actorId: null,
    tenantId: String(device.tenant_id),
    action: "offline_verifier_bundle_issued",
    resourceType: "offline_verifier_bundle",
    resourceId: String(bundle.id),
    afterData: {
      bundle_id: bundle.id,
      bundle_ref: bundle.bundle_ref,
      device_id: device.id,
      allowed_bids: bids,
      bundle_hash: bundle.bundle_hash,
      contains_key_material: false,
      issued_by: getAdminActor(req).email,
      expires_at: bundle.expires_at,
    },
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({
    ok: true,
    bundle: {
      id: bundle.id,
      bundle_ref: bundle.bundle_ref,
      tenant_slug: device.tenant_slug,
      device_id: device.id,
      allowed_bids: bundle.allowed_bids_json,
      key_fingerprints: bundle.key_fingerprints_json,
      key_material_included: false,
      policy: bundle.policy_json,
      bundle_hash: bundle.bundle_hash,
      status: bundle.status,
      expires_at: bundle.expires_at,
      created_at: bundle.created_at,
    },
    warning: "This bundle is for low-connectivity workflow control only. It does not include K_META_BATCH, K_FILE_BATCH or tenant master keys; local verdicts remain provisional until backend sync.",
  });
}
