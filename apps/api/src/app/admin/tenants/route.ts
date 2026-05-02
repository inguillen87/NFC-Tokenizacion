export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomBytes } from "crypto";
import { sql } from "../../../lib/db";
import { checkAdmin } from "../../../lib/auth";
import { encryptKey16 } from "../../../lib/keys";
import { json } from "../../../lib/http";
import { buildTenantSunProfileInput, normalizeTenantCreateSlug, upsertTenantSunProfile } from "../../../lib/tenant-onboarding";
import { ensureSunTenantProfilesSchema } from "../../../lib/sun-tenant-profile-schema";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const withStats = searchParams.get("withStats") === "1";
  await ensureSunTenantProfilesSchema();

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

  const rows = await sql/*sql*/`
    SELECT
      tn.id,
      tn.slug,
      tn.name,
      tn.created_at,
      tsp.vertical AS sun_vertical,
      tsp.product_label AS sun_product_label,
      tsp.tokenization_mode AS sun_tokenization_mode,
      tsp.claim_policy AS sun_claim_policy,
      (
        tsp.tenant_id IS NOT NULL
        AND tsp.vertical IS NOT NULL
        AND NULLIF(tsp.club_name, '') IS NOT NULL
        AND NULLIF(tsp.product_label, '') IS NOT NULL
        AND NULLIF(tsp.origin_label, '') IS NOT NULL
        AND NULLIF(tsp.origin_address, '') IS NOT NULL
        AND tsp.origin_lat IS NOT NULL
        AND tsp.origin_lng IS NOT NULL
        AND tsp.tokenization_mode IS NOT NULL
        AND tsp.claim_policy IS NOT NULL
        AND tsp.ownership_policy <> '{}'::jsonb
        AND tsp.manifest_policy <> '{}'::jsonb
      ) AS sun_profile_ready
    FROM tenants tn
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = tn.id
    ORDER BY tn.created_at DESC
    LIMIT 200
  `;
  return json(rows);
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const slug = normalizeTenantCreateSlug(body.slug);
  const name = String(body.name || "");
  if (!slug || !name) return json({ ok: false, reason: "slug and name required" }, 400);

  const profileInput = buildTenantSunProfileInput(body);
  if (!profileInput.ok) {
    return json({
      ok: false,
      reason: "tenant_sun_profile_required",
      message: "Every tenant must be created with SUN profile, origin, ownership policy and manifest policy. No generic tenant fallbacks are allowed.",
      missing: profileInput.missing,
      allowed: profileInput.allowed,
    }, 400);
  }

  const root = randomBytes(16);
  const rootKeyCt = encryptKey16(root);

  try {
    const rows = await sql/*sql*/`
      INSERT INTO tenants (slug, name, root_key_ct)
      VALUES (${slug}, ${name}, ${rootKeyCt})
      RETURNING id, slug, name, created_at
    `;
    const sunProfile = await upsertTenantSunProfile(String(rows[0].id), profileInput.profile);
    return json({ ...rows[0], sun_profile: sunProfile, sun_profile_ready: true }, 201);
  } catch {
    const existing = await sql/*sql*/`
      SELECT id, slug, name, created_at
      FROM tenants
      WHERE slug = ${slug}
      LIMIT 1
    `;
    if (existing[0]) {
      const sunProfile = await upsertTenantSunProfile(String(existing[0].id), profileInput.profile);
      return json({ ...existing[0], sun_profile: sunProfile, sun_profile_ready: true }, 200);
    }
    return json({ ok: false, reason: "tenant create failed" }, 500);
  }
}
