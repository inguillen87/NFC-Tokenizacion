import { sql } from "./db";

export async function hitSunRateLimit(scope: string, scopeKey: string, windowSeconds: number, maxHits: number) {
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
}
