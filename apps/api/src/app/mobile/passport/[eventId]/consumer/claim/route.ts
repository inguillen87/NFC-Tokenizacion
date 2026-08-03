export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { json } from "../../../../../../lib/http";
import { getConsumerFromRequest } from "../../../../../../lib/consumer-auth";
import { claimOwnershipForConsumer } from "../../../../../../lib/consumer-portal-service";
import { getTapEvent } from "../../../../../../lib/loyalty-service";
import { matchesOwnershipTenant } from "../../../../../../lib/ownership-policy";
import { consumeSunFreshHandoff } from "../../../../../../lib/sun-fresh-handoff";
import { ensureConsumerPortalSchema, ensureSdkSchema } from "../../../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../../../lib/bounded-request-body";
import { sql } from "../../../../../../lib/db";
import {
  ownershipClaimPinRateScope,
  readOwnershipClaimPinInput,
  verifyOwnershipClaimPin,
  type OwnershipClaimPinVerification,
} from "../../../../../../lib/ownership-claim-pin";
import {
  OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS,
  releaseSuccessfulOwnershipClaimPinAttempt,
  reserveOwnershipClaimPinAttempt,
} from "../../../../../../lib/ownership-claim-pin-rate-limit";
import {
  evaluateOwnershipClaimAuthorization,
  resolveOwnershipClaimPinCredential,
} from "../../../../../../lib/ownership-claim-authorization";

const FRESH_OWNERSHIP_REQUIRED = "fresh_physical_tap_required_for_ownership";

function freshOwnershipForbidden(freshTokenStatus: string) {
  return json({
    ok: false,
    error: FRESH_OWNERSHIP_REQUIRED,
    reason: FRESH_OWNERSHIP_REQUIRED,
    fresh_token_status: freshTokenStatus,
  }, 403);
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:ownership-claim` });
  if (limited) return limited;
  let body: {
    bid?: string;
    tenantId?: string;
    tenant_id?: string;
    tenantSlug?: string;
    tenant_slug?: string;
    tenant?: string;
    uidHex?: string;
    uid_hex?: string;
    email?: string;
    contact?: string;
    pin?: unknown;
  };
  try {
    body = await readBoundedJsonBody<typeof body>(req, 16 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  const { eventId } = await params;
  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, error: "event_not_found" }, 404);
  const pinInput = readOwnershipClaimPinInput(body.pin);
  if (!pinInput.ok) return json({ ok: false, error: "pin_invalid_input", reason: "pin_invalid_input" }, 400);
  await Promise.all([ensureConsumerPortalSchema(), ensureSdkSchema()]);
  if (!matchesOwnershipTenant({
    eventTenantId: event.tenant_id,
    eventTenantSlug: event.tenant_slug,
    requestedTenantId: body.tenantId || body.tenant_id,
    requestedTenantSlug: body.tenantSlug || body.tenant_slug,
    requestedTenant: body.tenant,
  })) {
    return json({ ok: false, error: "tenant_mismatch" }, 403);
  }
  const expectedEventId = String(event.id || eventId).trim();
  const expectedBid = String(body.bid || event.bid || "").trim();
  if (!expectedBid) return freshOwnershipForbidden("fresh_token_bid_missing");
  const fresh = await consumeSunFreshHandoff(req, body as Record<string, unknown>, {
    eventId: expectedEventId,
    bid: expectedBid,
    uidHex: String(event.uid_hex || ""),
    readCounter: event.sdm_read_ctr,
  }, "consumer_claim_ownership");
  if (!fresh.ok) return freshOwnershipForbidden(fresh.reason);

  const policyRows = await sql/*sql*/`
    SELECT
      t.id::text AS tag_id,
      t.claim_pin_required AS tag_claim_pin_required,
      t.hash_pin AS tag_hash_pin,
      t.active_for_claim AS tag_active_for_claim,
      b.id::text AS batch_id,
      b.claim_pin_required AS batch_claim_pin_required,
      b.hash_pin AS batch_hash_pin,
      b.active_for_claim AS batch_active_for_claim,
      b.sdm_config AS batch_sdm_config,
      tsp.claim_policy AS tenant_claim_policy,
      EXISTS (
        SELECT 1
        FROM sdk_pos_activations activation
        WHERE activation.tenant_id = b.tenant_id
          AND activation.batch_id = b.id
          AND activation.activation_status = 'active'
          AND (activation.expires_at IS NULL OR activation.expires_at > now())
          AND activation.tag_id = t.id
          AND UPPER(activation.uid_hex) = UPPER(t.uid_hex)
      ) AS retailer_pos_attested
    FROM tags t
    JOIN batches b ON b.id = t.batch_id
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = b.tenant_id
    WHERE b.id = ${event.batch_id}
      AND b.tenant_id = ${event.tenant_id}
      AND UPPER(t.uid_hex) = UPPER(${String(event.uid_hex || "")})
    LIMIT 1
  `;
  const policyRow = policyRows[0] as Record<string, unknown> | undefined;
  if (!policyRow) return json({ ok: false, error: "tag_not_found", reason: "tag_not_found" }, 404);
  const sdmConfig = policyRow.batch_sdm_config && typeof policyRow.batch_sdm_config === "object"
    ? policyRow.batch_sdm_config as Record<string, unknown>
    : {};
  const sunConfig = sdmConfig.sun && typeof sdmConfig.sun === "object"
    ? sdmConfig.sun as Record<string, unknown>
    : {};
  const passportConfig = sunConfig.passport && typeof sunConfig.passport === "object"
    ? sunConfig.passport as Record<string, unknown>
    : {};
  const claimPolicy = policyRow.tenant_claim_policy || passportConfig.claimPolicy || sunConfig.claimPolicy;
  const activeForClaim = policyRow.tag_active_for_claim !== null && policyRow.tag_active_for_claim !== undefined
    ? Boolean(policyRow.tag_active_for_claim)
    : Boolean(policyRow.batch_active_for_claim || sdmConfig.active_for_claim);
  const configuredPosRequired = Boolean(sdmConfig.claim_requires_pos || sdmConfig.pos_required || sdmConfig.retailer_attestation_required);
  const posValidated = policyRow.retailer_pos_attested === true || String(policyRow.retailer_pos_attested) === "true";
  const pinCredential = resolveOwnershipClaimPinCredential({
    claimPolicy,
    tagPinRequired: policyRow.tag_claim_pin_required,
    tagPinHash: policyRow.tag_hash_pin,
    batchPinRequired: policyRow.batch_claim_pin_required,
    batchPinHash: policyRow.batch_hash_pin,
    configPinRequired: sdmConfig.claim_pin_required,
    configPinHash: sdmConfig.hash_pin || sdmConfig.claim_pin_hash,
  });
  if (pinCredential.misconfigured) {
    return json({ ok: false, error: "pin_policy_misconfigured", reason: "pin_policy_misconfigured" }, 409, { "cache-control": "no-store" });
  }

  let pinVerification: OwnershipClaimPinVerification | null = null;
  if (pinCredential.required) {
    if (!pinInput.pin) return json({ ok: false, error: "pin_required", reason: "pin_required" }, 400, { "cache-control": "no-store" });
    const rateContext = {
      tenantId: String(event.tenant_id || ""),
      bid: expectedBid,
      uidHex: String(event.uid_hex || ""),
      sourceId: `consumer:${consumer.id}`,
      credentialScope: ownershipClaimPinRateScope(pinCredential.storedHash),
    };
    const attemptReservation = await reserveOwnershipClaimPinAttempt(req, rateContext);
    if (attemptReservation.status === "unavailable") {
      return json({ ok: false, error: "claim_pin_security_unavailable", reason: "claim_pin_security_unavailable" }, 503, { "cache-control": "no-store" });
    }
    if (attemptReservation.status === "locked") {
      return json({ ok: false, error: "claim_pin_locked", reason: "claim_pin_locked", retry_after_seconds: OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS }, 429, {
        "cache-control": "no-store",
        "retry-after": String(OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS),
      });
    }
    try {
      pinVerification = await verifyOwnershipClaimPin({
        storedHash: pinCredential.storedHash,
        pin: pinInput.pin,
        context: { tenantId: String(event.tenant_id || ""), bid: expectedBid, uidHex: String(event.uid_hex || "") },
      });
    } catch {
      await releaseSuccessfulOwnershipClaimPinAttempt(attemptReservation.attempt);
      return json({ ok: false, error: "claim_pin_security_unavailable", reason: "claim_pin_security_unavailable" }, 503, { "cache-control": "no-store" });
    }
    if (pinVerification.matches) {
      const released = await releaseSuccessfulOwnershipClaimPinAttempt(attemptReservation.attempt);
      if (released.status === "unavailable") {
        return json({ ok: false, error: "claim_pin_security_unavailable", reason: "claim_pin_security_unavailable" }, 503, { "cache-control": "no-store" });
      }
    } else {
      return json({ ok: false, error: "invalid_pin", reason: "invalid_pin" }, 403, { "cache-control": "no-store" });
    }
  }

  const claimAuthorization = evaluateOwnershipClaimAuthorization({
    claimPolicy,
    activeForClaim,
    configuredPinRequired: pinCredential.required,
    pinPresented: Boolean(pinInput.pin),
    pinValidated: pinVerification?.matches === true,
    configuredPosRequired,
    posValidated,
    purchaseProofPresented: false,
  });
  if (claimAuthorization.disposition !== "authorized") {
    const reason = claimAuthorization.disposition === "review_required"
      ? "ownership_manual_review_required"
      : claimAuthorization.reason;
    return json({ ok: false, error: reason, reason, review_required: true }, reason === "claim_policy_configuration_required" ? 409 : 403, { "cache-control": "no-store" });
  }
  const claimed = await claimOwnershipForConsumer({
    consumerId: consumer.id,
    eventId,
    source: "sun_passport",
    bid: expectedBid,
    uidHex: String(event.uid_hex || ""),
    trustSnapshot: {
      fresh_handoff_exp: fresh.payload.exp,
      claim_policy: claimAuthorization.policy,
      retailer_pos_attested: posValidated,
      claim_pin_verification: pinVerification ? {
        algorithm: pinVerification.algorithm,
        needs_rotation: pinVerification.needsRotation,
      } : null,
    },
  });
  if (!claimed.ok) return json({
    ok: false,
    error: claimed.error,
    ownership: claimed.ownership || null,
    operation_committed: "operationCommitted" in claimed ? claimed.operationCommitted : false,
  }, claimed.status);
  return json({
    ok: true,
    eventId,
    consumerId: consumer.id,
    ownership: claimed.ownership,
    canonical_event: claimed.canonicalEvent,
    webhook_outbox: claimed.canonicalEvent.webhookOutbox,
    ownership_scope: "nexid_off_chain_digital_title",
    chain_transfer_status: "not_executed",
    nft_transfer_executed: false,
    on_chain_owner_verified: false,
  });
}
