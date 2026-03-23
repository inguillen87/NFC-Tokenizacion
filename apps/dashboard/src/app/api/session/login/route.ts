export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE } from "../../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

export async function POST(req: Request) {
  const body = await req.text();
  const upstream = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": req.headers.get("user-agent") || "dashboard" },
    body,
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) return NextResponse.json({ ok: false, reason: "auth upstream unavailable" }, { status: 502 });

  const text = await upstream.text();
  const data = text ? JSON.parse(text) : null;
  if (!upstream.ok || !data?.ok || !data?.sessionToken) {
    return NextResponse.json(data || { ok: false, reason: "invalid credentials" }, { status: upstream.status || 401 });
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
