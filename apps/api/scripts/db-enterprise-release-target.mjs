import { createHash } from "node:crypto";

import pg from "pg";

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const client = new pg.Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5_000,
  query_timeout: 15_000,
});

await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  const target = (await client.query(`SELECT
    current_database() AS database,
    current_user AS database_role,
    current_setting('neon.endpoint_id', true) AS endpoint_id,
    current_setting('transaction_read_only') AS transaction_read_only`)).rows[0];
  const ledger = (await client.query(`SELECT id, applied_at
    FROM schema_migrations
    ORDER BY applied_at DESC, id DESC
    LIMIT 8`)).rows;
  const releaseLedger = (await client.query(`SELECT id, applied_at
    FROM schema_migrations
    WHERE id >= '20260723193000_0050'
      AND id <= '20260730150000_0074_supplier_key_rotation_atomic.sql'
    ORDER BY id`)).rows;
  const identity = [target.endpoint_id, target.database, target.database_role].join("|");
  console.log(JSON.stringify({
    ok: true,
    provider: String(target.endpoint_id || "").startsWith("ep-") ? "neon" : "unknown",
    endpoint_id: target.endpoint_id || null,
    database: target.database,
    database_role: target.database_role,
    transaction_read_only: target.transaction_read_only,
    target_fingerprint: `sha256:${createHash("sha256").update(identity).digest("hex")}`,
    latest_migrations: ledger,
    release_migrations: releaseLedger,
  }));
  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
