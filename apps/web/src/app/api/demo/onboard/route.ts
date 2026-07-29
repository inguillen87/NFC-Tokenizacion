export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/**
 * Privileged tenant/batch creation is intentionally unavailable from the
 * browser application. Local demo provisioning belongs to audited CLI or
 * authenticated dashboard workflows, never to an ambient root credential.
 */
export async function POST() {
  return NextResponse.json(
    { ok: false, reason: "not_found" },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}
