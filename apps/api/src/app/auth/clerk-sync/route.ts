export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { auditAuthEvent, createSession, getAuthUserByEmail, normalizeRole } from '../../../lib/iam';
import { getRequestMeta } from '../../../lib/request-meta';
import { ensureEnterpriseIamSchema } from '../../../lib/commercial-runtime-schema';
import { ensureSunTenantProfilesSchema } from '../../../lib/sun-tenant-profile-schema';

export async function POST(req: Request) {
  await ensureEnterpriseIamSchema();
  await ensureSunTenantProfilesSchema();

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const expected = String(process.env.ADMIN_API_KEY || "").trim();

  if (!expected || token !== expected) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({})) as { email?: string; fullName?: string; externalUserId?: string; };
  const rawEmail = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim();

  if (!rawEmail) {
    return json({ ok: false, reason: "email is required" }, 400);
  }

  const email = rawEmail;
  const isSuperAdmin = email === 'guillen.marce@gmail.com';

  const meta = getRequestMeta(req);

  // 1. Sync User
  const userRows = await sql`SELECT id, email, full_name FROM users WHERE lower(email) = ${email} LIMIT 1`;
  let userId: string;
  let userLabel: string = fullName || email.split("@")[0];

  if (userRows.length > 0) {
    userId = userRows[0].id;
    if (userRows[0].full_name) {
      userLabel = userRows[0].full_name;
    } else if (fullName) {
      await sql`UPDATE users SET full_name = ${fullName} WHERE id = ${userId}::uuid`;
      userLabel = fullName;
    }
  } else {
    const insertRows = await sql`
      INSERT INTO users (email, full_name)
      VALUES (${email}, ${userLabel})
      RETURNING id, full_name
    `;
    userId = insertRows[0].id;
  }

  // 2. Ensure password credential (even dummy for OAuth compliance with legacy schemas/queries)
  const pwdRows = await sql`SELECT user_id FROM password_credentials WHERE user_id = ${userId}::uuid LIMIT 1`;
  if (!pwdRows[0]) {
    // We insert a dummy bcrypt hash or random bytes that won't match direct passwords
    await sql`INSERT INTO password_credentials (user_id, password_hash) VALUES (${userId}::uuid, 'clerk_oauth_external_login')`;
  }

  // 3. Resolve Tenant & Membership
  if (isSuperAdmin) {
    // Marcelo Guillen is global Super Admin
    const membershipRows = await sql`
      SELECT id, role, tenant_id FROM memberships WHERE user_id = ${userId}::uuid LIMIT 1
    `;
    if (membershipRows.length === 0) {
      await sql`
        INSERT INTO memberships (user_id, tenant_id, role)
        VALUES (${userId}::uuid, NULL, 'super_admin'::membership_role)
      `;
    } else if (membershipRows[0].role !== 'super_admin') {
      await sql`
        UPDATE memberships
        SET role = 'super_admin'::membership_role, tenant_id = NULL, updated_at = now()
        WHERE id = ${membershipRows[0].id}::uuid
      `;
    }

    const superPermissions = ["users:manage", "tenants:write", "batches:write", "analytics:read", "events:read"];
    for (const p of superPermissions) {
      const [res, act] = p.split(":");
      await sql`
        INSERT INTO resource_permissions (user_id, resource, action)
        VALUES (${userId}::uuid, ${res}, ${act})
        ON CONFLICT DO NOTHING
      `;
    }
  } else {
    // Non-super-admins: must have a tenant-scoped role.
    const membershipRows = await sql`
      SELECT m.id, m.role, m.tenant_id, t.slug AS tenant_slug
      FROM memberships m
      LEFT JOIN tenants t ON t.id = m.tenant_id
      WHERE m.user_id = ${userId}::uuid
      LIMIT 1
    `;

    if (membershipRows.length === 0) {
      // Create new tenant
      let baseSlug = email.split('@')[0].replace(/[^a-z0-9]/g, '-');
      if (!baseSlug) baseSlug = 'tenant';
      let tenantSlug = baseSlug;

      const existingTenant = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`;
      if (existingTenant.length > 0) {
        tenantSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
      }

      const tenantName = fullName ? `${fullName}'s Org` : `${email.split('@')[0]}'s Org`;

      const tenantRows = await sql`
        INSERT INTO tenants (slug, name)
        VALUES (${tenantSlug}, ${tenantName})
        RETURNING id, slug, name
      `;
      const tenantId = tenantRows[0].id;

      // Create SUN Profile with setup_completed: false
      await sql`
        INSERT INTO tenant_sun_profiles (
          tenant_id,
          vertical,
          club_name,
          product_label,
          origin_label,
          origin_address,
          origin_lat,
          origin_lng,
          tokenization_mode,
          claim_policy,
          ownership_policy,
          manifest_policy,
          theme,
          metadata
        )
        VALUES (
          ${tenantId}::uuid,
          'wine',
          'Club Terroir',
          'Vino premium',
          'Valle de Uco, Mendoza',
          'Finca Altamira, Mendoza, AR',
          -33.3667,
          -69.15,
          'valid_and_opened',
          'purchase_proof_required',
          '{"requiresPurchaseProof":true,"requiresFreshTap":true,"requiresTenantMembership":true,"allowsPublicClaim":false,"antiReplayRequired":true}'::jsonb,
          '{"acceptedFormats":["csv","txt"],"requiredColumns":["uid_hex"],"csvOptionalColumns":["batch_id","product_name","sku","lot","serial","serial_number","external_unit_id","bottle_number","label_number","case_id","pallet_id","roll_id","supplier_lot","expires_at","image_url","label_image_url","model_url","gallery_urls","sensor_json","iot_json","telemetry_json","sensor_at","sensor_id","temperature_c","humidity_pct","light_exposure","transit_shock","storage_zone"],"activateDefault":false,"rejectDuplicates":true}'::jsonb,
          '{"accent":"cyan","secondary":"violet","mapStyle":"luxury"}'::jsonb,
          '{"setup_completed": false}'::jsonb
        )
      `;

      // Assign tenant_admin membership
      await sql`
        INSERT INTO memberships (user_id, tenant_id, role)
        VALUES (${userId}::uuid, ${tenantId}::uuid, 'tenant_admin'::membership_role)
      `;

      // Assign default tenant admin permissions
      const adminPermissions = ["users:manage", "batches:write", "analytics:read", "events:read"];
      for (const p of adminPermissions) {
        const [res, act] = p.split(":");
        await sql`
          INSERT INTO resource_permissions (user_id, resource, action)
          VALUES (${userId}::uuid, ${res}, ${act})
          ON CONFLICT DO NOTHING
        `;
      }
    }
  }

  // Fetch final user record (using database helper to resolve roles and permissions)
  const user = await getAuthUserByEmail(sql as any, email);
  if (!user) {
    return json({ ok: false, reason: "failed to retrieve synced user" }, 500);
  }

  const userStatus = 'active'; // Clerk authenticated is active by definition
  const session = await createSession(sql as any, { user, ...meta, mfaVerified: false });
  await auditAuthEvent(sql as any, { email, eventName: 'clerk_login', ok: true, role: user.role, ...meta, meta: { source: 'dashboard', mfaVerified: false } }).catch(() => null);

  return json({
    ok: true,
    email: user.email,
    role: normalizeRole(user.role),
    label: user.label,
    permissions: user.permissions,
    mfaRequired: false,
    sessionToken: `${session.id}.${session.secret}`,
    expiresAt: session.expiresAt,
  });
}
