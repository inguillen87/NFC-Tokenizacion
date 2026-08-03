export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission } from "../../../../lib/auth";
import { resolveAdminProofTenantScope } from "../../../../lib/admin-proof-tenant-scope";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { findForbiddenProofPayloadKey, hashEvidencePayload } from "../../../../lib/proof-layer";
import {
  assertProofProviderEventPolicy,
  ProofEventPolicyError,
} from "../../../../lib/proof-event-policy";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

function safeString(value: unknown) {
  return String(value || "").trim();
}

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "proof:read");
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const url = new URL(req.url);
  const requestedTenant = safeString(url.searchParams.get("tenant"));
  const tenantScope = await resolveAdminProofTenantScope(req, requestedTenant);
  if (tenantScope.requested && !tenantScope.found) {
    return json({ ok: false, reason: "tenant_not_found", events: [] }, 404);
  }

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 60), 1), 200);
  const resourceType = safeString(url.searchParams.get("resource_type"));
  const resourceId = safeString(url.searchParams.get("resource_id"));
  const rows = tenantScope.tenantId
    ? await sql/*sql*/`
        SELECT id, resource_type, resource_id, event_type, payload_hash, created_at
        FROM evidence_events
        WHERE tenant_id = ${tenantScope.tenantId}::uuid
          AND (${resourceType || null}::text IS NULL OR resource_type = ${resourceType})
          AND (${resourceId || null}::text IS NULL OR resource_id = ${resourceId})
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql/*sql*/`
        SELECT id, resource_type, resource_id, event_type, payload_hash, created_at
        FROM evidence_events
        WHERE (${resourceType || null}::text IS NULL OR resource_type = ${resourceType})
          AND (${resourceId || null}::text IS NULL OR resource_id = ${resourceId})
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

  return json({ ok: true, events: rows });
}

export async function POST(req: Request) {
  const auth = await checkAdminWithPermission(req, "proof:write");
  if (auth) return auth;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;
  await ensureSupplierOpsSchema();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedTenant = safeString(body.tenant_id || body.tenant_slug || body.tenantId || body.tenant);
  const tenantScope = await resolveAdminProofTenantScope(req, requestedTenant);
  if (tenantScope.requested && !tenantScope.found) {
    return json({ ok: false, reason: "tenant_not_found" }, 404);
  }
  if (!tenantScope.requested) {
    return json({ ok: false, reason: "tenant_required" }, 400);
  }
  const tenantId = tenantScope.tenantId;

  const requestedResourceType = safeString(body.resource_type || body.resourceType);
  const resourceId = safeString(body.resource_id || body.resourceId);
  const requestedEventType = safeString(body.event_type || body.eventType);
  const providerPreference = safeString(body.provider_preference || body.providerPreference || "none");
  const rawPayload = body.payload || body.payload_json || {};

  if (!requestedResourceType || !resourceId || !requestedEventType) {
    return json({ ok: false, reason: "event_identity_required" }, 400);
  }
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return json({ ok: false, reason: "proof_payload_object_required" }, 400);
  }
  const payload = rawPayload as Record<string, unknown>;

  let policy;
  try {
    policy = assertProofProviderEventPolicy({
      provider: providerPreference,
      eventType: requestedEventType,
      resourceType: requestedResourceType,
    });
  } catch (error) {
    if (error instanceof ProofEventPolicyError) {
      return json({ ok: false, reason: error.code, field: error.field || null }, 400);
    }
    throw error;
  }
  const { eventType, resourceType } = policy;

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
    event_type: eventType,
    resource_type: resourceType,
  }, 201);
}
