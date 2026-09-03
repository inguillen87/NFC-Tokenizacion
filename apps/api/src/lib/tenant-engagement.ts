import { sql, type SqlExecutor } from "./db";
import {
  POST_TAP_ENGAGEMENT_DOMAINS,
  POST_TAP_ENGAGEMENT_STAGES,
  POST_TAP_ENGAGEMENT_TAXONOMY_VERSION,
  type PostTapEngagementDomain,
  type PostTapEngagementStage,
} from "./public-experience-events";

export const TENANT_ENGAGEMENT_RANGES = ["24h", "7d", "30d"] as const;
export const TENANT_ENGAGEMENT_DATA_MODES = ["real", "demo", "imported", "unknown"] as const;

export type TenantEngagementRange = (typeof TENANT_ENGAGEMENT_RANGES)[number];
export type TenantEngagementDataMode = (typeof TENANT_ENGAGEMENT_DATA_MODES)[number];

export type TenantEngagementFilters = {
  range: TenantEngagementRange;
  rangeSql: "24 hours" | "7 days" | "30 days";
  domain: PostTapEngagementDomain | "";
  stage: PostTapEngagementStage | "";
  dataMode: TenantEngagementDataMode | "";
  limit: number;
};

export type TenantEngagementScope = {
  id: string;
  slug: string;
  name: string;
};

export type TenantEngagementItem = {
  id: string;
  domain: PostTapEngagementDomain;
  stage: PostTapEngagementStage;
  occurredAt: string;
  dataMode: TenantEngagementDataMode;
  sourceEventType: string;
  actor: {
    state: "contactable_consumer" | "linked_without_contact_consent" | "ambiguous_link" | "anonymous";
    consumerId: string | null;
    contactable: boolean;
    consentChannels: Array<"email" | "phone" | "whatsapp">;
  };
  unit: {
    batchId: string | null;
    tagId: string | null;
    bid: string | null;
    sourceTapEventId: string | null;
    isActorIdentity: false;
  };
  provenance: {
    sourceKind: string;
    recordType: string;
    recordId: string;
    evidence: string;
    auditId: string | null;
    traceId: string | null;
    tenantScope: "server_derived";
    idempotency: {
      status: "recorded" | "registry_deduplicated" | "not_available";
      key: string | null;
      requestFingerprint: string | null;
    };
  };
};

const RANGE_SQL: Record<TenantEngagementRange, TenantEngagementFilters["rangeSql"]> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};
const DOMAIN_SET = new Set<string>(POST_TAP_ENGAGEMENT_DOMAINS);
const STAGE_SET = new Set<string>(POST_TAP_ENGAGEMENT_STAGES);
const RANGE_SET = new Set<string>(TENANT_ENGAGEMENT_RANGES);
const DATA_MODE_SET = new Set<string>(TENANT_ENGAGEMENT_DATA_MODES);
const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/;

function text(value: unknown, maximum = 160) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximum);
}

function optionalText(value: unknown, maximum = 160) {
  const normalized = text(value, maximum);
  return normalized || null;
}

export function normalizeTenantEngagementSlug(value: unknown) {
  const normalized = text(value, 80).toLowerCase();
  return TENANT_SLUG_RE.test(normalized) ? normalized : null;
}

export function parseTenantEngagementFilters(searchParams: URLSearchParams):
  | { ok: true; filters: TenantEngagementFilters }
  | { ok: false; reason: string } {
  const requestedRange = text(searchParams.get("range"), 16).toLowerCase() || "24h";
  if (!RANGE_SET.has(requestedRange)) return { ok: false, reason: "engagement_range_invalid" };

  const requestedDomain = text(searchParams.get("domain"), 32).toLowerCase();
  if (requestedDomain && !DOMAIN_SET.has(requestedDomain)) return { ok: false, reason: "engagement_domain_invalid" };

  const requestedStage = text(searchParams.get("stage"), 32).toUpperCase();
  if (requestedStage && !STAGE_SET.has(requestedStage)) return { ok: false, reason: "engagement_stage_invalid" };

  const requestedDataMode = text(searchParams.get("source") || searchParams.get("dataMode"), 32).toLowerCase();
  const dataMode = requestedDataMode === "all" ? "" : requestedDataMode;
  if (dataMode && !DATA_MODE_SET.has(dataMode)) return { ok: false, reason: "engagement_source_invalid" };

  const requestedLimit = Number(searchParams.get("limit") || 100);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 500) {
    return { ok: false, reason: "engagement_limit_invalid" };
  }

  const range = requestedRange as TenantEngagementRange;
  return {
    ok: true,
    filters: {
      range,
      rangeSql: RANGE_SQL[range],
      domain: requestedDomain as PostTapEngagementDomain | "",
      stage: requestedStage as PostTapEngagementStage | "",
      dataMode: dataMode as TenantEngagementDataMode | "",
      limit: requestedLimit,
    },
  };
}

export async function resolveTenantEngagementScope(
  tenantSlug: string,
  query: SqlExecutor = sql,
): Promise<TenantEngagementScope | null> {
  const rows = await query/*sql*/`
    SELECT tenant.id::text AS id, tenant.slug, tenant.name
    FROM tenants tenant
    WHERE tenant.slug = ${tenantSlug}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row?.id || !row.slug) return null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name || row.slug),
  };
}

function normalizeChannels(value: unknown): Array<"email" | "phone" | "whatsapp"> {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(["email", "phone", "whatsapp"]);
  return [...new Set(value.map((entry) => text(entry, 32).toLowerCase()).filter((entry) => allowed.has(entry)))]
    .sort() as Array<"email" | "phone" | "whatsapp">;
}

export function normalizeTenantEngagementRow(row: Record<string, unknown>): TenantEngagementItem | null {
  const domain = text(row.domain, 32).toLowerCase();
  const stage = text(row.stage, 32).toUpperCase();
  const dataMode = text(row.data_mode, 32).toLowerCase();
  const id = text(row.activity_id, 240);
  const occurredAt = text(row.occurred_at, 80);
  if (
    !id
    || !DOMAIN_SET.has(domain)
    || !STAGE_SET.has(stage)
    || !DATA_MODE_SET.has(dataMode)
    || !occurredAt
    || !Number.isFinite(Date.parse(occurredAt))
  ) return null;

  const linkedActorCount = Math.max(0, Number(row.linked_actor_count || 0));
  const channels = normalizeChannels(row.consent_channels);
  const actorRef = optionalText(row.actor_ref, 80);
  const contactable = linkedActorCount === 1 && channels.length > 0 && Boolean(actorRef);
  const actorState = contactable
    ? "contactable_consumer"
    : linkedActorCount > 1
      ? "ambiguous_link"
      : linkedActorCount === 1
        ? "linked_without_contact_consent"
        : "anonymous";

  const idempotencyKey = optionalText(row.idempotency_key, 255);
  const requestFingerprint = optionalText(row.request_fingerprint, 128);
  const idempotencyStatus = idempotencyKey && requestFingerprint
    ? "recorded"
    : text(row.dedupe_mode, 80) === "registry_unique_constraint"
      ? "registry_deduplicated"
      : "not_available";

  return {
    id,
    domain: domain as PostTapEngagementDomain,
    stage: stage as PostTapEngagementStage,
    occurredAt: new Date(occurredAt).toISOString(),
    dataMode: dataMode as TenantEngagementDataMode,
    sourceEventType: text(row.source_event_type, 120),
    actor: {
      state: actorState,
      consumerId: contactable ? actorRef : null,
      contactable,
      consentChannels: contactable ? channels : [],
    },
    unit: {
      batchId: optionalText(row.batch_id, 80),
      tagId: optionalText(row.tag_id, 80),
      bid: optionalText(row.bid, 160),
      sourceTapEventId: optionalText(row.source_tap_event_id, 80),
      isActorIdentity: false,
    },
    provenance: {
      sourceKind: text(row.source_kind, 80),
      recordType: text(row.source_record_type, 80),
      recordId: text(row.source_record_id, 160),
      evidence: text(row.evidence, 120),
      auditId: optionalText(row.audit_id, 80),
      traceId: optionalText(row.trace_id, 160),
      tenantScope: "server_derived",
      idempotency: {
        status: idempotencyStatus,
        key: idempotencyStatus === "recorded" ? idempotencyKey : null,
        requestFingerprint: idempotencyStatus === "recorded" ? requestFingerprint : null,
      },
    },
  };
}

export async function loadTenantEngagement(input: {
  tenant: TenantEngagementScope;
  filters: TenantEngagementFilters;
  query?: SqlExecutor;
}) {
  const query = input.query || sql;
  const tenantId = input.tenant.id;
  const { rangeSql, domain, stage, dataMode, limit } = input.filters;
  const rows = await query/*sql*/`
    WITH public_experience AS MATERIALIZED (
      SELECT
        'public-experience:' || external_event.id::text AS activity_id,
        external_event.tenant_id,
        CASE
          WHEN external_event.event_type = 'PRODUCT_VIEWED' THEN 'passport'
          WHEN external_event.event_type IN (
            'TECHNICAL_SHEET_VIEWED', 'SAFETY_SHEET_VIEWED', 'PPE_CONTENT_VIEWED',
            'STEWARDSHIP_CONFIRMED', 'CROPWISE_CTA_CLICKED', 'TRAINING_STARTED', 'TRAINING_COMPLETED'
          ) THEN 'content'
          WHEN external_event.event_type IN ('ADVISOR_CONTACT_REQUESTED', 'LEAD_CREATED', 'PROBLEM_REPORTED') THEN 'support'
          WHEN external_event.event_type IN ('LOYALTY_OFFER_VIEWED', 'LOYALTY_JOINED') THEN 'loyalty'
        END AS domain,
        CASE
          WHEN external_event.event_type IN (
            'PRODUCT_VIEWED', 'TECHNICAL_SHEET_VIEWED', 'SAFETY_SHEET_VIEWED',
            'PPE_CONTENT_VIEWED', 'LOYALTY_OFFER_VIEWED'
          ) THEN 'VIEWED'
          WHEN external_event.event_type IN (
            'CROPWISE_CTA_CLICKED', 'ADVISOR_CONTACT_REQUESTED', 'TRAINING_STARTED', 'PROBLEM_REPORTED'
          ) THEN 'STARTED'
          WHEN external_event.event_type IN ('STEWARDSHIP_CONFIRMED', 'LOYALTY_JOINED', 'TRAINING_COMPLETED', 'LEAD_CREATED') THEN 'CONFIRMED'
        END AS stage,
        COALESCE(external_event.occurred_at, external_event.created_at) AS occurred_at,
        external_event.event_type AS source_event_type,
        'public_experience_event'::text AS source_kind,
        'sdk_external_events'::text AS source_record_type,
        external_event.id::text AS source_record_id,
        CASE
          WHEN external_event.data->>'sourceTapEventId' ~ '^[1-9][0-9]*$'
          THEN (external_event.data->>'sourceTapEventId')::bigint
          ELSE NULL
        END AS source_tap_event_id,
        external_event.batch_id,
        external_event.tag_id::text AS tag_id,
        external_event.bid,
        NULL::uuid AS direct_consumer_id,
        CASE
          WHEN COALESCE(source_event.meta->>'simulated', 'false') = 'true' OR source_event.source::text = 'demo' THEN 'demo'
          WHEN source_event.source::text = 'real' THEN 'real'
          WHEN source_event.source::text = 'imported' THEN 'imported'
          ELSE 'unknown'
        END AS data_mode,
        external_event.data->>'publicIdempotencyKey' AS idempotency_key,
        external_event.data->>'publicRequestFingerprint' AS request_fingerprint,
        external_event.data->>'traceId' AS trace_id,
        'client_reported_action'::text AS evidence,
        (
          SELECT audit.id::text
          FROM audit_logs audit
          WHERE audit.tenant_id = external_event.tenant_id
            AND audit.action = 'post_tap.engagement.recorded'
            AND audit.resource_type = 'sdk_external_event'
            AND audit.resource_id = external_event.id::text
          ORDER BY audit.created_at ASC, audit.id ASC
          LIMIT 1
        ) AS audit_id,
        'writer_idempotency_key'::text AS dedupe_mode
      FROM sdk_external_events external_event
      LEFT JOIN events source_event
        ON source_event.tenant_id = external_event.tenant_id
       AND source_event.id = CASE
         WHEN external_event.data->>'sourceTapEventId' ~ '^[1-9][0-9]*$'
         THEN (external_event.data->>'sourceTapEventId')::bigint
         ELSE NULL
       END
      WHERE external_event.tenant_id = ${tenantId}::uuid
        AND external_event.source = 'public_passport'
        AND external_event.event_type IN (
          'PRODUCT_VIEWED', 'TECHNICAL_SHEET_VIEWED', 'SAFETY_SHEET_VIEWED', 'PPE_CONTENT_VIEWED',
          'STEWARDSHIP_CONFIRMED', 'CROPWISE_CTA_CLICKED', 'ADVISOR_CONTACT_REQUESTED',
          'LOYALTY_OFFER_VIEWED', 'LOYALTY_JOINED', 'TRAINING_STARTED', 'TRAINING_COMPLETED',
          'LEAD_CREATED', 'PROBLEM_REPORTED'
        )
        AND COALESCE(external_event.occurred_at, external_event.created_at) >= now() - ${rangeSql}::interval
    ), warranty_activity AS MATERIALIZED (
      SELECT
        'canonical-event:' || lifecycle_event.id::text AS activity_id,
        lifecycle_event.tenant_id,
        'warranty'::text AS domain,
        CASE WHEN lifecycle_event.event_type::text = 'WARRANTY_REGISTERED' THEN 'CONFIRMED' ELSE 'STARTED' END AS stage,
        lifecycle_event.created_at AS occurred_at,
        lifecycle_event.event_type::text AS source_event_type,
        'canonical_lifecycle_event'::text AS source_kind,
        'events'::text AS source_record_type,
        lifecycle_event.id::text AS source_record_id,
        CASE
          WHEN lifecycle_event.meta->>'source_event_id' ~ '^[1-9][0-9]*$'
          THEN (lifecycle_event.meta->>'source_event_id')::bigint
          ELSE NULL
        END AS source_tap_event_id,
        lifecycle_event.batch_id,
        lifecycle_event.tag_id::text AS tag_id,
        lifecycle_event.bid,
        NULL::uuid AS direct_consumer_id,
        CASE
          WHEN COALESCE(lifecycle_event.meta->>'simulated', 'false') = 'true' OR lifecycle_event.source::text = 'demo' THEN 'demo'
          WHEN lifecycle_event.source::text = 'real' THEN 'real'
          WHEN lifecycle_event.source::text = 'imported' THEN 'imported'
          ELSE 'unknown'
        END AS data_mode,
        operation.operation_key AS idempotency_key,
        operation.request_fingerprint,
        lifecycle_event.meta->>'trace_id' AS trace_id,
        CASE
          WHEN lifecycle_event.event_type::text = 'WARRANTY_REGISTERED' THEN 'server_confirmed_warranty_registration'
          ELSE 'server_confirmed_review_request'
        END AS evidence,
        operation.id::text AS audit_id,
        'canonical_event_operation'::text AS dedupe_mode
      FROM events lifecycle_event
      LEFT JOIN canonical_event_operations operation
        ON operation.tenant_id = lifecycle_event.tenant_id
       AND operation.event_id = lifecycle_event.id
       AND operation.event_created_at = lifecycle_event.created_at
      WHERE lifecycle_event.tenant_id = ${tenantId}::uuid
        AND lifecycle_event.event_type::text IN ('WARRANTY_REVIEW_REQUESTED', 'WARRANTY_REGISTERED')
        AND lifecycle_event.created_at >= now() - ${rangeSql}::interval
    ), support_activity AS MATERIALIZED (
      SELECT
        'ticket:' || ticket.id::text AS activity_id,
        ticket.tenant_id,
        'support'::text AS domain,
        'CONFIRMED'::text AS stage,
        ticket.created_at AS occurred_at,
        'TICKET_CREATED'::text AS source_event_type,
        'support_ticket'::text AS source_kind,
        'tickets'::text AS source_record_type,
        ticket.id::text AS source_record_id,
        ticket.tap_event_id AS source_tap_event_id,
        source_event.batch_id,
        source_event.tag_id::text AS tag_id,
        COALESCE(source_batch.bid, ticket.bid) AS bid,
        NULL::uuid AS direct_consumer_id,
        CASE
          WHEN COALESCE(source_event.meta->>'simulated', 'false') = 'true' OR source_event.source::text = 'demo' THEN 'demo'
          WHEN source_event.source::text = 'real' THEN 'real'
          WHEN source_event.source::text = 'imported' THEN 'imported'
          ELSE 'unknown'
        END AS data_mode,
        NULL::text AS idempotency_key,
        NULL::text AS request_fingerprint,
        NULL::text AS trace_id,
        'durable_ticket_created'::text AS evidence,
        NULL::text AS audit_id,
        'none'::text AS dedupe_mode
      FROM tickets ticket
      LEFT JOIN events source_event
        ON source_event.tenant_id = ticket.tenant_id
       AND source_event.id = ticket.tap_event_id
      LEFT JOIN batches source_batch
        ON source_batch.tenant_id = source_event.tenant_id
       AND source_batch.id = source_event.batch_id
      WHERE ticket.tenant_id = ${tenantId}::uuid
        AND ticket.source = 'sun_public_report'
        AND ticket.tap_event_id IS NOT NULL
        AND ticket.created_at >= now() - ${rangeSql}::interval
    ), ownership_activity AS MATERIALIZED (
      SELECT
        'ownership:' || ownership.id::text AS activity_id,
        ownership.tenant_id,
        'ownership'::text AS domain,
        'CONFIRMED'::text AS stage,
        COALESCE(ownership.claimed_at, ownership.created_at) AS occurred_at,
        'OWNERSHIP_ACTIVATED'::text AS source_event_type,
        'ownership_registry'::text AS source_kind,
        'consumer_product_ownerships'::text AS source_record_type,
        ownership.id::text AS source_record_id,
        ownership.event_id AS source_tap_event_id,
        ownership.batch_id,
        ownership.tag_id::text AS tag_id,
        source_batch.bid,
        ownership.consumer_id AS direct_consumer_id,
        CASE
          WHEN COALESCE(source_event.meta->>'simulated', 'false') = 'true' OR source_event.source::text = 'demo' THEN 'demo'
          WHEN source_event.source::text = 'real' THEN 'real'
          WHEN source_event.source::text = 'imported' THEN 'imported'
          ELSE 'unknown'
        END AS data_mode,
        NULL::text AS idempotency_key,
        NULL::text AS request_fingerprint,
        NULL::text AS trace_id,
        'durable_claimed_ownership_record'::text AS evidence,
        NULL::text AS audit_id,
        'registry_unique_constraint'::text AS dedupe_mode
      FROM consumer_product_ownerships ownership
      LEFT JOIN events source_event
        ON source_event.tenant_id = ownership.tenant_id
       AND source_event.id = ownership.event_id
      LEFT JOIN batches source_batch
        ON source_batch.tenant_id = ownership.tenant_id
       AND source_batch.id = ownership.batch_id
      WHERE ownership.tenant_id = ${tenantId}::uuid
        AND ownership.status = 'claimed'
        AND COALESCE(ownership.claimed_at, ownership.created_at) >= now() - ${rangeSql}::interval
    ), loyalty_activity AS MATERIALIZED (
      SELECT
        'loyalty-member:' || member.id::text AS activity_id,
        member.tenant_id,
        'loyalty'::text AS domain,
        'CONFIRMED'::text AS stage,
        member.created_at AS occurred_at,
        'LOYALTY_JOINED'::text AS source_event_type,
        'loyalty_registry'::text AS source_kind,
        'loyalty_members'::text AS source_record_type,
        member.id::text AS source_record_id,
        member.event_id AS source_tap_event_id,
        source_event.batch_id,
        source_event.tag_id::text AS tag_id,
        source_batch.bid,
        member.consumer_id AS direct_consumer_id,
        CASE
          WHEN COALESCE(source_event.meta->>'simulated', 'false') = 'true' OR source_event.source::text = 'demo' THEN 'demo'
          WHEN source_event.source::text = 'real' THEN 'real'
          WHEN source_event.source::text = 'imported' THEN 'imported'
          ELSE 'unknown'
        END AS data_mode,
        NULL::text AS idempotency_key,
        NULL::text AS request_fingerprint,
        NULL::text AS trace_id,
        'durable_loyalty_membership'::text AS evidence,
        NULL::text AS audit_id,
        'registry_unique_constraint'::text AS dedupe_mode
      FROM loyalty_members member
      LEFT JOIN events source_event
        ON source_event.tenant_id = member.tenant_id
       AND source_event.id = member.event_id
      LEFT JOIN batches source_batch
        ON source_batch.tenant_id = source_event.tenant_id
       AND source_batch.id = source_event.batch_id
      WHERE member.tenant_id = ${tenantId}::uuid
        AND member.status::text IN ('enrolled', 'verified')
        AND member.created_at >= now() - ${rangeSql}::interval
    ), base_activity AS MATERIALIZED (
      SELECT * FROM public_experience
      UNION ALL SELECT * FROM warranty_activity
      UNION ALL SELECT * FROM support_activity
      UNION ALL SELECT * FROM ownership_activity
      UNION ALL SELECT * FROM loyalty_activity
    ), actor_links AS MATERIALIZED (
      SELECT activity.activity_id, activity.direct_consumer_id AS consumer_id
      FROM base_activity activity
      WHERE activity.direct_consumer_id IS NOT NULL
      UNION
      SELECT activity.activity_id, history.consumer_id
      FROM base_activity activity
      JOIN consumer_tap_history history
        ON history.tenant_id = ${tenantId}::uuid
       AND history.tap_event_id = activity.source_tap_event_id
      WHERE history.consumer_id IS NOT NULL
    ), actor_rollup AS MATERIALIZED (
      SELECT link.activity_id,
        count(DISTINCT link.consumer_id)::integer AS linked_actor_count,
        min(link.consumer_id::text) AS sole_actor_ref
      FROM actor_links link
      GROUP BY link.activity_id
    ), actor_consent AS MATERIALIZED (
      SELECT rollup.activity_id, rollup.linked_actor_count, rollup.sole_actor_ref,
        COALESCE(array_agg(DISTINCT CASE
          WHEN lower(consent.scope) IN ('whatsapp', 'whatsapp_marketing') THEN 'whatsapp'
          WHEN lower(consent.scope) = 'phone_marketing' THEN 'phone'
          WHEN lower(consent.scope) IN ('email', 'email_marketing') THEN 'email'
        END) FILTER (WHERE consent.id IS NOT NULL), ARRAY[]::text[]) AS consent_channels
      FROM actor_rollup rollup
      LEFT JOIN consumer_tenant_consents consent
        ON rollup.linked_actor_count = 1
       AND consent.tenant_id = ${tenantId}::uuid
       AND consent.consumer_id::text = rollup.sole_actor_ref
       AND consent.granted = true
       AND consent.granted_at IS NOT NULL
       AND consent.revoked_at IS NULL
       AND lower(consent.scope) IN (
         'whatsapp', 'whatsapp_marketing', 'phone_marketing', 'email', 'email_marketing'
       )
      GROUP BY rollup.activity_id, rollup.linked_actor_count, rollup.sole_actor_ref
    ), filtered AS MATERIALIZED (
      SELECT activity.*,
        COALESCE(actor.linked_actor_count, 0)::integer AS linked_actor_count,
        CASE
          WHEN actor.linked_actor_count = 1 AND cardinality(actor.consent_channels) > 0
          THEN actor.sole_actor_ref
          ELSE NULL
        END AS actor_ref,
        CASE
          WHEN actor.linked_actor_count = 1 THEN actor.consent_channels
          ELSE ARRAY[]::text[]
        END AS consent_channels
      FROM base_activity activity
      LEFT JOIN actor_consent actor ON actor.activity_id = activity.activity_id
      WHERE (${domain} = '' OR activity.domain = ${domain})
        AND (${stage} = '' OR activity.stage = ${stage})
        AND (${dataMode} = '' OR activity.data_mode = ${dataMode})
    )
    SELECT filtered.*, count(*) OVER()::integer AS total_count
    FROM filtered
    ORDER BY filtered.occurred_at DESC, filtered.activity_id DESC
    LIMIT ${limit + 1}
  `;

  const total = Math.max(0, Number(rows[0]?.total_count || 0));
  const items = rows.slice(0, limit)
    .map((row) => normalizeTenantEngagementRow(row))
    .filter((item): item is TenantEngagementItem => item !== null);
  return {
    total,
    truncated: total > items.length,
    items,
    taxonomy: {
      version: POST_TAP_ENGAGEMENT_TAXONOMY_VERSION,
      domains: [...POST_TAP_ENGAGEMENT_DOMAINS],
      stages: [...POST_TAP_ENGAGEMENT_STAGES],
      confirmedMeaning: "The source system durably confirmed the activity record; it does not imply warranty approval, support resolution, physical authenticity, custody, or marketing consent.",
    },
  };
}

export function summarizeTenantEngagement(items: TenantEngagementItem[]) {
  const byDomain = Object.fromEntries(POST_TAP_ENGAGEMENT_DOMAINS.map((domain) => [domain, 0])) as Record<PostTapEngagementDomain, number>;
  const byStage = Object.fromEntries(POST_TAP_ENGAGEMENT_STAGES.map((stage) => [stage, 0])) as Record<PostTapEngagementStage, number>;
  let contactable = 0;
  let real = 0;
  let demo = 0;
  for (const item of items) {
    byDomain[item.domain] += 1;
    byStage[item.stage] += 1;
    if (item.actor.contactable) contactable += 1;
    if (item.dataMode === "real") real += 1;
    if (item.dataMode === "demo") demo += 1;
  }
  return {
    scope: "returned_items" as const,
    returned: items.length,
    byDomain,
    byStage,
    contactable,
    real,
    demo,
  };
}
