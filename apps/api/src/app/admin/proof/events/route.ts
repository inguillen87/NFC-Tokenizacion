export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { findForbiddenProofPayloadKey, hashEvidencePayload } from "../../../../lib/proof-layer";

function safeString(value: unknown) {
  return String(value || "").trim();
}

export async function POST(req: Request) {
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  
  let tenantId: string | null = null;
  const requestedTenant = safeString(body.tenant_id || body.tenant_slug || body.tenantId || body.tenant);
  
  if (forcedTenantSlug) {
    const rows = await sql/*sql*/`SELECT id FROM tenants WHERE slug = ${forcedTenantSlug} LIMIT 1`;
    tenantId = rows[0]?.id || null;
  } else if (requestedTenant) {
    const rows = /^[0-9a-f-]{36}$/i.test(requestedTenant)
      ? await sql/*sql*/`SELECT id FROM tenants WHERE id = ${requestedTenant}::uuid LIMIT 1`
      : await sql/*sql*/`SELECT id FROM tenants WHERE slug = ${requestedTenant.toLowerCase()} LIMIT 1`;
    tenantId = rows[0]?.id || null;
  }

  const resourceType = safeString(body.resource_type || body.resourceType);
  const resourceId = safeString(body.resource_id || body.resourceId);
  const eventType = safeString(body.event_type || body.eventType);
  const payload = (body.payload || body.payload_json || {}) as Record<string, unknown>;

  if (!resourceType || !resourceId || !eventType) {
    return json({ ok: false, reason: "event_identity_required" }, 400);
  }

  const forbiddenKey = findForbiddenProofPayloadKey(payload);
  if (forbiddenKey) {
    return json({ ok: false, reason: "proof_payload_sensitive_key_rejected", key: forbiddenKey }, 400);
  }

  const payloadHash = hashEvidencePayload({
    tenantId,
    resourceType,
    resourceId,
    eventType,
    payload,
  });

  const rows = await sql/*sql*/`
    INSERT INTO evidence_events (tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash)
    VALUES (${tenantId}, ${resourceType}, ${resourceId}, ${eventType}, ${JSON.stringify(payload)}::jsonb, ${payloadHash})
    ON CONFLICT (payload_hash) DO UPDATE SET payload_hash = EXCLUDED.payload_hash
    RETURNING id, payload_hash, resource_type, resource_id, event_type, created_at
  `;
  const eventRow = rows[0];

  await logAuditEvent({
    actorId: null,
    tenantId,
    action: "proof_event_created",
    resourceType: "evidence_event",
    resourceId: String(eventRow.id),
    afterData: {
      event_type: eventType,
      resource_type: resourceType,
      resource_id: resourceId,
      payload_hash: payloadHash,
    },
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({
    ok: true,
    proof_event_id: eventRow.id,
    payload_hash: eventRow.payload_hash,
  }, 201);
}
