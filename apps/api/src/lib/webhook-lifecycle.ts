import { createHash, randomBytes } from "node:crypto";

import type { AdminPrincipal } from "./auth";
import { sql } from "./db";
import { getRequestMeta } from "./request-meta";

export const WEBHOOK_ADMIN_BODY_MAX_BYTES = 32 * 1024;
export const WEBHOOK_NAME_MAX_LENGTH = 160;
export const WEBHOOK_URL_MAX_LENGTH = 2_048;
export const WEBHOOK_EVENTS_MAX_COUNT = 50;
export const WEBHOOK_ENABLED_ENDPOINTS_MAX_COUNT = 25;
export const WEBHOOK_EVENT_NAME_MAX_LENGTH = 120;
export const WEBHOOK_SECRET_OVERLAP_MIN_SECONDS = 5 * 60;
export const WEBHOOK_SECRET_OVERLAP_DEFAULT_SECONDS = 60 * 60;
export const WEBHOOK_SECRET_OVERLAP_MAX_SECONDS = 24 * 60 * 60;

const WEBHOOK_EVENT_PATTERN = /^(?:\*|[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)*)$/;

export type WebhookEventsParseResult =
  | { ok: true; events: string[] }
  | { ok: false; reason: "webhook_events_required" | "webhook_events_invalid" | "webhook_events_too_many" };

export type WebhookTenant = { id: string; slug: string; name: string };

export function generateWebhookSigningSecret() {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function webhookSecretFingerprint(secret: string) {
  const digest = createHash("sha256").update(String(secret || ""), "utf8").digest("hex");
  return `sha256:${digest.slice(0, 32)}`;
}

export function webhookUrlFingerprint(value: string) {
  const digest = createHash("sha256").update(String(value || ""), "utf8").digest("hex");
  return `sha256:${digest.slice(0, 32)}`;
}

export function redactWebhookUrlForDisplay(value: string) {
  try {
    const url = new URL(value);
    // Webhook providers commonly embed credentials in either the first path
    // segment or the query string. Administration only needs the origin plus
    // the stable fingerprint below, so never disclose any non-root path.
    if (url.pathname !== "/") url.pathname = "/[redacted]";
    for (const key of [...new Set(url.searchParams.keys())]) url.searchParams.set(key, "[redacted]");
    return url.toString();
  } catch {
    return "[redacted_invalid_webhook_url]";
  }
}

export function safeWebhookEndpointProjection<T extends Record<string, any>>(row: T): T & { url_fingerprint: string } {
  const url = String(row.url || "");
  return {
    ...row,
    url: redactWebhookUrlForDisplay(url),
    url_fingerprint: webhookUrlFingerprint(url),
  };
}

export function normalizeWebhookSecretOverlapSeconds(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return WEBHOOK_SECRET_OVERLAP_DEFAULT_SECONDS;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return null;
  if (parsed < WEBHOOK_SECRET_OVERLAP_MIN_SECONDS || parsed > WEBHOOK_SECRET_OVERLAP_MAX_SECONDS) return null;
  return parsed;
}

export function normalizeWebhookExpectedSecretVersion(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeWebhookName(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized) return "SDK webhook";
  return normalized.length <= WEBHOOK_NAME_MAX_LENGTH ? normalized : null;
}

export function parseWebhookEvents(value: unknown): WebhookEventsParseResult {
  if (!Array.isArray(value) || !value.length) {
    return { ok: false, reason: "webhook_events_required" };
  }
  if (value.length > WEBHOOK_EVENTS_MAX_COUNT) {
    return { ok: false, reason: "webhook_events_too_many" };
  }
  if (value.some((event) => typeof event !== "string")) {
    return { ok: false, reason: "webhook_events_invalid" };
  }
  const events = [...new Set(value.map((event) => event.trim().toLowerCase()).filter(Boolean))];
  if (!events.length) return { ok: false, reason: "webhook_events_required" };
  if (events.some((event) => event.length > WEBHOOK_EVENT_NAME_MAX_LENGTH || !WEBHOOK_EVENT_PATTERN.test(event))) {
    return { ok: false, reason: "webhook_events_invalid" };
  }
  return { ok: true, events };
}

export function boundedWebhookAuditText(value: unknown, maximumLength: number) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maximumLength);
}

export function webhookLifecycleStatus(input: { enabled?: unknown; deleted_at?: unknown; deletedAt?: unknown }) {
  if (input.deleted_at || input.deletedAt) return "deleted" as const;
  return input.enabled === true ? "active" as const : "disabled" as const;
}

export function isWebhookEndpointId(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export async function resolveWebhookTenant(
  principal: AdminPrincipal,
  requestedTenant: unknown,
): Promise<WebhookTenant | null> {
  const requested = String(requestedTenant || "").trim().toLowerCase();
  if (principal.scope !== "super_admin") {
    if (!principal.tenantId) return null;
    const rows = await sql/*sql*/`
      SELECT id::text AS id, slug, name
      FROM tenants
      WHERE id = ${principal.tenantId}::uuid
      LIMIT 1
    `;
    const tenant = rows[0] as WebhookTenant | undefined;
    if (!tenant) return null;
    if (requested && requested !== tenant.id.toLowerCase() && requested !== tenant.slug.toLowerCase()) return null;
    return tenant;
  }
  if (!requested) return null;
  const rows = await sql/*sql*/`
    SELECT id::text AS id, slug, name
    FROM tenants
    WHERE slug = ${requested} OR id::text = ${requested}
    LIMIT 1
  `;
  return (rows[0] as WebhookTenant | undefined) || null;
}

export function webhookAuditRequestMeta(req: Request) {
  const meta = getRequestMeta(req);
  return {
    ipAddress: boundedWebhookAuditText(meta.ip, 64),
    userAgent: boundedWebhookAuditText(meta.userAgent, 512),
    requestId: boundedWebhookAuditText(meta.traceId, 160),
  };
}

export function webhookDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown_error";
  const code = String((error as { code?: unknown }).code || "");
  return /^[A-Za-z0-9_-]{1,32}$/.test(code) ? code : "unknown_error";
}

export function webhookLifecycleFailure(error: unknown) {
  const code = webhookDatabaseErrorCode(error);
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : "";
  if (/\bwebhook_enabled_endpoint_limit_exceeded\b/.test(message)) {
    return { status: 409, reason: "webhook_enabled_endpoint_limit_exceeded" } as const;
  }
  if (new Set(["42P01", "42703", "42883"]).has(code)) {
    return {
      status: 503,
      reason: "webhook_lifecycle_migration_required",
      requiredMigration: "20260728160000_0064_webhook_lifecycle_governance.sql",
    } as const;
  }
  if (code === "23505") return { status: 409, reason: "webhook_endpoint_conflict" } as const;
  if (code === "23514" || code === "55000") return { status: 409, reason: "webhook_lifecycle_conflict" } as const;
  console.error("[webhook_lifecycle_database_failed]", code);
  return { status: 503, reason: "webhook_lifecycle_unavailable" } as const;
}
