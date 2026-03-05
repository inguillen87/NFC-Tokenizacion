import { neon } from "@neondatabase/serverless";
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1|\.local/.test(url);
if (!isLocal && process.env.FORCE_DB_RESET !== "1") {
  console.error("Refusing reset on non-local DB. Set FORCE_DB_RESET=1 to override intentionally.");
  process.exit(1);
}

const sql = neon(url);
await sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
console.log("Local schema reset done.");

spawnSync("node", ["scripts/db-apply.mjs"], { stdio: "inherit", env: process.env });
spawnSync("node", ["scripts/db-seed-dev.mjs"], { stdio: "inherit", env: process.env });
