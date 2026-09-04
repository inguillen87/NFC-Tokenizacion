export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../../lib/db';
import { json } from '../../../lib/http';
import { auditAuthEvent, createSession, getAuthUserByEmail, normalizeRole } from '../../../lib/iam';
import { getRequestMeta } from '../../../lib/request-meta';
import { ensureEnterpriseIamSchema } from '../../../lib/commercial-runtime-schema';
import { ensureSunTenantProfilesSchema } from '../../../lib/sun-tenant-profile-schema';
import { isClerkSuperAdminEmailAllowed, redactAllowlistForLogs } from '../../../lib/clerk-super-admin-allowlist';
import { RequestBodyTooLargeError, readBoundedJsonBody } from '../../../lib/bounded-request-body';
import { enforceCriticalRateLimit } from '../../../lib/critical-rate-limit';
import { resolveVerifiedClerkAdminIdentity } from '../../../lib/clerk-admin-auth';

export async function POST(req: Request) {
  const clerkAuth = await resolveVerifiedClerkAdminIdentity(req);
  if (!clerkAuth.ok) return json({ ok: false, reason: clerkAuth.reason }, clerkAuth.status);
  if (!clerkAuth.identity.verifiedOAuthProviders.includes('google')) {
    return json({
      ok: false,
      reason: 'Google authentication required for dashboard super admin',
      code: 'clerk_google_required',
    }, 403);
  }

  const limited = await enforceCriticalRateLimit(req, {
    rateClass: 'auth',
    tenantId: 'platform',
    subjectId: `clerk-sync:${clerkAuth.identity.externalUserId}`,
  });
  if (limited) return limited;
  let body: { email?: string; fullName?: string; externalUserId?: string; };
  try {
    body = await readBoundedJsonBody<typeof body>(req, 8 * 1024);
  } catch (error) {
    return json({ ok: false, reason: error instanceof RequestBodyTooLargeError ? 'request_body_too_large' : 'invalid_json' }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  const claimedExternalUserId = String(body.externalUserId || '').trim();
  const claimedEmail = String(body.email || '').trim().toLowerCase();
  if (claimedExternalUserId && claimedExternalUserId !== clerkAuth.identity.externalUserId) {
    return json({ ok: false, reason: "clerk_identity_mismatch" }, 403);
  }
  if (claimedEmail && claimedEmail !== clerkAuth.identity.email) {
    return json({ ok: false, reason: "clerk_identity_mismatch" }, 403);
  }

  const email = clerkAuth.identity.email;
  const fullName = clerkAuth.identity.fullName;
  const isSuperAdmin = isClerkSuperAdminEmailAllowed(email);

  if (!isSuperAdmin) {
    console.info("[clerk_sync_audit]", JSON.stringify({
      event: "clerk_super_admin_denied",
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
  await sql`
    WITH identity_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 91731))
    ),
    existing_super_admin AS MATERIALIZED (
      SELECT membership.id
      FROM memberships membership
      CROSS JOIN identity_lock
      WHERE membership.user_id = ${userId}::uuid
        AND membership.role = 'super_admin'::membership_role
        AND membership.tenant_id IS NULL
      ORDER BY membership.created_at ASC, membership.id ASC
      LIMIT 1
    )
    INSERT INTO memberships (user_id, tenant_id, role)
    SELECT ${userId}::uuid, NULL, 'super_admin'::membership_role
    FROM identity_lock
    WHERE NOT EXISTS (SELECT 1 FROM existing_super_admin)
    ON CONFLICT DO NOTHING
  `;

  const superPermissions = ["users:manage", "tenants:write", "batches:write", "analytics:read", "events:read"];
  for (const p of superPermissions) {
    const [res, act] = p.split(":");
    await sql`
      INSERT INTO resource_permissions (user_id, tenant_id, resource, action)
      VALUES (${userId}::uuid, NULL, ${res}, ${act})
      ON CONFLICT DO NOTHING
    `;
  }

  // Fetch final user record (using database helper to resolve roles and permissions)
  const user = await getAuthUserByEmail(sql as any, email);
  if (!user) {
    return json({ ok: false, reason: "failed to retrieve synced user" }, 500);
  }

  const session = await createSession(sql as any, { user, ...meta, mfaVerified: false });
  await auditAuthEvent(sql as any, {
    email,
    eventName: 'clerk_login',
    ok: true,
    role: user.role,
    ...meta,
    meta: { source: 'dashboard', mfaVerified: false, clerkUserId: clerkAuth.identity.externalUserId },
  }).catch(() => null);

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
