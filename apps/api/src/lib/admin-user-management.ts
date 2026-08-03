import type { ManagedAdminRole } from "./admin-user-management-policy";

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

type ManagedTarget = {
  targetUserId: string;
  actorIsSuperAdmin: boolean;
  actorTenantId: string | null;
};

type ManagedAccess = ManagedTarget & {
  tenantId: string | null;
  role: ManagedAdminRole;
  permissions: string[];
};

export async function createManagedAdminUser(sql: Sql, input: {
  email: string;
  fullName: string | null;
  passwordHash: string;
  tenantId: string | null;
  role: ManagedAdminRole;
  permissions: string[];
}) {
  const rows = await sql/*sql*/`
    WITH existing_user AS MATERIALIZED (
      SELECT id
      FROM users
      WHERE lower(email) = ${input.email}
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE
    ),
    new_user AS (
      INSERT INTO users (email, full_name, admin_status)
      SELECT ${input.email}, ${input.fullName}, 'active'::admin_user_status
      WHERE NOT EXISTS (SELECT 1 FROM existing_user)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    ),
    new_credential AS (
      INSERT INTO password_credentials (user_id, password_hash)
      SELECT id, ${input.passwordHash}
      FROM new_user
      RETURNING user_id
    ),
    new_membership AS (
      INSERT INTO memberships (user_id, tenant_id, role)
      SELECT id, ${input.tenantId}::uuid, ${input.role}::membership_role
      FROM new_user
      RETURNING user_id
    ),
    desired_permissions AS MATERIALIZED (
      SELECT DISTINCT
        CASE WHEN value = '*' THEN '*' ELSE split_part(value, ':', 1) END AS resource,
        CASE WHEN value = '*' THEN '*' ELSE substr(value, strpos(value, ':') + 1) END AS action
      FROM jsonb_array_elements_text(${JSON.stringify(input.permissions)}::jsonb)
    ),
    new_permissions AS (
      INSERT INTO resource_permissions (user_id, tenant_id, resource, action)
      SELECT nu.id, ${input.tenantId}::uuid, dp.resource, dp.action
      FROM new_user nu
      CROSS JOIN desired_permissions dp
      RETURNING user_id
    )
    SELECT nu.id,
      (SELECT count(*) FROM new_credential) AS credential_count,
      (SELECT count(*) FROM new_membership) AS membership_count,
      (SELECT count(*) FROM new_permissions) AS permission_count
    FROM new_user nu
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
}

export async function createManagedAdminInvite(sql: Sql, input: {
  email: string;
  fullName: string | null;
  tenantId: string | null;
  role: ManagedAdminRole;
  permissions: string[];
  invitedBy: string | null;
  tokenHash: string;
  ttlMinutes: number;
}) {
  const rows = await sql/*sql*/`
    WITH existing_user AS MATERIALIZED (
      SELECT id
      FROM users
      WHERE lower(email) = ${input.email}
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE
    ),
    new_user AS (
      INSERT INTO users (email, full_name, admin_status)
      SELECT ${input.email}, ${input.fullName}, 'invited'::admin_user_status
      WHERE NOT EXISTS (SELECT 1 FROM existing_user)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    ),
    new_membership AS (
      INSERT INTO memberships (user_id, tenant_id, role)
      SELECT id, ${input.tenantId}::uuid, ${input.role}::membership_role
      FROM new_user
      RETURNING user_id
    ),
    desired_permissions AS MATERIALIZED (
      SELECT DISTINCT
        CASE WHEN value = '*' THEN '*' ELSE split_part(value, ':', 1) END AS resource,
        CASE WHEN value = '*' THEN '*' ELSE substr(value, strpos(value, ':') + 1) END AS action
      FROM jsonb_array_elements_text(${JSON.stringify(input.permissions)}::jsonb)
    ),
    new_permissions AS (
      INSERT INTO resource_permissions (user_id, tenant_id, resource, action)
      SELECT nu.id, ${input.tenantId}::uuid, dp.resource, dp.action
      FROM new_user nu
      CROSS JOIN desired_permissions dp
      RETURNING user_id
    ),
    new_invite AS (
      INSERT INTO user_invites (email, role, tenant_id, permissions, invited_by, token_hash, expires_at)
      SELECT ${input.email}, ${input.role}::membership_role, ${input.tenantId}::uuid,
        ${JSON.stringify(input.permissions)}::jsonb, ${input.invitedBy}::uuid, ${input.tokenHash},
        now() + (${input.ttlMinutes} * interval '1 minute')
      FROM new_user
      RETURNING id
    ),
    new_reset_token AS (
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, meta)
      SELECT id, ${input.tokenHash}, now() + (${input.ttlMinutes} * interval '1 minute'),
        ${JSON.stringify({ source: "invite", email: input.email })}::jsonb
      FROM new_user
      RETURNING id
    )
    SELECT nu.id,
      (SELECT count(*) FROM new_membership) AS membership_count,
      (SELECT count(*) FROM new_permissions) AS permission_count,
      (SELECT count(*) FROM new_invite) AS invite_count,
      (SELECT count(*) FROM new_reset_token) AS reset_count
    FROM new_user nu
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
}

export async function replaceManagedAdminUserAccess(sql: Sql, input: ManagedAccess) {
  const rows = await sql/*sql*/`
    WITH target AS MATERIALIZED (
      SELECT u.id
      FROM users u
      WHERE u.id = ${input.targetUserId}::uuid
        AND (
          ${input.actorIsSuperAdmin}
          OR (
            ${input.actorTenantId}::uuid IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM memberships own_membership
              WHERE own_membership.user_id = u.id
                AND own_membership.tenant_id = ${input.actorTenantId}::uuid
                AND own_membership.role::text NOT IN ('super_admin', 'tenant_owner')
            )
            AND NOT EXISTS (
              SELECT 1
              FROM memberships forbidden_membership
              WHERE forbidden_membership.user_id = u.id
                AND (
                  forbidden_membership.role::text IN ('super_admin', 'tenant_owner')
                  OR forbidden_membership.tenant_id IS NULL
                  OR forbidden_membership.tenant_id <> ${input.actorTenantId}::uuid
                )
            )
          )
        )
      FOR UPDATE
    ),
    membership_write AS (
      INSERT INTO memberships (user_id, tenant_id, role)
      SELECT id, ${input.tenantId}::uuid, ${input.role}::membership_role
      FROM target
      ON CONFLICT (user_id, tenant_id, role)
      DO UPDATE SET updated_at = now()
      RETURNING id, user_id
    ),
    old_memberships_delete AS (
      DELETE FROM memberships membership
      USING membership_write desired_membership
      WHERE membership.user_id = desired_membership.user_id
        AND membership.id <> desired_membership.id
      RETURNING membership.id
    ),
    desired_permissions AS MATERIALIZED (
      SELECT DISTINCT
        CASE WHEN value = '*' THEN '*' ELSE split_part(value, ':', 1) END AS resource,
        CASE WHEN value = '*' THEN '*' ELSE substr(value, strpos(value, ':') + 1) END AS action
      FROM jsonb_array_elements_text(${JSON.stringify(input.permissions)}::jsonb)
    ),
    permissions_write AS (
      INSERT INTO resource_permissions (user_id, tenant_id, resource, action)
      SELECT target.id, ${input.tenantId}::uuid, desired.resource, desired.action
      FROM target
      CROSS JOIN desired_permissions desired
      ON CONFLICT DO NOTHING
      RETURNING id
    ),
    old_permissions_delete AS (
      DELETE FROM resource_permissions permission
      USING target
      WHERE permission.user_id = target.id
        AND NOT EXISTS (
          SELECT 1
          FROM desired_permissions desired
          WHERE desired.resource = permission.resource
            AND desired.action = permission.action
            AND permission.effect = 'allow'
            AND permission.tenant_id IS NOT DISTINCT FROM ${input.tenantId}::uuid
        )
      RETURNING permission.id
    ),
    revoked_sessions AS (
      UPDATE auth_sessions session
      SET revoked_at = now(), last_seen_at = now()
      FROM target
      WHERE session.user_id = target.id
        AND session.revoked_at IS NULL
      RETURNING session.id
    )
    SELECT target.id,
      (SELECT count(*) FROM membership_write) AS membership_count,
      (SELECT count(*) FROM old_memberships_delete) AS removed_memberships,
      (SELECT count(*) FROM permissions_write) AS added_permissions,
      (SELECT count(*) FROM old_permissions_delete) AS removed_permissions,
      (SELECT count(*) FROM revoked_sessions) AS revoked_session_count
    FROM target
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
}

export async function resetManagedAdminUserMfa(sql: Sql, input: ManagedTarget) {
  const rows = await sql/*sql*/`
    WITH target AS MATERIALIZED (
      SELECT u.id
      FROM users u
      WHERE u.id = ${input.targetUserId}::uuid
        AND (
          ${input.actorIsSuperAdmin}
          OR (
            ${input.actorTenantId}::uuid IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM memberships own_membership
              WHERE own_membership.user_id = u.id
                AND own_membership.tenant_id = ${input.actorTenantId}::uuid
                AND own_membership.role::text NOT IN ('super_admin', 'tenant_owner')
            )
            AND NOT EXISTS (
              SELECT 1 FROM memberships forbidden_membership
              WHERE forbidden_membership.user_id = u.id
                AND (
                  forbidden_membership.role::text IN ('super_admin', 'tenant_owner')
                  OR forbidden_membership.tenant_id IS NULL
                  OR forbidden_membership.tenant_id <> ${input.actorTenantId}::uuid
                )
            )
          )
        )
      FOR UPDATE
    ),
    deleted_mfa AS (
      DELETE FROM user_mfa_factors factor
      USING target
      WHERE factor.user_id = target.id
      RETURNING factor.user_id
    ),
    revoked_sessions AS (
      UPDATE auth_sessions session
      SET revoked_at = now(), last_seen_at = now()
      FROM target
      WHERE session.user_id = target.id
        AND session.revoked_at IS NULL
      RETURNING session.id
    )
    SELECT target.id,
      (SELECT count(*) FROM deleted_mfa) AS deleted_mfa_count,
      (SELECT count(*) FROM revoked_sessions) AS revoked_session_count
    FROM target
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
}

export async function createManagedAdminPasswordReset(sql: Sql, input: ManagedTarget & {
  tokenHash: string;
  ttlMinutes: number;
}) {
  const rows = await sql/*sql*/`
    WITH target AS MATERIALIZED (
      SELECT u.id
      FROM users u
      WHERE u.id = ${input.targetUserId}::uuid
        AND (
          ${input.actorIsSuperAdmin}
          OR (
            ${input.actorTenantId}::uuid IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM memberships own_membership
              WHERE own_membership.user_id = u.id
                AND own_membership.tenant_id = ${input.actorTenantId}::uuid
                AND own_membership.role::text NOT IN ('super_admin', 'tenant_owner')
            )
            AND NOT EXISTS (
              SELECT 1 FROM memberships forbidden_membership
              WHERE forbidden_membership.user_id = u.id
                AND (
                  forbidden_membership.role::text IN ('super_admin', 'tenant_owner')
                  OR forbidden_membership.tenant_id IS NULL
                  OR forbidden_membership.tenant_id <> ${input.actorTenantId}::uuid
                )
            )
          )
        )
      FOR UPDATE
    ),
    consumed_tokens AS (
      UPDATE password_reset_tokens token
      SET consumed_at = now()
      FROM target
      WHERE token.user_id = target.id
        AND token.consumed_at IS NULL
      RETURNING token.id
    ),
    new_reset_token AS (
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, meta)
      SELECT id, ${input.tokenHash}, now() + (${input.ttlMinutes} * interval '1 minute'),
        '{"source":"admin"}'::jsonb
      FROM target
      RETURNING id
    ),
    revoked_sessions AS (
      UPDATE auth_sessions session
      SET revoked_at = now(), last_seen_at = now()
      FROM target
      WHERE session.user_id = target.id
        AND session.revoked_at IS NULL
      RETURNING session.id
    )
    SELECT target.id,
      (SELECT count(*) FROM consumed_tokens) AS consumed_token_count,
      (SELECT count(*) FROM new_reset_token) AS new_token_count,
      (SELECT count(*) FROM revoked_sessions) AS revoked_session_count
    FROM target
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
}
