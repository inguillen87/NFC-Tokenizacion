import type { ManagedAdminRole } from "./admin-user-management-policy";

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

type ManagedTarget = {
  targetUserId: string;
  actorIsSuperAdmin: boolean;
  actorTenantId: string | null;
};

type ManagedRoleChange = ManagedTarget & {
  tenantId: string | null;
  role: ManagedAdminRole;
};

type ManagedPermissionOverrides = ManagedRoleChange & {
  actorUserId: string;
  allowPermissions: string[];
  deniedPermissions: string[];
  roleDefaultPermissions: unknown;
  ipAddress: string | null;
  requestId: string | null;
  userAgent: string | null;
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

/**
 * Changes only the authoritative membership and keeps every explicit override.
 * A tenant actor may re-save the current role, but must clear direct allows via
 * the explicit audited path before changing roles; otherwise a dormant grant
 * could become active under the new role boundary.
 */
export async function replaceManagedAdminUserRole(sql: Sql, input: ManagedRoleChange) {
  const rows = await sql/*sql*/`
    WITH target AS MATERIALIZED (
      SELECT u.id
      FROM users u
      WHERE u.id = ${input.targetUserId}::uuid
        AND (
          SELECT count(*)
          FROM memberships existing_membership
          WHERE existing_membership.user_id = u.id
        ) <= 1
        AND NOT EXISTS (
          SELECT 1
          FROM resource_permissions scoped_permission
          WHERE scoped_permission.user_id = u.id
            AND scoped_permission.tenant_id IS DISTINCT FROM ${input.tenantId}::uuid
        )
        AND (
          ${input.actorIsSuperAdmin}
          OR NOT EXISTS (
            SELECT 1
            FROM resource_permissions role_change_permission
            WHERE role_change_permission.user_id = u.id
              AND role_change_permission.tenant_id IS NOT DISTINCT FROM ${input.tenantId}::uuid
              AND role_change_permission.effect = 'allow'
          )
          OR EXISTS (
            SELECT 1
            FROM memberships unchanged_membership
            WHERE unchanged_membership.user_id = u.id
              AND unchanged_membership.tenant_id IS NOT DISTINCT FROM ${input.tenantId}::uuid
              AND unchanged_membership.role = ${input.role}::membership_role
          )
        )
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
      (SELECT count(*) FROM revoked_sessions) AS revoked_session_count
    FROM target
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
}

export async function getManagedAdminUserAccess(sql: Sql, input: ManagedTarget & {
  tenantId: string | null;
}) {
  const rows = await sql/*sql*/`
    SELECT u.id, target_membership.tenant_id, target_membership.role::text AS role,
      role_profile.default_permissions
    FROM users u
    JOIN memberships target_membership ON target_membership.user_id = u.id
    JOIN enterprise_role_profiles role_profile
      ON role_profile.code = target_membership.role::text
     AND role_profile.active = true
     AND role_profile.human_session_allowed = true
    WHERE u.id = ${input.targetUserId}::uuid
      AND target_membership.tenant_id IS NOT DISTINCT FROM ${input.tenantId}::uuid
      AND (
        ${input.actorIsSuperAdmin}
        OR (
          ${input.actorTenantId}::uuid IS NOT NULL
          AND target_membership.tenant_id = ${input.actorTenantId}::uuid
          AND target_membership.role::text NOT IN ('super_admin', 'tenant_owner')
          AND NOT EXISTS (
            SELECT 1
            FROM memberships forbidden_membership
            WHERE forbidden_membership.user_id = u.id
              AND forbidden_membership.id <> target_membership.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM resource_permissions forbidden_permission
            WHERE forbidden_permission.user_id = u.id
              AND forbidden_permission.tenant_id IS DISTINCT FROM ${input.actorTenantId}::uuid
          )
        )
      )
    ORDER BY target_membership.updated_at DESC, target_membership.id DESC
    LIMIT 2
  `;
  if (rows.length !== 1 || !rows[0]?.id || !rows[0]?.role) return null;
  return {
    userId: String(rows[0].id),
    tenantId: rows[0].tenant_id ? String(rows[0].tenant_id) : null,
    role: String(rows[0].role) as ManagedAdminRole,
    roleDefaultPermissions: rows[0].default_permissions,
  };
}

/**
 * Replaces explicit grants and denies for one already-resolved membership.
 * The role is an optimistic scope guard, not a requested role change. The
 * permission writes, session revocation and audit record share one statement,
 * so an audit failure rolls the entire privileged mutation back.
 */
export async function replaceManagedAdminUserPermissionOverrides(
  sql: Sql,
  input: ManagedPermissionOverrides,
) {
  const rows = await sql/*sql*/`
    WITH target AS MATERIALIZED (
      SELECT u.id, target_membership.role::text AS role
      FROM users u
      JOIN memberships target_membership
        ON target_membership.user_id = u.id
       AND target_membership.tenant_id IS NOT DISTINCT FROM ${input.tenantId}::uuid
       AND target_membership.role = ${input.role}::membership_role
      JOIN enterprise_role_profiles role_profile
        ON role_profile.code = target_membership.role::text
       AND role_profile.active = true
       AND role_profile.human_session_allowed = true
       AND role_profile.default_permissions = ${JSON.stringify(input.roleDefaultPermissions)}::jsonb
      WHERE u.id = ${input.targetUserId}::uuid
        AND (
          ${input.actorIsSuperAdmin}
          OR (
            ${input.actorTenantId}::uuid IS NOT NULL
            AND target_membership.tenant_id = ${input.actorTenantId}::uuid
            AND target_membership.role::text NOT IN ('super_admin', 'tenant_owner')
            AND NOT EXISTS (
              SELECT 1
              FROM memberships forbidden_membership
              WHERE forbidden_membership.user_id = u.id
                AND forbidden_membership.id <> target_membership.id
            )
            AND NOT EXISTS (
              SELECT 1
              FROM resource_permissions forbidden_permission
              WHERE forbidden_permission.user_id = u.id
                AND forbidden_permission.tenant_id IS DISTINCT FROM ${input.actorTenantId}::uuid
            )
          )
        )
      FOR UPDATE OF u, target_membership
    ),
    previous_permissions AS MATERIALIZED (
      SELECT permission.resource, permission.action, permission.effect
      FROM resource_permissions permission
      JOIN target ON target.id = permission.user_id
      WHERE permission.tenant_id IS NOT DISTINCT FROM ${input.tenantId}::uuid
    ),
    desired_permissions AS MATERIALIZED (
      SELECT DISTINCT
        requested.effect,
        CASE WHEN requested.value = '*' THEN '*' ELSE split_part(requested.value, ':', 1) END AS resource,
        CASE WHEN requested.value = '*' THEN '*' ELSE substr(requested.value, strpos(requested.value, ':') + 1) END AS action
      FROM (
        SELECT 'allow'::text AS effect, value
        FROM jsonb_array_elements_text(${JSON.stringify(input.allowPermissions)}::jsonb)
        UNION ALL
        SELECT 'deny'::text AS effect, value
        FROM jsonb_array_elements_text(${JSON.stringify(input.deniedPermissions)}::jsonb)
      ) requested
    ),
    deleted_permissions AS (
      DELETE FROM resource_permissions permission
      USING target
      WHERE permission.user_id = target.id
        AND permission.tenant_id IS NOT DISTINCT FROM ${input.tenantId}::uuid
        AND NOT EXISTS (
          SELECT 1
          FROM desired_permissions desired
          WHERE desired.resource = permission.resource
            AND desired.action = permission.action
            AND desired.effect = permission.effect
        )
      RETURNING permission.id
    ),
    inserted_permissions AS (
      INSERT INTO resource_permissions (user_id, tenant_id, resource, action, effect)
      SELECT target.id, ${input.tenantId}::uuid,
        desired.resource, desired.action, desired.effect
      FROM target
      CROSS JOIN desired_permissions desired
      WHERE NOT EXISTS (
        SELECT 1
        FROM resource_permissions existing_permission
        WHERE existing_permission.user_id = target.id
          AND existing_permission.tenant_id IS NOT DISTINCT FROM ${input.tenantId}::uuid
          AND existing_permission.resource = desired.resource
          AND existing_permission.action = desired.action
          AND existing_permission.effect = desired.effect
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    ),
    revoked_sessions AS (
      UPDATE auth_sessions session
      SET revoked_at = now(), last_seen_at = now()
      FROM target
      WHERE session.user_id = target.id
        AND session.revoked_at IS NULL
      RETURNING session.id
    ),
    audit_write AS (
      INSERT INTO audit_logs (
        actor_id, tenant_id, action, resource_type, resource_id,
        before_hash, after_hash, ip_address, user_agent, request_id
      )
      SELECT
        ${input.actorUserId}::uuid,
        ${input.tenantId}::uuid,
        'admin_user_permission_overrides_replaced',
        'admin_user',
        target.id::text,
        encode(digest(jsonb_build_object(
          'role', target.role,
          'overrides', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'effect', previous.effect,
                'permission', CASE
                  WHEN previous.resource = '*' AND previous.action = '*' THEN '*'
                  ELSE previous.resource || ':' || previous.action
                END
              ) ORDER BY previous.effect, previous.resource, previous.action
            )
            FROM previous_permissions previous
          ), '[]'::jsonb)
        )::text, 'sha256'), 'hex'),
        encode(digest(jsonb_build_object(
          'role', target.role,
          'allow', ${JSON.stringify(input.allowPermissions)}::jsonb,
          'deny', ${JSON.stringify(input.deniedPermissions)}::jsonb
        )::text, 'sha256'), 'hex'),
        ${input.ipAddress}::inet,
        NULLIF(left(${input.userAgent}, 512), ''),
        NULLIF(left(${input.requestId}, 160), '')
      FROM target
      RETURNING id
    )
    SELECT target.id,
      (SELECT count(*) FROM deleted_permissions) AS deleted_permission_count,
      (SELECT count(*) FROM inserted_permissions) AS inserted_permission_count,
      (SELECT count(*) FROM revoked_sessions) AS revoked_session_count,
      (SELECT count(*) FROM audit_write) AS audit_count
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
