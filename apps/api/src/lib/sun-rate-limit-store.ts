import { sql } from "./db";
let ensuredTable = false;

async function ensureSunRateLimitTable() {
  if (ensuredTable) return;
  await sql/*sql*/`CREATE SEQUENCE IF NOT EXISTS sun_rate_limit_events_id_seq`;
  try {
    await sql/*sql*/`
      CREATE TABLE IF NOT EXISTS sun_rate_limit_events (
        id bigint PRIMARY KEY DEFAULT nextval('sun_rate_limit_events_id_seq'),
        scope text NOT NULL,
        scope_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code || "") : "";
    if (code !== "23505") throw error;
  }
  await sql/*sql*/`
    CREATE INDEX IF NOT EXISTS idx_sun_rate_limit_events_scope_time
      ON sun_rate_limit_events (scope, scope_key, created_at DESC)
  `;
  ensuredTable = true;
}

export async function hitSunRateLimit(scope: string, scopeKey: string, windowSeconds: number, maxHits: number): Promise<{ hits: number; limited: boolean; unavailable?: boolean }> {
  try {
    const rows = await sql/*sql*/`
      WITH ins AS (
        INSERT INTO sun_rate_limit_events (scope, scope_key)
        VALUES (${scope}, ${scopeKey})
        RETURNING 1
      )
      SELECT count(*)::int AS hits
      FROM sun_rate_limit_events
      WHERE scope = ${scope}
        AND scope_key = ${scopeKey}
        AND created_at >= now() - (${windowSeconds} || ' seconds')::interval
    `;
    const hits = Number(rows[0]?.hits || 0);
    return { hits, limited: hits > maxHits };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code || "") : "";
    if (code === "42P01") {
      console.warn("[sun_rate_limit_store_missing]", JSON.stringify({ scope, scopeKey }));
      try {
        await ensureSunRateLimitTable();
        const retry = await hitSunRateLimit(scope, scopeKey, windowSeconds, maxHits);
        return retry;
      } catch (repairError) {
        const repairCode = typeof repairError === "object" && repairError && "code" in repairError ? String((repairError as { code?: string }).code || "") : "";
        if (repairCode === "42P01") {
          return { hits: 0, limited: false, unavailable: true };
        }
        throw repairError;
      }
    }
    throw error;
  }
}
