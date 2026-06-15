import { NextResponse } from "next/server";
import { getDashboardSession } from "../../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

export async function POST(req: Request) {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const tenantSlug = session.tenantSlug;
  if (!tenantSlug) {
    return NextResponse.json({ ok: false, reason: "no tenant associated with session" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const adminKey = process.env.ADMIN_API_KEY || "";

  try {
    const res = await fetch(`${API_BASE}/admin/tenants/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminKey}`,
        "x-nexid-tenant-slug": tenantSlug,
      },
      body: JSON.stringify({
        ...body,
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
