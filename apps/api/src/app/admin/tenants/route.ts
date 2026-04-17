export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomBytes } from "crypto";
import { sql } from "../../../lib/db";
import { checkAdmin } from "../../../lib/auth";
import { encryptKey16 } from "../../../lib/keys";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const withStats = searchParams.get("withStats") === "1";

  if (withStats) {
    const rows = await sql/*sql*/`
      SELECT
        tn.id,
        tn.slug,
        tn.name,
        tn.created_at,
        COUNT(e.id)::int AS scans,
        COUNT(*) FILTER (WHERE e.result IN ('DUPLICATE','REPLAY_SUSPECT'))::int AS duplicates,
        COUNT(*) FILTER (WHERE e.result IN ('TAMPER','NOT_REGISTERED','NOT_ACTIVE','INVALID'))::int AS tamper
      FROM tenants tn
      LEFT JOIN batches b ON b.tenant_id = tn.id
      LEFT JOIN events e ON e.batch_id = b.id
      GROUP BY tn.id, tn.slug, tn.name, tn.created_at
      ORDER BY tn.created_at DESC
      LIMIT 200
    `;
    return json(rows);
  }

  const rows = await sql/*sql*/`SELECT id, slug, name, created_at FROM tenants ORDER BY created_at DESC LIMIT 200`;
  return json(rows);
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const slug = String(body.slug || "").toLowerCase();
  const name = String(body.name || "");
  if (!slug || !name) return json({ ok: false, reason: "slug and name required" }, 400);

  const root = randomBytes(16);
  const rootKeyCt = encryptKey16(root);

  try {
    const rows = await sql/*sql*/`
      INSERT INTO tenants (slug, name, root_key_ct)
      VALUES (${slug}, ${name}, ${rootKeyCt})
      RETURNING id, slug, name, created_at
    `;
    return json(rows[0], 201);
  } catch {
    const existing = await sql/*sql*/`
      SELECT id, slug, name, created_at
      FROM tenants
      WHERE slug = ${slug}
      LIMIT 1
    `;
    if (existing[0]) return json(existing[0], 200);
    return json({ ok: false, reason: "tenant create failed" }, 500);
  }
}
