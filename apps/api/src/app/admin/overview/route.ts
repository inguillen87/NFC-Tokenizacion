export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantAccess } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { aggregateTenantMetrics, EVENT_TAXONOMY_VERSION } from "@product/core";

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const requestedTenant = searchParams.get("tenant");
  const { effectiveTenantSlug: tenant } = getAdminTenantAccess(req, requestedTenant);

  const rows = tenant
    ? await sql/*sql*/`
      WITH scoped_batches AS MATERIALIZED (
        SELECT b.id, b.tenant_id
        FROM batches b
        JOIN tenants tn ON tn.id = b.tenant_id
        WHERE tn.slug = ${tenant}
      ),
      classified_events AS MATERIALIZED (
        SELECT CASE
          WHEN UPPER(COALESCE(e.result, '')) IN ('DUPLICATE','REPLAY_SUSPECT') THEN 'replay_suspect'
          WHEN UPPER(COALESCE(e.result, '')) = 'BLOCKED_REPLAY' THEN 'blocked_replay'
          WHEN UPPER(COALESCE(e.result, '')) IN ('TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED') THEN 'tampered'
          WHEN UPPER(COALESCE(e.result, '')) = 'REVOKED' THEN 'revoked'
          WHEN UPPER(COALESCE(e.result, '')) = 'BROKEN' THEN 'broken'
          WHEN LOWER(COALESCE(e.verdict, '')) = 'identified_unverified'
            OR UPPER(COALESCE(e.result, '')) = 'IDENTIFIED_UNVERIFIED'
            OR (
              UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED'
              AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true'
            ) THEN 'identified_unverified'
          WHEN UPPER(COALESCE(e.result, '')) = 'NOT_REGISTERED' THEN 'not_registered'
          WHEN UPPER(COALESCE(e.result, '')) = 'NOT_ACTIVE' THEN 'not_active'
          WHEN UPPER(COALESCE(e.result, '')) = 'UNKNOWN_BATCH' THEN 'unknown_batch'
          WHEN UPPER(COALESCE(e.result, '')) IN ('INVALID','TAP_INVALID') OR UPPER(COALESCE(e.result, '')) LIKE 'BLOCKED_%' THEN 'invalid'
          WHEN UPPER(COALESCE(e.result, '')) IN ('CLAIMED','REDEEMED','CHECK_IN','OWNERSHIP_ACTIVATED','WARRANTY_REGISTERED','PROVENANCE_VIEWED','TOKENIZATION_REQUESTED','TOKENIZATION_SIMULATED','TOKENIZATION_ANCHORED','EXPORT_GENERATED') THEN 'lifecycle'
          WHEN LOWER(COALESCE(e.verdict, '')) IN ('valid','invalid','replay_suspect','blocked_replay','tampered','revoked','broken','not_registered','not_active','unknown_batch','identified_unverified','unknown') THEN LOWER(e.verdict)
          WHEN UPPER(COALESCE(e.result, '')) IN ('VALID','TAP_VALID') OR UPPER(COALESCE(e.result, '')) LIKE 'VALID_%' THEN 'valid'
          ELSE 'unknown'
        END AS event_class,
        (e.batch_id IS NOT NULL OR e.tag_id IS NOT NULL) AS product_identity_recognized,
        (
          LOWER(COALESCE(e.verdict, '')) = 'valid'
          AND UPPER(COALESCE(e.event_type::text, '')) = 'TAP_VALID'
          AND e.cmac_ok IS TRUE
          AND e.allowlisted IS TRUE
        ) AS authentication_verified
        FROM events e
        JOIN scoped_batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
        WHERE COALESCE(e.source::text, 'real') <> 'demo'
      ),
      asset_counts AS (
        SELECT COUNT(DISTINCT b.id)::int AS batches, COUNT(DISTINCT t.id)::int AS tags
        FROM scoped_batches b
        LEFT JOIN tags t ON t.batch_id = b.id
      ),
      event_counts AS (
        SELECT
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE product_identity_recognized)::int AS product_recognized,
          COUNT(*) FILTER (WHERE authentication_verified)::int AS authentication_verified,
          COUNT(*) FILTER (WHERE event_class = 'identified_unverified')::int AS identified_unverified,
          COUNT(*) FILTER (WHERE event_class IN ('replay_suspect','blocked_replay'))::int AS duplicates,
          COUNT(*) FILTER (WHERE event_class = 'tampered')::int AS tamper,
          COUNT(*) FILTER (WHERE event_class = 'valid')::int AS valid,
          COUNT(*) FILTER (WHERE event_class = 'invalid')::int AS invalid,
          COUNT(*) FILTER (WHERE event_class = 'revoked')::int AS revoked,
          COUNT(*) FILTER (WHERE event_class = 'broken')::int AS broken,
          COUNT(*) FILTER (WHERE event_class = 'not_registered')::int AS unregistered,
          COUNT(*) FILTER (WHERE event_class = 'not_active')::int AS inactive,
          COUNT(*) FILTER (WHERE event_class = 'unknown_batch')::int AS unknown_batch,
          COUNT(*) FILTER (WHERE event_class = 'lifecycle')::int AS lifecycle,
          COUNT(*) FILTER (WHERE event_class = 'unknown')::int AS unclassified
        FROM classified_events
      )
      SELECT * FROM asset_counts CROSS JOIN event_counts
    `
    : await sql/*sql*/`
      WITH scoped_batches AS MATERIALIZED (
        SELECT b.id, b.tenant_id FROM batches b
      ),
      classified_events AS MATERIALIZED (
        SELECT CASE
          WHEN UPPER(COALESCE(e.result, '')) IN ('DUPLICATE','REPLAY_SUSPECT') THEN 'replay_suspect'
          WHEN UPPER(COALESCE(e.result, '')) = 'BLOCKED_REPLAY' THEN 'blocked_replay'
          WHEN UPPER(COALESCE(e.result, '')) IN ('TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED') THEN 'tampered'
          WHEN UPPER(COALESCE(e.result, '')) = 'REVOKED' THEN 'revoked'
          WHEN UPPER(COALESCE(e.result, '')) = 'BROKEN' THEN 'broken'
          WHEN LOWER(COALESCE(e.verdict, '')) = 'identified_unverified'
            OR UPPER(COALESCE(e.result, '')) = 'IDENTIFIED_UNVERIFIED'
            OR (
              UPPER(COALESCE(e.event_type::text, '')) = 'PROVENANCE_VIEWED'
              AND COALESCE(e.meta #>> '{assurance,identity_registered}', 'false') = 'true'
            ) THEN 'identified_unverified'
          WHEN UPPER(COALESCE(e.result, '')) = 'NOT_REGISTERED' THEN 'not_registered'
          WHEN UPPER(COALESCE(e.result, '')) = 'NOT_ACTIVE' THEN 'not_active'
          WHEN UPPER(COALESCE(e.result, '')) = 'UNKNOWN_BATCH' THEN 'unknown_batch'
          WHEN UPPER(COALESCE(e.result, '')) IN ('INVALID','TAP_INVALID') OR UPPER(COALESCE(e.result, '')) LIKE 'BLOCKED_%' THEN 'invalid'
          WHEN UPPER(COALESCE(e.result, '')) IN ('CLAIMED','REDEEMED','CHECK_IN','OWNERSHIP_ACTIVATED','WARRANTY_REGISTERED','PROVENANCE_VIEWED','TOKENIZATION_REQUESTED','TOKENIZATION_SIMULATED','TOKENIZATION_ANCHORED','EXPORT_GENERATED') THEN 'lifecycle'
          WHEN LOWER(COALESCE(e.verdict, '')) IN ('valid','invalid','replay_suspect','blocked_replay','tampered','revoked','broken','not_registered','not_active','unknown_batch','identified_unverified','unknown') THEN LOWER(e.verdict)
          WHEN UPPER(COALESCE(e.result, '')) IN ('VALID','TAP_VALID') OR UPPER(COALESCE(e.result, '')) LIKE 'VALID_%' THEN 'valid'
          ELSE 'unknown'
        END AS event_class,
        (e.batch_id IS NOT NULL OR e.tag_id IS NOT NULL) AS product_identity_recognized,
        (
          LOWER(COALESCE(e.verdict, '')) = 'valid'
          AND UPPER(COALESCE(e.event_type::text, '')) = 'TAP_VALID'
          AND e.cmac_ok IS TRUE
          AND e.allowlisted IS TRUE
        ) AS authentication_verified
        FROM events e
        JOIN scoped_batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
        WHERE COALESCE(e.source::text, 'real') <> 'demo'
      ),
      asset_counts AS (
        SELECT COUNT(DISTINCT b.id)::int AS batches, COUNT(DISTINCT t.id)::int AS tags
        FROM scoped_batches b
        LEFT JOIN tags t ON t.batch_id = b.id
      ),
      event_counts AS (
        SELECT
          COUNT(*)::int AS scans,
          COUNT(*) FILTER (WHERE product_identity_recognized)::int AS product_recognized,
          COUNT(*) FILTER (WHERE authentication_verified)::int AS authentication_verified,
          COUNT(*) FILTER (WHERE event_class = 'identified_unverified')::int AS identified_unverified,
          COUNT(*) FILTER (WHERE event_class IN ('replay_suspect','blocked_replay'))::int AS duplicates,
          COUNT(*) FILTER (WHERE event_class = 'tampered')::int AS tamper,
          COUNT(*) FILTER (WHERE event_class = 'valid')::int AS valid,
          COUNT(*) FILTER (WHERE event_class = 'invalid')::int AS invalid,
          COUNT(*) FILTER (WHERE event_class = 'revoked')::int AS revoked,
          COUNT(*) FILTER (WHERE event_class = 'broken')::int AS broken,
          COUNT(*) FILTER (WHERE event_class = 'not_registered')::int AS unregistered,
          COUNT(*) FILTER (WHERE event_class = 'not_active')::int AS inactive,
          COUNT(*) FILTER (WHERE event_class = 'unknown_batch')::int AS unknown_batch,
          COUNT(*) FILTER (WHERE event_class = 'lifecycle')::int AS lifecycle,
          COUNT(*) FILTER (WHERE event_class = 'unknown')::int AS unclassified
        FROM classified_events
      )
      SELECT * FROM asset_counts CROSS JOIN event_counts
    `;

  const raw = rows[0] || {};
  const stats = {
    batches: Number(raw.batches || 0),
    tags: Number(raw.tags || 0),
    scans: Number(raw.scans || 0),
    productRecognized: Number(raw.product_recognized || 0),
    authenticationVerified: Number(raw.authentication_verified || 0),
    identifiedUnverified: Number(raw.identified_unverified || 0),
    duplicates: Number(raw.duplicates || 0),
    tamper: Number(raw.tamper || 0),
    valid: Number(raw.valid || 0),
    invalid: Number(raw.invalid || 0),
    revoked: Number(raw.revoked || 0),
    broken: Number(raw.broken || 0),
    unregistered: Number(raw.unregistered || 0),
    inactive: Number(raw.inactive || 0),
    unknownBatch: Number(raw.unknown_batch || 0),
    lifecycle: Number(raw.lifecycle || 0),
    unclassified: Number(raw.unclassified || 0),
  };
  const metrics = aggregateTenantMetrics({
    counts: {
      scans: stats.scans,
      activityTotal: stats.scans,
      recognizedProductIdentity: stats.productRecognized,
      verifiedAuthentication: stats.authenticationVerified,
      valid: stats.valid,
      invalid: stats.invalid,
      duplicates: stats.duplicates,
      tamper: stats.tamper,
      revoked: stats.revoked + stats.broken,
    },
  });

  return json({
    ...stats,
    riskScore: metrics.riskScore,
    riskBreakdown: metrics.riskBreakdown,
    eventTaxonomy: {
      version: EVENT_TAXONOMY_VERSION,
      securityRiskClasses: ["invalid", "duplicate_replay", "tamper", "revoked", "broken"],
      neutralIdentityClass: "identified_unverified",
      neutralIdentityClassesExcludedFromRisk: ["identified_unverified"],
      lifecycleClassesExcludedFromRisk: ["unregistered", "inactive", "unknown_batch", "lifecycle"],
      unknownClassExcludedFromRisk: "unclassified",
    },
  });
}
