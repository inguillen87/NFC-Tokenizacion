import { sql, type SqlExecutor } from "./db";
import { AdminRewardError, adjustedAdminRewardStock, type AdminRewardCommand } from "./admin-reward-policy";

/** Programs are persisted tenant configuration. Catalog edits never create,
 * activate or move a program, including when its current status is paused. */
export async function saveAdminReward(tenantId: string, command: AdminRewardCommand, execute: SqlExecutor = sql) {
  const candidates = command.rewardId
    ? await execute`SELECT reward.id, reward.program_id
        FROM rewards reward JOIN loyalty_programs program ON program.id = reward.program_id AND program.tenant_id = reward.tenant_id
        WHERE reward.tenant_id = ${tenantId}::uuid AND reward.id = ${command.rewardId}::uuid
          AND reward.program_id = ${command.programId}::uuid AND reward.code = ${command.code} LIMIT 2`
    : await execute`SELECT reward.id, reward.program_id
        FROM rewards reward JOIN loyalty_programs program ON program.id = reward.program_id AND program.tenant_id = reward.tenant_id
        WHERE reward.tenant_id = ${tenantId}::uuid AND reward.code = ${command.code}
          AND (${command.programId || null}::uuid IS NULL OR reward.program_id = ${command.programId || null}::uuid) LIMIT 2`;
  if (candidates.length > 1) throw new AdminRewardError("reward_program_ambiguous", 409);
  if (command.rewardId && candidates.length !== 1) throw new AdminRewardError("reward_not_found", 404);

  const existing = candidates[0];
  if (existing) {
    // UPDATE evaluates the delta against the row version locked by PostgreSQL,
    // including any redemption committed while the request was in flight.
    // A legacy stock_remaining value is validated but never applied to edits.
    const rows = await execute`UPDATE rewards reward SET
      title = ${command.title}, description = COALESCE(${command.description ?? null}, reward.description),
      type = COALESCE(${command.type ?? null}::reward_type, reward.type),
      status = COALESCE(${command.status ?? null}, reward.status),
      points_cost = COALESCE(${command.pointsCost ?? null}::integer, reward.points_cost),
      stock_total = COALESCE(${command.stockTotal ?? null}::integer, reward.stock_total),
      stock_remaining = CASE WHEN ${command.stockTotal ?? null}::integer IS NULL THEN reward.stock_remaining
        ELSE reward.stock_remaining + (${command.stockTotal ?? null}::integer - reward.stock_total) END,
      image_url = CASE WHEN ${command.imageUrl !== undefined} THEN ${command.imageUrl || null} ELSE reward.image_url END,
      requires_age_gate = COALESCE(${command.requiresAgeGate ?? null}::boolean, reward.requires_age_gate),
      network_visible = COALESCE(${command.networkVisible ?? null}::boolean, reward.network_visible), updated_at = now()
      FROM loyalty_programs program
      WHERE reward.id = ${existing.id}::uuid AND reward.tenant_id = ${tenantId}::uuid
        AND reward.program_id = ${existing.program_id}::uuid AND reward.code = ${command.code}
        AND program.id = reward.program_id AND program.tenant_id = reward.tenant_id
        AND (${command.stockTotal ?? null}::integer IS NULL OR (
          reward.stock_total IS NOT NULL AND reward.stock_remaining IS NOT NULL
          AND reward.stock_total >= 0 AND reward.stock_remaining >= 0 AND reward.stock_remaining <= reward.stock_total
          AND ${command.stockTotal ?? null}::integer >= reward.stock_total - reward.stock_remaining))
      RETURNING reward.*`;
    if (rows.length === 1) return rows[0];
    const current = (await execute`SELECT stock_total, stock_remaining FROM rewards
      WHERE id = ${existing.id}::uuid AND tenant_id = ${tenantId}::uuid AND program_id = ${existing.program_id}::uuid`)[0];
    if (current && command.stockTotal !== undefined) adjustedAdminRewardStock(current.stock_total, current.stock_remaining, command.stockTotal);
    throw new AdminRewardError("reward_update_conflict", 409);
  }

  const programs = command.programId
    ? await execute`SELECT id FROM loyalty_programs WHERE tenant_id = ${tenantId}::uuid AND id = ${command.programId}::uuid LIMIT 1`
    : await execute`SELECT id FROM loyalty_programs WHERE tenant_id = ${tenantId}::uuid ORDER BY created_at DESC, id DESC LIMIT 1`;
  if (!programs[0]) throw new AdminRewardError("loyalty_program_not_found", 409);
  const stockTotal = command.stockTotal ?? 100;
  const rows = await execute`INSERT INTO rewards (
    tenant_id, program_id, code, title, description, type, status,
    points_cost, stock_total, stock_remaining, image_url, requires_age_gate, network_visible)
    SELECT program.tenant_id, program.id, ${command.code}, ${command.title}, ${command.description ?? ""},
      ${command.type ?? "EXPERIENCE"}::reward_type, ${command.status ?? "active"}, ${command.pointsCost ?? 0},
      ${stockTotal}, ${command.stockRemaining ?? stockTotal}, ${command.imageUrl || null},
      ${command.requiresAgeGate ?? false}, ${command.networkVisible ?? true}
    FROM loyalty_programs program WHERE program.id = ${programs[0].id}::uuid AND program.tenant_id = ${tenantId}::uuid
    ON CONFLICT (program_id, code) DO NOTHING RETURNING *`;
  if (rows.length !== 1) throw new AdminRewardError("reward_create_conflict", 409);
  return rows[0];
}
