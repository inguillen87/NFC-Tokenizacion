import { NextResponse } from "next/server";
import { getDashboardSession } from "../../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

export async function POST(req: Request) {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  if (session.role !== "tenant-admin") {
    return NextResponse.json({ ok: false, reason: "tenant admin required" }, { status: 403 });
  }

  if (session.isDemo) {
    return NextResponse.json({ ok: false, reason: "demo sessions cannot mutate tenant setup" }, { status: 403 });
  }

  const tenantSlug = session.tenantSlug;
  if (!tenantSlug) {
    return NextResponse.json({ ok: false, reason: "no tenant associated with session" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const tenantName = String(body.tenantName || "").trim();
  const originLat = typeof body.originLat === "number" ? body.originLat : Number.NaN;
  const originLng = typeof body.originLng === "number" ? body.originLng : Number.NaN;
  if (!tenantName) {
    return NextResponse.json({ ok: false, reason: "tenant name required" }, { status: 400 });
  }
  if (!Number.isFinite(originLat) || originLat < -90 || originLat > 90) {
    return NextResponse.json({ ok: false, reason: "invalid origin latitude" }, { status: 400 });
  }
  if (!Number.isFinite(originLng) || originLng < -180 || originLng > 180) {
    return NextResponse.json({ ok: false, reason: "invalid origin longitude" }, { status: 400 });
  }
  const adminKey = process.env.ADMIN_API_KEY || "";

  try {
    const res = await fetch(`${API_BASE}/admin/tenants/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminKey}`,
        "x-nexid-admin-scope": "tenant_admin",
        "x-nexid-tenant-slug": tenantSlug,
      },
      body: JSON.stringify({
        ...body,
        tenantName,
        originLat,
        originLng,
        tenantSlug,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ ok: false, reason: errorText || "upstream setup error" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "failed to contact upstream api" }, { status: 502 });
  }
}
