import { createHash } from "node:crypto";
import { json } from "../../../../lib/http";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { claimOwnershipForConsumer } from "../../../../lib/consumer-portal-service";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import { requireSunFreshHandoff } from "../../../../lib/sun-fresh-handoff";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { getTapEvent } from "../../../../lib/loyalty-service";
import { createAlert } from "../../../../lib/alert-engine";
import { sql } from "../../../../lib/db";
import { performReceiptOcr } from "../../../../lib/ocr-service";
import { getRequestMeta } from "../../../../lib/request-meta";
import { hitSunRateLimit, readSunRateLimit } from "../../../../lib/sun-rate-limit-store";

const CLAIM_PIN_DEVICE_MAX_ATTEMPTS = 5;
const CLAIM_PIN_PRODUCT_MAX_ATTEMPTS = 20;
const CLAIM_PIN_WINDOW_SECONDS = 15 * 60;

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function claimPinRateKeys(req: Request, event: Record<string, unknown>) {
  const meta = getRequestMeta(req);
  const productIdentity = `${event.tenant_id || "tenant"}:${event.id || "event"}:${event.uid_hex || "uid"}`;
  const clientIdentity = `${meta.ip || "no-ip"}:${meta.userAgent || "no-ua"}`;
  return {
    device: sha256Hex(`${productIdentity}:${clientIdentity}`),
    product: sha256Hex(productIdentity),
  };
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
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, 400);
  const { bid, uid, eventId } = target;

  const auth = requireShareToken(req, bid, target.shareUid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);
  const fresh = requireSunFreshHandoff(req, body, { bid, eventId });
  if (!eventId || !fresh.ok) {
    const freshReason = fresh.ok ? "fresh_event_required" : fresh.reason;
    return json({
      ok: false,
      reason: "fresh_physical_tap_required_for_ownership",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: freshReason,
    }, 403);
  }

  const event = await getTapEvent(eventId);
  if (!event) return json({ ok: false, reason: "event_not_found", trace_id: traceId }, 404);

  // 0. Query Tag and Batch Security Policies (POS Activation & PIN Requirement)
  const tagRows = await sql`
    SELECT 
      t.claim_pin_required AS tag_claim_pin_required,
      t.hash_pin AS tag_hash_pin,
      t.active_for_claim AS tag_active_for_claim,
      b.claim_pin_required AS batch_claim_pin_required,
      b.hash_pin AS batch_hash_pin,
      b.active_for_claim AS batch_active_for_claim,
      b.sdm_config AS batch_sdm_config
    FROM tags t
    JOIN batches b ON b.id = t.batch_id
    WHERE t.uid_hex = ${event.uid_hex} AND b.id = ${event.batch_id}
    LIMIT 1
  `;
  const tagRow = tagRows[0];
  if (!tagRow) return json({ ok: false, reason: "tag_not_found", error: "El tag no está registrado.", trace_id: traceId }, 404);

  const activeForClaim = tagRow.tag_active_for_claim !== null && tagRow.tag_active_for_claim !== undefined
    ? Boolean(tagRow.tag_active_for_claim)
    : tagRow.batch_active_for_claim !== null && tagRow.batch_active_for_claim !== undefined
    ? Boolean(tagRow.batch_active_for_claim)
    : true; // Default to true for legacy tags

  if (!activeForClaim) {
    return json({
      ok: false,
      reason: "pos_activation_pending",
      error: "Este producto requiere ser activado en caja al momento del pago. Por favor solicita la activación al comercio.",
      trace_id: traceId,
    }, 403);
  }

  const pinRequired = tagRow.tag_claim_pin_required !== null && tagRow.tag_claim_pin_required !== undefined
    ? Boolean(tagRow.tag_claim_pin_required)
    : Boolean(tagRow.batch_claim_pin_required || (tagRow.batch_sdm_config as any)?.claim_pin_required);

  if (pinRequired) {
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    if (!pin) {
      return json({
        ok: false,
        reason: "pin_required",
        error: "Se requiere ingresar el PIN de seguridad oculto bajo la cápsula de la botella.",
        trace_id: traceId,
      }, 400);
    }

    const rateKeys = claimPinRateKeys(req, event as Record<string, unknown>);
    let currentRate;
    try {
      currentRate = await Promise.all([
        readSunRateLimit("claim_pin_device", rateKeys.device, CLAIM_PIN_WINDOW_SECONDS, CLAIM_PIN_DEVICE_MAX_ATTEMPTS),
        readSunRateLimit("claim_pin_product", rateKeys.product, CLAIM_PIN_WINDOW_SECONDS, CLAIM_PIN_PRODUCT_MAX_ATTEMPTS),
      ]);
    } catch {
      return json({ ok: false, reason: "claim_pin_security_unavailable", trace_id: traceId }, 503, { "cache-control": "no-store" });
    }
    if (currentRate.some((entry) => entry.limited)) {
      return json({
        ok: false,
        reason: "claim_pin_locked",
        error: "Demasiados intentos. Espera 15 minutos o solicita asistencia al emisor.",
        trace_id: traceId,
        retry_after_seconds: CLAIM_PIN_WINDOW_SECONDS,
      }, 429, { "cache-control": "no-store", "retry-after": String(CLAIM_PIN_WINDOW_SECONDS) });
    }

    const storedPinHash = tagRow.tag_hash_pin || tagRow.batch_hash_pin || (tagRow.batch_sdm_config as any)?.hash_pin || (tagRow.batch_sdm_config as any)?.claim_pin_hash;
    const candidateHashes = [
      sha256Hex(pin),
      sha256Hex(`${event.tenant_id}:${event.bid}:${event.uid_hex}:${pin}`),
      sha256Hex(`${event.tenant_id}:${event.bid}:${pin}`)
    ];

    if (!storedPinHash || !candidateHashes.includes(storedPinHash)) {
      const recorded = await Promise.all([
        hitSunRateLimit("claim_pin_device", rateKeys.device, CLAIM_PIN_WINDOW_SECONDS, CLAIM_PIN_DEVICE_MAX_ATTEMPTS),
        hitSunRateLimit("claim_pin_product", rateKeys.product, CLAIM_PIN_WINDOW_SECONDS, CLAIM_PIN_PRODUCT_MAX_ATTEMPTS),
      ]).catch(() => null);
      if (!recorded || recorded.some((entry) => entry.unavailable)) {
        return json({ ok: false, reason: "claim_pin_security_unavailable", trace_id: traceId }, 503, { "cache-control": "no-store" });
      }
      if (recorded.some((entry) => entry.limited)) {
        return json({
          ok: false,
          reason: "claim_pin_locked",
          error: "Demasiados intentos. Espera 15 minutos o solicita asistencia al emisor.",
          trace_id: traceId,
          retry_after_seconds: CLAIM_PIN_WINDOW_SECONDS,
        }, 429, { "cache-control": "no-store", "retry-after": String(CLAIM_PIN_WINDOW_SECONDS) });
      }
      return json({
        ok: false,
        reason: "invalid_pin",
        error: "El PIN de seguridad ingresado es incorrecto. Verificá los caracteres bajo la cápsula.",
        trace_id: traceId,
      }, 403);
    }
  }

  // Security Checks: Location & Device Verification
  const host = req.headers.get("host") || "";
  const isLocal = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(?::\d+)?$/i.test(host);

  if (!isLocal) {
    // 1. Mobile Device Check (User-Agent and Screen Size)
    const userAgent = req.headers.get("user-agent") || "";
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const screenSize = body.screenSize as { width?: number; height?: number } | undefined;
    const isDesktopScreen = screenSize && screenSize.width ? screenSize.width > 1024 : false;

    if (!isMobileUA || isDesktopScreen) {
      if (event.tenant_id) {
        await createAlert({
          tenantId: event.tenant_id,
          eventId: Number(eventId),
          type: "suspicious_claim_attempt",
          severity: "medium",
          title: "Intento de reclamo desde dispositivo no autorizado (Desktop/Spoofing)",
          details: {
            reason: "desktop_detected",
            user_agent: userAgent,
            screen_size: screenSize || null,
            uid_hex: uid,
          },
        }).catch((err) => console.error("Failed to trigger security alert", err));
      }

      return json({
        ok: false,
        reason: "mobile_device_required",
        error: "Se requiere un dispositivo móvil físico para reclamar la propiedad del producto.",
        trace_id: traceId,
        share_token_status: auth.share_token_status,
      }, 400);
    }

    // 2. Geolocation Availability Check
    const clientLat = typeof body.latitude === "number" ? body.latitude : null;
    const clientLng = typeof body.longitude === "number" ? body.longitude : null;

    if (clientLat === null || clientLng === null) {
      if (event.tenant_id) {
        await createAlert({
          tenantId: event.tenant_id,
          eventId: Number(eventId),
          type: "suspicious_claim_attempt",
          severity: "low",
          title: "Intento de reclamo sin geolocalización activa",
          details: {
            reason: "gps_missing",
            user_agent: userAgent,
            uid_hex: uid,
          },
        }).catch((err) => console.error("Failed to trigger security alert", err));
      }

      return json({
        ok: false,
        reason: "gps_location_required",
        error: "Por seguridad, debes permitir el acceso a la ubicación (GPS) en tu celular para verificar que estás junto al producto.",
        trace_id: traceId,
        share_token_status: auth.share_token_status,
      }, 400);
    }

    // 3. Distance Verification (Haversine formula against original tap event geo_lat/geo_lng)
    const eventLat = event.geo_lat !== null && event.geo_lat !== undefined ? Number(event.geo_lat) : null;
    const eventLng = event.geo_lng !== null && event.geo_lng !== undefined ? Number(event.geo_lng) : null;

    if (eventLat !== null && eventLng !== null) {
      const distance = getDistanceKm(clientLat, clientLng, eventLat, eventLng);
      // Threshold: 150 km
      if (distance > 150) {
        if (event.tenant_id) {
          await createAlert({
            tenantId: event.tenant_id,
            eventId: Number(eventId),
            type: "suspicious_claim_attempt",
            severity: "high",
            title: "Reclamo denegado: Inconsistencia de ubicación física (Posible link compartido)",
            details: {
              reason: "location_mismatch",
              client_gps: { lat: clientLat, lng: clientLng, accuracy: body.accuracy || null },
              event_gps: { lat: eventLat, lng: eventLng },
              distance_km: Math.round(distance * 10) / 10,
              user_agent: userAgent,
              uid_hex: uid,
            },
          }).catch((err) => console.error("Failed to trigger security alert", err));
        }

        return json({
          ok: false,
          reason: "location_mismatch",
          error: "La ubicación de tu celular no coincide con el lugar del escaneo. Por seguridad, debes escanear la botella estando cerca de ella.",
          trace_id: traceId,
          share_token_status: auth.share_token_status,
          distance_km: Math.round(distance * 10) / 10,
        }, 400);
      }
    }
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

    let ocrResult = null;
    if (receiptFileData) {
      let expectedProduct = "Gran Reserva Malbec";
      let expectedWinery = "Bodega Demo";
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
        receiptFileData,
        expectedProduct,
        expectedWinery,
        receiptFileName
      );

      console.log(`[OCR Result] compliance_score: ${ocrResult.compliance_score}, is_invoice: ${ocrResult.is_invoice}, product_matched: ${ocrResult.product_matched}`);

      if (ocrResult.compliance_score < 40 || !ocrResult.is_invoice) {
        return json({
          ok: false,
          reason: "compliance_failed",
          error: "El comprobante subido no parece ser una factura o ticket de compra válido. Por favor, subí una foto clara del comprobante.",
          trace_id: traceId,
        }, 400);
      }

      if (!ocrResult.product_matched) {
        return json({
          ok: false,
          reason: "compliance_failed",
          error: `El comprobante no menciona el producto de la bodega (${expectedProduct}). Verificá que la factura corresponda a la compra del vino.`,
          trace_id: traceId,
        }, 400);
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

    const claim = await claimOwnershipForConsumer({
      consumerId: consumer.id,
      eventId,
      bid,
      uidHex: uid,
      source: "sun_passport",
      trustSnapshot: {
        trace_id: traceId,
        share_token_status: auth.share_token_status,
        fresh_handoff_exp: fresh.payload.exp,
        client_gps: {
          latitude: body.latitude,
          longitude: body.longitude,
          accuracy: body.accuracy,
        },
        client_device: {
          screen_size: body.screenSize,
          device_fingerprint: body.deviceFingerprint,
        },
        // Guardamos los datos de comprobante para auditoría y verificación NFT
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
        { ok: false, reason: claim.error, trace_id: traceId, share_token_status: auth.share_token_status, ownership: claim.ownership || null },
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
      ownership_status: claim.ownership?.status || "claimed",
      ownership_mode: "durable",
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
      required: ["fresh_physical_tap", "verified_email_or_phone"],
      optional: ["purchase_receipt", "retailer_pos_token", "wallet_address"],
      unlocks: ["durable_passport_ownership", "wallet_connection", "nft_tokenization_request", "marketplace_listing"],
    },
  }, 401);
}
