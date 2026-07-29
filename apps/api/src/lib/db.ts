import { neon } from "@neondatabase/serverless";

export const DEFAULT_REQUIRED_SCHEMA_MIGRATIONS = [
  "20260725230000_0057_sun_rate_limit_atomic_buckets.sql",
  "20260726103000_0058_webhook_signature_v2.sql",
  "20260726135000_0059_marketplace_claim_truth_cleanup.sql",
  "20260726173000_0060_sdk_idempotency_operations.sql",
  "20260726190000_0061_supplier_export_artifact_delivery.sql",
  "20260728120000_0062_sun_atomic_persistence.sql",
  "20260728143000_0063_supplier_packaging_governance.sql",
] as const;
export const DEFAULT_REQUIRED_SCHEMA_MIGRATION = DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.at(-1)!;

let productionWatermarkCheck: Promise<void> | null = null;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(url);
}

function stripSqlLiteralsAndComments(statement: string) {
  let output = "";
  let index = 0;
  while (index < statement.length) {
    const char = statement[index];
    const next = statement[index + 1];
    if (char === "-" && next === "-") {
      index += 2;
      while (index < statement.length && statement[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      let depth = 1;
      while (index < statement.length && depth > 0) {
        if (statement[index] === "/" && statement[index + 1] === "*") {
          depth += 1;
          index += 2;
        } else if (statement[index] === "*" && statement[index + 1] === "/") {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      output += " ";
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      index += 1;
      while (index < statement.length) {
        if (statement[index] === quote && statement[index + 1] === quote) {
          index += 2;
        } else if (statement[index] === quote) {
          index += 1;
          break;
        } else {
          index += 1;
        }
      }
      output += " ";
      continue;
    }
    if (char === "$") {
      const tag = statement.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
      if (tag) {
        const end = statement.indexOf(tag, index + tag.length);
        index = end < 0 ? statement.length : end + tag.length;
        output += " ";
        continue;
      }
    }
    output += char;
    index += 1;
  }
  return output;
}

export function isRuntimeDdlStatement(statement: string) {
  const structuralSql = stripSqlLiteralsAndComments(statement);
  return structuralSql
    .split(";")
    .some((part) => /^\s*(?:CREATE|ALTER|DROP|TRUNCATE|COMMENT|GRANT|REVOKE|DO|CALL|VACUUM|REINDEX|CLUSTER|ANALYZE|REFRESH\s+MATERIALIZED\s+VIEW)\b/i.test(part));
}

function isProductionRuntime() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

async function requireProductionSchemaWatermark() {
  if (!isProductionRuntime()) return;
  if (!productionWatermarkCheck) {
    productionWatermarkCheck = (async () => {
      const configured = [
        String(process.env.NEXID_REQUIRED_SCHEMA_MIGRATIONS || ""),
        String(process.env.NEXID_REQUIRED_SCHEMA_MIGRATION || ""),
      ]
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);
      const required = [...new Set([...DEFAULT_REQUIRED_SCHEMA_MIGRATIONS, ...configured])].sort();
      if (required.some((id) => !/^\d{14}_\d{4}_[a-z0-9_]+\.sql$/.test(id))) {
        throw new Error("required_schema_migration_id_invalid");
      }
      const query = getSql();
      const rows = await query/*sql*/`
        SELECT id
        FROM schema_migrations
        ORDER BY id ASC
      `;
      const applied = rows.map((row) => String(row.id || ""));
      const positions = required.map((id) => applied.indexOf(id));
      const ordered = positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1]));
      if (!ordered) {
        throw new Error("required_schema_migration_not_applied");
      }
    })().catch((error) => {
      productionWatermarkCheck = null;
      throw error;
    });
  }
  return productionWatermarkCheck;
}

export async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  const staticStatement = strings.join("?");
  if (isProductionRuntime() && isRuntimeDdlStatement(staticStatement)) {
    // Production schema ownership belongs exclusively to the migration runner.
    // Existing ensure*Schema calls become no-op compatibility guards rather
    // than request-path DDL. The first business query verifies the watermark.
    return [];
  }
  await requireProductionSchemaWatermark();
  return getSql()(strings, ...values);
}
