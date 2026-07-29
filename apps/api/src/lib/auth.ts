import { sql } from "./db";
import { resolveSession, type SessionRecord } from "./iam";
import { permissionMatches } from "./permission-matcher.js";

export type AdminScope = "super_admin" | "tenant_admin" | "reseller" | "readonly_demo";

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
  mfaVerified: boolean;
  expiresAt: string;
  rotatedSessionToken: string | null;
};

export type AdminSessionResolver = (token: string) => Promise<SessionRecord | null>;

const adminPrincipals = new WeakMap<Request, AdminPrincipal>();

function scopeForSession(session: SessionRecord): AdminScope {
  if (session.role === "super-admin") return "super_admin";
  if (session.role === "tenant-admin") return "tenant_admin";
  if (session.role === "reseller") return "reseller";
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
  const tenantId = session.tenantId ? String(session.tenantId) : null;
  const tenantSlug = session.tenantSlug ? String(session.tenantSlug).trim().toLowerCase() : null;
  if ((scope === "tenant_admin" || scope === "reseller") && (!tenantId || !tenantSlug)) return null;
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
  requiredScopes: AdminScope[] = ["super_admin", "tenant_admin", "reseller"],
  sessionResolver: AdminSessionResolver = resolvePersistedSession,
): Promise<Response | null> {
  const token = bearerToken(req);
  if (!token || token.startsWith("demo.") || token.startsWith("local.")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const session = await sessionResolver(token).catch(() => null);
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
  const forcedTenantSlug = principal.scope === "tenant_admin" || principal.scope === "reseller"
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
  if (principal.scope === "super_admin") return null;
  if (permissionMatches(principal.permissions, requiredPermission)) return null;
  return new Response("Forbidden", { status: 403 });
}
