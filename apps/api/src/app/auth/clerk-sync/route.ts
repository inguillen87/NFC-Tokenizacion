export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { auditAuthEvent, createSession, getAuthUserByEmail, normalizeRole } from '../../../lib/iam';
import { getRequestMeta } from '../../../lib/request-meta';
import { ensureEnterpriseIamSchema } from '../../../lib/commercial-runtime-schema';
import { ensureSunTenantProfilesSchema } from '../../../lib/sun-tenant-profile-schema';
import { isClerkSuperAdminEmailAllowed, redactAllowlistForLogs } from '../../../lib/clerk-super-admin-allowlist';

export async function POST(req: Request) {
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
  const isSuperAdmin = isClerkSuperAdminEmailAllowed(email);

  if (!isSuperAdmin) {
    console.info("[clerk_sync_audit]", JSON.stringify({
      event: "clerk_super_admin_denied",
      email,
      allowlist: redactAllowlistForLogs(),
    }));
    return json({
      ok: false,
      reason: "email not allowed for dashboard super admin",
      code: "clerk_super_admin_not_allowed",
    }, 403);
  }

  await ensureEnterpriseIamSchema();
  await ensureSunTenantProfilesSchema();

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

  // 3. Resolve Super Admin Membership. Clerk is only a founder/admin SSO path;
  // tenant onboarding stays behind explicit invites or controlled credentials.
  const membershipRows = await sql`
    SELECT id, role, tenant_id FROM memberships WHERE user_id = ${userId}::uuid LIMIT 1
  `;
  if (membershipRows.length === 0) {
    await sql`
      INSERT INTO memberships (user_id, tenant_id, role)
      VALUES (${userId}::uuid, NULL, 'super_admin'::membership_role)
    `;
  } else if (membershipRows[0].role !== 'super_admin' || membershipRows[0].tenant_id !== null) {
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
