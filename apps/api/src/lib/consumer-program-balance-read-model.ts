import { sql, type SqlExecutor } from "./db";

type BalanceReason = "membership_inactive" | "no_current_program" | "ambiguous_current_program" | "program_member_unavailable" | "ambiguous_program_member" | "program_member_inactive" | "invalid_balance";

function integer(value: unknown): number | null {
  const candidate = typeof value === "number" ? value
    : typeof value === "string" && /^(?:0|[1-9]\d*)$/.test(value) ? Number(value) : null;
  return candidate !== null && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null;
}

export function consumerProgramBalance(row: Record<string, unknown>) {
  const programCount = integer(row.current_program_count);
  const memberCount = integer(row.program_member_count);
  const balance = integer(row.program_points_balance);
  const lifetime = integer(row.program_lifetime_points);
  let reason: BalanceReason | null = null;
  if (row.status !== "active") reason = "membership_inactive";
  else if (programCount === 0) reason = "no_current_program";
  else if (programCount !== 1 || typeof row.current_program_id !== "string" || !row.current_program_id) reason = "ambiguous_current_program";
  else if (memberCount === 0) reason = "program_member_unavailable";
  else if (memberCount !== 1) reason = "ambiguous_program_member";
  else if (row.program_member_active !== true) reason = "program_member_inactive";
  else if (balance === null || lifetime === null || lifetime < balance) reason = "invalid_balance";
  return {
    points_balance: reason ? null : balance,
    lifetime_points: reason ? null : lifetime,
    balance_status: reason ? "unavailable" as const : "ready" as const,
    balance_reason: reason,
    points_source: "loyalty_members" as const,
    points_program_id: programCount === 1 && typeof row.current_program_id === "string" ? row.current_program_id : null,
  };
}

/** One current, authorized program balance per own brand. Membership balances
 * are a write-side projection and can lag redemptions/refunds. Never use them
 * as a fallback, sum currencies across programs, or infer zero from absence. */
export async function getPrivateConsumerProgramBalances(consumerId: string, executor: SqlExecutor = sql) {
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(consumerId)) throw new Error("invalid_consumer_id");
  const rows = await executor/*sql*/`
    SELECT t.id AS tenant_id, t.slug, t.name, m.status, m.joined_at,
      m.consumer_id AS owner_consumer_id,
      current_program.program_count AS current_program_count,
      current_program.program_id AS current_program_id,
      member.member_count AS program_member_count,
      member.active AS program_member_active,
      member.points_balance AS program_points_balance,
      member.lifetime_points AS program_lifetime_points,
      COALESCE((SELECT jsonb_object_agg(scope, granted)
        FROM consumer_tenant_consents consent
        WHERE consent.tenant_id = m.tenant_id AND consent.consumer_id = ${consumerId}::uuid), '{}'::jsonb) AS consents
    FROM tenant_consumer_memberships m
    JOIN tenants t ON t.id = m.tenant_id
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS program_count,
        (array_agg(program.id ORDER BY program.id))[1] AS program_id
      FROM loyalty_programs program
      WHERE program.tenant_id = m.tenant_id
        AND program.status = 'active'
        AND program.start_at <= statement_timestamp()
        AND (program.end_at IS NULL OR program.end_at > statement_timestamp())
    ) current_program ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS member_count,
        min(lm.points_balance) AS points_balance,
        min(lm.lifetime_points) AS lifetime_points,
        bool_and(lm.status IN ('enrolled', 'verified')) AS active
      FROM loyalty_members lm
      WHERE current_program.program_count = 1
        AND lm.tenant_id = m.tenant_id
        AND lm.program_id = current_program.program_id
        AND lm.consumer_id = ${consumerId}::uuid
    ) member ON true
    WHERE m.consumer_id = ${consumerId}::uuid
    ORDER BY m.updated_at DESC, t.id ASC
  `;
  return rows.map(row => {
    if (String(row.owner_consumer_id || "").toLowerCase() !== consumerId.toLowerCase()) throw new Error("consumer_balance_scope_mismatch");
    return {
      tenant_id: row.tenant_id, slug: row.slug, name: row.name, status: row.status,
      joined_at: row.joined_at, consents: row.consents,
      ...consumerProgramBalance(row),
    };
  });
}
