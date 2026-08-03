export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission } from "../../../../lib/auth";
import { resolveAdminProofTenantScope } from "../../../../lib/admin-proof-tenant-scope";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { buildMerkleRoot, findForbiddenProofPayloadKey, hashEvidencePayload } from "../../../../lib/proof-layer";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";

type EvidenceEventRow = {
  id: string;
  payload_hash: string;
  resource_type: string;
  resource_id: string;
  event_type: string;
};

function safeString(value: unknown) {
  return String(value || "").trim();
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
  const requestedTenant = safeString(body.tenant_id || body.tenantId || body.tenant_slug || body.tenantSlug || body.tenant);
  const tenantScope = await resolveAdminProofTenantScope(req, requestedTenant);
  if (tenantScope.requested && !tenantScope.found) {
    return json({ ok: false, reason: "tenant_not_found" }, 404);
  }
  if (!tenantScope.requested) {
    return json({ ok: false, reason: "tenant_required" }, 400);
  }
  const tenantId = tenantScope.tenantId;
  const provider = safeString(body.provider || "none").toLowerCase();
  const network = safeString(body.network || (provider === "none" ? "local" : "testnet")).toLowerCase();

  const providerRows = await sql/*sql*/`
    SELECT *
    FROM ledger_providers
    WHERE code = ${provider} AND network = ${network}
    LIMIT 1
  `;
  const ledgerProvider = providerRows[0];
  if (!ledgerProvider) return json({ ok: false, reason: "ledger_provider_not_configured", provider, network }, 404);
  if (!ledgerProvider.enabled) {
    return json({
      ok: false,
      reason: "ledger_provider_disabled",
      provider,
      network,
      warning: provider === "iota" ? "IOTA testnet is disabled by default because testnets can reset." : undefined,
    }, 409);
  }
  if (!(provider === "none" && network === "local")) {
    return json({
      ok: false,
      reason: "external_anchor_adapter_not_enabled",
      provider,
      network,
      message: "Only provider=none/network=local is enabled until the external signer adapter is configured.",
    }, 501);
  }

  const eventIds = Array.isArray(body.event_ids)
    ? body.event_ids.map(safeString).filter(Boolean)
    : Array.isArray(body.eventIds)
      ? body.eventIds.map(safeString).filter(Boolean)
      : [];
  const inlineEvents = Array.isArray(body.events) ? body.events as Record<string, unknown>[] : [];
  let events: EvidenceEventRow[] = [];

  if (inlineEvents.length) {
    const inserted: EvidenceEventRow[] = [];
    for (const event of inlineEvents) {
      const resourceType = safeString(event.resource_type || event.resourceType);
      const resourceId = safeString(event.resource_id || event.resourceId);
      const eventType = safeString(event.event_type || event.eventType);
      const payload = (event.payload || event.payload_json || {}) as Record<string, unknown>;
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
        RETURNING id, payload_hash, resource_type, resource_id, event_type
      `;
      inserted.push(rows[0] as EvidenceEventRow);
    }
    events = inserted;
  } else if (eventIds.length) {
    const rows = tenantId
      ? await sql/*sql*/`
          SELECT id, payload_hash, resource_type, resource_id, event_type
          FROM evidence_events
          WHERE tenant_id = ${tenantId}::uuid AND id = ANY(${eventIds}::uuid[])
          ORDER BY created_at ASC
        `
      : await sql/*sql*/`
          SELECT id, payload_hash, resource_type, resource_id, event_type
          FROM evidence_events
          WHERE id = ANY(${eventIds}::uuid[])
          ORDER BY created_at ASC
        `;
    events = rows as EvidenceEventRow[];
    if (events.length !== new Set(eventIds).size) {
      return json({ ok: false, reason: "evidence_event_not_found" }, 404);
    }
  } else {
    const resourceType = safeString(body.resource_type || body.resourceType);
    const resourceId = safeString(body.resource_id || body.resourceId);
    if (!resourceType || !resourceId) {
      return json({ ok: false, reason: "events_or_resource_required" }, 400);
    }
    const rows = tenantId
      ? await sql/*sql*/`
          SELECT id, payload_hash, resource_type, resource_id, event_type
          FROM evidence_events
          WHERE tenant_id = ${tenantId}::uuid AND resource_type = ${resourceType} AND resource_id = ${resourceId}
          ORDER BY created_at ASC
        `
      : await sql/*sql*/`
          SELECT id, payload_hash, resource_type, resource_id, event_type
          FROM evidence_events
          WHERE resource_type = ${resourceType} AND resource_id = ${resourceId}
          ORDER BY created_at ASC
        `;
    events = rows as EvidenceEventRow[];
  }

  if (!events.length) return json({ ok: false, reason: "no_evidence_events_found" }, 404);
  const resourceKeys = new Set(events.map((event) => `${event.resource_type}\u0000${event.resource_id}`));
  if (resourceKeys.size !== 1) {
    return json({
      ok: false,
      reason: "mixed_resource_events",
      message: "An evidence receipt can only group events from the same resource.",
    }, 400);
  }
  const resourceType = events[0].resource_type;
  const resourceId = events[0].resource_id;
  const eventHashes = events.map((event) => String(event.payload_hash));
  const merkleRoot = buildMerkleRoot(eventHashes);
  const anchorRows = await sql/*sql*/`
    INSERT INTO evidence_anchors (
      tenant_id, provider, network, anchor_type, resource_type, resource_id, merkle_root,
      event_count, event_hashes_json, status, anchored_at
    ) VALUES (
      ${tenantId}, ${provider}, ${network}, 'merkle_root', ${resourceType}, ${resourceId},
      ${merkleRoot}, ${events.length}, ${JSON.stringify(eventHashes)}::jsonb, 'local', now()
    )
    RETURNING *
  `;
  const anchor = anchorRows[0];

  await logAuditEvent({
    actorId: null,
    tenantId,
    action: "proof_anchor_created",
    resourceType: "evidence_anchor",
    resourceId: String(anchor.id),
    afterData: {
      provider,
      network,
      resource_type: resourceType,
      resource_id: resourceId,
      event_count: events.length,
      merkle_root: merkleRoot,
      event_types: Array.from(new Set(events.map((event) => event.event_type))),
    },
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({
    ok: true,
    anchor: {
      id: anchor.id,
      provider,
      network,
      resource_type: resourceType,
      resource_id: resourceId,
      merkle_root: merkleRoot,
      event_count: events.length,
      status: anchor.status,
      anchored_at: anchor.anchored_at,
    },
    event_hashes: eventHashes,
  }, 201);
}
