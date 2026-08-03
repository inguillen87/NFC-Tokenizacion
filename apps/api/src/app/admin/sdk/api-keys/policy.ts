import { isIP } from "node:net";

import { checkAdminPermission, getAdminPrincipal } from "../../../../lib/auth";
import { readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { roleMayUseEnterpriseCapability } from "../../../../lib/enterprise-capability-policy";
import { permissionDenied } from "../../../../lib/permission-matcher.js";
import { getRequestMeta } from "../../../../lib/request-meta";

export const SDK_API_KEY_ADMIN_BODY_MAX_BYTES = 16 * 1024;
export const SDK_API_KEY_ACTIVE_QUOTA_DEFAULT = 20;
export const SDK_API_KEY_ACTIVE_QUOTA_MAX = 1_000;
export const SDK_API_KEY_NAME_MAX_LENGTH = 160;
export const SDK_API_KEY_LIFECYCLE_REQUIRED_MIGRATION =
  "20260802230000_0088_enterprise_event_profile.sql";
export const SDK_API_KEY_NETWORK_RULE_MAX_COUNT = 64;
export const SDK_API_KEY_RATE_LIMIT_PROFILES = ["conservative", "standard", "high_throughput"] as const;

export const SDK_API_KEY_SCOPES = [
  "sdk:verify",
  "sdk:claim",
  "sdk:products",
  "sdk:events",
  "sdk:pos",
  "sdk:logistics",
  "sdk:epcis:read",
  "sdk:epcis:write",
] as const;

export type SdkApiKeyScope = (typeof SDK_API_KEY_SCOPES)[number];
export type SdkApiKeyPermission = "read" | "write";
export type SdkApiKeyRateLimitProfile = (typeof SDK_API_KEY_RATE_LIMIT_PROFILES)[number];

export type SdkApiKeyNetworkPolicyResult =
  | {
      ok: true;
      allowedIpCidrs: string[];
      allowedOrigins: string[];
      rateLimitProfile: SdkApiKeyRateLimitProfile;
    }
  | { ok: false; reason: "sdk_api_key_network_policy_invalid" };

export type SdkApiKeyScopeResult =
  | { ok: true; scopes: SdkApiKeyScope[] }
  | { ok: false; reason: "scopes_required" | "invalid_scopes"; invalidScopes: string[] };

export type SdkApiKeyStatusPatchResult =
  | { ok: true; revokeRequested: boolean }
  | { ok: false; reason: "sdk_api_key_reactivation_forbidden" | "sdk_api_key_status_invalid" };

const ALLOWED_SCOPE_SET = new Set<string>(SDK_API_KEY_SCOPES);
const RATE_PROFILE_SET = new Set<string>(SDK_API_KEY_RATE_LIMIT_PROFILES);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function boundedAuditText(value: unknown, maxLength: number) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

export function sdkApiKeyAuditRequestMeta(req: Request) {
  const meta = getRequestMeta(req);
  return {
    ipAddress: boundedAuditText(meta.ip, 64),
    userAgent: boundedAuditText(meta.userAgent, 512),
    requestId: boundedAuditText(meta.traceId, 160),
  };
}

export function isSdkApiKeyId(value: unknown) {
  return UUID_PATTERN.test(String(value || "").trim());
}

export function normalizeSdkApiKeyName(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > SDK_API_KEY_NAME_MAX_LENGTH) return null;
  return normalized;
}

export function parseSdkApiKeyExpiry(value: unknown, now = Date.now()) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true as const, expiresAt: null };
  }
  if (typeof value !== "string") {
    return { ok: false as const, reason: "sdk_api_key_expiry_invalid" as const };
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= now) {
    return { ok: false as const, reason: "sdk_api_key_expiry_invalid" as const };
  }
  return { ok: true as const, expiresAt: new Date(parsed).toISOString() };
}

export async function readSdkApiKeyAdminBody(req: Request) {
  const parsed = await readBoundedJsonBody<unknown>(req, SDK_API_KEY_ADMIN_BODY_MAX_BYTES);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("invalid_json_body");
  }
  return parsed as Record<string, unknown>;
}

export function resolveSdkApiKeyActiveQuota(
  environment: Record<string, string | undefined> = process.env,
) {
  const raw = environment.SDK_API_KEY_MAX_ACTIVE_PER_TENANT;
  if (raw === undefined || raw.trim() === "") return SDK_API_KEY_ACTIVE_QUOTA_DEFAULT;
  const normalized = raw.trim();
  if (!/^[1-9][0-9]*$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed > SDK_API_KEY_ACTIVE_QUOTA_MAX) return null;
  return parsed;
}

export function parseSdkApiKeyStatusPatch(input: {
  provided: boolean;
  value: unknown;
}): SdkApiKeyStatusPatchResult {
  if (!input.provided) return { ok: true, revokeRequested: false };
  const status = String(input.value || "").trim().toLowerCase();
  if (status === "revoked") return { ok: true, revokeRequested: true };
  if (status === "active") return { ok: false, reason: "sdk_api_key_reactivation_forbidden" };
  return { ok: false, reason: "sdk_api_key_status_invalid" };
}

export function parseSdkApiKeyScopes(value: unknown): SdkApiKeyScopeResult {
  if (value === undefined || value === null) {
    return { ok: false, reason: "scopes_required", invalidScopes: [] };
  }

  if (!Array.isArray(value) && typeof value !== "string") {
    return { ok: false, reason: "invalid_scopes", invalidScopes: [] };
  }

  const rawScopes = Array.isArray(value) ? value : value.split(",");
  if (rawScopes.some((scope) => typeof scope !== "string")) {
    return { ok: false, reason: "invalid_scopes", invalidScopes: [] };
  }

  const normalized = rawScopes
    .map((scope) => String(scope).trim())
    .filter(Boolean);
  if (!normalized.length) {
    return { ok: false, reason: "scopes_required", invalidScopes: [] };
  }

  const invalidScopes = [...new Set(normalized.filter((scope) => !ALLOWED_SCOPE_SET.has(scope)))];
  if (invalidScopes.length) {
    return { ok: false, reason: "invalid_scopes", invalidScopes };
  }

  return {
    ok: true,
    scopes: [...new Set(normalized)] as SdkApiKeyScope[],
  };
}

function stringList(value: unknown): string[] | null {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

function normalizeCidr(value: string) {
  const [address, prefixRaw, ...rest] = value.split("/");
  const family = isIP(address);
  if (!family || rest.length) return null;
  const maximum = family === 4 ? 32 : 128;
  const prefix = prefixRaw === undefined ? maximum : Number(prefixRaw);
  if (!Number.isSafeInteger(prefix) || prefix < 0 || prefix > maximum) return null;
  return `${address.toLowerCase()}/${prefix}`;
}

function normalizeOrigin(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password
      || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    if (!parsed.hostname || parsed.origin.length > 253) return null;
    if (parsed.port && (!/^\d{1,5}$/.test(parsed.port) || Number(parsed.port) > 65535)) return null;
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function parseSdkApiKeyNetworkPolicy(input: {
  allowedIpCidrs?: unknown;
  allowedOrigins?: unknown;
  rateLimitProfile?: unknown;
}): SdkApiKeyNetworkPolicyResult {
  const rawIps = stringList(input.allowedIpCidrs);
  const rawOrigins = stringList(input.allowedOrigins);
  const rateLimitProfile = String(input.rateLimitProfile || "standard").trim().toLowerCase();
  if (!rawIps || !rawOrigins
    || rawIps.length > SDK_API_KEY_NETWORK_RULE_MAX_COUNT
    || rawOrigins.length > SDK_API_KEY_NETWORK_RULE_MAX_COUNT
    || !RATE_PROFILE_SET.has(rateLimitProfile)) {
    return { ok: false, reason: "sdk_api_key_network_policy_invalid" };
  }
  const allowedIpCidrs = rawIps.map(normalizeCidr);
  const allowedOrigins = rawOrigins.map(normalizeOrigin);
  if (allowedIpCidrs.some((value) => value === null) || allowedOrigins.some((value) => value === null)) {
    return { ok: false, reason: "sdk_api_key_network_policy_invalid" };
  }
  return {
    ok: true,
    allowedIpCidrs: [...new Set(allowedIpCidrs as string[])],
    allowedOrigins: [...new Set(allowedOrigins as string[])],
    rateLimitProfile: rateLimitProfile as SdkApiKeyRateLimitProfile,
  };
}

export function checkSdkApiKeyPermission(req: Request, permission: SdkApiKeyPermission): Response | null {
  const principal = getAdminPrincipal(req);
  const canonical = permission === "read" ? "api_keys.read" : "api_keys.manage";
  if (!roleMayUseEnterpriseCapability(principal.role, canonical)) {
    return new Response("Forbidden", { status: 403 });
  }
  const sdkPermission = checkAdminPermission(req, `sdk:keys:${permission}`);
  if (!sdkPermission) return null;
  if (permissionDenied(principal.deniedPermissions, `sdk:keys:${permission}`)) {
    return sdkPermission;
  }

  // tenant:read/write is the existing tenant-admin equivalent for tenant-owned keys.
  return checkAdminPermission(req, `tenant:${permission}`);
}
