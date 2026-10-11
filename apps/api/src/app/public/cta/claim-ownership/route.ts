import { createHash } from "node:crypto";
import { json as httpJson } from "../../../../lib/http";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { claimOwnershipForConsumer } from "../../../../lib/consumer-portal-service";
import { readConsumerOwnershipClaimContext, consumeAndAuthorizeConsumerOwnershipClaim } from "../../../../lib/consumer-vertical-writer-policy";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import { ensureConsumerPortalSchema, ensureSdkSchema } from "../../../../lib/commercial-runtime-schema";
import { createAlert } from "../../../../lib/alert-engine";
import { sql } from "../../../../lib/db";
import { evaluateReceiptOcrForOwnership, performReceiptOcr, validateReceiptImageDataUrl } from "../../../../lib/ocr-service";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { normalizeConsentedApproximateLocation } from "../../../../lib/approximate-location";

const MAX_CLAIM_REQUEST_BYTES = 8 * 1024 * 1024;

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(req: Request) {
  let freshSpent = false;
  const json = (body: Record<string, any>, status = 200, headers?: Record<string, string>) => httpJson({ ...body, ...(status >= 400 ? { fresh_tap_required: body.operation_committed === true ? false : freshSpent } : {}) }, status, headers);
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "platform",
    subjectId: "claim-ownership:public",
  });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_CLAIM_REQUEST_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json", trace_id: traceId }, tooLarge ? 413 : 400);
  }
  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, 400);
  const { bid, uid, eventId } = target;

  const auth = requireShareToken(req, bid, target.shareUid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);
  if (!eventId) {
    return json({
      ok: false,
      reason: "fresh_nfc_evidence_required_for_ownership",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "fresh_event_required",
    }, 403);
  }
  // Normal verified consumer auth remains separate from the NFC capability.
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, reason: "consumer_auth_required", next_step: "verify_email_or_phone", ownership_created: false, trace_id: traceId }, 401);
  const precheck = await readConsumerOwnershipClaimContext(eventId, consumer.id, typeof body.receiptFileData === "string" && body.receiptFileData.length > 0);
  if (!precheck.ok) return json({ ok: false, reason: precheck.error, ownership_created: false, trace_id: traceId }, precheck.error === "tap_policy_unavailable" ? 503 : 403, { "cache-control": "no-store" });
  const event = precheck.context.event;
  if (event.bid !== bid || String(event.uid_hex).trim().toUpperCase() !== String(uid).trim().toUpperCase()) return json({ ok: false, reason: "tenant_batch_mismatch", trace_id: traceId }, 403);
  const authorized = await consumeAndAuthorizeConsumerOwnershipClaim(req, body, precheck.context, "public_claim_ownership");
  if (!authorized.ok) {
    freshSpent = authorized.freshTapRequired;
    return json({ ok: false, reason: authorized.error,
      error: authorized.error === "claim_pin_locked" ? "Demasiados intentos. Espera 15 minutos o solicita asistencia al emisor." : authorized.error, trace_id: traceId,
      fresh_token_status: "freshTokenStatus" in authorized ? authorized.freshTokenStatus : undefined,
      ...("retryAfterSeconds" in authorized ? { retry_after_seconds: authorized.retryAfterSeconds } : {}) }, authorized.status,
      { "cache-control": "no-store", ...("retryAfterSeconds" in authorized ? { "retry-after": String(authorized.retryAfterSeconds) } : {}) });
  }
  freshSpent = true;
  try {
  const fresh = authorized.fresh;
  const pinVerification = authorized.pinVerification;
  const pinRequired = precheck.context.pinRequired;
  const activeForClaim = true;
  const claimPolicy = precheck.context.claimPolicy;
  const tagRow = { tag_id: event.current_tag_id };

  // UA, screen and geolocation are spoofable client-reported risk signals.
  // They never prove a physical device, proximity, custody or ownership.
  const userAgent = req.headers.get("user-agent") || "";
  const isMobileUaReported = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const screenSize = body.screenSize as { width?: number; height?: number } | undefined;
  const approximateLocation = normalizeConsentedApproximateLocation({
    consent: body.locationConsent,
    precision: body.geoPrecision,
    lat: body.latitude,
    lng: body.longitude,
    accuracy: body.accuracy,
  });
  const clientLat = approximateLocation.lat;
  const clientLng = approximateLocation.lng;
  const eventLat = event.geo_lat !== null && event.geo_lat !== undefined && Number.isFinite(Number(event.geo_lat))
    ? Number(event.geo_lat)
    : null;
  const eventLng = event.geo_lng !== null && event.geo_lng !== undefined && Number.isFinite(Number(event.geo_lng))
    ? Number(event.geo_lng)
    : null;
  const reportedDistanceKm = clientLat !== null && clientLng !== null && eventLat !== null && eventLng !== null
    ? Math.round(getDistanceKm(clientLat, clientLng, eventLat, eventLng) * 10) / 10
    : null;
  const reportedClientSignals = {
    provenance: "client_reported_spoofable",
    authorization_role: "risk_signal_only",
    mobile_user_agent_reported: isMobileUaReported,
    screen_size_reported: screenSize || null,
    location_reported: clientLat !== null && clientLng !== null,
    location_consent: body.locationConsent === true,
    location_precision: approximateLocation.accepted ? "approximate" : "not_stored",
    location_normalization: approximateLocation.reason,
    location: clientLat !== null && clientLng !== null
      ? { latitude: clientLat, longitude: clientLng, accuracy: approximateLocation.accuracy }
      : null,
    distance_from_event_reported_km: reportedDistanceKm,
  };
  if (event.tenant_id && (!isMobileUaReported || (reportedDistanceKm !== null && reportedDistanceKm > 150))) {
    await createAlert({
      tenantId: event.tenant_id,
      tenantSlug: event.tenant_slug,
      eventId: Number(eventId),
      type: "suspicious_claim_attempt",
      severity: reportedDistanceKm !== null && reportedDistanceKm > 150 ? "high" : "low",
      title: "Señales cliente reportadas requieren revisión de riesgo",
      details: { ...reportedClientSignals, uid_hex: uid },
    }).catch((err) => console.error("Failed to record reported client risk signals", err));
  }

  await ensureConsumerPortalSchema();
  const consumer = await getConsumerFromRequest(req);
  if (consumer && eventId) {
    const receiptDate = typeof body.receiptDate === "string" ? body.receiptDate : null;
    const receiptTime = typeof body.receiptTime === "string" ? body.receiptTime : null;
    const receiptPrice = typeof body.receiptPrice === "number" ? body.receiptPrice : null;
    const receiptEstablishment = typeof body.receiptEstablishment === "string" ? body.receiptEstablishment : null;
    const receiptFileName = typeof body.receiptFileName === "string" ? body.receiptFileName : null;
    const receiptFileData = typeof body.receiptFileData === "string" ? body.receiptFileData : null;

    if (claimPolicy === "purchase_proof_required" && !receiptFileData) {
      return json({
        ok: false,
        reason: "purchase_receipt_required",
        error: "La política del producto exige un comprobante para revisión antes de crear titularidad digital.",
        review_required: true,
        trace_id: traceId,
      }, 400);
    }

    let ocrResult = null;
    if (receiptFileData) {
      const receiptImage = validateReceiptImageDataUrl(receiptFileData);
      if (!receiptImage.ok) {
        return json({ ok: false, reason: receiptImage.reason, trace_id: traceId }, receiptImage.status);
      }
      let expectedProduct = "Producto configurado";
      let expectedWinery = "Emisor configurado";
      try {
        if (event.batch_id) {
          const batchRows = await sql`SELECT sdm_config FROM batches WHERE id = ${event.batch_id} LIMIT 1`;
          const sdmConfig = batchRows[0]?.sdm_config as any;
          const resolvedName = sdmConfig?.sun?.product?.name || sdmConfig?.productName || sdmConfig?.product_name || sdmConfig?.title;
          if (resolvedName) expectedProduct = String(resolvedName);
        }
        if (event.tenant_id) {
          const tenantRows = await sql`SELECT name FROM tenants WHERE id = ${event.tenant_id} LIMIT 1`;
          const resolvedWinery = tenantRows[0]?.name;
          if (resolvedWinery) expectedWinery = String(resolvedWinery);
        }
      } catch (err) {
        console.warn("Failed to resolve product/winery metadata in claim:", err);
      }

      console.log(`[OCR Verification] Auditing uploaded file for: ${expectedProduct} by ${expectedWinery}`);
      ocrResult = await performReceiptOcr(
        receiptImage.dataUrl,
        expectedProduct,
        expectedWinery,
        receiptFileName
      );

      console.log(`[OCR Result] extraction_score: ${ocrResult.compliance_score}, invoice_reported: ${ocrResult.is_invoice}, product_match_reported: ${ocrResult.product_matched}`);

      const ocrDecision = evaluateReceiptOcrForOwnership(ocrResult);
      try {
        await ensureSdkSchema();
        const contact = String(consumer.email || consumer.phone || `consumer:${consumer.id}`).slice(0, 320);
        const receiptDigest = sha256Hex(receiptImage.dataUrl);
        const reviewRows = await sql/*sql*/`
          INSERT INTO sdk_claim_requests (
            tenant_id, batch_id, tag_id, bid, uid_hex, contact, name,
            claim_status, pin_validated, active_for_claim, pos_validated, meta
          ) VALUES (
            ${event.tenant_id}, ${event.batch_id}, ${tagRow.tag_id}, ${bid}, ${uid}, ${contact}, ${consumer.name || null},
            'pending_manual_review', ${Boolean(pinRequired)}, ${Boolean(activeForClaim)}, false,
            ${JSON.stringify({
              source: "public_receipt_review",
              event_id: eventId,
              receipt_sha256: receiptDigest,
              receipt_attachment_stored: false,
              ocr_provenance: ocrResult.provenance,
              ocr_extraction_score: ocrResult.compliance_score,
              ocr_invoice_reported: ocrResult.is_invoice,
              ocr_product_match_reported: ocrResult.product_matched,
              review_reason: ocrDecision.reason,
              ownership_scope: "digital_title_record",
              physical_custody_verified: false,
              claim_pin_verification: pinVerification ? {
                algorithm: pinVerification.algorithm,
                needs_rotation: pinVerification.needsRotation,
              } : null,
            })}::jsonb
          )
          RETURNING id::text AS id, created_at
        `;
        const reviewRequest = reviewRows[0];
        if (!reviewRequest?.id) throw new Error("ownership_review_request_not_persisted");
        return json({
          ok: true,
          action: "claim_ownership",
          outcome: "request_recorded",
          request_status: "pending_manual_review",
          ownership_status: "not_claimed",
          ownership_created: false,
          review_required: true,
          review_reason: ocrDecision.reason,
          review_request: { id: reviewRequest.id, recorded_at: reviewRequest.created_at },
          receipt_evidence: {
            sha256: receiptDigest,
            attachment_stored: false,
            next_step: "secure_attachment_or_pos_review_required",
          },
          ocr_provenance: ocrResult.provenance,
          evidence_boundary: "OCR assists extraction only; it does not validate payment, retailer, custody or ownership.",
          trace_id: traceId,
        }, 202);
      } catch (error) {
        console.error("[ownership_review_request] persistence failed", error);
        return json({
          ok: false,
          reason: "ownership_review_persistence_failed",
          ownership_status: "not_claimed",
          review_required: true,
          trace_id: traceId,
        }, 503);
      }
    }

    // Mercado Gris check
    let isGrayMarket = false;
    let targetCountry: string | null = null;
    const scanCountry = event.country_code ? String(event.country_code).trim().toUpperCase() : null;

    if (event.batch_id) {
      const batchRows = await sql`
        SELECT sdm_config 
        FROM batches 
        WHERE id = ${event.batch_id}
        LIMIT 1
      `;
      const sdmConfig = batchRows[0]?.sdm_config as Record<string, any> | undefined;
      const rawTarget = sdmConfig?.target_country || sdmConfig?.target_market || sdmConfig?.export_market;
      if (typeof rawTarget === "string" && rawTarget.trim()) {
        targetCountry = rawTarget.trim().toUpperCase();
        if (scanCountry && scanCountry !== targetCountry) {
          isGrayMarket = true;
        }
      }
    }

    if (isGrayMarket && event.tenant_id) {
      await createAlert({
        tenantId: event.tenant_id,
        tenantSlug: event.tenant_slug,
        eventId: Number(eventId),
        type: "suspicious_claim_attempt",
        severity: "high",
        title: "Sospecha de Mercado Gris (Desvío de Distribución)",
        details: {
          reason: "gray_market_detected",
          scan_country: scanCountry,
          target_country: targetCountry,
          uid_hex: uid,
          bid,
        },
      }).catch((err) => console.error("Failed to trigger gray market alert", err));
    }

    if (!authorized.authorization) return json({ ok: false, reason: "purchase_receipt_required", ownership_created: false, review_required: true, trace_id: traceId }, 403, { "cache-control": "no-store" });
    const claim = await claimOwnershipForConsumer({
      consumerId: consumer.id,
      eventId,
      authorization: authorized.authorization,
      bid,
      uidHex: uid,
      source: "sun_passport",
      trustSnapshot: {
        trace_id: traceId,
        share_token_status: auth.share_token_status,
        fresh_handoff_exp: fresh.payload.exp,
        reported_client_signals: reportedClientSignals,
        claim_pin_verification: pinVerification ? {
          algorithm: pinVerification.algorithm,
          needs_rotation: pinVerification.needsRotation,
        } : null,
        // El comprobante y OCR quedan como material de revisión, no como validación de pago.
        receipt_details: {
          date: receiptDate,
          time: receiptTime,
          price: receiptPrice,
          establishment: receiptEstablishment,
          file_name: receiptFileName,
          file_preview: receiptFileData ? receiptFileData.slice(0, 1000) + "..." : null,
          ocr_analysis: ocrResult,
        },
        gray_market: {
          detected: isGrayMarket,
          scan_country: scanCountry,
          target_country: targetCountry,
        },
      },
    });
    if (!claim.ok) {
      return json(
        {
          ok: false,
          reason: claim.error,
          trace_id: traceId,
          share_token_status: auth.share_token_status,
          ownership: claim.ownership || null,
          operation_committed: "operationCommitted" in claim ? claim.operationCommitted : false,
          reconciliation: "operationCommitted" in claim && claim.operationCommitted
            ? "The title is saved. Reconcile the original canonical receipt; do not repeat the claim."
            : null,
        },
        claim.status,
      );
    }
    return json({
      ok: true,
      action: "claim_ownership",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "accepted",
      ownership: claim.ownership,
      canonical_event: claim.canonicalEvent,
      webhook_outbox: claim.canonicalEvent.webhookOutbox,
      ownership_status: claim.ownership?.status || "claimed",
      ownership_mode: "durable",
      ownership_scope: "nexid_off_chain_digital_title",
      chain_transfer_status: "not_executed",
      nft_transfer_executed: false,
      on_chain_owner_verified: false,
      physical_custody_verified: false,
      evidence_boundary: "Recent NFC evidence plus tenant policy authorized an off-chain nexID digital title record. No NFT transfer was executed and this does not certify physical custody or proximity.",
    });
  }

  return json({
    ok: false,
    reason: "consumer_auth_required",
    action: "claim_ownership",
    trace_id: traceId,
    share_token_status: auth.share_token_status,
    fresh_token_status: "accepted",
    next_step: "verify_email_or_phone",
    claim_protocol: {
      required: ["recent_nfc_message_evidence", "verified_email_or_phone", "tenant_claim_policy"],
      authorization: ["retailer_pos_activation", "inside_pack_pin", "tenant_manual_approval"],
      review_only: ["purchase_receipt_ocr", "client_reported_location", "user_agent"],
      unlocks: ["durable_digital_title_record", "wallet_connection", "nft_tokenization_request", "marketplace_listing"],
      boundary: "UA and client GPS are spoofable risk signals; they do not prove a physical device, proximity or custody.",
    },
  }, 401);
  } catch { return json({ ok: false, reason: "ownership_write_unavailable", ownership_created: false, trace_id: traceId }, 503, { "cache-control": "no-store" }); }
}
