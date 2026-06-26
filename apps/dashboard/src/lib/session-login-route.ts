import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_SNAPSHOT_COOKIE } from "./session";
import { getAccessProfiles } from "./access-profiles";
import { dashboardOneClickAccessAllowed } from "./dashboard-access-flags";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
const AUTH_UPSTREAM_TIMEOUT_MS = Number(process.env.AUTH_UPSTREAM_TIMEOUT_MS || 8000);

function safeParseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function encodeDemoToken(email: string, role: string) {
  const payload = Buffer.from(JSON.stringify({ email, role, demo: true }), "utf8").toString("base64url");
  return `demo.${payload}`;
}

function findAccessProfile(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return getAccessProfiles().find((profile) => profile.email.trim().toLowerCase() === normalizedEmail && profile.password === password);
}

function useSecureCookie(req: Request) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.toLowerCase() === "https";
  return process.env.NODE_ENV === "production";
}

function demoTenantScope(role: string) {
  return role === "tenant-admin"
    ? { tenantId: "demo-tenant-demobodega", tenantSlug: "demobodega" }
    : { tenantId: null, tenantSlug: null };
}

function demoAccountForRole(role: string) {
  const profile = getAccessProfiles().find((item) => item.role === role);
  if (profile) {
    return {
      email: profile.email,
      label: profile.label,
      permissions: profile.permissions,
    };
  }
  if (role === "super-admin") {
    return { email: "guillen.marce@gmail.com", label: "Super Admin", permissions: ["*"] };
  }
  if (role === "tenant-admin") {
    return { email: "demobodega@nexid.lat", label: "Owner Bodega Balmec", permissions: ["tenant:*", "batches:*", "tags:*", "events:*", "analytics:*", "crm:*", "marketplace:*", "rewards:*", "employees:*"] };
  }
  return { email: "demobodega@nexid.lat", label: "Owner Bodega Balmec", permissions: ["tenant:*", "batches:*", "tags:*", "events:*", "analytics:*", "crm:*", "marketplace:*", "rewards:*", "employees:*"] };
}

function buildSnapshot(
  email: string,
  role: string,
  label?: string,
  permissions?: string[],
  scope?: { tenantId?: string | null; tenantSlug?: string | null },
) {
  return Buffer.from(
    JSON.stringify({
      id: `${role}-${email}`,
      email,
      role,
      tenantId: scope?.tenantId ?? null,
      tenantSlug: scope?.tenantSlug ?? null,
      label: label || `${role} session`,
      permissions: permissions || ["*"],
      mfaVerified: true,
      setupCompleted: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 12 * 1000).toISOString(),
    }),
    "utf8",
  ).toString("base64url");
}

type LoginDiagnostics = {
  upstreamReachable: boolean;
  upstreamStatus: number | null;
  apiBaseConfigured: boolean;
  demoLoginAllowed: boolean;
  presetProfilesAvailable: boolean;
  missingEnvNames: string[];
};

function buildDiagnostics(input: {
  upstreamReachable: boolean;
  upstreamStatus: number | null;
  demoLoginAllowed: boolean;
}): LoginDiagnostics {
  const apiBaseConfigured = Boolean(
    String(process.env.NEXT_PUBLIC_API_URL || "").trim() || String(process.env.NEXT_PUBLIC_API_BASE_URL || "").trim(),
  );
  const presetProfilesAvailable = getAccessProfiles().some((profile) => profile.available);
  const missingEnvNames: string[] = [];
  if (!apiBaseConfigured) {
    missingEnvNames.push("NEXT_PUBLIC_API_URL | NEXT_PUBLIC_API_BASE_URL");
  }
  if (!presetProfilesAvailable) {
    missingEnvNames.push(
      "SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD, TENANT_ADMIN_EMAIL/TENANT_ADMIN_PASSWORD, TENANT_OPS_EMAIL/TENANT_OPS_PASSWORD o TENANT_GROWTH_EMAIL/TENANT_GROWTH_PASSWORD",
    );
  }

  return {
    upstreamReachable: input.upstreamReachable,
    upstreamStatus: input.upstreamStatus,
    apiBaseConfigured,
    demoLoginAllowed: input.demoLoginAllowed,
    presetProfilesAvailable,
    missingEnvNames,
  };
}

export async function handleSessionLogin(req: Request) {
  const body = await req.text();
  const parsed = safeParseJson(body);
  const submitted = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const submittedEmail = String(submitted["email"] || "").trim();
  const submittedPassword = String(submitted["password"] || "");
  const wantsDemoLogin = submitted["demoLogin"] === true;
  const requestedDemoRole = String(submitted["demoRole"] || "tenant-admin").trim().toLowerCase();
  const demoRole = requestedDemoRole === "super-admin" || requestedDemoRole === "tenant-admin" ? requestedDemoRole : "tenant-admin";
  const canUseDemoLogin = dashboardOneClickAccessAllowed();

  if (wantsDemoLogin) {
    if (!canUseDemoLogin) {
      console.info("[dashboard_login_audit]", JSON.stringify({ event: "operational_login_denied", reason: "disabled", email: submittedEmail || null }));
      return NextResponse.json(
        {
          ok: false,
          reason: "one-click access disabled in this environment",
          diagnostics: buildDiagnostics({ upstreamReachable: false, upstreamStatus: null, demoLoginAllowed: canUseDemoLogin }),
        },
        { status: 403 },
      );
    }
    const demoAccount = demoAccountForRole(demoRole);
    const demoScope = demoTenantScope(demoRole);
    const response = NextResponse.json({
      ok: true,
      email: demoAccount.email,
      role: demoRole,
      ...demoScope,
      label: demoAccount.label,
      permissions: demoAccount.permissions,
      mfaRequired: false,
    });
    response.cookies.set(DASHBOARD_SESSION_COOKIE, encodeDemoToken(demoAccount.email, demoRole), {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookie(req),
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, buildSnapshot(demoAccount.email, demoRole, demoAccount.label, demoAccount.permissions, demoScope), {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookie(req),
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    console.info("[dashboard_login_audit]", JSON.stringify({ event: "operational_login_ok", email: demoAccount.email, role: demoRole }));
    return response;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_UPSTREAM_TIMEOUT_MS);
  const upstream = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": req.headers.get("user-agent") || "dashboard" },
    body,
    cache: "no-store",
    signal: controller.signal,
  }).catch(() => null);
  clearTimeout(timeout);

  const accessProfile = findAccessProfile(submittedEmail, submittedPassword);
  const unreachableDiagnostics = buildDiagnostics({ upstreamReachable: false, upstreamStatus: null, demoLoginAllowed: canUseDemoLogin });
  if (!upstream) {
    if (accessProfile) {
      const demoScope = demoTenantScope(accessProfile.role);
      const response = NextResponse.json({
        ok: true,
        email: accessProfile.email,
        role: accessProfile.role,
        ...demoScope,
        label: accessProfile.label,
        permissions: accessProfile.permissions,
        mfaRequired: false,
      });
      response.cookies.set(DASHBOARD_SESSION_COOKIE, encodeDemoToken(accessProfile.email, accessProfile.role), {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookie(req),
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, buildSnapshot(accessProfile.email, accessProfile.role, accessProfile.label, accessProfile.permissions, demoScope), {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookie(req),
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      console.info("[dashboard_login_audit]", JSON.stringify({ event: "profile_login_ok", email: accessProfile.email, role: accessProfile.role }));
      return response;
    }
    return NextResponse.json({ ok: false, reason: "auth upstream unavailable", diagnostics: unreachableDiagnostics }, { status: 502 });
  }

  const text = await upstream.text();
  const data = safeParseJson(text);
  const upstreamStatus = Number.isFinite(upstream.status) ? upstream.status : null;
  const baseDiagnostics = buildDiagnostics({ upstreamReachable: true, upstreamStatus, demoLoginAllowed: canUseDemoLogin });
  if (!upstream.ok || !data?.ok || !data?.sessionToken) {
    if (accessProfile) {
      const demoScope = demoTenantScope(accessProfile.role);
      const response = NextResponse.json({
        ok: true,
        email: accessProfile.email,
        role: accessProfile.role,
        ...demoScope,
        label: accessProfile.label,
        permissions: accessProfile.permissions,
        mfaRequired: false,
      });
      response.cookies.set(DASHBOARD_SESSION_COOKIE, encodeDemoToken(accessProfile.email, accessProfile.role), {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookie(req),
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, buildSnapshot(accessProfile.email, accessProfile.role, accessProfile.label, accessProfile.permissions, demoScope), {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookie(req),
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      console.info("[dashboard_login_audit]", JSON.stringify({ event: "profile_login_ok", email: accessProfile.email, role: accessProfile.role }));
      return response;
    }
    const normalizedStatus = upstream.status === 401 ? 401 : upstream.status === 403 ? 403 : upstream.status >= 500 ? 502 : 500;
    const fallbackReason = normalizedStatus === 401
      ? "invalid credentials"
      : normalizedStatus === 403
      ? "temporary access disabled or missing scope"
      : normalizedStatus === 502
      ? "auth upstream unavailable"
      : "internal login error";
    const payload = data && typeof data === "object"
      ? { ...(data as Record<string, unknown>), diagnostics: baseDiagnostics }
      : { ok: false, reason: fallbackReason, diagnostics: baseDiagnostics };
    console.info("[dashboard_login_audit]", JSON.stringify({ event: "upstream_login_fail", status: normalizedStatus, email: submittedEmail || null }));
    return NextResponse.json(payload, { status: normalizedStatus });
  }

  const response = NextResponse.json({ ok: true, email: data.email, role: data.role, label: data.label, permissions: data.permissions, mfaRequired: false });
  response.cookies.set(DASHBOARD_SESSION_COOKIE, data.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(req),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, buildSnapshot(String(data.email || submittedEmail || ""), String(data.role || "viewer"), String(data.label || ""), Array.isArray(data.permissions) ? data.permissions : ["*"], { tenantId: data.tenantId || null, tenantSlug: data.tenantSlug || null }), {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(req),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  console.info("[dashboard_login_audit]", JSON.stringify({ event: "upstream_login_ok", email: String(data.email || submittedEmail || ""), role: String(data.role || "viewer") }));
  return response;
}
