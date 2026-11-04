export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantAccess } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

function loyaltyOverviewSchemaUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as { code?: unknown; message?: unknown };
  return failure.code === "42P01" || failure.code === "42703"
    || failure.message === "required_schema_migration_not_applied"
    || failure.message === "required_schema_migration_id_invalid";
}
type LoyaltyOverview = {
  active_programs: number;
  total_members: number;
  points_issued: number;
  points_redeemed: number;
};

function confirmedOverview(rows: unknown): LoyaltyOverview | null {
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const row: unknown = rows[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const keys = ["active_programs", "total_members", "points_issued", "points_redeemed"] as const;
  if (Object.keys(row).length !== keys.length) return null;
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) return null;
    const value = record[key];
    // Every selected expression is PostgreSQL ::int (OID23). The existing
    // unconfigured Neon0.10.4 text parser returns a JavaScript number for int4.
    if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)
      || value < 0 || value > 2_147_483_647) return null;
  }
  return {
    active_programs: record.active_programs as number,
    total_members: record.total_members as number,
    points_issued: record.points_issued as number,
    points_redeemed: record.points_redeemed as number,
  };
}
function unavailableOverview(schemaUnavailable: boolean, retryable = !schemaUnavailable) {
  return json({
    ok: false,
    error: schemaUnavailable ? "loyalty_overview_schema_unavailable" : "loyalty_overview_unavailable",
    message: schemaUnavailable || !retryable
      ? "El resumen de fidelización necesita una revisión de NexID. Contactá a soporte."
      : "No pudimos cargar el resumen. Volvé a intentar; si continúa, contactá a soporte.",
    retryable,
  }, 503, { "cache-control": "no-store" });
}
export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "crm:read");
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const requestedTenant = searchParams.get("tenant");
  const { effectiveTenantSlug: tenant } = getAdminTenantAccess(req, requestedTenant);

  try {

  const rows = await sql/*sql*/`
    WITH active_programs AS MATERIALIZED (
      SELECT program.id
      FROM loyalty_programs program
      JOIN tenants t ON t.id = program.tenant_id
      WHERE program.status = 'active'
        AND (${tenant} = '' OR t.slug = ${tenant})
    ),
    member_totals AS (
      SELECT member.program_id, COUNT(*)::int AS total_members
      FROM loyalty_members member
      JOIN active_programs program ON program.id = member.program_id
      GROUP BY member.program_id
    ),
    ledger_totals AS (
      SELECT ledger.program_id,
        COALESCE(SUM(ledger.delta) FILTER (WHERE ledger.delta > 0), 0)::int AS points_issued,
        (COALESCE(SUM(ledger.delta) FILTER (WHERE ledger.delta < 0), 0) * -1)::int AS points_redeemed
      FROM points_ledger ledger
      JOIN active_programs program ON program.id = ledger.program_id
      GROUP BY ledger.program_id
    )
    SELECT
      COUNT(program.id)::int AS active_programs,
      COALESCE(SUM(members.total_members), 0)::int AS total_members,
      COALESCE(SUM(points.points_issued), 0)::int AS points_issued,
      COALESCE(SUM(points.points_redeemed), 0)::int AS points_redeemed
    FROM active_programs program
    LEFT JOIN member_totals members ON members.program_id = program.id
    LEFT JOIN ledger_totals points ON points.program_id = program.id
  `;

  const overview = confirmedOverview(rows);
  if (!overview) return unavailableOverview(false, false);
  return json(overview);
  } catch (error) {
    return unavailableOverview(loyaltyOverviewSchemaUnavailable(error));
  }
}
