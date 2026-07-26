import pg from "pg";
import { checkIotaDurableStore } from "../apps/executor/src/iota-idempotency.mjs";

const { Client } = pg;
const connectionString = String(process.env.DATABASE_URL || "").trim();
if (!connectionString) {
  console.error(JSON.stringify({ ok: false, gate: "iota_executor_db_readiness", reason: "database_url_required" }));
  process.exit(1);
}

const client = new Client({ connectionString, connectionTimeoutMillis: 5_000 });
try {
  await client.connect();
  const readiness = await checkIotaDurableStore({ database: client, cache: false });
  console.log(JSON.stringify({
    ok: readiness.ok,
    gate: "iota_executor_db_readiness",
    reason: readiness.reason,
    checks: readiness.checks,
  }));
  process.exitCode = readiness.ok ? 0 : 1;
} catch {
  console.error(JSON.stringify({
    ok: false,
    gate: "iota_executor_db_readiness",
    reason: "database_unavailable",
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
