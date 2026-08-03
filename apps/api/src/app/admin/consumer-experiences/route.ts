export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantScope } from "../../../lib/auth";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected", "needs_brand_response", "private"]);
const ALLOWED_VISIBILITY = new Set(["private", "tenant", "public"]);

function cleanText(value: unknown, max = 280) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanUuid(value: unknown) {
  const text = cleanText(value, 80);
  return UUID_RE.test(text) ? text : "";
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

function formatExperience(row: Record<string, unknown>) {
  const metadata = row.metadata_json && typeof row.metadata_json === "object"
    ? row.metadata_json as Record<string, unknown>
    : {};
  const trustScoreStatus = String(metadata.trust_score_status || "").trim() || (row.trust_score == null ? "not_computed" : "computed");
  return {
    ...row,
    trust_score: trustScoreStatus === "computed" ? row.trust_score : null,
    trust_score_status: trustScoreStatus,
    photo_urls: readJsonArray(row.photo_urls_json),
    verification_badges: readJsonArray(row.verification_badges_json),
  };
}

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "consumer_experiences.read_pii");
  if (auth) return auth;
  await ensureConsumerPortalSchema();

  const url = new URL(req.url);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenant = forcedTenantSlug || cleanText(url.searchParams.get("tenant") || url.searchParams.get("tenantSlug"));
  const status = cleanText(url.searchParams.get("status"));
  const visibility = cleanText(url.searchParams.get("visibility"));
  const limit = Math.max(1, Math.min(150, Number(url.searchParams.get("limit") || 75)));

  const rows = await sql/*sql*/`
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
      e.metadata_json,
      e.moderation_status,
      e.visibility,
      e.brand_response,
      e.translation_json,
      e.created_at,
      e.updated_at,
      t.slug AS tenant_slug,
      c.email AS consumer_email,
      c.phone AS consumer_phone,
      o.status AS ownership_status
    FROM consumer_product_experiences e
    JOIN tenants t ON t.id = e.tenant_id
    JOIN consumers c ON c.id = e.consumer_id
    LEFT JOIN consumer_product_ownerships o ON o.id = e.ownership_id
    WHERE (${tenant} = '' OR t.slug = ${tenant})
      AND (${status} = '' OR e.moderation_status = ${status})
      AND (${visibility} = '' OR e.visibility = ${visibility})
    ORDER BY
      (e.moderation_status = 'pending') DESC,
      e.created_at DESC
    LIMIT ${limit}
  `;

  const moderation = {
    pending: rows.filter((row) => row.moderation_status === "pending").length,
    approved: rows.filter((row) => row.moderation_status === "approved").length,
    needsBrandResponse: rows.filter((row) => row.moderation_status === "needs_brand_response").length,
  };

  return json({
    ok: true,
    tenant: tenant || null,
    count: rows.length,
    moderation,
    items: rows.map(formatExperience),
  });
}

export async function PATCH(req: Request) {
  const auth = await checkAdminWithPermission(req, "consumer_experiences.moderate");
  if (auth) return auth;
  await ensureConsumerPortalSchema();

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = cleanUuid(body.id);
  const requestedTenant = cleanText(body.tenant || body.tenantSlug);
  const tenant = forcedTenantSlug || requestedTenant;
  const moderationStatus = cleanText(body.moderationStatus || body.moderation_status || body.status);
  const visibility = cleanText(body.visibility || "tenant");
  const brandResponse = cleanText(body.brandResponse || body.brand_response, 1200);

  if (!id) return json({ ok: false, error: "id_required" }, 400);
  if (!ALLOWED_STATUSES.has(moderationStatus)) return json({ ok: false, error: "invalid_moderation_status" }, 400);
  if (!ALLOWED_VISIBILITY.has(visibility)) return json({ ok: false, error: "invalid_visibility" }, 400);
  if (visibility === "public" && moderationStatus !== "approved") {
    return json({ ok: false, error: "public_requires_approved_status" }, 400);
  }

  const rows = await sql/*sql*/`
    UPDATE consumer_product_experiences e
    SET
      moderation_status = ${moderationStatus},
      visibility = ${visibility},
      brand_response = ${brandResponse || null},
      updated_at = now()
    FROM tenants t
    WHERE e.id = ${id}
      AND t.id = e.tenant_id
      AND (${tenant} = '' OR t.slug = ${tenant})
    RETURNING
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
      e.metadata_json,
      e.moderation_status,
      e.visibility,
      e.brand_response,
      e.translation_json,
      e.created_at,
      e.updated_at,
      t.slug AS tenant_slug
  `;

  const item = rows[0];
  if (!item) return json({ ok: false, error: "experience_not_found" }, 404);
  return json({ ok: true, item: formatExperience(item) });
}
