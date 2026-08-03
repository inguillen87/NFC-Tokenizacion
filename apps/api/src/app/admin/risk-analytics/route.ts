export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, checkAdminPermission, getAdminPrincipal } from "../../../lib/auth";
import { CARRIER_PROFILES } from "../../../lib/carrier-profiles";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

const NO_STORE = { "cache-control": "no-store" };
const REQUIRED_MIGRATION = "20260802310000_0096_enterprise_rbac_risk_truth.sql";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILTER = /^[\p{L}\p{N}][\p{L}\p{N} ._:/-]{0,159}$/u;
const RFC3339_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i;
const RISK_LEVELS = new Set(["none", "low", "medium", "high", "critical"]);
const CARRIER_CODES: ReadonlySet<string> = new Set(CARRIER_PROFILES.map((profile) => profile.code));

function boundedFilter(value: string | null) {
  const normalized = String(value || "").trim();
  return !normalized ? null : FILTER.test(normalized) ? normalized : "__invalid__";
}

function boundedLimit(value: string | null) {
  const parsed = Number(value || 100);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 200 ? parsed : null;
}

function instant(value: string | null) {
  if (!value) return null;
  if (!RFC3339_WITH_ZONE.test(value)) return "__invalid__";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "__invalid__";
}

async function enterpriseRiskSchemaReady() {
  const rows = await sql/*sql*/`
    SELECT
      to_regclass('public.events') IS NOT NULL
      AND to_regclass('public.tags') IS NOT NULL
      AND to_regclass('public.batches') IS NOT NULL
      AND to_regclass('public.tag_profiles') IS NOT NULL
      AND to_regclass('public.sdk_external_events') IS NOT NULL
      AND to_regclass('public.webhook_deliveries') IS NOT NULL
      AND to_regclass('public.webhook_endpoints') IS NOT NULL
      AND to_regclass('public.event_risk_projections') IS NOT NULL
      AND to_regprocedure('public.nexid_enterprise_rbac_risk_truth_v1_capability()') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'events'
          AND column_name = 'risk_profile_version'
      ) AS ready
  `;
  return rows[0]?.ready === true;
}

async function tenantIdFor(req: Request, selector: string | null) {
  const principal = getAdminPrincipal(req);
  const requested = String(selector || "").trim().toLowerCase();
  if (principal.scope !== "super_admin") {
    if (!principal.tenantId) return undefined;
    if (requested && requested !== principal.tenantId.toLowerCase() && requested !== String(principal.tenantSlug || "").toLowerCase()) {
      return undefined;
    }
    return principal.tenantId;
  }
  if (!requested) return null;
  const rows = await sql/*sql*/`
    SELECT id::text AS id FROM tenants
    WHERE slug = ${requested} OR (${UUID.test(requested)} AND id::text = ${requested})
    LIMIT 1
  `;
  return rows[0]?.id ? String(rows[0].id) : undefined;
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator", "reseller"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "analytics:read");
  if (permission) return permission;
  const sensitiveEventPermission = checkAdminPermission(req, "events.read_sensitive");
  if (sensitiveEventPermission) return sensitiveEventPermission;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "observability_read",
    ...adminCriticalRateLimitIdentity(req),
    tenantWide: true,
  });
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(req.url);
  const tenantSelector = searchParams.get("tenant");
  const filters = {
    sku: boundedFilter(searchParams.get("sku")),
    product: boundedFilter(searchParams.get("product")),
    batch: boundedFilter(searchParams.get("batch")),
    lot: boundedFilter(searchParams.get("lot")),
    region: boundedFilter(searchParams.get("region")),
    distributor: boundedFilter(searchParams.get("distributor")),
    carrier: boundedFilter(searchParams.get("carrier")),
  };
  const riskLevel = String(searchParams.get("riskLevel") || "").trim().toLowerCase() || null;
  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");
  const to = rawTo ? instant(rawTo) : new Date().toISOString();
  const from = rawFrom
    ? instant(rawFrom)
    : to && to !== "__invalid__"
      ? new Date(Date.parse(to) - 30 * 24 * 60 * 60 * 1000).toISOString()
      : "__invalid__";
  const limit = boundedLimit(searchParams.get("limit"));
  if (Object.values(filters).includes("__invalid__") || from === "__invalid__" || to === "__invalid__"
    || !limit || (riskLevel && !RISK_LEVELS.has(riskLevel))
    || (filters.carrier && !CARRIER_CODES.has(filters.carrier.toLowerCase()))
    || (from && to && (
      Date.parse(from) > Date.parse(to)
      || Date.parse(to) - Date.parse(from) > 366 * 24 * 60 * 60 * 1000
    ))) {
    return json({ ok: false, reason: "risk_analytics_filters_invalid" }, 400, NO_STORE);
  }

  try {
    if (!await enterpriseRiskSchemaReady()) {
      return json({ ok: false, reason: "enterprise_risk_migration_required", requiredMigration: REQUIRED_MIGRATION }, 503, {
        ...NO_STORE,
        "retry-after": "1",
      });
    }
    const tenantId = await tenantIdFor(req, tenantSelector);
    if (tenantId === undefined) return json({ ok: false, reason: "tenant_not_found" }, 404, NO_STORE);
    const rows = await sql/*sql*/`
      WITH event_base AS MATERIALIZED (
        SELECT
          event.id,
          event.created_at,
          event.tenant_id,
          tenant.slug AS tenant_slug,
          event.batch_id,
          event.tag_id,
          batch.bid,
          COALESCE(NULLIF(profile.sku, ''), NULLIF(batch.sku, ''), NULLIF(event.meta->>'sku', '')) AS sku,
          COALESCE(NULLIF(tag.product_id, ''), NULLIF(event.meta->>'product_id', ''), NULLIF(event.product_name, '')) AS product_id,
          COALESCE(NULLIF(event.meta->>'lot_number', ''), NULLIF(event.meta->>'lot', '')) AS lot_number,
          COALESCE(NULLIF(event.meta->>'region', ''), NULLIF(profile.region, ''), NULLIF(event.city, '')) AS region,
          NULLIF(event.meta->>'distributor_id', '') AS distributor_id,
          COALESCE(
            NULLIF(profile.carrier_profile_code, ''),
            NULLIF(tag.carrier_profile_code, ''),
            NULLIF(batch.carrier_profile_code, '')
          ) AS carrier_profile_code,
          COALESCE(event.event_type::text, 'UNKNOWN_EVENT') AS event_type,
          event.verdict,
          event.result,
          event.reason,
          CASE
            WHEN event.risk_profile_version = 'nexid-risk-v1' THEN event.risk_score
            WHEN risk_projection.risk_profile_version = 'nexid-risk-v1' THEN risk_projection.risk_score
            ELSE NULL
          END AS risk_score,
          CASE
            WHEN event.risk_profile_version = 'nexid-risk-v1' THEN event.risk_level::text
            WHEN risk_projection.risk_profile_version = 'nexid-risk-v1' THEN risk_projection.risk_level::text
            ELSE NULL
          END AS risk_level,
          CASE
            WHEN event.risk_profile_version = 'nexid-risk-v1' THEN event.triggered_rules
            WHEN risk_projection.risk_profile_version = 'nexid-risk-v1' THEN risk_projection.triggered_rules
            ELSE '[]'::jsonb
          END AS triggered_rules,
          CASE
            WHEN event.risk_profile_version = 'nexid-risk-v1' THEN event.recommended_action
            WHEN risk_projection.risk_profile_version = 'nexid-risk-v1' THEN risk_projection.recommended_action
            ELSE NULL
          END AS recommended_action,
          CASE
            WHEN event.risk_profile_version = 'nexid-risk-v1' THEN event.risk_profile_version
            WHEN risk_projection.risk_profile_version = 'nexid-risk-v1' THEN risk_projection.risk_profile_version
            ELSE NULL
          END AS risk_profile_version,
          (
            event.risk_profile_version = 'nexid-risk-v1'
            OR risk_projection.risk_profile_version = 'nexid-risk-v1'
          ) AS risk_classified,
          COALESCE(
            'tag:' || event.tag_id::text,
            CASE WHEN event.uid_hex IS NULL THEN NULL ELSE
              'uid:' || encode(digest(event.tenant_id::text || ':' || upper(event.uid_hex), 'sha256'), 'hex')
            END
          ) AS unit_key,
          CASE WHEN event.lat IS NULL OR event.lng IS NULL THEN NULL ELSE jsonb_build_object(
            'lat', round(event.lat::numeric, 3), 'lng', round(event.lng::numeric, 3),
            'city', event.city, 'country', event.country_code
          ) END AS approximate_location
        FROM events event
        JOIN tenants tenant ON tenant.id = event.tenant_id
        JOIN batches batch ON batch.id = event.batch_id AND batch.tenant_id = event.tenant_id
        LEFT JOIN tags tag ON tag.id = event.tag_id AND tag.batch_id = batch.id
        LEFT JOIN tag_profiles profile ON profile.tag_id = tag.id
        LEFT JOIN event_risk_projections risk_projection
          ON risk_projection.event_id = event.id
         AND risk_projection.event_created_at = event.created_at
         AND risk_projection.tenant_id = event.tenant_id
         AND risk_projection.risk_profile_version = 'nexid-risk-v1'
        WHERE (${tenantId}::uuid IS NULL OR event.tenant_id = ${tenantId}::uuid)
          AND (${filters.sku}::text IS NULL OR lower(COALESCE(NULLIF(profile.sku, ''), NULLIF(batch.sku, ''), NULLIF(event.meta->>'sku', ''), '')) = lower(${filters.sku}))
          AND (${filters.product}::text IS NULL OR lower(COALESCE(NULLIF(tag.product_id, ''), NULLIF(event.meta->>'product_id', ''), NULLIF(event.product_name, ''), '')) = lower(${filters.product}))
          AND (${filters.batch}::text IS NULL OR batch.bid = ${filters.batch} OR batch.id::text = ${filters.batch})
          AND (${filters.lot}::text IS NULL OR lower(COALESCE(NULLIF(event.meta->>'lot_number', ''), NULLIF(event.meta->>'lot', ''), '')) = lower(${filters.lot}))
          AND (${filters.region}::text IS NULL OR lower(COALESCE(NULLIF(event.meta->>'region', ''), NULLIF(profile.region, ''), NULLIF(event.city, ''), '')) = lower(${filters.region}))
          AND (${filters.distributor}::text IS NULL OR lower(COALESCE(NULLIF(event.meta->>'distributor_id', ''), '')) = lower(${filters.distributor}))
          AND (${filters.carrier}::text IS NULL OR lower(COALESCE(
            NULLIF(profile.carrier_profile_code, ''),
            NULLIF(tag.carrier_profile_code, ''),
            NULLIF(batch.carrier_profile_code, ''),
            ''
          )) = lower(${filters.carrier}))
          AND (${from}::timestamptz IS NULL OR event.created_at >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR event.created_at <= ${to}::timestamptz)
      ), filtered AS MATERIALIZED (
        SELECT *
        FROM event_base
        WHERE ${riskLevel}::text IS NULL
          OR (risk_profile_version = 'nexid-risk-v1' AND risk_level = ${riskLevel})
      ), inventory AS MATERIALIZED (
        SELECT tag.id, tag.scan_count, tag.first_seen_at
        FROM tags tag
        JOIN batches batch ON batch.id = tag.batch_id
        LEFT JOIN tag_profiles profile ON profile.tag_id = tag.id
        WHERE (${tenantId}::uuid IS NULL OR batch.tenant_id = ${tenantId}::uuid)
          AND (${filters.sku}::text IS NULL OR lower(COALESCE(NULLIF(profile.sku, ''), NULLIF(batch.sku, ''), '')) = lower(${filters.sku}))
          AND (${filters.product}::text IS NULL OR lower(COALESCE(NULLIF(tag.product_id, ''), NULLIF(profile.product_name, ''), '')) = lower(${filters.product}))
          AND (${filters.batch}::text IS NULL OR batch.bid = ${filters.batch} OR batch.id::text = ${filters.batch})
          AND (${filters.region}::text IS NULL OR lower(COALESCE(NULLIF(profile.region, ''), '')) = lower(${filters.region}))
          AND (${filters.carrier}::text IS NULL OR lower(COALESCE(
            NULLIF(profile.carrier_profile_code, ''),
            NULLIF(tag.carrier_profile_code, ''),
            NULLIF(batch.carrier_profile_code, ''),
            ''
          )) = lower(${filters.carrier}))
      ), experience AS MATERIALIZED (
        SELECT external_event.event_type
        FROM sdk_external_events external_event
        LEFT JOIN batches batch
          ON batch.id = external_event.batch_id AND batch.tenant_id = external_event.tenant_id
        LEFT JOIN tags tag
          ON tag.id = external_event.tag_id
         AND tag.batch_id = batch.id
        LEFT JOIN tag_profiles profile ON profile.tag_id = tag.id
        WHERE (${tenantId}::uuid IS NULL OR external_event.tenant_id = ${tenantId}::uuid)
          AND (${filters.sku}::text IS NULL OR lower(COALESCE(NULLIF(external_event.sku, ''), NULLIF(profile.sku, ''), NULLIF(batch.sku, ''), '')) = lower(${filters.sku}))
          AND (${filters.product}::text IS NULL OR lower(COALESCE(NULLIF(external_event.product_id, ''), NULLIF(tag.product_id, ''), NULLIF(profile.product_name, ''), '')) = lower(${filters.product}))
          AND (${filters.batch}::text IS NULL OR external_event.bid = ${filters.batch} OR external_event.batch_id::text = ${filters.batch})
          AND (${filters.lot}::text IS NULL OR lower(COALESCE(NULLIF(external_event.lot_number, ''), '')) = lower(${filters.lot}))
          AND (${filters.region}::text IS NULL OR lower(COALESCE(NULLIF(external_event.approximate_location->>'region', ''), '')) = lower(${filters.region}))
          AND (${filters.distributor}::text IS NULL OR lower(COALESCE(NULLIF(external_event.distributor_id, ''), '')) = lower(${filters.distributor}))
          AND (${filters.carrier}::text IS NULL OR lower(COALESCE(
            NULLIF(profile.carrier_profile_code, ''),
            NULLIF(tag.carrier_profile_code, ''),
            NULLIF(batch.carrier_profile_code, ''),
            ''
          )) = lower(${filters.carrier}))
          AND (${riskLevel}::text IS NULL OR lower(external_event.risk_level) = ${riskLevel})
          AND (${from}::timestamptz IS NULL OR COALESCE(external_event.occurred_at, external_event.created_at) >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR COALESCE(external_event.occurred_at, external_event.created_at) <= ${to}::timestamptz)
      ), webhook_health AS MATERIALIZED (
        SELECT delivery.status
        FROM webhook_deliveries delivery
        JOIN webhook_endpoints endpoint ON endpoint.id = delivery.endpoint_id
        WHERE (${tenantId}::uuid IS NULL OR endpoint.tenant_id = ${tenantId}::uuid)
          AND (${from}::timestamptz IS NULL OR delivery.created_at >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR delivery.created_at <= ${to}::timestamptz)
      ), rule_counts AS (
        SELECT rule.value AS rule, count(*)::integer AS events
        FROM filtered event
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(event.triggered_rules, '[]'::jsonb)) rule(value)
        WHERE event.risk_profile_version = 'nexid-risk-v1'
        GROUP BY rule.value
        ORDER BY events DESC, rule.value ASC
      ), limited AS (
        SELECT
          id::text AS id,
          created_at,
          tenant_slug,
          bid,
          sku,
          product_id,
          lot_number,
          region,
          distributor_id,
          carrier_profile_code,
          event_type,
          result,
          CASE WHEN risk_classified THEN risk_profile_version ELSE NULL END AS risk_profile_version,
          risk_classified,
          CASE WHEN risk_classified THEN risk_score ELSE NULL END AS risk_score,
          CASE WHEN risk_classified THEN risk_level ELSE NULL END AS risk_level,
          CASE WHEN risk_classified THEN triggered_rules ELSE '[]'::jsonb END AS triggered_rules,
          CASE WHEN risk_classified THEN recommended_action ELSE NULL END AS recommended_action,
          'event:' || left(encode(digest(
            tenant_id::text || ':' || id::text || ':' || created_at::text,
            'sha256'
          ), 'hex'), 24) AS unit_reference,
          approximate_location
        FROM filtered
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      )
      SELECT jsonb_build_object(
        'kpis', jsonb_build_object(
          'total_events', count(*),
          'risk_scored_events', count(*) FILTER (WHERE risk_profile_version = 'nexid-risk-v1'),
          'risk_unscored_events', count(*) FILTER (WHERE risk_profile_version IS DISTINCT FROM 'nexid-risk-v1'),
          'risk_coverage_pct', CASE WHEN count(*) = 0 THEN NULL ELSE round(
            100.0 * count(*) FILTER (WHERE risk_profile_version = 'nexid-risk-v1') / count(*), 2
          ) END,
          'critical_events', count(*) FILTER (WHERE risk_profile_version = 'nexid-risk-v1' AND risk_level = 'critical'),
          'high_events', count(*) FILTER (WHERE risk_profile_version = 'nexid-risk-v1' AND risk_level = 'high'),
          'medium_events', count(*) FILTER (WHERE risk_profile_version = 'nexid-risk-v1' AND risk_level = 'medium'),
          'low_or_none_events', count(*) FILTER (WHERE risk_profile_version = 'nexid-risk-v1' AND risk_level IN ('low', 'none')),
          'risk_event_rate_pct', CASE
            WHEN count(*) FILTER (WHERE risk_profile_version = 'nexid-risk-v1') = 0 THEN NULL
            ELSE round(100.0 * count(*) FILTER (
              WHERE risk_profile_version = 'nexid-risk-v1' AND risk_score > 0
            ) / count(*) FILTER (WHERE risk_profile_version = 'nexid-risk-v1'), 2)
          END,
          'average_risk_score', round(avg(risk_score) FILTER (WHERE risk_profile_version = 'nexid-risk-v1'), 2),
          'valid_taps', count(*) FILTER (WHERE upper(COALESCE(result, '')) IN (
            'VALID', 'TAP_VALID', 'VALID_AUTHENTIC', 'VALID_CLOSED', 'VALID_OPENED',
            'VALID_OPENED_PREVIOUSLY', 'VALID_UNKNOWN_TAMPER', 'VALID_MANUAL_OPENED'
          )),
          'unique_units', count(DISTINCT unit_key) FILTER (WHERE unit_key IS NOT NULL),
          'replay_events', count(*) FILTER (WHERE
            upper(COALESCE(result, '')) IN ('REPLAY', 'REPLAY_SUSPECT', 'DUPLICATE', 'BLOCKED_REPLAY')
            OR (risk_profile_version = 'nexid-risk-v1' AND COALESCE(triggered_rules, '[]'::jsonb) ? 'REPLAY_SUSPECT')
          ),
          'invalid_auth_events', count(*) FILTER (WHERE
            upper(COALESCE(result, '')) IN ('INVALID', 'NOT_REGISTERED', 'NOT_ACTIVE', 'REVOKED', 'BROKEN', 'SUN_PROFILE_MISMATCH')
            OR upper(COALESCE(verdict, '')) = 'INVALID'
            OR (risk_profile_version = 'nexid-risk-v1' AND COALESCE(triggered_rules, '[]'::jsonb) ? 'INVALID_SUN_OR_CMAC')
          ),
          'never_scanned_units_lifetime', (SELECT count(*) FROM inventory WHERE scan_count = 0 AND first_seen_at IS NULL),
          'tamper_events', count(*) FILTER (WHERE
            upper(COALESCE(result, '')) IN ('TAMPER', 'TAMPERED', 'TAMPER_RISK', 'TAMPER_UNVERIFIED', 'BROKEN')
            OR (risk_profile_version = 'nexid-risk-v1' AND COALESCE(triggered_rules, '[]'::jsonb) ? 'TAMPER_BEFORE_EXPECTED_SALE_STAGE')
          ),
          'geo_anomalies', count(*) FILTER (WHERE risk_profile_version = 'nexid-risk-v1'
            AND COALESCE(triggered_rules, '[]'::jsonb) ? 'IMPOSSIBLE_TRAVEL_OR_GEO_ANOMALY'),
          'content_adoption_events', (SELECT count(*) FROM experience WHERE event_type IN (
            'PRODUCT_VIEWED', 'TECHNICAL_SHEET_VIEWED', 'SAFETY_SHEET_VIEWED',
            'PPE_CONTENT_VIEWED', 'STEWARDSHIP_CONFIRMED', 'TRAINING_STARTED', 'TRAINING_COMPLETED'
          )),
          'cropwise_cta_clicks', (SELECT count(*) FROM experience WHERE event_type = 'CROPWISE_CTA_CLICKED'),
          'registrations_and_leads', (SELECT count(*) FROM experience WHERE event_type IN (
            'ADVISOR_CONTACT_REQUESTED', 'LOYALTY_JOINED', 'LEAD_CREATED'
          )),
          'training_completions', (SELECT count(*) FROM experience WHERE event_type = 'TRAINING_COMPLETED'),
          'webhook_deliveries', (SELECT count(*) FROM webhook_health),
          'webhook_delivered', (SELECT count(*) FROM webhook_health WHERE status = 'delivered'),
          'webhook_pending', (SELECT count(*) FROM webhook_health WHERE status IN ('pending', 'processing', 'retry_scheduled')),
          'webhook_dead_letter', (SELECT count(*) FROM webhook_health WHERE status = 'dead_letter'),
          'webhook_delivery_rate_pct', CASE
            WHEN (SELECT count(*) FROM webhook_health) = 0 THEN NULL
            ELSE round(100.0 * (SELECT count(*) FROM webhook_health WHERE status = 'delivered') / (SELECT count(*) FROM webhook_health), 2)
          END,
          'unique_products', count(DISTINCT product_id) FILTER (WHERE product_id IS NOT NULL),
          'unique_batches', count(DISTINCT batch_id),
          'unique_distributors', count(DISTINCT distributor_id) FILTER (WHERE distributor_id IS NOT NULL)
        ),
        'triggered_rules', COALESCE((SELECT jsonb_agg(to_jsonb(rule_counts)) FROM rule_counts), '[]'::jsonb),
        'events', COALESCE((SELECT jsonb_agg(to_jsonb(limited) ORDER BY limited.created_at DESC, limited.id DESC) FROM limited), '[]'::jsonb)
      ) AS result
      FROM filtered
    `;
    return json({
      ok: true,
      tenantScoped: tenantId !== null,
      scopes: {
        eventKpis: "selected_filters_and_time_window",
        neverScannedUnits: "lifetime_inventory_matching_tenant_sku_product_batch_region_and_carrier",
        webhookHealth: "tenant_and_time_window",
        riskScoring: "only_events_scored_with_nexid-risk-v1",
      },
      ...(rows[0]?.result || {}),
    }, 200, NO_STORE);
  } catch (error) {
    const code = String((error as { code?: unknown })?.code || "");
    return json({
      ok: false,
      reason: ["42P01", "42703"].includes(code) ? "enterprise_risk_migration_required" : "enterprise_risk_analytics_unavailable",
      ...(["42P01", "42703"].includes(code)
        ? { requiredMigration: REQUIRED_MIGRATION }
        : {}),
    }, 503, { ...NO_STORE, "retry-after": "1" });
  }
}
