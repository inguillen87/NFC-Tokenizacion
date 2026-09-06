import { createHash } from "node:crypto";
import type { AdminPrincipal } from "./auth";
import type { SqlExecutor } from "./db";

export type CampaignDraftChannel = "whatsapp" | "email" | "phone";
export type CampaignDraftStatus = "draft" | "archived";
export type CampaignDraftContent = {
  title: string;
  message: string;
  channel: CampaignDraftChannel;
  purpose: "marketing";
};
export type CampaignDraft = CampaignDraftContent & {
  id: string;
  tenant: string;
  status: CampaignDraftStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; label: string };
  updatedBy: { id: string; label: string };
};
export type CampaignDraftPatch = Partial<CampaignDraftContent> & {
  expectedRevision: number;
  status?: CampaignDraftStatus;
};
export type CampaignDraftTenant = { id: string; slug: string };
export type CampaignDraftActor = { id: string; label: string };
export type CampaignDraftAudit = { ip: string | null; userAgent: string | null; traceId: string | null };

export class CampaignDraftError extends Error {
  constructor(message: string, public status = 400, public currentRevision?: number) {
    super(message);
    this.name = "CampaignDraftError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTENT_FIELDS = ["title", "message", "channel", "purpose"];
const has = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function invalid(field: string): never {
  throw new CampaignDraftError(`campaign_draft_${field}_invalid`);
}

function record(input: unknown, fields: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid("body");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !fields.includes(key))) return invalid("fields");
  return value;
}

function plainText(value: unknown, field: string, maximum: number, multiline = false): string {
  if (typeof value !== "string") return invalid(field);
  const normalized = value.trim();
  const controls = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (!normalized || normalized.length > maximum || controls.test(value)) return invalid(field);
  // Content is plain text; it is never interpreted as HTML or template code.
  return normalized;
}

function channel(value: unknown): CampaignDraftChannel {
  if (value !== "whatsapp" && value !== "email" && value !== "phone") return invalid("channel");
  return value;
}

function purpose(value: unknown): "marketing" {
  if (value !== "marketing") return invalid("purpose");
  return value;
}

function status(value: unknown): CampaignDraftStatus {
  if (value !== "draft" && value !== "archived") return invalid("status");
  return value;
}

export function parseCampaignDraftCreate(input: unknown): CampaignDraftContent {
  const value = record(input, CONTENT_FIELDS);
  return {
    title: plainText(value.title, "title", 160),
    message: plainText(value.message, "message", 6000, true),
    channel: channel(value.channel),
    purpose: purpose(value.purpose),
  };
}

export function parseCampaignDraftPatch(input: unknown): CampaignDraftPatch {
  const value = record(input, [...CONTENT_FIELDS, "status", "expectedRevision"]);
  if (!has(value, "expectedRevision")) throw new CampaignDraftError("campaign_draft_expected_revision_required");
  if (!Number.isSafeInteger(value.expectedRevision) || Number(value.expectedRevision) < 1 || Number(value.expectedRevision) > 2147483647) return invalid("expected_revision");
  if (!Object.keys(value).some((key) => key !== "expectedRevision")) return invalid("patch");
  return {
    expectedRevision: Number(value.expectedRevision),
    ...(has(value, "title") ? { title: plainText(value.title, "title", 160) } : {}),
    ...(has(value, "message") ? { message: plainText(value.message, "message", 6000, true) } : {}),
    ...(has(value, "channel") ? { channel: channel(value.channel) } : {}),
    ...(has(value, "purpose") ? { purpose: purpose(value.purpose) } : {}),
    ...(has(value, "status") ? { status: status(value.status) } : {}),
  };
}

export function parseCampaignDraftId(input: string): string {
  if (!UUID.test(input)) return invalid("id");
  return input.toLowerCase();
}

export function parseCampaignDraftIdempotencyKey(input: string | null): string {
  if (!input) throw new CampaignDraftError("campaign_draft_idempotency_key_required");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(input)) return invalid("idempotency_key");
  return input;
}

export function parseCampaignDraftList(input: URLSearchParams) {
  const requestedStatus = input.get("status") ?? "draft";
  if (requestedStatus !== "all" && requestedStatus !== "draft" && requestedStatus !== "archived") return invalid("status");
  const rawLimit = input.get("limit");
  if (rawLimit !== null && !/^[1-9][0-9]{0,2}$/.test(rawLimit)) return invalid("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (limit > 100) return invalid("limit");
  return { status: requestedStatus, limit } as const;
}

export async function resolveCampaignDraftTenant(
  requested: string | null,
  principal: AdminPrincipal,
  query: SqlExecutor,
): Promise<CampaignDraftTenant> {
  if (!requested?.trim()) throw new CampaignDraftError("campaign_draft_tenant_required");
  const slug = requested.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,119}$/.test(slug)) return invalid("tenant");
  if (principal.scope !== "super_admin" && (
    slug !== principal.tenantSlug?.toLowerCase() || !principal.tenantId || !UUID.test(principal.tenantId)
  )) throw new CampaignDraftError("campaign_draft_tenant_mismatch", 403);
  const [tenant] = await query`SELECT id, slug FROM public.tenants WHERE lower(slug) = ${slug} LIMIT 1`;
  if (!tenant) throw new CampaignDraftError("campaign_draft_tenant_not_found", 404);
  if (typeof tenant.id !== "string" || !UUID.test(tenant.id) || typeof tenant.slug !== "string" || tenant.slug.toLowerCase() !== slug) {
    throw new CampaignDraftError("campaign_drafts_unavailable", 503);
  }
  if (principal.scope !== "super_admin" && tenant.id.toLowerCase() !== principal.tenantId?.toLowerCase()) {
    throw new CampaignDraftError("campaign_draft_tenant_mismatch", 403);
  }
  return { id: tenant.id, slug: tenant.slug };
}

export function campaignDraftActor(principal: AdminPrincipal): CampaignDraftActor {
  if (!UUID.test(principal.userId)) throw new CampaignDraftError("campaign_drafts_unavailable", 503);
  const label = principal.label?.trim().slice(0, 160);
  if (!label) throw new CampaignDraftError("campaign_drafts_unavailable", 503);
  return { id: principal.userId, label };
}

function timestamp(value: unknown): string {
  if (!(value instanceof Date) && typeof value !== "string") throw new Error("campaign_draft_timestamp_invalid");
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("campaign_draft_timestamp_invalid");
  return date.toISOString();
}

function fromRow(row: Record<string, unknown>, tenant: CampaignDraftTenant): CampaignDraft {
  if (row.tenant_id !== tenant.id || typeof row.id !== "string" || !UUID.test(row.id)
    || typeof row.created_by !== "string" || !UUID.test(row.created_by)
    || typeof row.updated_by !== "string" || !UUID.test(row.updated_by)
    || !Number.isInteger(row.revision) || Number(row.revision) < 1) throw new Error("campaign_draft_record_invalid");
  try {
    return {
      id: row.id,
      tenant: tenant.slug,
      ...parseCampaignDraftCreate({ title: row.title, message: row.message, channel: row.channel, purpose: row.purpose }),
      status: status(row.status),
      revision: Number(row.revision),
      createdAt: timestamp(row.created_at),
      updatedAt: timestamp(row.updated_at),
      createdBy: { id: row.created_by, label: plainText(row.created_by_label, "actor", 160) },
      updatedBy: { id: row.updated_by, label: plainText(row.updated_by_label, "actor", 160) },
    };
  } catch {
    throw new Error("campaign_draft_record_invalid");
  }
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function state(draft: CampaignDraftContent & { status: CampaignDraftStatus; revision: number }) {
  return { title: draft.title, message: draft.message, channel: draft.channel, purpose: draft.purpose, status: draft.status, revision: draft.revision };
}

export async function listCampaignDrafts(tenant: CampaignDraftTenant, options: ReturnType<typeof parseCampaignDraftList>, query: SqlExecutor) {
  const rows = await query`
    SELECT * FROM public.campaign_drafts
    WHERE tenant_id = ${tenant.id}::uuid AND (${options.status} = 'all' OR status = ${options.status})
    ORDER BY updated_at DESC, id DESC LIMIT ${options.limit + 1}
  `;
  const items = rows.slice(0, options.limit).map((row) => fromRow(row, tenant));
  return { items, count: items.length, truncated: rows.length > options.limit };
}

export async function getCampaignDraft(tenant: CampaignDraftTenant, id: string, query: SqlExecutor): Promise<CampaignDraft> {
  const [row] = await query`SELECT * FROM public.campaign_drafts WHERE tenant_id = ${tenant.id}::uuid AND id = ${id}::uuid LIMIT 1`;
  if (!row) throw new CampaignDraftError("campaign_draft_not_found", 404);
  return fromRow(row, tenant);
}

export async function createCampaignDraft(
  tenant: CampaignDraftTenant, actor: CampaignDraftActor, content: CampaignDraftContent,
  key: string, audit: CampaignDraftAudit, query: SqlExecutor,
) {
  // Keep the initial request fingerprint immutable when the draft is edited.
  const fingerprint = hash({
    tenantId: tenant.id, actorId: actor.id,
    title: content.title, message: content.message, channel: content.channel, purpose: content.purpose,
  });
  const afterHash = hash(state({ ...content, status: "draft", revision: 1 }));
  const [created] = await query`
    WITH created AS (
      INSERT INTO public.campaign_drafts (
        tenant_id, title, message, channel, purpose, created_by, updated_by,
        created_by_label, updated_by_label, create_idempotency_key, create_fingerprint
      ) VALUES (
        ${tenant.id}::uuid, ${content.title}, ${content.message}, ${content.channel}, ${content.purpose},
        ${actor.id}::uuid, ${actor.id}::uuid, ${actor.label}, ${actor.label}, ${key}, ${fingerprint}
      ) ON CONFLICT (tenant_id, create_idempotency_key) DO NOTHING
      RETURNING *
    ), audited AS (
      INSERT INTO public.audit_logs (
        actor_id, tenant_id, action, resource_type, resource_id, before_hash, after_hash, ip_address, user_agent, request_id
      ) SELECT ${actor.id}::uuid, created.tenant_id, 'campaign_draft_created', 'campaign_draft', created.id::text,
        NULL, ${afterHash}, ${audit.ip}, ${audit.userAgent}, ${audit.traceId} FROM created
      RETURNING 1
    ) SELECT created.*, (SELECT count(*) FROM audited)::integer AS audit_count FROM created
  `;
  if (created) return { draft: fromRow(created, tenant), idempotentReplay: false };

  // A separate read gets a fresh snapshot after a concurrent unique-key winner commits.
  const [existing] = await query`
    SELECT * FROM public.campaign_drafts
    WHERE tenant_id = ${tenant.id}::uuid AND create_idempotency_key = ${key} LIMIT 1
  `;
  if (!existing) throw new CampaignDraftError("campaign_drafts_unavailable", 503);
  if (existing.create_fingerprint !== fingerprint) throw new CampaignDraftError("campaign_draft_idempotency_conflict", 409);
  return { draft: fromRow(existing, tenant), idempotentReplay: true };
}

export async function patchCampaignDraft(
  tenant: CampaignDraftTenant, actor: CampaignDraftActor, id: string,
  patch: CampaignDraftPatch, audit: CampaignDraftAudit, query: SqlExecutor,
) {
  const before = await getCampaignDraft(tenant, id, query);
  if (before.revision !== patch.expectedRevision) throw new CampaignDraftError("campaign_draft_revision_conflict", 409, before.revision);
  const after = { ...before, ...patch, revision: before.revision + 1 };
  const action = before.status === after.status ? "campaign_draft_updated"
    : after.status === "archived" ? "campaign_draft_archived" : "campaign_draft_restored";
  const [updated] = await query`
    WITH updated AS (
      UPDATE public.campaign_drafts SET
        title = ${after.title}, message = ${after.message}, channel = ${after.channel}, purpose = ${after.purpose},
        status = ${after.status}, revision = revision + 1, updated_at = now(),
        updated_by = ${actor.id}::uuid, updated_by_label = ${actor.label}
      WHERE tenant_id = ${tenant.id}::uuid AND id = ${id}::uuid AND revision = ${patch.expectedRevision}
      RETURNING *
    ), audited AS (
      INSERT INTO public.audit_logs (
        actor_id, tenant_id, action, resource_type, resource_id, before_hash, after_hash, ip_address, user_agent, request_id
      ) SELECT ${actor.id}::uuid, updated.tenant_id, ${action}, 'campaign_draft', updated.id::text,
        ${hash(state(before))}, ${hash(state(after))}, ${audit.ip}, ${audit.userAgent}, ${audit.traceId} FROM updated
      RETURNING 1
    ) SELECT updated.*, (SELECT count(*) FROM audited)::integer AS audit_count FROM updated
  `;
  if (updated) return fromRow(updated, tenant);
  const current = await getCampaignDraft(tenant, id, query);
  throw new CampaignDraftError("campaign_draft_revision_conflict", 409, current.revision);
}
