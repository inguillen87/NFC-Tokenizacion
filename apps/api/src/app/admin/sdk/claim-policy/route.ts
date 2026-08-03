export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  checkAdminWithPermission,
  getAdminActor,
  getAdminPrincipal,
  getAdminTenantScope,
} from "../../../../lib/auth";
import { RequestBodyTooLargeError } from "../../../../lib/bounded-request-body";
import { ensureSdkSchema } from "../../../../lib/commercial-runtime-schema";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import {
  hashOwnershipClaimPin,
  validateNewOwnershipClaimPin,
} from "../../../../lib/ownership-claim-pin";
import { getRequestMeta } from "../../../../lib/request-meta";
import {
  normalizeClaimPolicyAdminBody,
  readClaimPolicyAdminBody,
} from "./policy";

const NO_STORE = {
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
  "x-content-type-options": "nosniff",
};

function failure(
  reason: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return json({ ok: false, reason, ...extra }, status, NO_STORE);
}

function invalidBody(error: unknown) {
  const tooLarge = error instanceof RequestBodyTooLargeError;
  return failure(tooLarge ? "request_body_too_large" : "invalid_json_body", tooLarge ? 413 : 400);
}

async function resolveBatch(bid: string, tenantSlug: string) {
  const rows = await sql/*sql*/`
    SELECT b.id::text AS batch_id, b.tenant_id::text AS tenant_id, b.bid, tn.slug AS tenant_slug
    FROM batches b
    JOIN tenants tn ON tn.id = b.tenant_id
    WHERE b.bid = ${bid}
      AND tn.slug = ${tenantSlug}
    LIMIT 1
  `;
  return rows[0] as Record<string, unknown> | undefined;
}

export async function POST(req: Request) {
  const auth = await checkAdminWithPermission(req, "ownership.claim_policy.manage");
  if (auth) return auth;

  const principal = getAdminPrincipal(req);
  const actor = getAdminActor(req);
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    ...adminCriticalRateLimitIdentity(req),
    tenantWide: true,
  });
  if (rateLimited) return rateLimited;
  if (!principal.mfaVerified) {
    return failure("ownership_claim_policy_mfa_required", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await readClaimPolicyAdminBody(req);
  } catch (error) {
    return invalidBody(error);
  }
  const normalized = normalizeClaimPolicyAdminBody(body);
  if (!normalized.ok) {
    return failure(normalized.reason, 400, {
      ...(normalized.field ? { field: normalized.field } : {}),
      ...(normalized.invalidFields ? { invalidFields: normalized.invalidFields } : {}),
    });
  }

  const {
    bid,
    tenant,
    uidHex,
    pin,
    activeForClaim,
    claimPinRequired,
    claimRequiresPos,
    autoClaimEnabled,
  } = normalized.mutation;
  const tenantScope = getAdminTenantScope(req).forcedTenantSlug;
  if (tenantScope && tenant && tenant !== tenantScope) {
    return failure("tenant_scope_forbidden", 403);
  }
  const tenantSlug = tenantScope || tenant;
  if (!tenantSlug) return failure("tenant_required", 400);

  let batch: Record<string, unknown> | undefined;
  try {
    await ensureSdkSchema();
    batch = await resolveBatch(bid, tenantSlug);
  } catch {
    return failure("ownership_claim_policy_unavailable", 503);
  }
  if (!batch) return failure("batch_not_found_for_tenant", 404, { bid });

  const pinContext = {
    tenantId: String(batch.tenant_id),
    bid: String(batch.bid),
    uidHex: uidHex || null,
  };
  if (pin) {
    const validation = validateNewOwnershipClaimPin(pin, pinContext);
    if (!validation.ok) return failure(validation.reason, 400, { field: "pin" });
  }

  let hashPin: string | null = null;
  try {
    hashPin = pin ? await hashOwnershipClaimPin(pin, pinContext) : null;
  } catch {
    return failure("ownership_claim_pin_hash_unavailable", 503);
  }

  const configPatch = {
    ...(typeof claimRequiresPos === "boolean" ? { claim_requires_pos: claimRequiresPos } : {}),
    ...(typeof autoClaimEnabled === "boolean" ? { sdk_auto_claim_enabled: autoClaimEnabled } : {}),
    ...(typeof activeForClaim === "boolean" ? { active_for_claim: activeForClaim } : {}),
    ...(typeof claimPinRequired === "boolean" ? { claim_pin_required: claimPinRequired } : {}),
    ...(hashPin ? { claim_pin_hash: hashPin, hash_pin: hashPin } : {}),
  };
  const meta = getRequestMeta(req);
  const requestId = String(meta.traceId || "").slice(0, 160) || null;
  const userAgent = String(meta.userAgent || "").slice(0, 512) || null;

  let rows: Array<Record<string, unknown>>;
  try {
    rows = uidHex
      ? await sql/*sql*/`
        WITH authorized_session AS MATERIALIZED (
          SELECT auth_session.id
          FROM auth_sessions auth_session
          JOIN users session_actor
            ON session_actor.id = auth_session.user_id
          JOIN memberships current_membership
            ON current_membership.user_id = auth_session.user_id
           AND current_membership.role = auth_session.role
           AND current_membership.tenant_id IS NOT DISTINCT FROM auth_session.tenant_id
          WHERE auth_session.id = ${principal.sessionId}::uuid
            AND auth_session.user_id = ${actor.id}::uuid
            AND auth_session.tenant_id IS NOT DISTINCT FROM ${principal.tenantId || null}::uuid
            AND auth_session.mfa_verified IS TRUE
            AND auth_session.revoked_at IS NULL
            AND auth_session.expires_at > now()
            AND session_actor.admin_status::text = 'active'
          FOR SHARE OF auth_session, session_actor, current_membership
        ), target AS MATERIALIZED (
          SELECT
            tag.id,
            tag.uid_hex,
            tag.active_for_claim AS previous_active_for_claim,
            tag.claim_pin_required AS previous_claim_pin_required,
            tag.hash_pin AS previous_hash_pin
          FROM tags tag
          JOIN authorized_session ON true
          WHERE tag.batch_id = ${String(batch.batch_id)}::uuid
            AND upper(tag.uid_hex) = ${uidHex}
          FOR UPDATE OF tag
        ), candidate AS MATERIALIZED (
          SELECT
            target.*,
            COALESCE(${typeof activeForClaim === "boolean" ? activeForClaim : null}, target.previous_active_for_claim) AS next_active_for_claim,
            COALESCE(${typeof claimPinRequired === "boolean" ? claimPinRequired : null}, target.previous_claim_pin_required) AS next_claim_pin_required,
            COALESCE(${hashPin}, target.previous_hash_pin) AS next_hash_pin
          FROM target
        ), eligible AS MATERIALIZED (
          SELECT
            candidate.*,
            NOT (
              COALESCE(candidate.next_claim_pin_required, false)
              AND candidate.next_hash_pin IS NULL
            ) AS policy_coherent
          FROM candidate
        ), updated AS (
          UPDATE tags tag
          SET
            active_for_claim = eligible.next_active_for_claim,
            claim_pin_required = eligible.next_claim_pin_required,
            hash_pin = eligible.next_hash_pin
          FROM eligible
          WHERE tag.id = eligible.id
            AND eligible.policy_coherent
          RETURNING
            tag.id,
            tag.uid_hex,
            eligible.previous_active_for_claim,
            eligible.previous_claim_pin_required,
            eligible.previous_hash_pin,
            tag.active_for_claim,
            tag.claim_pin_required,
            tag.hash_pin
        ), audit AS (
          INSERT INTO audit_logs (
            actor_id, tenant_id, action, resource_type, resource_id,
            before_hash, after_hash, ip_address, user_agent, request_id
          )
          SELECT
            ${actor.id}::uuid,
            ${String(batch.tenant_id)}::uuid,
            'ownership_claim_policy_updated',
            'tag_claim_policy',
            updated.id::text,
            encode(digest(jsonb_build_object(
              'scope', 'tag',
              'active_for_claim', updated.previous_active_for_claim,
              'claim_pin_required', updated.previous_claim_pin_required,
              'pin_configured', updated.previous_hash_pin IS NOT NULL
            )::text, 'sha256'), 'hex'),
            encode(digest(jsonb_build_object(
              'scope', 'tag',
              'active_for_claim', updated.active_for_claim,
              'claim_pin_required', updated.claim_pin_required,
              'pin_configured', updated.hash_pin IS NOT NULL
            )::text, 'sha256'), 'hex'),
            ${meta.ip}::inet,
            ${userAgent},
            ${requestId}
          FROM updated
          RETURNING id
        )
        SELECT
          EXISTS (SELECT 1 FROM authorized_session) AS authorized_session_ok,
          EXISTS (SELECT 1 FROM target) AS target_found,
          COALESCE((SELECT policy_coherent FROM eligible LIMIT 1), false) AS policy_coherent,
          (SELECT id::text FROM audit LIMIT 1) AS audit_receipt
      `
      : await sql/*sql*/`
        WITH authorized_session AS MATERIALIZED (
          SELECT auth_session.id
          FROM auth_sessions auth_session
          JOIN users session_actor
            ON session_actor.id = auth_session.user_id
          JOIN memberships current_membership
            ON current_membership.user_id = auth_session.user_id
           AND current_membership.role = auth_session.role
           AND current_membership.tenant_id IS NOT DISTINCT FROM auth_session.tenant_id
          WHERE auth_session.id = ${principal.sessionId}::uuid
            AND auth_session.user_id = ${actor.id}::uuid
            AND auth_session.tenant_id IS NOT DISTINCT FROM ${principal.tenantId || null}::uuid
            AND auth_session.mfa_verified IS TRUE
            AND auth_session.revoked_at IS NULL
            AND auth_session.expires_at > now()
            AND session_actor.admin_status::text = 'active'
          FOR SHARE OF auth_session, session_actor, current_membership
        ), target AS MATERIALIZED (
          SELECT
            batch.id,
            batch.sdm_config AS previous_sdm_config,
            batch.active_for_claim AS previous_active_for_claim,
            batch.claim_pin_required AS previous_claim_pin_required,
            batch.hash_pin AS previous_hash_pin
          FROM batches batch
          JOIN authorized_session ON true
          WHERE batch.id = ${String(batch.batch_id)}::uuid
            AND batch.tenant_id = ${String(batch.tenant_id)}::uuid
          FOR UPDATE OF batch
        ), candidate AS MATERIALIZED (
          SELECT
            target.*,
            COALESCE(${typeof activeForClaim === "boolean" ? activeForClaim : null}, target.previous_active_for_claim) AS next_active_for_claim,
            COALESCE(${typeof claimPinRequired === "boolean" ? claimPinRequired : null}, target.previous_claim_pin_required) AS next_claim_pin_required,
            COALESCE(${hashPin}, target.previous_hash_pin) AS next_hash_pin,
            COALESCE(target.previous_sdm_config, '{}'::jsonb) || ${JSON.stringify(configPatch)}::jsonb AS next_sdm_config
          FROM target
        ), eligible AS MATERIALIZED (
          SELECT
            candidate.*,
            NOT (
              COALESCE(candidate.next_claim_pin_required, false)
              AND candidate.next_hash_pin IS NULL
            ) AS policy_coherent
          FROM candidate
        ), updated AS (
          UPDATE batches batch
          SET
            active_for_claim = eligible.next_active_for_claim,
            claim_pin_required = eligible.next_claim_pin_required,
            hash_pin = eligible.next_hash_pin,
            sdm_config = eligible.next_sdm_config
          FROM eligible
          WHERE batch.id = eligible.id
            AND eligible.policy_coherent
          RETURNING
            batch.id,
            eligible.previous_active_for_claim,
            eligible.previous_claim_pin_required,
            eligible.previous_hash_pin,
            eligible.previous_sdm_config,
            batch.active_for_claim,
            batch.claim_pin_required,
            batch.hash_pin,
            batch.sdm_config
        ), audit AS (
          INSERT INTO audit_logs (
            actor_id, tenant_id, action, resource_type, resource_id,
            before_hash, after_hash, ip_address, user_agent, request_id
          )
          SELECT
            ${actor.id}::uuid,
            ${String(batch.tenant_id)}::uuid,
            'ownership_claim_policy_updated',
            'batch_claim_policy',
            updated.id::text,
            encode(digest(jsonb_build_object(
              'scope', 'batch',
              'active_for_claim', updated.previous_active_for_claim,
              'claim_pin_required', updated.previous_claim_pin_required,
              'claim_requires_pos', updated.previous_sdm_config->'claim_requires_pos',
              'sdk_auto_claim_enabled', updated.previous_sdm_config->'sdk_auto_claim_enabled',
              'pin_configured', updated.previous_hash_pin IS NOT NULL
            )::text, 'sha256'), 'hex'),
            encode(digest(jsonb_build_object(
              'scope', 'batch',
              'active_for_claim', updated.active_for_claim,
              'claim_pin_required', updated.claim_pin_required,
              'claim_requires_pos', updated.sdm_config->'claim_requires_pos',
              'sdk_auto_claim_enabled', updated.sdm_config->'sdk_auto_claim_enabled',
              'pin_configured', updated.hash_pin IS NOT NULL
            )::text, 'sha256'), 'hex'),
            ${meta.ip}::inet,
            ${userAgent},
            ${requestId}
          FROM updated
          RETURNING id
        )
        SELECT
          EXISTS (SELECT 1 FROM authorized_session) AS authorized_session_ok,
          EXISTS (SELECT 1 FROM target) AS target_found,
          COALESCE((SELECT policy_coherent FROM eligible LIMIT 1), false) AS policy_coherent,
          (SELECT id::text FROM audit LIMIT 1) AS audit_receipt
      `;
  } catch {
    return failure("ownership_claim_policy_unavailable", 503);
  }

  const result = rows[0];
  if (result?.authorized_session_ok !== true) {
    return failure("ownership_claim_policy_session_not_current", 403);
  }
  if (result?.target_found !== true) {
    if (uidHex) return failure("tag_not_found_for_batch", 404, { bid, uidHex });
    return failure("claim_policy_target_changed", 409);
  }
  if (result?.policy_coherent !== true) {
    return failure("claim_pin_required_without_pin", 409);
  }
  if (!result?.audit_receipt) {
    return failure("ownership_claim_policy_audit_unavailable", 503);
  }

  const auditReceipt = String(result.audit_receipt);
  return json({
    ok: true,
    tenant: String(batch.tenant_slug),
    bid,
    uidHex: uidHex || null,
    policy: {
      activeForClaim: typeof activeForClaim === "boolean" ? activeForClaim : null,
      claimPinRequired: typeof claimPinRequired === "boolean" ? claimPinRequired : null,
      claimRequiresPos: typeof claimRequiresPos === "boolean" ? claimRequiresPos : null,
      autoClaimEnabled: typeof autoClaimEnabled === "boolean" ? autoClaimEnabled : null,
      pinUpdated: Boolean(hashPin),
    },
    auditReceipt,
  }, 200, {
    ...NO_STORE,
    "x-nexid-audit-receipt": auditReceipt,
  });
}
