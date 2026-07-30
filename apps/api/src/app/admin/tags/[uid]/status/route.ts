export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  checkAdmin,
  checkAdminPermission,
  getAdminPrincipal,
} from "../../../../../lib/auth";
import { logAuditEvent } from "../../../../../lib/audit-logger";
import {
  readBoundedJsonBody,
  RequestBodyTooLargeError,
} from "../../../../../lib/bounded-request-body";
import {
  adminCriticalRateLimitIdentity,
  enforceCriticalRateLimit,
} from "../../../../../lib/critical-rate-limit";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { hashEvidencePayload } from "../../../../../lib/proof-layer";
import { getRequestMeta } from "../../../../../lib/request-meta";
import {
  allowedTagLifecycleTransitions,
  evaluateTagLifecycleTransition,
  lifecycleRiskLevel,
  normalizeTagLifecycleState,
} from "../../../../../lib/tag-lifecycle";

const MAX_BODY_BYTES = 16_384;
const UID_PATTERN = /^[0-9A-F]{8,32}$/;
const OPERATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

type TenantRow = { id: string; slug: string; name: string };
type TagRow = {
  id: string;
  uid_hex: string;
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  bid: string;
  operational_status: string;
  lifecycle_state: string;
  lifecycle_revision: number;
  lifecycle_reason: string | null;
  lifecycle_updated_at: string | null;
  lifecycle_updated_by: string | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clean(value: unknown, maximum = 1_000) {
  return String(value || "").trim().slice(0, maximum);
}

function normalizeUid(value: string) {
  const uid = decodeURIComponent(value || "").trim().toUpperCase();
  return UID_PATTERN.test(uid) ? uid : null;
}

async function resolveTenant(req: Request, requestedTenant: unknown): Promise<TenantRow | null> {
  const principal = getAdminPrincipal(req);
  if (principal.tenantId) {
    const rows = await sql/*sql*/`
      SELECT id::text AS id, slug, name
      FROM tenants
      WHERE id = ${principal.tenantId}::uuid
      LIMIT 1
    `;
    return rows[0] as TenantRow | undefined || null;
  }

  const requested = clean(requestedTenant, 128).toLowerCase();
  if (!requested) return null;
  const rows = await sql/*sql*/`
    SELECT id::text AS id, slug, name
    FROM tenants
    WHERE slug = ${requested} OR id::text = ${requested}
    LIMIT 1
  `;
  return rows[0] as TenantRow | undefined || null;
}

async function loadTag(tenantId: string, uid: string): Promise<{ tag: TagRow | null; ambiguous: boolean }> {
  const rows = await sql/*sql*/`
    SELECT
      tag.id::text AS id,
      tag.uid_hex,
      batch.tenant_id::text AS tenant_id,
      tenant.slug AS tenant_slug,
      tenant.name AS tenant_name,
      batch.bid,
      tag.status::text AS operational_status,
      COALESCE(tag.lifecycle_state, tag.status::text) AS lifecycle_state,
      tag.lifecycle_revision::bigint AS lifecycle_revision,
      tag.lifecycle_reason,
      tag.lifecycle_updated_at,
      tag.lifecycle_updated_by::text AS lifecycle_updated_by
    FROM tags tag
    JOIN batches batch ON batch.id = tag.batch_id
    JOIN tenants tenant ON tenant.id = batch.tenant_id
    WHERE batch.tenant_id = ${tenantId}::uuid
      AND UPPER(tag.uid_hex) = ${uid}
    ORDER BY tag.created_at DESC, tag.id DESC
    LIMIT 2
  `;
  return {
    tag: rows[0] as TagRow | undefined || null,
    ambiguous: rows.length > 1,
  };
}

function missingLifecycleMigration(error: unknown) {
  const code = clean((error as { code?: unknown })?.code, 16);
  const message = clean((error as Error)?.message, 256);
  return ["42P01", "42703", "42883"].includes(code)
    || /tag_lifecycle_events|lifecycle_state|nexid_transition_tag_lifecycle_v1/i.test(message)
      && /does not exist|undefined/i.test(message);
}

function lifecycleError(error: unknown) {
  if (missingLifecycleMigration(error)) return { status: 503, reason: "tag_lifecycle_migration_required" };
  const message = clean((error as Error)?.message, 256);
  const reason = message.match(/tag_lifecycle_[a-z0-9_]+/i)?.[0]?.toLowerCase();
  if (!reason) return { status: 500, reason: "tag_lifecycle_transition_failed" };
  if (reason === "tag_lifecycle_tag_not_found") return { status: 404, reason };
  if (reason === "tag_lifecycle_actor_scope_invalid") return { status: 403, reason };
  if ([
    "tag_lifecycle_revision_conflict",
    "tag_lifecycle_idempotency_conflict",
    "tag_lifecycle_batch_not_active",
    "tag_lifecycle_supplier_activation_gate_failed",
  ].includes(reason)) return { status: 409, reason };
  return { status: 400, reason };
}

function currentPayload(tag: TagRow) {
  const state = normalizeTagLifecycleState(tag.lifecycle_state) || "inactive";
  return {
    id: tag.id,
    uid: tag.uid_hex,
    bid: tag.bid,
    tenant: { id: tag.tenant_id, slug: tag.tenant_slug, name: tag.tenant_name },
    operational_status: tag.operational_status,
    lifecycle_state: state,
    lifecycle_revision: Number(tag.lifecycle_revision || 0),
    lifecycle_reason: tag.lifecycle_reason,
    lifecycle_updated_at: tag.lifecycle_updated_at,
    lifecycle_updated_by: tag.lifecycle_updated_by,
    risk_level: lifecycleRiskLevel(state),
    allowed_transitions: allowedTagLifecycleTransitions(state),
    evidence_boundary: "Lifecycle is an audited administrative state. It does not alter or replace NFC CMAC/SDM verification or physical TagTamper evidence.",
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "tags:read");
  if (permission) return permission;
  const uid = normalizeUid((await params).uid);
  if (!uid) return json({ ok: false, reason: "uid_invalid" }, 400);

  const url = new URL(req.url);
  let tenant: TenantRow | null;
  try {
    tenant = await resolveTenant(req, url.searchParams.get("tenant"));
  } catch (error) {
    if (missingLifecycleMigration(error)) return json({ ok: false, reason: "tag_lifecycle_migration_required" }, 503);
    throw error;
  }
  if (!tenant) return json({ ok: false, reason: "tenant_required_or_not_found" }, 400);

  try {
    const loaded = await loadTag(tenant.id, uid);
    if (loaded.ambiguous) return json({ ok: false, reason: "tag_uid_ambiguous_within_tenant" }, 409);
    if (!loaded.tag) return json({ ok: false, reason: "tag_not_found" }, 404);
    const history = await sql/*sql*/`
      SELECT
        event.id::text AS id,
        event.previous_state,
        event.next_state,
        event.operational_status,
        event.lifecycle_revision::bigint AS lifecycle_revision,
        event.reason,
        event.evidence_json,
        event.actor_id::text AS actor_id,
        actor.email AS actor_email,
        event.request_id,
        event.created_at
      FROM tag_lifecycle_events event
      LEFT JOIN users actor ON actor.id = event.actor_id
      WHERE event.tenant_id = ${tenant.id}::uuid
        AND event.tag_id = ${loaded.tag.id}::uuid
      ORDER BY event.lifecycle_revision DESC
      LIMIT 100
    `;
    return json({ ok: true, tag: currentPayload(loaded.tag), history });
  } catch (error) {
    if (missingLifecycleMigration(error)) return json({ ok: false, reason: "tag_lifecycle_migration_required" }, 503);
    throw error;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "tags:write");
  if (permission) return permission;
  const principal = getAdminPrincipal(req);
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "public",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;

  const uid = normalizeUid((await params).uid);
  if (!uid) return json({ ok: false, reason: "uid_invalid" }, 400);

  let body: Record<string, unknown>;
  try {
    body = record(await readBoundedJsonBody(req, MAX_BODY_BYTES));
  } catch (error) {
    return json({
      ok: false,
      reason: error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json_body",
    }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }

  const operationKey = clean(req.headers.get("idempotency-key") || body.operation_key || body.operationKey, 128);
  if (!OPERATION_KEY_PATTERN.test(operationKey)) {
    return json({ ok: false, reason: "tag_lifecycle_operation_key_required" }, 400);
  }
  const expectedRevision = Number(body.expected_revision ?? body.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return json({ ok: false, reason: "tag_lifecycle_expected_revision_invalid" }, 400);
  }
  const nextState = normalizeTagLifecycleState(body.lifecycle_state ?? body.lifecycleState ?? body.status);
  if (!nextState) return json({ ok: false, reason: "tag_lifecycle_next_state_invalid" }, 400);
  const reason = clean(body.reason, 1_001);
  if (reason.length < 3 || reason.length > 1_000) {
    return json({ ok: false, reason: "tag_lifecycle_reason_invalid" }, 400);
  }
  const evidence = record(body.evidence);

  let tenant: TenantRow | null;
  try {
    tenant = await resolveTenant(req, body.tenant ?? body.tenant_slug ?? body.tenantSlug);
  } catch (error) {
    if (missingLifecycleMigration(error)) return json({ ok: false, reason: "tag_lifecycle_migration_required" }, 503);
    throw error;
  }
  if (!tenant) return json({ ok: false, reason: "tenant_required_or_not_found" }, 400);

  try {
    const loaded = await loadTag(tenant.id, uid);
    if (loaded.ambiguous) return json({ ok: false, reason: "tag_uid_ambiguous_within_tenant" }, 409);
    if (!loaded.tag) return json({ ok: false, reason: "tag_not_found" }, 404);
    if (loaded.tag.lifecycle_state !== nextState) {
      const transition = evaluateTagLifecycleTransition(loaded.tag.lifecycle_state, nextState);
      if (!transition.ok) return json(transition, 409);
    }

    const requestMeta = getRequestMeta(req);
    const requestFingerprint = hashEvidencePayload({
      tenant_id: tenant.id,
      tag_id: loaded.tag.id,
      next_state: nextState,
      expected_revision: expectedRevision,
      reason,
      evidence,
    });
    const rows = await sql/*sql*/`
      SELECT *
      FROM nexid_transition_tag_lifecycle_v1(${JSON.stringify({
        tag_id: loaded.tag.id,
        tenant_id: tenant.id,
        actor_id: principal.userId,
        next_state: nextState,
        expected_revision: expectedRevision,
        reason,
        evidence,
        operation_key: operationKey,
        request_fingerprint: requestFingerprint,
        request_id: requestMeta.traceId,
        ip_address: requestMeta.ip,
        user_agent: requestMeta.userAgent,
      })}::jsonb)
    `;
    const receipt = rows[0] as Record<string, unknown> | undefined;
    if (!receipt) return json({ ok: false, reason: "tag_lifecycle_transition_receipt_missing" }, 500);

    const audit = await logAuditEvent({
      actorId: principal.userId,
      tenantId: tenant.id,
      action: "tag_lifecycle_transition",
      resourceType: "tag",
      resourceId: loaded.tag.id,
      beforeData: {
        lifecycle_state: receipt.previous_state,
        lifecycle_revision: expectedRevision,
      },
      afterData: {
        lifecycle_state: receipt.lifecycle_state,
        lifecycle_revision: Number(receipt.lifecycle_revision || 0),
        operational_status: receipt.operational_status,
      },
      ipAddress: requestMeta.ip,
      userAgent: requestMeta.userAgent,
      requestId: requestMeta.traceId,
    });

    return json({
      ok: true,
      transition: {
        ...receipt,
        lifecycle_revision: Number(receipt.lifecycle_revision || 0),
        risk_level: lifecycleRiskLevel(normalizeTagLifecycleState(receipt.lifecycle_state)),
        allowed_transitions: allowedTagLifecycleTransitions(normalizeTagLifecycleState(receipt.lifecycle_state) || "inactive"),
      },
      ...(audit.ok ? {} : { warning: audit.reason }),
    });
  } catch (error) {
    const mapped = lifecycleError(error);
    return json({ ok: false, reason: mapped.reason }, mapped.status);
  }
}
