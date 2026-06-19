export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ensureSdkSchema } from "../../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { authenticateSdkRequest } from "../../../../../lib/sdk-auth";
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
  const auth = await authenticateSdkRequest(req, "sdk:claim");
  if (!auth.ok) return auth.response;

  await ensureSdkSchema();
  const body = asRecord(await req.json().catch(() => ({})));
  const contact = clean(body.contact || body.email || body.phone || body.whatsapp);
  const name = clean(body.name);
  const bid = clean(body.bid);
  const uidHex = clean(body.uidHex || body.uid_hex).toUpperCase();
  const pin = clean(body.pin);
  if (!contact || !bid) {
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
  if (!row) return json({ ok: false, reason: "batch_not_found_for_tenant", bid, trace_id: auth.context.traceId }, 404);
  if (uidHex && !clean(row.tag_id)) return json({ ok: false, reason: "tag_not_found_for_batch", bid, uidHex, trace_id: auth.context.traceId }, 404);

  const sdmConfig = readJsonObject(row.sdm_config);
  const carrierProfileCode = clean(row.carrier_profile_code || row.tag_carrier_profile_code || row.batch_carrier_profile_code || sdmConfig.carrier_profile_code) || null;
  const activeForClaim = row.tag_active_for_claim !== null && row.tag_active_for_claim !== undefined
    ? Boolean(row.tag_active_for_claim)
    : Boolean(row.batch_active_for_claim || sdmConfig.active_for_claim);
  const pinRequired = row.tag_claim_pin_required !== null && row.tag_claim_pin_required !== undefined
    ? Boolean(row.tag_claim_pin_required)
    : Boolean(row.batch_claim_pin_required || sdmConfig.claim_pin_required);
  const storedPinHash = clean(row.tag_hash_pin || row.batch_hash_pin || sdmConfig.hash_pin || sdmConfig.claim_pin_hash);
  if (pinRequired && !storedPinHash) {
    return json({ ok: false, reason: "pin_policy_misconfigured", bid, trace_id: auth.context.traceId }, 409);
  }
  if (pinRequired && !pin) {
    return json({ ok: false, reason: "pin_required", bid, uidHex: uidHex || null, trace_id: auth.context.traceId }, 403);
  }
  const pinValidated = pinRequired ? pinMatches({ storedHash: storedPinHash, pin, tenantId: auth.context.tenantId, bid, uidHex }) : false;
  if (pinRequired && !pinValidated) {
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
    activeForClaim,
    carrierProfileCode,
  };
  const gps = asRecord(body.gps);
  const lat = numberOrNull(gps.lat ?? gps.latitude);
  const lng = numberOrNull(gps.lng ?? gps.longitude);
  const secureOwnershipCarrier = isSecureOwnershipCarrier(carrierProfileCode);
  const autoClaimEnabled = Boolean(sdmConfig.sdk_auto_claim_enabled || sdmConfig.auto_claim_enabled);
  const claimStatus = activeForClaim && secureOwnershipCarrier && (!pinRequired || pinValidated) && autoClaimEnabled
    ? "claimed"
    : "pending_verification";

  const leadRows = await sql/*sql*/`
    INSERT INTO leads (
      locale, contact, name, email, phone, company, country, vertical, role_interest, estimated_volume, tag_type,
      source, status, message, notes, tenant_id, meta
    ) VALUES (
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
        `carrier=${carrierProfileCode || "unknown"}`,
      ].filter(Boolean).join(" | ")},
      ${auth.context.tenantId},
      ${JSON.stringify({ ...meta, gps: { ...gps, lat, lng } })}::jsonb
    )
    RETURNING id::text AS id
  `;
  const leadId = String((leadRows[0] as { id?: string } | undefined)?.id || "");

  const claimRows = await sql/*sql*/`
    INSERT INTO sdk_claim_requests (
      tenant_id, api_key_id, lead_id, batch_id, tag_id, bid, uid_hex, contact, name,
      claim_status, pin_validated, active_for_claim, carrier_profile_code, meta
    ) VALUES (
      ${auth.context.tenantId},
      ${auth.context.apiKeyId},
      ${leadId || null},
      ${clean(row.batch_id)},
      ${clean(row.tag_id) || null},
      ${bid},
      ${uidHex || null},
      ${contact},
      ${name || null},
      ${claimStatus},
      ${pinValidated},
      ${activeForClaim},
      ${carrierProfileCode || null},
      ${JSON.stringify(meta)}::jsonb
    )
    RETURNING id::text AS id, claim_status
  `;
  const claimId = String((claimRows[0] as { id?: string } | undefined)?.id || "");

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
      carrierProfileCode,
      secureOwnershipCarrier,
      autoClaimEnabled,
      reason: claimStatus === "claimed"
        ? "sdk_auto_claim_enabled"
        : "pending_brand_or_purchase_verification",
    },
    traceId: auth.context.traceId,
  }, 201);
}

