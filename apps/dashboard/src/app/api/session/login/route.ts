export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE } from "../../../../lib/session";
import { getAccessProfiles } from "../../../../lib/access-profiles";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

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

function findDemoProfile(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return getAccessProfiles().find((profile) => profile.email.trim().toLowerCase() === normalizedEmail && profile.password === password);
}

export async function POST(req: Request) {
  const body = await req.text();
  const submitted = safeParseJson(body) as { email?: string; password?: string } | null;
  const submittedEmail = (submitted?.email || "").trim();
  const submittedPassword = submitted?.password || "";
  const upstream = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": req.headers.get("user-agent") || "dashboard" },
    body,
    cache: "no-store",
  }).catch(() => null);

  const demoProfile = findDemoProfile(submittedEmail, submittedPassword);
  if (!upstream) {
    if (demoProfile) {
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
        secure: process.env.NODE_ENV === "production",
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
    if (demoProfile) {
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
        secure: process.env.NODE_ENV === "production",
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
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
