export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ensureSdkSchema } from "../../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { authenticateSdkRequest, hashSdkApiKey, logSdkUsage } from "../../../../../lib/sdk-auth";
import { dispatchTenantWebhooks } from "../../../../../lib/sdk-webhooks";
import { asRecord, clean, isSecureOwnershipCarrier, numberOrNull, parseHeaderIp, readJsonObject, sha256Hex } from "../_shared";

function pinMatches(input: { storedHash: string; pin: string; tenantId: string; bid: string; uidHex: string }) {
  const stored = clean(input.storedHash).toLowerCase();
  if (!stored || !input.pin) return false;
  const normalizedPin = input.pin.trim();
  const uid = input.uidHex.toUpperCase();
  const candidates = [
    sha256Hex(normalizedPin),
    sha256Hex(`${input.tenantId}:${input.bid}:${uid}:${normalizedPin}`),
    sha256Hex(`${input.tenantId}:${input.bid}:${normalizedPin}`),
  ].map((value) => value.toLowerCase());
  return candidates.includes(stored);
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const auth = await authenticateSdkRequest(req, "sdk:claim");
  if (!auth.ok) {
    await logSdkUsage({ req, endpoint: "sdk.claim", statusCode: auth.response.status, startedAt, reason: "auth_failed" });
    return auth.response;
  }

  await ensureSdkSchema();
  const body = asRecord(await req.json().catch(() => ({})));
  const contact = clean(body.contact || body.email || body.phone || body.whatsapp);
  const name = clean(body.name);
  const bid = clean(body.bid);
  const uidHex = clean(body.uidHex || body.uid_hex).toUpperCase();
  const pin = clean(body.pin);
  const posToken = clean(body.posToken || body.pos_token || body.retailerPosToken || body.retailer_pos_token);
  if (!contact || !bid) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.claim", statusCode: 400, startedAt, reason: "contact_and_bid_required" });
    return json({ ok: false, reason: "contact_and_bid_required", need: ["contact", "bid"], trace_id: auth.context.traceId }, 400);
  }

  const rows = await sql/*sql*/`
    SELECT
      b.id::text AS batch_id,
      b.bid,
      b.sdm_config,
      b.carrier_profile_code AS batch_carrier_profile_code,
      b.active_for_claim AS batch_active_for_claim,
      b.claim_pin_required AS batch_claim_pin_required,
      b.hash_pin AS batch_hash_pin,
      t.id::text AS tag_id,
      t.uid_hex,
      t.status AS tag_status,
      t.carrier_profile_code AS tag_carrier_profile_code,
      t.active_for_claim AS tag_active_for_claim,
      t.claim_pin_required AS tag_claim_pin_required,
      t.hash_pin AS tag_hash_pin,
      tp.product_name,
      tp.sku,
      cp.code AS carrier_profile_code,
      cp.label AS carrier_label
    FROM batches b
    LEFT JOIN LATERAL (
      SELECT *
      FROM tags candidate
      WHERE candidate.batch_id = b.id
        AND (${uidHex} = '' OR UPPER(candidate.uid_hex) = UPPER(${uidHex}))
      ORDER BY candidate.created_at ASC
      LIMIT 1
    ) t ON ${uidHex} <> ''
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    LEFT JOIN carrier_profiles cp ON cp.code = COALESCE(t.carrier_profile_code, b.carrier_profile_code, NULLIF(b.sdm_config->>'carrier_profile_code', ''))
    WHERE b.tenant_id = ${auth.context.tenantId}
      AND b.bid = ${bid}
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.claim", statusCode: 404, startedAt, reason: "batch_not_found_for_tenant", meta: { bid } });
    return json({ ok: false, reason: "batch_not_found_for_tenant", bid, trace_id: auth.context.traceId }, 404);
  }
  if (uidHex && !clean(row.tag_id)) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.claim", statusCode: 404, startedAt, reason: "tag_not_found_for_batch", meta: { bid, uidHex } });
    return json({ ok: false, reason: "tag_not_found_for_batch", bid, uidHex, trace_id: auth.context.traceId }, 404);
  }

  const sdmConfig = readJsonObject(row.sdm_config);
  const posRows = posToken ? await sql/*sql*/`
    SELECT id::text AS id, uid_hex, external_order_id, retailer_id
    FROM sdk_pos_activations
    WHERE tenant_id = ${auth.context.tenantId}
      AND bid = ${bid}
      AND pos_token_hash = ${hashSdkApiKey(posToken)}
      AND activation_status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
      AND (${uidHex} = '' OR uid_hex IS NULL OR UPPER(uid_hex) = UPPER(${uidHex}))
    LIMIT 1
  ` : [];
  const posActivation = posRows[0] as Record<string, unknown> | undefined;
  const posActivationId = clean(posActivation?.id);
  const posValidated = Boolean(posActivationId);
  const carrierProfileCode = clean(row.carrier_profile_code || row.tag_carrier_profile_code || row.batch_carrier_profile_code || sdmConfig.carrier_profile_code) || null;
  const configuredActiveForClaim = row.tag_active_for_claim !== null && row.tag_active_for_claim !== undefined
    ? Boolean(row.tag_active_for_claim)
    : Boolean(row.batch_active_for_claim || sdmConfig.active_for_claim);
  const activeForClaim = posValidated || configuredActiveForClaim;
  const claimRequiresPos = Boolean(sdmConfig.claim_requires_pos || sdmConfig.pos_required || sdmConfig.retailer_attestation_required);
  if ((claimRequiresPos || posToken) && !posValidated) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.claim", statusCode: 403, startedAt, reason: "pos_token_invalid_or_required", meta: { bid, uidHex: uidHex || null, claimRequiresPos } });
    return json({ ok: false, reason: claimRequiresPos ? "pos_token_required_or_invalid" : "invalid_pos_token", bid, uidHex: uidHex || null, trace_id: auth.context.traceId }, 403);
  }
  const pinRequired = row.tag_claim_pin_required !== null && row.tag_claim_pin_required !== undefined
    ? Boolean(row.tag_claim_pin_required)
    : Boolean(row.batch_claim_pin_required || sdmConfig.claim_pin_required);
  const storedPinHash = clean(row.tag_hash_pin || row.batch_hash_pin || sdmConfig.hash_pin || sdmConfig.claim_pin_hash);
  if (pinRequired && !storedPinHash) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.claim", statusCode: 409, startedAt, reason: "pin_policy_misconfigured", meta: { bid, uidHex: uidHex || null } });
    return json({ ok: false, reason: "pin_policy_misconfigured", bid, trace_id: auth.context.traceId }, 409);
  }
  if (pinRequired && !pin) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.claim", statusCode: 403, startedAt, reason: "pin_required", meta: { bid, uidHex: uidHex || null } });
    return json({ ok: false, reason: "pin_required", bid, uidHex: uidHex || null, trace_id: auth.context.traceId }, 403);
  }
  const pinValidated = pinRequired ? pinMatches({ storedHash: storedPinHash, pin, tenantId: auth.context.tenantId, bid, uidHex }) : false;
  if (pinRequired && !pinValidated) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.claim", statusCode: 403, startedAt, reason: "invalid_pin", meta: { bid, uidHex: uidHex || null } });
    return json({ ok: false, reason: "invalid_pin", bid, uidHex: uidHex || null, trace_id: auth.context.traceId }, 403);
  }

  const meta = {
    ...asRecord(body.meta),
    sdk: true,
    api_key_id: auth.context.apiKeyId,
    tenantSlug: auth.context.tenantSlug,
    bid,
    uidHex: uidHex || null,
    productName: clean(row.product_name || row.sku) || null,
    gps: asRecord(body.gps),
    device: asRecord(body.device || body.deviceMeta || body.device_meta),
    requestIp: parseHeaderIp(req),
    pinRequired,
    pinValidated,
    posValidated,
    posActivationId: posActivationId || null,
    claimRequiresPos,
    activeForClaim,
    carrierProfileCode,
  };
  const gps = asRecord(body.gps);
  const lat = numberOrNull(gps.lat ?? gps.latitude);
  const lng = numberOrNull(gps.lng ?? gps.longitude);
  const secureOwnershipCarrier = isSecureOwnershipCarrier(carrierProfileCode);
  const autoClaimEnabled = Boolean(sdmConfig.sdk_auto_claim_enabled || sdmConfig.auto_claim_enabled);
  const hasPhysicalTagIdentity = Boolean(uidHex && clean(row.tag_id));
  const claimStatus = activeForClaim && secureOwnershipCarrier && hasPhysicalTagIdentity && (!claimRequiresPos || posValidated) && (!pinRequired || pinValidated) && (autoClaimEnabled || posValidated)
    ? "claimed"
    : "pending_verification";

  const claimRows = await sql/*sql*/`
    WITH claim_ids AS MATERIALIZED (
      SELECT uuid_generate_v4() AS lead_id, uuid_generate_v4() AS claim_id
    ),
    consumed_pos AS (
      UPDATE sdk_pos_activations activation
      SET activation_status = 'used',
          used_at = now(),
          claim_request_id = claim_ids.claim_id,
          updated_at = now()
      FROM claim_ids
      WHERE ${posToken} <> ''
        AND activation.id = ${posActivationId || null}
        AND activation.tenant_id = ${auth.context.tenantId}
        AND activation.bid = ${bid}
        AND activation.pos_token_hash = ${hashSdkApiKey(posToken)}
        AND activation.activation_status = 'active'
        AND activation.claim_request_id IS NULL
        AND (activation.expires_at IS NULL OR activation.expires_at > now())
        AND (${uidHex} = '' OR activation.uid_hex IS NULL OR UPPER(activation.uid_hex) = UPPER(${uidHex}))
      RETURNING activation.id
    ),
    claim_gate AS (
      SELECT claim_ids.lead_id, claim_ids.claim_id, consumed_pos.id AS pos_activation_id
      FROM claim_ids
      LEFT JOIN consumed_pos ON true
      WHERE ${posToken} = '' OR consumed_pos.id IS NOT NULL
    ),
    created_lead AS (
      INSERT INTO leads (
        id, locale, contact, name, email, phone, company, country, vertical, role_interest, estimated_volume, tag_type,
        source, status, message, notes, tenant_id, meta
      )
      SELECT
        claim_gate.lead_id,
        ${clean(body.locale) || "es-AR"},
        ${contact},
        ${name || null},
        ${contact.includes("@") ? contact : clean(body.email) || null},
        ${!contact.includes("@") ? contact : clean(body.phone || body.whatsapp) || null},
        ${clean(body.company) || null},
        ${clean(body.country || gps.country || gps.countryCode) || null},
        ${clean(body.vertical) || "wine"},
        ${clean(body.role_interest || body.role) || "ownership_claim"},
        ${clean(body.estimated_volume) || null},
        ${carrierProfileCode || null},
        'sdk_claim',
        ${claimStatus === "claimed" ? "qualified" : "new"},
        ${clean(body.message) || "SDK ownership claim request"},
        ${[
          `sdk_claim_status=${claimStatus}`,
          `bid=${bid}`,
          uidHex ? `uid=${uidHex}` : "",
          `active_for_claim=${activeForClaim}`,
          `pin_required=${pinRequired}`,
          `pos_required=${claimRequiresPos}`,
          `pos_validated=${posValidated}`,
          `carrier=${carrierProfileCode || "unknown"}`,
        ].filter(Boolean).join(" | ")},
        ${auth.context.tenantId},
        ${JSON.stringify({ ...meta, gps: { ...gps, lat, lng } })}::jsonb
      FROM claim_gate
      RETURNING id
    ),
    created_claim AS (
      INSERT INTO sdk_claim_requests (
        id, tenant_id, api_key_id, lead_id, batch_id, tag_id, bid, uid_hex, contact, name,
        claim_status, pin_validated, active_for_claim, pos_activation_id, pos_validated, carrier_profile_code, meta
      )
      SELECT
        claim_gate.claim_id,
        ${auth.context.tenantId},
        ${auth.context.apiKeyId},
        created_lead.id,
        ${clean(row.batch_id)},
        ${clean(row.tag_id) || null},
        ${bid},
        ${uidHex || null},
        ${contact},
        ${name || null},
        ${claimStatus},
        ${pinValidated},
        ${activeForClaim},
        claim_gate.pos_activation_id,
        ${posValidated},
        ${carrierProfileCode || null},
        ${JSON.stringify(meta)}::jsonb
      FROM claim_gate
      JOIN created_lead ON created_lead.id = claim_gate.lead_id
      RETURNING id::text AS id, lead_id::text AS lead_id, claim_status
    )
    SELECT id, lead_id, claim_status
    FROM created_claim
  `;
  const persistedClaim = claimRows[0] as { id?: string; lead_id?: string; claim_status?: string } | undefined;
  if (!persistedClaim && posToken) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.claim", statusCode: 409, startedAt, reason: "pos_token_invalid_or_consumed", meta: { bid, uidHex: uidHex || null } });
    return json({ ok: false, reason: "pos_token_invalid_or_consumed", bid, uidHex: uidHex || null, trace_id: auth.context.traceId }, 409);
  }
  if (!persistedClaim) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.claim", statusCode: 500, startedAt, reason: "claim_persistence_failed", meta: { bid, uidHex: uidHex || null } });
    return json({ ok: false, reason: "claim_persistence_failed", trace_id: auth.context.traceId }, 500);
  }
  const claimId = String(persistedClaim.id || "");
  const leadId = String(persistedClaim.lead_id || "");

  await dispatchTenantWebhooks({
    tenantId: auth.context.tenantId,
    eventName: "sdk.claim.created",
    idempotencyKey: claimId,
    payload: { claimId, leadId, status: claimStatus, bid, uidHex: uidHex || null, posValidated, pinValidated, traceId: auth.context.traceId },
  }).catch(() => null);
  if (claimStatus === "claimed") {
    await dispatchTenantWebhooks({
      tenantId: auth.context.tenantId,
      eventName: "sdk.claim.claimed",
      idempotencyKey: claimId,
      payload: { claimId, leadId, bid, uidHex: uidHex || null, posActivationId: posActivationId || null, traceId: auth.context.traceId },
    }).catch(() => null);
  }
  await logSdkUsage({ req, context: auth.context, endpoint: "sdk.claim", statusCode: 201, startedAt, meta: { bid, uidHex: uidHex || null, claimStatus, posValidated, pinValidated } });

  return json({
    ok: true,
    claimId,
    leadId,
    status: claimStatus,
    tokenId: null,
    txHash: null,
    tenant: { slug: auth.context.tenantSlug, name: auth.context.tenantName },
    bid,
    uidMasked: uidHex ? `${uidHex.slice(0, 4)}****${uidHex.slice(-4)}` : null,
    policy: {
      activeForClaim,
      pinRequired,
      pinValidated,
      claimRequiresPos,
      posValidated,
      carrierProfileCode,
      secureOwnershipCarrier,
      hasPhysicalTagIdentity,
      autoClaimEnabled,
      reason: claimStatus === "claimed"
        ? (posValidated ? "verified_purchase_pos_token" : "sdk_auto_claim_enabled")
        : "pending_brand_or_purchase_verification",
    },
    traceId: auth.context.traceId,
  }, 201);
}
