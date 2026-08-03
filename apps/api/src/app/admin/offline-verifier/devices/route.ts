export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, checkAdminPermission, getAdminActor, getAdminTenantScope } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import {
  hashOfflineIdentifier,
  OFFLINE_DEVICE_ENROLLMENT_BODY_MAX_BYTES,
  offlineVerifierBundleIssuanceEnabled,
  requireOfflineJsonObject,
} from "../../../../lib/offline-verifier";

const NO_STORE = { "cache-control": "no-store" };

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

async function resolveTenant(input: string) {
  const normalized = input.trim();
  if (!normalized) return null;
  const rows = /^[0-9a-f-]{36}$/i.test(normalized)
    ? await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE id = ${normalized}::uuid LIMIT 1`
    : await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE slug = ${normalized.toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "supplier:offline_verifier");
  if (permission) return permission;
  await ensureSupplierOpsSchema();

  const url = new URL(req.url);
  const requestedTenant = firstString(url.searchParams.get("tenant"), url.searchParams.get("tenant_slug"), url.searchParams.get("tenant_id"));
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const rows = forcedTenantSlug
    ? await sql/*sql*/`
        SELECT ovd.id, ovd.device_label, ovd.device_type, ovd.device_fingerprint, ovd.operator_ref,
               ovd.status, ovd.last_seen_at, ovd.created_at, t.slug AS tenant_slug
        FROM offline_verifier_devices ovd
        JOIN tenants t ON t.id = ovd.tenant_id
        WHERE t.slug = ${forcedTenantSlug}
        ORDER BY ovd.created_at DESC
        LIMIT 100
      `
    : requestedTenant
      ? await sql/*sql*/`
          SELECT ovd.id, ovd.device_label, ovd.device_type, ovd.device_fingerprint, ovd.operator_ref,
                 ovd.status, ovd.last_seen_at, ovd.created_at, t.slug AS tenant_slug
          FROM offline_verifier_devices ovd
          JOIN tenants t ON t.id = ovd.tenant_id
          WHERE t.slug = ${requestedTenant.toLowerCase()} OR t.id::text = ${requestedTenant}
          ORDER BY ovd.created_at DESC
          LIMIT 100
        `
      : await sql/*sql*/`
        SELECT ovd.id, ovd.device_label, ovd.device_type, ovd.device_fingerprint, ovd.operator_ref,
               ovd.status, ovd.last_seen_at, ovd.created_at, t.slug AS tenant_slug
        FROM offline_verifier_devices ovd
        JOIN tenants t ON t.id = ovd.tenant_id
        ORDER BY ovd.created_at DESC
        LIMIT 100
      `;

  return json({ ok: true, devices: rows });
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
      await readBoundedJsonBody<unknown>(req, OFFLINE_DEVICE_ENROLLMENT_BODY_MAX_BYTES),
    );
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400, NO_STORE);
  }
  await ensureSupplierOpsSchema();
  const tenantInput = firstString(body.tenant_id, body.tenantId, body.tenant_slug, body.tenantSlug, body.tenant);
  const tenant = await resolveTenant(tenantInput);
  if (!tenant) return json({ ok: false, reason: "tenant_not_found" }, 404);

  const { forcedTenantSlug } = getAdminTenantScope(req);
  if (forcedTenantSlug && String(tenant.slug || "").toLowerCase() !== forcedTenantSlug) {
    return json({ ok: false, reason: "tenant_scope_forbidden" }, 403);
  }

  const deviceLabel = firstString(body.device_label, body.deviceLabel, body.label);
  const deviceType = firstString(body.device_type, body.deviceType, "field_app");
  const fingerprintSource = firstString(body.device_fingerprint, body.deviceFingerprint, body.device_public_key, body.devicePublicKey, body.device_serial, body.deviceSerial);
  if (!deviceLabel || !fingerprintSource) {
    return json({
      ok: false,
      reason: "offline_device_identity_required",
      required: ["device_label", "device_fingerprint or device_public_key"],
    }, 400);
  }

  const deviceFingerprint = hashOfflineIdentifier(fingerprintSource, "offline-device");
  const operatorRef = firstString(body.operator_ref, body.operatorRef, body.operator) || null;
  const metadata = {
    app_version: firstString(body.app_version, body.appVersion) || null,
    platform: firstString(body.platform) || null,
    enrolled_by: getAdminActor(req).email,
  };

  const rows = await sql/*sql*/`
    INSERT INTO offline_verifier_devices (
      tenant_id, device_label, device_type, device_fingerprint, operator_ref, status, metadata_json
    ) VALUES (
      ${tenant.id}, ${deviceLabel}, ${deviceType}, ${deviceFingerprint}, ${operatorRef}, 'active', ${JSON.stringify(metadata)}::jsonb
    )
    ON CONFLICT (tenant_id, device_fingerprint) DO UPDATE SET
      device_label = EXCLUDED.device_label,
      device_type = EXCLUDED.device_type,
      operator_ref = EXCLUDED.operator_ref,
      status = 'active',
      metadata_json = offline_verifier_devices.metadata_json || EXCLUDED.metadata_json,
      updated_at = now()
    RETURNING id, tenant_id, device_label, device_type, device_fingerprint, operator_ref, status, created_at, updated_at
  `;
  const device = rows[0];

  await logAuditEvent({
    actorId: null,
    tenantId: String(tenant.id),
    action: "offline_verifier_device_enrolled",
    resourceType: "offline_verifier_device",
    resourceId: String(device.id),
    afterData: {
      device_id: device.id,
      device_label: device.device_label,
      device_type: device.device_type,
      device_fingerprint: device.device_fingerprint,
      operator_ref: device.operator_ref,
      enrolled_by: getAdminActor(req).email,
    },
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({
    ok: true,
    device: {
      id: device.id,
      tenant_slug: tenant.slug,
      device_label: device.device_label,
      device_type: device.device_type,
      device_fingerprint: device.device_fingerprint,
      operator_ref: device.operator_ref,
      status: device.status,
    },
  });
}
