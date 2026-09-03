import { createHash } from "node:crypto";
import type { SqlExecutor } from "./db";
import { maskConsumerEmail } from "./consumer-network-metrics";

export const CAMPAIGN_AUDIENCE_CHANNELS = ["email", "whatsapp", "phone"] as const;
export const CAMPAIGN_AUDIENCE_PURPOSES = ["marketing"] as const;

export type CampaignAudienceChannel = (typeof CAMPAIGN_AUDIENCE_CHANNELS)[number];
export type CampaignAudiencePurpose = (typeof CAMPAIGN_AUDIENCE_PURPOSES)[number];

const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/;
const REQUIRED_SCOPE: Record<CampaignAudienceChannel, Record<CampaignAudiencePurpose, string>> = {
  email: { marketing: "email_marketing" },
  whatsapp: { marketing: "whatsapp_marketing" },
  phone: { marketing: "phone_marketing" },
};

type AudienceErrorStatus = 400 | 404 | 503;

export class CampaignAudienceError extends Error {
  readonly status: AudienceErrorStatus;

  constructor(code: string, status: AudienceErrorStatus) {
    super(code);
    this.name = "CampaignAudienceError";
    this.status = status;
  }
}
function text(value: unknown) {
  return String(value ?? "").trim();
}

function validTimestamp(value: unknown, now: Date) {
  const raw = text(value);
  if (!raw) return false;
  const timestamp = new Date(raw);
  return !Number.isNaN(timestamp.getTime()) && timestamp.getTime() <= now.getTime();
}

export function normalizeCampaignAudienceChannel(value: unknown): CampaignAudienceChannel | null {
  const normalized = text(value).toLowerCase();
  return CAMPAIGN_AUDIENCE_CHANNELS.includes(normalized as CampaignAudienceChannel)
    ? normalized as CampaignAudienceChannel
    : null;
}

export function normalizeCampaignAudiencePurpose(value: unknown): CampaignAudiencePurpose | null {
  const normalized = text(value).toLowerCase();
  return CAMPAIGN_AUDIENCE_PURPOSES.includes(normalized as CampaignAudiencePurpose)
    ? normalized as CampaignAudiencePurpose
    : null;
}

export function requiredCampaignConsentScope(channel: CampaignAudienceChannel, purpose: CampaignAudiencePurpose) {
  return REQUIRED_SCOPE[channel][purpose];
}

export function maskConsumerPhone(value: unknown) {
  const digits = text(value).replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.length < 7) return "***";
  return `+${digits.slice(0, 3)}***${digits.slice(-4)}`;
}

function actorReference(tenantId: string, consumerId: string) {
  return `actor-${createHash("sha256")
    .update(`nexid:campaign-audience:v1\u0000${tenantId}\u0000${consumerId}`, "utf8")
    .digest("hex")
    .slice(0, 20)}`;
}

type Candidate = {
  tenant_id?: unknown;
  consumer_id?: unknown;
  membership_status?: unknown;
  consent_scope?: unknown;
  consent_granted?: unknown;
  granted_at?: unknown;
  revoked_at?: unknown;
  contact_value?: unknown;
  last_activity_at?: unknown;
};

export function campaignAudienceCandidateIsEligible(input: {
  candidate: Candidate;
  tenantId: string;
  requiredScope: string;
  now?: Date;
}) {
  const { candidate } = input;
  const now = input.now || new Date();
  return text(candidate.tenant_id) === input.tenantId
    && text(candidate.consumer_id).length > 0
    && text(candidate.membership_status).toLowerCase() === "active"
    && text(candidate.consent_scope).toLowerCase() === input.requiredScope
    && candidate.consent_granted === true
    && validTimestamp(candidate.granted_at, now)
    && !text(candidate.revoked_at)
    && text(candidate.contact_value).length > 0;
}

export type CampaignAudienceMember = {
  actorRef: string;
  contactMasked: string;
  consentedAt: string;
  lastActivityAt: string | null;
};

export type CampaignAudienceResult = {
  tenant: string;
  channel: CampaignAudienceChannel;
  purpose: CampaignAudiencePurpose;
  requiredScope: string;
  count: number;
  items: CampaignAudienceMember[];
  truncated: boolean;
};

export async function resolveCampaignAudience(input: {
  tenantSlug: string;
  channel: CampaignAudienceChannel;
  purpose: CampaignAudiencePurpose;
  limit?: number;
  now?: Date;
}, query: SqlExecutor): Promise<CampaignAudienceResult> {
  const tenantSlug = text(input.tenantSlug).toLowerCase();
  if (!tenantSlug) throw new CampaignAudienceError("campaign_audience_tenant_required", 400);
  if (!TENANT_SLUG_PATTERN.test(tenantSlug)) {
    throw new CampaignAudienceError("campaign_audience_tenant_invalid", 400);
  }
  const channel = normalizeCampaignAudienceChannel(input.channel);
  if (!channel) throw new CampaignAudienceError("campaign_audience_channel_invalid", 400);
  const purpose = normalizeCampaignAudiencePurpose(input.purpose);
  if (!purpose) throw new CampaignAudienceError("campaign_audience_purpose_invalid", 400);
  const requiredScope = requiredCampaignConsentScope(channel, purpose);
  const requestedLimit = Number(input.limit ?? 100);
  const limit = Number.isInteger(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 100;

  const rows = await query/*sql*/`
    WITH selected_tenant AS (
      SELECT id, lower(slug) AS slug
      FROM tenants
      WHERE lower(slug) = ${tenantSlug}
      LIMIT 1
    ), eligible AS (
      SELECT
        tenant.id::text AS tenant_id,
        consumer.id::text AS consumer_id,
        membership.status::text AS membership_status,
        lower(consent.scope) AS consent_scope,
        consent.granted AS consent_granted,
        consent.granted_at,
        consent.revoked_at,
        CASE
          WHEN ${channel} = 'email' THEN consumer.email
          ELSE consumer.phone
        END AS contact_value,
        membership.last_activity_at
      FROM selected_tenant tenant
      JOIN tenant_consumer_memberships membership
        ON membership.tenant_id = tenant.id
       AND membership.status = 'active'
      JOIN consumers consumer ON consumer.id = membership.consumer_id
      JOIN consumer_tenant_consents consent
        ON consent.tenant_id = tenant.id
       AND consent.consumer_id = consumer.id
       AND lower(consent.scope) = ${requiredScope}
       AND consent.granted = true
       AND consent.granted_at IS NOT NULL
       AND consent.granted_at <= now()
       AND consent.revoked_at IS NULL
      WHERE (
        (${channel} = 'email' AND NULLIF(BTRIM(consumer.email), '') IS NOT NULL)
        OR (${channel} IN ('whatsapp', 'phone') AND NULLIF(BTRIM(consumer.phone), '') IS NOT NULL)
      )
    )
    SELECT
      tenant.id::text AS tenant_id,
      tenant.slug AS tenant_slug,
      (SELECT COUNT(*)::int FROM eligible) AS audience_count,
      COALESCE((
        SELECT json_agg(row_to_json(sample))
        FROM (
          SELECT *
          FROM eligible
          ORDER BY last_activity_at DESC NULLS LAST, consumer_id ASC
          LIMIT ${limit}
        ) sample
      ), '[]'::json) AS members
    FROM selected_tenant tenant
  `;

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new CampaignAudienceError("campaign_audience_tenant_not_found", 404);
  const tenantId = text(row.tenant_id);
  const candidates = Array.isArray(row.members) ? row.members as Candidate[] : [];
  const now = input.now || new Date();
  if (candidates.some((candidate) => !campaignAudienceCandidateIsEligible({ candidate, tenantId, requiredScope, now }))) {
    throw new CampaignAudienceError("campaign_audience_integrity_violation", 503);
  }

  const items = candidates.map((candidate) => {
    const contact = text(candidate.contact_value);
    return {
      actorRef: actorReference(tenantId, text(candidate.consumer_id)),
      contactMasked: channel === "email" ? maskConsumerEmail(contact) : maskConsumerPhone(contact),
      consentedAt: new Date(text(candidate.granted_at)).toISOString(),
      lastActivityAt: text(candidate.last_activity_at) || null,
    };
  });
  const rawCount = Number(row.audience_count || 0);
  if (!Number.isFinite(rawCount)) {
    throw new CampaignAudienceError("campaign_audience_integrity_violation", 503);
  }
  const count = Math.max(0, rawCount);
  return {
    tenant: text(row.tenant_slug),
    channel,
    purpose,
    requiredScope,
    count,
    items,
    truncated: count > items.length,
  };
}
