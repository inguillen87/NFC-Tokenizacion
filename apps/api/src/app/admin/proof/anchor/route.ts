export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { buildMerkleRoot, findForbiddenProofPayloadKey, hashEvidencePayload } from "../../../../lib/proof-layer";

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

async function resolveTenant(req: Request, body: Record<string, unknown>) {
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const requested = safeString(body.tenant_id || body.tenantId || body.tenant_slug || body.tenantSlug || body.tenant);
  if (forcedTenantSlug) {
    const rows = await sql/*sql*/`SELECT id, slug FROM tenants WHERE slug = ${forcedTenantSlug} LIMIT 1`;
    return rows[0] || null;
  }
  if (!requested) return null;
  const rows = /^[0-9a-f-]{36}$/i.test(requested)
    ? await sql/*sql*/`SELECT id, slug FROM tenants WHERE id = ${requested}::uuid LIMIT 1`
    : await sql/*sql*/`SELECT id, slug FROM tenants WHERE slug = ${requested.toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

export async function POST(req: Request) {
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tenant = await resolveTenant(req, body);
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
        tenantId: tenant?.id ? String(tenant.id) : null,
        resourceType,
        resourceId,
        eventType,
        payload,
      });
      const rows = await sql/*sql*/`
        INSERT INTO evidence_events (tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash)
        VALUES (${tenant?.id || null}, ${resourceType}, ${resourceId}, ${eventType}, ${JSON.stringify(payload)}::jsonb, ${payloadHash})
        ON CONFLICT (payload_hash) DO UPDATE SET payload_hash = EXCLUDED.payload_hash
        RETURNING id, payload_hash, resource_type, resource_id, event_type
      `;
      inserted.push(rows[0] as EvidenceEventRow);
    }
    events = inserted;
  } else if (eventIds.length) {
    const rows = tenant?.id
      ? await sql/*sql*/`
          SELECT id, payload_hash, resource_type, resource_id, event_type
          FROM evidence_events
          WHERE tenant_id = ${tenant.id} AND id = ANY(${eventIds}::uuid[])
          ORDER BY created_at ASC
        `
      : await sql/*sql*/`
          SELECT id, payload_hash, resource_type, resource_id, event_type
          FROM evidence_events
          WHERE id = ANY(${eventIds}::uuid[])
          ORDER BY created_at ASC
        `;
    events = rows as EvidenceEventRow[];
  } else {
    const resourceType = safeString(body.resource_type || body.resourceType);
    const resourceId = safeString(body.resource_id || body.resourceId);
    if (!resourceType || !resourceId) {
      return json({ ok: false, reason: "events_or_resource_required" }, 400);
    }
    const rows = tenant?.id
      ? await sql/*sql*/`
          SELECT id, payload_hash, resource_type, resource_id, event_type
          FROM evidence_events
          WHERE tenant_id = ${tenant.id} AND resource_type = ${resourceType} AND resource_id = ${resourceId}
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
  const eventHashes = events.map((event) => String(event.payload_hash));
  const merkleRoot = buildMerkleRoot(eventHashes);
  const anchorRows = await sql/*sql*/`
    INSERT INTO evidence_anchors (
      tenant_id, provider, network, anchor_type, merkle_root, event_count, event_hashes_json,
      status, anchored_at
    ) VALUES (
      ${tenant?.id || null}, ${provider}, ${network}, 'merkle_root', ${merkleRoot}, ${events.length},
      ${JSON.stringify(eventHashes)}::jsonb, 'local', now()
    )
    RETURNING *
  `;
  const anchor = anchorRows[0];

  await logAuditEvent({
    actorId: null,
    tenantId: tenant?.id ? String(tenant.id) : null,
    action: "proof_anchor_created",
    resourceType: "evidence_anchor",
    resourceId: String(anchor.id),
    afterData: {
      provider,
      network,
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
      merkle_root: merkleRoot,
      event_count: events.length,
      status: anchor.status,
      anchored_at: anchor.anchored_at,
    },
    event_hashes: eventHashes,
  }, 201);
}
