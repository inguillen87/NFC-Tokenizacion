export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomBytes } from "crypto";
import { sql } from "../../../lib/db";
import { checkAdmin, getAdminTenantScope } from "../../../lib/auth";
import { encryptKey16 } from "../../../lib/keys";
import { json } from "../../../lib/http";
import { buildTenantSunProfileInput, normalizeTenantCreateSlug, upsertTenantSunProfile } from "../../../lib/tenant-onboarding";
import { ensureSunTenantProfilesSchema } from "../../../lib/sun-tenant-profile-schema";
import { effectiveTenantFilter, resolveTenantStatsSource } from "../../../lib/admin-tenant-filter";
import { aggregateTenantMetrics, EVENT_TAXONOMY_VERSION } from "@product/core";

function withCanonicalRisk(row: Record<string, unknown>) {
  const scans = Number(row.scans || 0);
  const metrics = aggregateTenantMetrics({
    counts: {
      scans,
      activityTotal: scans,
      recognizedProductIdentity: Number(row.product_recognized || 0),
      verifiedAuthentication: Number(row.authentication_verified || 0),
      valid: Number(row.valid || 0),
      invalid: Number(row.invalid || 0),
      duplicates: Number(row.duplicates || 0),
      tamper: Number(row.tamper || 0),
      revoked: Number(row.revoked || 0) + Number(row.broken || 0),
    },
  });
  return {
    ...row,
    risk_score: metrics.riskScore,
    risk_breakdown: metrics.riskBreakdown,
    risk_taxonomy_version: EVENT_TAXONOMY_VERSION,
  };
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const withStats = searchParams.get("withStats") === "1";
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenantSlug = effectiveTenantFilter({ forcedTenantSlug, requestedTenantSlug: searchParams.get("tenant") });
  const statsSourceResolution = resolveTenantStatsSource({
    forcedTenantSlug,
    requestedSource: searchParams.get("source"),
  });
  if (withStats && !statsSourceResolution.ok) {
    return json({ ok: false, reason: statsSourceResolution.reason }, 400, { "cache-control": "no-store" });
  }
  const statsSource = statsSourceResolution.ok ? statsSourceResolution.source : "real";
  await ensureSunTenantProfilesSchema();

  if (withStats) {
    const rows = tenantSlug
      ? await sql/*sql*/`
      WITH classified AS (
        SELECT tn.id, tn.slug, tn.name, tn.created_at, e.id AS event_id, e.batch_id, e.tag_id, CASE
          WHEN UPPER(COALESCE(e.result, '')) IN ('DUPLICATE','REPLAY_SUSPECT') THEN 'replay_suspect'
          WHEN UPPER(COALESCE(e.result, '')) = 'BLOCKED_REPLAY' THEN 'blocked_replay'
          WHEN UPPER(COALESCE(e.result, '')) IN ('TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED') THEN 'tampered'
          WHEN UPPER(COALESCE(e.result, '')) = 'REVOKED' THEN 'revoked'
          WHEN UPPER(COALESCE(e.result, '')) = 'BROKEN' THEN 'broken'
          WHEN LOWER(COALESCE(e.verdict, '')) = 'identified_unverified'
            OR UPPER(COALESCE(e.result, '')) = 'IDENTIFIED_UNVERIFIED'
            OR (UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED' AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true')
            THEN 'identified_unverified'
          WHEN UPPER(COALESCE(e.result, '')) = 'NOT_REGISTERED' THEN 'not_registered'
          WHEN UPPER(COALESCE(e.result, '')) = 'NOT_ACTIVE' THEN 'not_active'
          WHEN UPPER(COALESCE(e.result, '')) = 'UNKNOWN_BATCH' THEN 'unknown_batch'
          WHEN UPPER(COALESCE(e.result, '')) IN ('INVALID','TAP_INVALID') OR UPPER(COALESCE(e.result, '')) LIKE 'BLOCKED_%' THEN 'invalid'
          WHEN UPPER(COALESCE(e.result, '')) IN ('CLAIMED','REDEEMED','CHECK_IN','OWNERSHIP_ACTIVATED','WARRANTY_REGISTERED','PROVENANCE_VIEWED','TOKENIZATION_REQUESTED','TOKENIZATION_SIMULATED','TOKENIZATION_ANCHORED','EXPORT_GENERATED') THEN 'lifecycle'
          WHEN LOWER(COALESCE(e.verdict, '')) IN ('valid','invalid','replay_suspect','blocked_replay','tampered','revoked','broken','not_registered','not_active','unknown_batch','identified_unverified','unknown') THEN LOWER(e.verdict)
          WHEN UPPER(COALESCE(e.result, '')) IN ('VALID','TAP_VALID') OR UPPER(COALESCE(e.result, '')) LIKE 'VALID_%' THEN 'valid'
          ELSE 'unknown'
        END AS event_class,
        (
          LOWER(COALESCE(e.verdict, '')) = 'valid'
          AND UPPER(COALESCE(e.event_type::text, '')) = 'TAP_VALID'
          AND e.cmac_ok IS TRUE
          AND e.allowlisted IS TRUE
        ) AS authentication_verified
        FROM tenants tn
        LEFT JOIN batches b ON b.tenant_id = tn.id
        LEFT JOIN events e
          ON e.batch_id = b.id
         AND e.tenant_id = tn.id
         AND LOWER(COALESCE(e.source::text, 'real')) = ${statsSource}
        WHERE tn.slug = ${tenantSlug}
      )
      SELECT
        id, slug, name, created_at,
        COUNT(event_id)::int AS scans,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'identified_unverified')::int AS identified_unverified,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND (batch_id IS NOT NULL OR tag_id IS NOT NULL))::int AS product_recognized,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND authentication_verified)::int AS authentication_verified,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'valid')::int AS valid,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'invalid')::int AS invalid,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class IN ('replay_suspect','blocked_replay'))::int AS duplicates,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'tampered')::int AS tamper,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'revoked')::int AS revoked,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'broken')::int AS broken
      FROM classified
      GROUP BY id, slug, name, created_at
      ORDER BY created_at DESC
      LIMIT 200
    `
      : await sql/*sql*/`
      WITH classified AS (
        SELECT tn.id, tn.slug, tn.name, tn.created_at, e.id AS event_id, e.batch_id, e.tag_id, CASE
          WHEN UPPER(COALESCE(e.result, '')) IN ('DUPLICATE','REPLAY_SUSPECT') THEN 'replay_suspect'
          WHEN UPPER(COALESCE(e.result, '')) = 'BLOCKED_REPLAY' THEN 'blocked_replay'
          WHEN UPPER(COALESCE(e.result, '')) IN ('TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED') THEN 'tampered'
          WHEN UPPER(COALESCE(e.result, '')) = 'REVOKED' THEN 'revoked'
          WHEN UPPER(COALESCE(e.result, '')) = 'BROKEN' THEN 'broken'
          WHEN LOWER(COALESCE(e.verdict, '')) = 'identified_unverified'
            OR UPPER(COALESCE(e.result, '')) = 'IDENTIFIED_UNVERIFIED'
            OR (UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED' AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true')
            THEN 'identified_unverified'
          WHEN UPPER(COALESCE(e.result, '')) = 'NOT_REGISTERED' THEN 'not_registered'
          WHEN UPPER(COALESCE(e.result, '')) = 'NOT_ACTIVE' THEN 'not_active'
          WHEN UPPER(COALESCE(e.result, '')) = 'UNKNOWN_BATCH' THEN 'unknown_batch'
          WHEN UPPER(COALESCE(e.result, '')) IN ('INVALID','TAP_INVALID') OR UPPER(COALESCE(e.result, '')) LIKE 'BLOCKED_%' THEN 'invalid'
          WHEN UPPER(COALESCE(e.result, '')) IN ('CLAIMED','REDEEMED','CHECK_IN','OWNERSHIP_ACTIVATED','WARRANTY_REGISTERED','PROVENANCE_VIEWED','TOKENIZATION_REQUESTED','TOKENIZATION_SIMULATED','TOKENIZATION_ANCHORED','EXPORT_GENERATED') THEN 'lifecycle'
          WHEN LOWER(COALESCE(e.verdict, '')) IN ('valid','invalid','replay_suspect','blocked_replay','tampered','revoked','broken','not_registered','not_active','unknown_batch','identified_unverified','unknown') THEN LOWER(e.verdict)
          WHEN UPPER(COALESCE(e.result, '')) IN ('VALID','TAP_VALID') OR UPPER(COALESCE(e.result, '')) LIKE 'VALID_%' THEN 'valid'
          ELSE 'unknown'
        END AS event_class,
        (
          LOWER(COALESCE(e.verdict, '')) = 'valid'
          AND UPPER(COALESCE(e.event_type::text, '')) = 'TAP_VALID'
          AND e.cmac_ok IS TRUE
          AND e.allowlisted IS TRUE
        ) AS authentication_verified
        FROM tenants tn
        LEFT JOIN batches b ON b.tenant_id = tn.id
        LEFT JOIN events e
          ON e.batch_id = b.id
         AND e.tenant_id = tn.id
         AND LOWER(COALESCE(e.source::text, 'real')) = ${statsSource}
      )
      SELECT
        id, slug, name, created_at,
        COUNT(event_id)::int AS scans,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'identified_unverified')::int AS identified_unverified,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND (batch_id IS NOT NULL OR tag_id IS NOT NULL))::int AS product_recognized,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND authentication_verified)::int AS authentication_verified,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'valid')::int AS valid,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'invalid')::int AS invalid,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class IN ('replay_suspect','blocked_replay'))::int AS duplicates,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'tampered')::int AS tamper,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'revoked')::int AS revoked,
        COUNT(*) FILTER (WHERE event_id IS NOT NULL AND event_class = 'broken')::int AS broken
      FROM classified
      GROUP BY id, slug, name, created_at
      ORDER BY created_at DESC
      LIMIT 200
    `;
    return json(
      rows.map((row) => ({
        ...withCanonicalRisk(row as Record<string, unknown>),
        stats_source: statsSource,
      })),
      200,
      { "cache-control": "no-store" },
    );
  }

  const rows = tenantSlug
    ? await sql/*sql*/`
    SELECT
      tn.id,
      tn.slug,
      tn.name,
      tn.created_at,
      tsp.vertical AS sun_vertical,
      tsp.product_label AS sun_product_label,
      tsp.tokenization_mode AS sun_tokenization_mode,
      tsp.claim_policy AS sun_claim_policy,
      (
        tsp.tenant_id IS NOT NULL
        AND tsp.vertical IS NOT NULL
        AND NULLIF(tsp.club_name, '') IS NOT NULL
        AND NULLIF(tsp.product_label, '') IS NOT NULL
        AND NULLIF(tsp.origin_label, '') IS NOT NULL
        AND NULLIF(tsp.origin_address, '') IS NOT NULL
        AND tsp.origin_lat IS NOT NULL
        AND tsp.origin_lng IS NOT NULL
        AND tsp.tokenization_mode IS NOT NULL
        AND tsp.claim_policy IS NOT NULL
        AND tsp.ownership_policy <> '{}'::jsonb
        AND tsp.manifest_policy <> '{}'::jsonb
      ) AS sun_profile_ready
    FROM tenants tn
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = tn.id
    WHERE tn.slug = ${tenantSlug}
    ORDER BY tn.created_at DESC
    LIMIT 200
  `
    : await sql/*sql*/`
    SELECT
      tn.id,
      tn.slug,
      tn.name,
      tn.created_at,
      tsp.vertical AS sun_vertical,
      tsp.product_label AS sun_product_label,
      tsp.tokenization_mode AS sun_tokenization_mode,
      tsp.claim_policy AS sun_claim_policy,
      (
        tsp.tenant_id IS NOT NULL
        AND tsp.vertical IS NOT NULL
        AND NULLIF(tsp.club_name, '') IS NOT NULL
        AND NULLIF(tsp.product_label, '') IS NOT NULL
        AND NULLIF(tsp.origin_label, '') IS NOT NULL
        AND NULLIF(tsp.origin_address, '') IS NOT NULL
        AND tsp.origin_lat IS NOT NULL
        AND tsp.origin_lng IS NOT NULL
        AND tsp.tokenization_mode IS NOT NULL
        AND tsp.claim_policy IS NOT NULL
        AND tsp.ownership_policy <> '{}'::jsonb
        AND tsp.manifest_policy <> '{}'::jsonb
      ) AS sun_profile_ready
    FROM tenants tn
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = tn.id
    ORDER BY tn.created_at DESC
    LIMIT 200
  `;
  return json(rows);
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;
  const { scope } = getAdminTenantScope(req);
  if (scope && scope !== "super_admin") return json({ ok: false, reason: "super_admin_required" }, 403);

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const slug = normalizeTenantCreateSlug(body.slug);
  const name = String(body.name || "");
  if (!slug || !name) return json({ ok: false, reason: "slug and name required" }, 400);

  const profileInput = buildTenantSunProfileInput(body);
  if (!profileInput.ok) {
    return json({
      ok: false,
      reason: "tenant_sun_profile_required",
      message: "Every tenant must be created with SUN profile, origin, ownership policy and manifest policy. No generic tenant fallbacks are allowed.",
      missing: profileInput.missing,
      allowed: profileInput.allowed,
    }, 400);
  }

  const root = randomBytes(16);
  const rootKeyCt = encryptKey16(root);

  try {
    const rows = await sql/*sql*/`
      INSERT INTO tenants (slug, name, root_key_ct)
      VALUES (${slug}, ${name}, ${rootKeyCt})
      RETURNING id, slug, name, created_at
    `;
    const sunProfile = await upsertTenantSunProfile(String(rows[0].id), profileInput.profile);
    return json({ ...rows[0], sun_profile: sunProfile, sun_profile_ready: true }, 201);
  } catch {
    const existing = await sql/*sql*/`
      SELECT id, slug, name, created_at
      FROM tenants
      WHERE slug = ${slug}
      LIMIT 1
    `;
    if (existing[0]) {
      const sunProfile = await upsertTenantSunProfile(String(existing[0].id), profileInput.profile);
      return json({ ...existing[0], sun_profile: sunProfile, sun_profile_ready: true }, 200);
    }
    return json({ ok: false, reason: "tenant create failed" }, 500);
  }
}
