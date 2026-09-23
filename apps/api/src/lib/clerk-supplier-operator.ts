import { getAuthUserByEmail, type AuthUser } from './iam';

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;
type Result =
  | { kind: 'unmanaged' }
  | { kind: 'denied'; status: 403 | 503; reason: string }
  | { kind: 'operator'; user: AuthUser };

/** Call only with the primary email returned by verified Clerk identity resolution.
 * No provisioning here: a disabled or ambiguous operator never falls through to
 * the separate founder allowlist, even when that email is also allowlisted.
 */
export async function resolveClerkSupplierOperator(
  sql: Sql,
  verifiedEmail: string,
  loadUser: typeof getAuthUserByEmail = getAuthUserByEmail,
): Promise<Result> {
  const rows = await sql`
    SELECT u.id
    FROM users u
    WHERE lower(u.email) = ${verifiedEmail}
      AND EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.user_id = u.id AND m.role::text = 'supplier_operator'
      )
    LIMIT 2
  `;
  if (!rows.length) return { kind: 'unmanaged' };
  if (rows.length !== 1) return { kind: 'denied', status: 403, reason: 'clerk_operator_access_denied' };
  const user = await loadUser(sql, verifiedEmail);
  if (!user || user.id !== rows[0].id || user.email.toLowerCase() !== verifiedEmail
    || user.admin_status !== 'active' || user.role !== 'supplier_operator' || user.tenant_id !== null) {
    return { kind: 'denied', status: 403, reason: 'clerk_operator_access_denied' };
  }
  if (user.mfa_enabled) {
    return { kind: 'denied', status: 503, reason: 'mfa_login_temporarily_unavailable' };
  }
  return { kind: 'operator', user };
}
