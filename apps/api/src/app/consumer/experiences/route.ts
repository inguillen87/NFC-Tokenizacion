export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

type ConsumerSession = {
  id: string;
  email?: string | null;
  phone?: string | null;
};

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

function cleanPhotoUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 600))
    .filter((item) => /^https?:\/\//i.test(item))
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

function buildTrustScore(input: { hasOwnership: boolean; verdict?: unknown; riskLevel?: unknown; consumer: ConsumerSession }) {
  const verdict = String(input.verdict || "").toUpperCase();
  const risk = String(input.riskLevel || "").toLowerCase();
  let score = 58;
  if (input.hasOwnership) score += 22;
  if (verdict.includes("VALID") || verdict === "OPENED") score += 12;
  if (risk === "low" || !risk) score += 6;
  if (input.consumer.email || input.consumer.phone) score += 8;
  return Math.max(0, Math.min(100, score));
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
      photo_urls: readJsonArray(row.photo_urls_json),
      verification_badges: readJsonArray(row.verification_badges_json),
    })),
  });
}

export async function POST(req: Request) {
  await ensureConsumerPortalSchema();
  const consumer = (await getConsumerFromRequest(req)) as ConsumerSession | null;
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
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
          COALESCE(tp.product_name, e.product_name, tp.sku, 'Producto verificado') AS product_name,
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
          COALESCE(tp.product_name, e.product_name, tp.sku, 'Producto verificado') AS product_name,
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
  const trustScore = buildTrustScore({
    hasOwnership,
    verdict: evidence.verdict,
    riskLevel: evidence.risk_level,
    consumer,
  });
  const badges = [
    "tap_fisico_confirmado",
    "contacto_validado",
    hasOwnership ? "dueno_verificado" : "producto_guardado",
  ];
  if (photoUrls.length) badges.push("foto_de_uso_real");

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
    review_policy: "verified_experience_v1",
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
          trust_score = ${trustScore},
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
          ${evidence.product_name || "Producto verificado"},
          ${rating},
          ${title || null},
          ${reviewBody},
          ${locale},
          ${evidence.country || null},
          ${evidence.city || null},
          ${JSON.stringify(photoUrls)}::jsonb,
          ${JSON.stringify(badges)}::jsonb,
          ${trustScore},
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
      photo_urls: readJsonArray(item.photo_urls_json),
      verification_badges: readJsonArray(item.verification_badges_json),
    },
  });
}
