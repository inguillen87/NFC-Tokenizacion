export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { ensureSunTenantProfilesSchema } from "../../../../lib/sun-tenant-profile-schema";
import { ensureTokenizationRequestsSchema } from "../../../../lib/tokenization-schema";
import { normalizeTokenizationStatus } from "../../../../lib/tokenization-status";
import { buildProductAssetProfile, readProductAssetMedia } from "../../../../lib/product-asset-profile";
import { isClaimableOwnershipResult } from "../../../../lib/ownership-policy";
import {
  createPublicCertificateShareToken,
  verifyPublicCertificateShareToken,
} from "../../../../lib/public-certificate-share";

function cleanId(value: unknown) {
  return String(value || "").trim();
}

function maskUid(uid: unknown) {
  const raw = String(uid || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (!raw) return null;
  if (raw.length <= 8) return `${raw.slice(0, 4)}****`;
  return `${raw.slice(0, 4)}****${raw.slice(-4)}`;
}

function nullableScanCount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function publicWebBase() {
  return (process.env.NEXT_PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.WEB_BASE_URL || "https://nexid.lat").replace(/\/$/, "");
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readPath(value: Record<string, unknown>, path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return current == null ? null : String(current);
}

function explorerUrl(network: unknown, txHash: unknown) {
  const tx = String(txHash || "").trim();
  if (!tx || tx.toUpperCase().includes("DEMO")) return null;
  const net = String(network || "").toLowerCase();
  if (net.includes("amoy")) return `https://amoy.polygonscan.com/tx/${encodeURIComponent(tx)}`;
  if (net.includes("polygon")) return `https://polygonscan.com/tx/${encodeURIComponent(tx)}`;
  return null;
}

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: rawEventId } = await params;
  const eventId = cleanId(rawEventId);
  if (!/^\d+$/.test(eventId)) return json({ ok: false, error: "invalid_event_id" }, 400);
  const shareToken = new URL(req.url).searchParams.get("share");
  const signedAccess = verifyPublicCertificateShareToken(eventId, shareToken);

  await Promise.all([
    ensureConsumerPortalSchema(),
    ensureSunTenantProfilesSchema(),
    ensureTokenizationRequestsSchema(),
  ]);

  const rows = await sql/*sql*/`
    SELECT
      e.id AS event_id,
      e.tenant_id,
      e.batch_id,
      e.uid_hex,
      e.result,
      e.reason,
      e.created_at,
      e.city,
      e.country_code,
      e.lat,
      e.lng,
      tn.slug AS tenant_slug,
      tn.name AS tenant_name,
      b.bid,
      b.sdm_config,
      tsp.vertical AS tenant_vertical,
      tsp.club_name,
      tsp.origin_label,
      tsp.origin_lat,
      tsp.origin_lng,
      t.id AS tag_id,
      t.status AS tag_status,
      t.scan_count,
      tp.product_name,
      tp.sku,
      tp.winery,
      tp.region,
      tp.vintage,
      tp.grape_varietal,
      tp.image_url,
      tp.locale_data,
      ow.status AS ownership_status,
      ow.claimed_at AS ownership_claimed_at,
      tok.status AS tokenization_status,
      tok.network AS tokenization_network,
      tok.tx_hash AS tokenization_tx_hash,
      tok.token_id AS tokenization_token_id,
      tok.anchor_hash AS tokenization_anchor_hash,
      tok.processed_at AS tokenization_processed_at
    FROM events e
    JOIN tenants tn ON tn.id = e.tenant_id
    LEFT JOIN batches b ON b.id = e.batch_id
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = e.tenant_id
    LEFT JOIN tags t ON t.batch_id = e.batch_id AND UPPER(t.uid_hex) = UPPER(COALESCE(e.uid_hex, ''))
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    LEFT JOIN LATERAL (
      SELECT status, claimed_at
      FROM consumer_product_ownerships o
      WHERE o.tenant_id = e.tenant_id
        AND (
          o.event_id = e.id
          OR (COALESCE(e.uid_hex, '') <> '' AND UPPER(o.uid_hex) = UPPER(e.uid_hex))
        )
      ORDER BY (o.status = 'claimed') DESC, o.claimed_at DESC
      LIMIT 1
    ) ow ON TRUE
    LEFT JOIN LATERAL (
      SELECT status, network, tx_hash, token_id, anchor_hash, processed_at, requested_at
      FROM tokenization_requests tr
      WHERE COALESCE(e.uid_hex, '') <> ''
        AND tr.tenant_id = e.tenant_id
        AND UPPER(tr.uid_hex) = UPPER(e.uid_hex)
        AND (
          tr.batch_id = e.batch_id
          OR (b.bid IS NOT NULL AND tr.bid = b.bid)
        )
      ORDER BY tr.requested_at DESC
      LIMIT 1
    ) tok ON TRUE
    WHERE e.id = ${eventId}
      AND (LOWER(COALESCE(e.source::text, '')) = 'demo' OR ${signedAccess})
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return json(
      { ok: false, error: "certificate_not_found" },
      404,
      { "cache-control": "public, max-age=20, stale-while-revalidate=120" },
    );
  }

  const sdmConfig = readJsonObject(row.sdm_config);
  const localeData = readJsonObject(row.locale_data);
  const productConfig = readJsonObject(sdmConfig.sun && typeof sdmConfig.sun === "object" ? (sdmConfig.sun as Record<string, unknown>).product : null);
  const originConfig = readJsonObject(sdmConfig.sun && typeof sdmConfig.sun === "object" ? (sdmConfig.sun as Record<string, unknown>).origin : null);
  const productName = String(row.product_name || productConfig.name || row.sku || "Producto asociado");
  const brandName = String(row.winery || productConfig.producer || row.tenant_name || "Marca asociada");
  const originLabel = String(row.origin_label || row.region || originConfig.label || readPath(localeData, ["origin", "label"]) || "Origen registrado");
  const media = readProductAssetMedia(row.locale_data);
  const assetProfile = buildProductAssetProfile({
    tenantSlug: row.tenant_slug,
    brandName,
    productName,
    bid: row.bid,
    vertical: row.tenant_vertical || readPath(localeData, ["vertical"]),
    category: readPath(localeData, ["category"]),
    imageUrl: media.imageUrl || row.image_url || null,
    labelImageUrl: media.labelImageUrl || null,
    modelUrl: media.modelUrl || null,
    galleryUrls: media.galleryUrls || [],
    sku: row.sku,
  });
  const tokenStatus = normalizeTokenizationStatus(row.tokenization_status);
  const txUrl = explorerUrl(row.tokenization_network, row.tokenization_tx_hash);
  const claimed = String(row.ownership_status || "").toLowerCase() === "claimed";
  const resultCode = String(row.result || "").toUpperCase();
  const tagMessageValidated = isClaimableOwnershipResult(resultCode);
  const replayBlocked = resultCode === "REPLAY_SUSPECT" || resultCode === "DUPLICATE";
  const tamperReview = resultCode.includes("TAMPER") && !tagMessageValidated;
  const issuedShareToken = (() => {
    try {
      return createPublicCertificateShareToken(eventId);
    } catch {
      return null;
    }
  })();
  const certificateUrl = `${publicWebBase()}/certificado/${row.event_id}${issuedShareToken ? `?share=${encodeURIComponent(issuedShareToken)}` : ""}`;
  const verificationState = tagMessageValidated
    ? (resultCode.includes("OPENED") ? "nfc_message_validated_tt_open_reported" : "nfc_message_validated_tt_closed_or_unavailable")
    : replayBlocked
      ? "replay_blocked"
      : tamperReview
        ? "tamper_review"
        : "not_verified";
  const evidenceState = tagMessageValidated
    ? (resultCode.includes("OPENED") ? "nfc_validated_tt_open_reported" : "nfc_validated_tt_closed_or_unavailable")
    : verificationState;
  const statusLabel = tagMessageValidated
    ? (claimed ? "Mensaje NFC validado · claim registrado" : resultCode.includes("OPENED") ? "Mensaje NFC validado · TT reporta apertura" : "Mensaje NFC validado")
    : replayBlocked
      ? "Replay bloqueado"
      : tamperReview
        ? "Requiere revision de tamper"
        : "Mensaje NFC no validado";

  const timelineRows = row.batch_id && row.uid_hex ? await sql/*sql*/`
    SELECT id, result, city, country_code, created_at
    FROM events
    WHERE batch_id = ${row.batch_id}
      AND UPPER(uid_hex) = UPPER(${row.uid_hex})
    ORDER BY created_at ASC
    LIMIT 8
  ` : [];

  const certificate = {
    id: `NX-CERT-${row.event_id}`,
    publicUrl: certificateUrl,
    links: {
      certificateUrl,
      walletUrl: tagMessageValidated ? `${publicWebBase()}/me/wallet?tenant=${encodeURIComponent(String(row.tenant_slug || ""))}&eventId=${encodeURIComponent(String(row.event_id))}` : null,
      marketplaceUrl: tagMessageValidated ? `${publicWebBase()}/me/marketplace${row.tenant_slug ? `?tenant=${encodeURIComponent(String(row.tenant_slug))}` : ""}` : null,
      explorerUrl: tagMessageValidated ? txUrl : null,
    },
    status: tagMessageValidated ? (claimed ? "claim_recorded" : "tag_message_validated") : evidenceState,
    statusLabel,
    verification: {
      state: verificationState,
      evidenceState,
      tagMessageValidated,
      nfcMessageValidated: tagMessageValidated,
      physicalAuthenticityConfirmed: false,
      authentic: null,
      authenticCompatibilityScope: "deprecated_ambiguous_alias_never_asserted",
      actionEligible: tagMessageValidated,
      resultCode: resultCode || "UNKNOWN",
      explainer: tagMessageValidated
        ? "nexID validó el mensaje NFC y aplicó la policy del lote. Esto no certifica contenido, origen, custodia ni propiedad física; Polygon, si aparece, registra un claim digital separado."
        : replayBlocked
          ? "El evento fue bloqueado por replay. No habilita ownership, garantía ni certificado digital."
          : "Este evento no aporta evidencia NFC suficiente y no habilita acciones de ownership.",
    },
    product: {
      name: productName,
      brand: brandName,
      sku: row.sku || null,
      imageUrl: assetProfile.primaryImageUrl || null,
      vertical: row.tenant_vertical || readPath(localeData, ["vertical"]) || "producto",
      vintage: row.vintage || productConfig.vintage || null,
      varietal: row.grape_varietal || productConfig.varietal || null,
      batch: row.bid || null,
    },
    assets: assetProfile,
    tenant: {
      slug: row.tenant_slug,
      name: row.tenant_name,
      clubName: row.club_name || null,
    },
    tap: {
      eventId: String(row.event_id),
      result: row.result || null,
      reason: row.reason || null,
      at: row.created_at || null,
      city: row.city || null,
      country: row.country_code || null,
      scans: nullableScanCount(row.scan_count),
    },
    origin: {
      label: originLabel,
      lat: row.origin_lat ?? originConfig.lat ?? readPath(localeData, ["origin", "lat"]) ?? null,
      lng: row.origin_lng ?? originConfig.lng ?? readPath(localeData, ["origin", "lng"]) ?? null,
    },
    identity: {
      uidMasked: maskUid(row.uid_hex),
      bid: row.bid || null,
      carrier: row.tag_status || null,
    },
    ownership: {
      status: row.ownership_status || "not_claimed",
      claimed,
      actionEligible: tagMessageValidated,
      recordScope: "nexid_off_chain",
      onChainOwnerVerified: false,
      chainTransferStatus: "not_executed",
      nftTransferExecuted: false,
      claimedAt: row.ownership_claimed_at || null,
      ownerLabel: claimed
        ? "Claim de consumidor registrado en nexID"
        : tagMessageValidated
          ? "Disponible para reclamar con tap fresco"
          : "Ownership bloqueado para este evento",
    },
    tokenization: {
      status: tokenStatus,
      network: row.tokenization_network || "polygon-amoy",
      txHash: row.tokenization_tx_hash || null,
      tokenId: row.tokenization_token_id || null,
      anchorHash: row.tokenization_anchor_hash || null,
      processedAt: row.tokenization_processed_at || null,
      explorerUrl: tagMessageValidated ? txUrl : null,
    },
    trust: {
      score: null,
      basis: "explicit_evidence_factors_only",
      factors: [
        { label: "Mensaje NFC elegible según policy", ok: tagMessageValidated },
        { label: "Identidad de chip disponible", ok: Boolean(row.uid_hex) },
        { label: "Tenant y lote registrados", ok: Boolean(row.tenant_slug && row.bid) },
        { label: "Claim de consumidor registrado", ok: tagMessageValidated && claimed },
        { label: "Referencia Polygon disponible", ok: Boolean(tagMessageValidated && txUrl && row.tokenization_token_id && tokenStatus === "anchored") },
      ],
    },
    timeline: timelineRows.map((item) => ({
      eventId: String(item.id),
      result: item.result || null,
      city: item.city || null,
      country: item.country_code || null,
      at: item.created_at || null,
    })),
  };

  return json(
    { ok: true, certificate },
    200,
    { "cache-control": signedAccess ? "private, no-store" : "public, max-age=20, stale-while-revalidate=120" },
  );
}
