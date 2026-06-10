import { json } from "../../../../lib/http";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { claimOwnershipForConsumer } from "../../../../lib/consumer-portal-service";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import { requireSunFreshHandoff } from "../../../../lib/sun-fresh-handoff";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { getTapEvent } from "../../../../lib/loyalty-service";
import { createAlert } from "../../../../lib/alert-engine";

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
