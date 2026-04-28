// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_SNAPSHOT_COOKIE } from "../../../../lib/session";
import { getAccessProfiles } from "../../../../lib/access-profiles";
import { shouldAllowDemoFallback } from "../../../../lib/admin-proxy-policy";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
const AUTH_UPSTREAM_TIMEOUT_MS = Number(process.env.AUTH_UPSTREAM_TIMEOUT_MS || 8000);

function safeParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function encodeDemoToken(email, role) {
  const payload = Buffer.from(JSON.stringify({ email, role, demo: true }), "utf8").toString("base64url");
  return `demo.${payload}`;
}

function findDemoProfile(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  return getAccessProfiles().find((profile) => profile.email.trim().toLowerCase() === normalizedEmail && profile.password === password);
}

function useSecureCookie(req) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.toLowerCase() === "https";
  return process.env.NODE_ENV === "production";
}

function buildSnapshot(email, role, label, permissions) {
  return Buffer.from(
    JSON.stringify({
      id: `${role}-${email}`,
      email,
      role,
      label: label || `${role} session`,
      permissions: permissions || ["*"],
      mfaVerified: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 12 * 1000).toISOString(),
    }),
    "utf8",
  ).toString("base64url");
}

function allowDemoLoginMode() {
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const explicitDemoMode = String(process.env.DASHBOARD_DEMO_MODE || process.env.NEXT_PUBLIC_DEMO_MODE || "").toLowerCase() === "true";
  const configured = String(process.env.DASHBOARD_ALLOW_DEMO_LOGIN || "").trim().toLowerCase();
  const allowDemoLogin = configured === "" ? !isProduction : configured === "true";
  return shouldAllowDemoFallback({ allowDemoFallback: allowDemoLogin, isProduction, demoModeExplicit: explicitDemoMode });
}

export async function POST(req) {
  const body = await req.text();
  const parsed = safeParseJson(body);
  const submitted = parsed && typeof parsed === "object" ? parsed : {};
  const submittedEmail = String(submitted["email"] || "").trim();
  const submittedPassword = String(submitted["password"] || "");
  const wantsDemoLogin = submitted["demoLogin"] === true;
  const requestedDemoRole = String(submitted["demoRole"] || "viewer").trim().toLowerCase();
  const demoRole = requestedDemoRole === "super-admin" || requestedDemoRole === "tenant-admin" || requestedDemoRole === "reseller" ? requestedDemoRole : "viewer";
  const canUseDemoLogin = allowDemoLoginMode();

  if (wantsDemoLogin) {
    if (!canUseDemoLogin) {
      return NextResponse.json({ ok: false, reason: "demo login disabled in this environment" }, { status: 403 });
    }
    const demoEmail = `demo.${demoRole}@nexid.local`;
    const demoLabel = demoRole === "viewer" ? "Readonly Demo Session" : `${demoRole} Demo Session`;
    const demoPermissions = demoRole === "viewer" ? ["read:*"] : ["*"];
    const response = NextResponse.json({
      ok: true,
      email: demoEmail,
      role: demoRole,
      label: demoLabel,
      permissions: demoPermissions,
      mfaRequired: false,
    });
    response.cookies.set(DASHBOARD_SESSION_COOKIE, encodeDemoToken(demoEmail, demoRole), {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookie(req),
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, buildSnapshot(demoEmail, demoRole, demoLabel, demoPermissions), {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookie(req),
      path: "/",
      maxAge: 60 * 60 * 12,
    });
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

  const demoProfile = findDemoProfile(submittedEmail, submittedPassword);
  const canUseDemoLogin = allowDemoLoginMode();
  if (!upstream) {
    if (demoProfile && canUseDemoLogin) {
      const response = NextResponse.json({
        ok: true,
        email: demoProfile.email,
        role: demoProfile.role,
        label: `${demoProfile.label} (demo mode)`,
        permissions: ["*"],
        mfaRequired: false,
      });
      response.cookies.set(DASHBOARD_SESSION_COOKIE, encodeDemoToken(demoProfile.email, demoProfile.role), {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookie(req),
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, buildSnapshot(demoProfile.email, demoProfile.role, `${demoProfile.label} (demo mode)`, ["*"]), {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookie(req),
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      return response;
    }
    return NextResponse.json({ ok: false, reason: "auth upstream unavailable" }, { status: 502 });
  }

  const text = await upstream.text();
  const data = safeParseJson(text);
  if (!upstream.ok || !data?.ok || !data?.sessionToken) {
    if (demoProfile && canUseDemoLogin) {
      const response = NextResponse.json({
        ok: true,
        email: demoProfile.email,
        role: demoProfile.role,
        label: `${demoProfile.label} (demo mode)`,
        permissions: ["*"],
        mfaRequired: false,
      });
      response.cookies.set(DASHBOARD_SESSION_COOKIE, encodeDemoToken(demoProfile.email, demoProfile.role), {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookie(req),
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, buildSnapshot(demoProfile.email, demoProfile.role, `${demoProfile.label} (demo mode)`, ["*"]), {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookie(req),
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      return response;
    }
    const status = upstream.status === 401 || upstream.status === 403 ? upstream.status : 502;
    return NextResponse.json(
      data || { ok: false, reason: status === 502 ? "auth upstream invalid response" : "invalid credentials" },
      { status },
    );
  }

  const response = NextResponse.json({ ok: true, email: data.email, role: data.role, label: data.label, permissions: data.permissions, mfaRequired: false });
  response.cookies.set(DASHBOARD_SESSION_COOKIE, data.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(req),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, buildSnapshot(String(data.email || submittedEmail || ""), String(data.role || "viewer"), String(data.label || ""), Array.isArray(data.permissions) ? data.permissions : ["*"]), {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(req),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
