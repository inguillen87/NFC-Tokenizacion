import { checkAdminPermission } from "../../../../lib/auth";

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

export type SdkApiKeyScopeResult =
  | { ok: true; scopes: SdkApiKeyScope[] }
  | { ok: false; reason: "scopes_required" | "invalid_scopes"; invalidScopes: string[] };

const ALLOWED_SCOPE_SET = new Set<string>(SDK_API_KEY_SCOPES);

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

export function checkSdkApiKeyPermission(req: Request, permission: SdkApiKeyPermission): Response | null {
  const sdkPermission = checkAdminPermission(req, `sdk:keys:${permission}`);
  if (!sdkPermission) return null;

  // tenant:read/write is the existing tenant-admin equivalent for tenant-owned keys.
  return checkAdminPermission(req, `tenant:${permission}`);
}
