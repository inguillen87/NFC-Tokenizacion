export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";

type ConsumerSession = {
  id: string;
  email?: string | null;
  phone?: string | null;
};

const MAX_PHOTO_DATA_URL_CHARS = 2_800_000;
const MAX_EXPERIENCE_BODY_BYTES = 8 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, max = 280) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanUuid(value: unknown) {
  const text = cleanText(value, 80);
  return UUID_RE.test(text) ? text : "";
}

function cleanEventId(value: unknown) {
  const text = cleanText(value, 40);
  return /^\d+$/.test(text) ? text : "";
}

function cleanRating(value: unknown) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 0;
  return Math.max(1, Math.min(5, Math.round(rating)));
}

function cleanLocale(value: unknown) {
  const locale = cleanText(value, 12);
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : "es-AR";
}

function cleanPhotoUrl(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return cleanText(text, 900);
  if (
    text.length <= MAX_PHOTO_DATA_URL_CHARS &&
    /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(text)
  ) {
    return text;
  }
  return "";
}

function cleanPhotoUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanPhotoUrl)
    .filter(Boolean)
    .slice(0, 4);
}

function readJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function GET(req: Request) {
  await ensureConsumerPortalSchema();
  const consumer = (await getConsumerFromRequest(req)) as ConsumerSession | null;
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);

  const [rewardRows, experienceRows] = await Promise.all([
    sql/*sql*/`
      SELECT r.id, r.title, t.slug AS tenant_slug
      FROM rewards r
      JOIN tenants t ON t.id = r.tenant_id
      JOIN tenant_consumer_memberships m ON m.tenant_id = r.tenant_id AND m.consumer_id = ${consumer.id}
      WHERE r.type IN ('EXPERIENCE','TASTING','TOUR','VIP_ACCESS') AND r.status = 'active'
      ORDER BY r.created_at DESC
    `,
    sql/*sql*/`
      SELECT
        e.id,
        e.product_name,
        e.rating,
        e.title,
        e.body,
        e.original_locale,
        e.country,
        e.city,
        e.photo_urls_json,
        e.verification_badges_json,
        e.trust_score,
        e.moderation_status,
        e.visibility,
        e.brand_response,
        e.translation_json,
        e.created_at,
        t.slug AS tenant_slug
      FROM consumer_product_experiences e
      JOIN tenants t ON t.id = e.tenant_id
      WHERE e.consumer_id = ${consumer.id}
      ORDER BY e.created_at DESC
      LIMIT 50
    `,
  ]);

  return json({
    ok: true,
    items: rewardRows,
    verifiedExperiences: experienceRows.map((row) => ({
      ...row,
      trust_score: null,
      trust_score_status: "not_computed",
      photo_urls: readJsonArray(row.photo_urls_json),
      verification_badges: readJsonArray(row.verification_badges_json),
    })),
  });
}

export async function POST(req: Request) {
  const consumer = (await getConsumerFromRequest(req)) as ConsumerSession | null;
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    tenantId: "consumer",
    subjectId: `consumer:${consumer.id}:experience`,
  });
  if (limited) return limited;
  await ensureConsumerPortalSchema();

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_EXPERIENCE_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  const rating = cleanRating(body.rating);
  const title = cleanText(body.title, 96);
  const reviewBody = cleanText(body.body || body.comment || body.review, 1200);
  const locale = cleanLocale(body.locale || body.originalLocale);
  const ownershipId = cleanUuid(body.ownershipId || body.ownership_id);
  const eventId = cleanEventId(body.eventId || body.event_id);
  const photoUrls = cleanPhotoUrls(body.photoUrls || body.photo_urls);

  if (!rating) return json({ ok: false, error: "rating_required" }, 400);
  if (reviewBody.length < 12) return json({ ok: false, error: "body_too_short" }, 400);
  if (!ownershipId && !eventId) return json({ ok: false, error: "verified_evidence_required" }, 400);

  const evidenceRows = ownershipId
    ? await sql/*sql*/`
        SELECT
          o.id AS ownership_id,
          o.tenant_id,
          o.event_id,
          o.uid_hex,
          o.status,
          COALESCE(e.result, o.trust_snapshot->>'result') AS verdict,
          COALESCE(e.city, o.trust_snapshot->>'city') AS city,
          COALESCE(e.country_code, o.trust_snapshot->>'country') AS country,
          COALESCE(tp.product_name, e.product_name, tp.sku, 'Producto asociado') AS product_name,
          t.slug AS tenant_slug,
          'ownership' AS evidence_type
        FROM consumer_product_ownerships o
        JOIN tenants t ON t.id = o.tenant_id
        LEFT JOIN events e ON e.id = o.event_id
        LEFT JOIN tags tag ON tag.id = o.tag_id
        LEFT JOIN tag_profiles tp ON tp.tag_id = tag.id
        WHERE o.id = ${ownershipId}
          AND o.consumer_id = ${consumer.id}
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT
          null::uuid AS ownership_id,
          h.tenant_id,
          h.tap_event_id AS event_id,
          e.uid_hex,
          null::text AS status,
          h.verdict,
          h.city,
          h.country,
          COALESCE(tp.product_name, e.product_name, tp.sku, 'Producto asociado') AS product_name,
          t.slug AS tenant_slug,
          'tap' AS evidence_type,
          h.risk_level
        FROM consumer_tap_history h
        JOIN tenants t ON t.id = h.tenant_id
        JOIN events e ON e.id = h.tap_event_id
        LEFT JOIN tags tag ON tag.uid_hex = e.uid_hex AND tag.batch_id = e.batch_id
        LEFT JOIN tag_profiles tp ON tp.tag_id = tag.id
        WHERE h.consumer_id = ${consumer.id}
          AND h.tap_event_id = ${eventId}
        ORDER BY h.created_at DESC
        LIMIT 1
      `;

  const evidence = evidenceRows[0];
  if (!evidence) return json({ ok: false, error: "verified_evidence_not_found" }, 404);

  if (String(evidence.risk_level || "").toLowerCase() === "high" || String(evidence.status || "").includes("blocked")) {
    return json({ ok: false, error: "review_blocked_by_risk_policy" }, 403);
  }

  const hasOwnership = Boolean(evidence.ownership_id) && String(evidence.status || "") === "claimed";
  const badges = [
    "nfc_event_linked",
    "consumer_session_authenticated",
    hasOwnership ? "digital_ownership_record_claimed" : "digital_ownership_not_claimed",
  ];
  if (photoUrls.length) badges.push("consumer_supplied_photo");
  const normalizedVerdict = String(evidence.verdict || "").trim().toUpperCase();
  const validatedNfcVerdicts = new Set(["VALID", "VALID_CLOSED", "VALID_UNKNOWN_TAMPER", "OPENED", "OPENED_PREVIOUSLY"]);
  const evidenceCompleteness = {
    nfc_event_linked: Boolean(evidence.event_id),
    nfc_message_validated: validatedNfcVerdicts.has(normalizedVerdict),
    digital_ownership_record_claimed: hasOwnership,
    consumer_session_authenticated: true,
    consumer_supplied_photo: photoUrls.length > 0,
    physical_product_authenticity_confirmed: false,
    physical_custody_confirmed: false,
    photo_content_verified: false,
  };

  const existingRows = evidence.ownership_id
    ? await sql/*sql*/`
        SELECT id
        FROM consumer_product_experiences
        WHERE consumer_id = ${consumer.id}
          AND ownership_id = ${evidence.ownership_id}
        LIMIT 1
      `
    : [];

  const payload = {
    source: evidence.evidence_type,
    tenant_slug: evidence.tenant_slug,
    review_policy: "evidence_scoped_experience_v2",
    evidence_completeness: evidenceCompleteness,
    trust_score_status: "not_computed",
  };

  const rows = existingRows[0]?.id
    ? await sql/*sql*/`
        UPDATE consumer_product_experiences
        SET
          rating = ${rating},
          title = ${title || null},
          body = ${reviewBody},
          original_locale = ${locale},
          country = ${evidence.country || null},
          city = ${evidence.city || null},
          photo_urls_json = ${JSON.stringify(photoUrls)}::jsonb,
          verification_badges_json = ${JSON.stringify(badges)}::jsonb,
          trust_score = NULL,
          moderation_status = 'pending',
          visibility = 'private',
          metadata_json = ${JSON.stringify(payload)}::jsonb,
          updated_at = now()
        WHERE id = ${existingRows[0].id}
        RETURNING *
      `
    : await sql/*sql*/`
        INSERT INTO consumer_product_experiences (
          tenant_id,
          consumer_id,
          ownership_id,
          event_id,
          uid_hex,
          product_name,
          rating,
          title,
          body,
          original_locale,
          country,
          city,
          photo_urls_json,
          verification_badges_json,
          trust_score,
          moderation_status,
          visibility,
          metadata_json
        ) VALUES (
          ${evidence.tenant_id},
          ${consumer.id},
          ${evidence.ownership_id || null},
          ${evidence.event_id || null},
          ${evidence.uid_hex || null},
          ${evidence.product_name || "Producto asociado"},
          ${rating},
          ${title || null},
          ${reviewBody},
          ${locale},
          ${evidence.country || null},
          ${evidence.city || null},
          ${JSON.stringify(photoUrls)}::jsonb,
          ${JSON.stringify(badges)}::jsonb,
          NULL,
          'pending',
          'private',
          ${JSON.stringify(payload)}::jsonb
        )
        RETURNING *
      `;

  const item = rows[0];
  return json({
    ok: true,
    item: {
      ...item,
      trust_score: null,
      trust_score_status: "not_computed",
      evidence_completeness: evidenceCompleteness,
      photo_urls: readJsonArray(item.photo_urls_json),
      verification_badges: readJsonArray(item.verification_badges_json),
    },
  });
}
