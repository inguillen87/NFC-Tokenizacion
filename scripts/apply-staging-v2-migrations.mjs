import { spawn } from "node:child_process";

const approved = String(process.env.STAGING_MIGRATION_APPROVED || "").trim();
const envName = String(process.env.NODE_ENV || "").toLowerCase();
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const files = [
  "20260723193000_0050_evidence_anchor_reconciling_status.sql",
  "20260723193500_0051_iota_evidence_anchor_v2_writer.sql",
  "20260723194500_0052_webhook_delivery_outbox.sql",
  "20260723200500_0053_admin_login_abuse_guard.sql",
  "20260723213000_0054_iota_executor_publications.sql",
  "20260724213000_0055_iota_executor_durable_broadcast.sql",
];

if (approved !== "YES") throw new Error("staging_migration_confirmation_required");
if (envName === "production") throw new Error("production_migration_blocked");
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
if (/production|prod[-_.]/i.test(databaseUrl)) throw new Error("production_database_url_blocked");

const safety = await new Promise((resolve) => {
  const child = spawn(process.execPath, ["scripts/check-migration-safety.mjs"], { stdio: "inherit", env: process.env });
  child.on("close", (value) => resolve(value ?? 1));
});
if (safety !== 0) throw new Error("migration_safety_gate_failed");

for (const file of files) {
  const code = await new Promise((resolve) => {
    const child = spawn("npm.cmd", ["run", "db:migrate", "--workspace=api", "--", "--only", file], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (value) => resolve(value ?? 1));
  });
  if (code !== 0) throw new Error(`migration_failed:${file}`);
  console.log(JSON.stringify({ ok: true, migration: file, status: "applied" }));
}

console.log(JSON.stringify({ ok: true, gate: "staging_v2_migrations", migrations: files }));
