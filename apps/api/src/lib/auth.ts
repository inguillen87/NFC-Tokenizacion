import { sql } from "./db";
import { resolveSession, type SessionRecord } from "./iam";
import { permissionDenied, permissionMatches } from "./permission-matcher.js";
import { roleMayUseEnterpriseCapability } from "./enterprise-capability-policy";

export type AdminScope = "super_admin" | "tenant_admin" | "tenant_operator" | "reseller" | "readonly_demo";

export type AdminPrincipal = {
  authenticationType: "human_session";
  sessionId: string;
  userId: string;
  email: string;
  label: string;
  role: SessionRecord["role"];
  scope: AdminScope;
  tenantId: string | null;
  tenantSlug: string | null;
  permissions: string[];
  deniedPermissions: string[];
  mfaVerified: boolean;
  expiresAt: string;
  rotatedSessionToken: string | null;
};

export type AdminSessionResolver = (token: string) => Promise<SessionRecord | null>;

const adminPrincipals = new WeakMap<Request, AdminPrincipal>();

function adminSessionResolutionUnavailable() {
  return new Response(JSON.stringify({ ok: false, reason: "admin_session_resolution_unavailable" }), {
    status: 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      "retry-after": "5",
      "x-nexid-auth-outcome": "session-resolver-unavailable",
    },
  });
}

function scopeForSession(session: SessionRecord): AdminScope | null {
  if (session.role === "super-admin") return "super_admin";
  if (session.role === "tenant-admin" || session.role === "tenant-owner") return "tenant_admin";
  if (session.role === "reseller" || session.role === "reseller-admin") return "reseller";
  if ([
    "security-analyst", "operations-manager", "packaging-operator",
    "marketing-manager", "security-operator",
  ].includes(session.role)) return "tenant_operator";
  if (session.role === "api-integration") return null;
  return "readonly_demo";
}

async function resolvePersistedSession(token: string) {
  return resolveSession(sql as any, token);
}

function bearerToken(req: Request) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization") || "");
  return match?.[1] || "";
}

function principalFromSession(session: SessionRecord): AdminPrincipal | null {
  const scope = scopeForSession(session);
  if (!scope) return null;
  const tenantId = session.tenantId ? String(session.tenantId) : null;
  const tenantSlug = session.tenantSlug ? String(session.tenantSlug).trim().toLowerCase() : null;
  if (scope === "super_admin") {
    if (tenantId || tenantSlug) return null;
  } else if (!tenantId || !tenantSlug) {
    return null;
  }
  return {
    authenticationType: "human_session",
    sessionId: session.id,
    userId: session.userId,
    email: session.email,
    label: session.label,
    role: session.role,
    scope,
    tenantId,
    tenantSlug,
    permissions: [...session.permissions],
    // Sessions minted before deny-aware rollout and test/service adapters may
    // not carry this additive field yet. Missing means no explicit deny; live
    // database resolution always populates the current persisted deny set.
    deniedPermissions: [...(session.deniedPermissions || [])],
    mfaVerified: session.mfaVerified,
    expiresAt: session.expiresAt,
    rotatedSessionToken: session.rotatedCookieValue,
  };
}

/**
 * Authenticates a human admin from the opaque, revocable database session.
 * Caller-supplied scope, tenant, permission and actor headers are deliberately
 * ignored: those attributes are resolved from the current user and membership.
 */
export async function checkAdmin(
  req: Request,
  requiredScopes: AdminScope[] = ["super_admin", "tenant_admin"],
  sessionResolver: AdminSessionResolver = resolvePersistedSession,
): Promise<Response | null> {
  const token = bearerToken(req);
  if (!token || token.startsWith("demo.") || token.startsWith("local.")) {
    return new Response("Unauthorized", { status: 401 });
  }

  let session: SessionRecord | null;
  try {
    session = await sessionResolver(token);
  } catch {
    return adminSessionResolutionUnavailable();
  }
  if (!session) return new Response("Unauthorized", { status: 401 });

  const principal = principalFromSession(session);
  if (!principal) return new Response("Forbidden", { status: 403 });
  adminPrincipals.set(req, principal);

  if (!requiredScopes.includes(principal.scope)) {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}

export function getAdminPrincipal(req: Request): AdminPrincipal {
  const principal = adminPrincipals.get(req);
  if (!principal) throw new Error("authenticated_admin_principal_required");
  return principal;
}

export function getAdminTenantScope(req: Request) {
  const principal = getAdminPrincipal(req);
  const forcedTenantSlug = principal.scope === "tenant_admin" || principal.scope === "tenant_operator" || principal.scope === "reseller"
    ? principal.tenantSlug || ""
    : "";
  return {
    scope: principal.scope,
    tenantSlug: principal.tenantSlug || "",
    forcedTenantSlug,
  };
}

export function getAdminTenantAccess(req: Request, requestedTenantSlug?: string | null) {
  const scope = getAdminTenantScope(req);
  const requestedTenant = String(requestedTenantSlug || "").trim().toLowerCase();
  return {
    ...scope,
    tenantBound: Boolean(scope.forcedTenantSlug),
    requestedTenantSlug: requestedTenant,
    effectiveTenantSlug: scope.forcedTenantSlug || requestedTenant,
  };
}

export function getAdminPermissions(req: Request) {
  return [...getAdminPrincipal(req).permissions];
}

export function getAdminActor(req: Request) {
  const principal = getAdminPrincipal(req);
  return {
    id: principal.userId,
    email: principal.email,
    label: principal.label,
    sessionId: principal.sessionId,
  };
}

export function checkAdminPermission(req: Request, requiredPermission: string): Response | null {
  let principal: AdminPrincipal;
  try {
    principal = getAdminPrincipal(req);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!roleMayUseEnterpriseCapability(principal.role, requiredPermission)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (principal.scope === "super_admin") {
    return permissionDenied(principal.deniedPermissions, requiredPermission)
      ? new Response("Forbidden", { status: 403 })
      : null;
  }
  if (permissionMatches(principal.permissions, requiredPermission, principal.deniedPermissions)) return null;
  return new Response("Forbidden", { status: 403 });
}

/**
 * Authenticates every human enterprise operator but authorizes specialized
 * roles only through an explicit permission. Existing role-only routes keep
 * their fail-closed owner/admin scope gate and therefore cannot accidentally
 * give a legacy zero-capability reseller access to tenant or physical truth.
 */
export async function checkAdminWithPermission(
  req: Request,
  requiredPermission: string,
  sessionResolver: AdminSessionResolver = resolvePersistedSession,
): Promise<Response | null> {
  const auth = await checkAdmin(
    req,
    ["super_admin", "tenant_admin", "tenant_operator", "reseller"],
    sessionResolver,
  );
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
  if (!roleMayUseEnterpriseCapability(principal.role, requiredPermission)) {
    return new Response("Forbidden", { status: 403 });
  }
  return checkAdminPermission(req, requiredPermission);
}
