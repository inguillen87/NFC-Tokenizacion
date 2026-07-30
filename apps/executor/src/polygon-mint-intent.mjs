import { createHash } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const POLYGON_MINT_INTENT_VERSION = "nexid-polygon-mint-intent-v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const CHIP_UID_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;
const INTENT_STORE_QUERY_TIMEOUT_MS = 2_500;
const REQUIRED_COLUMNS = Object.freeze([
  "id",
  "tenant_id",
  "lease_id",
  "lease_expires_at",
  "status",
  "network",
  "execution_class",
  "issuer_wallet",
  "asset_ref",
  "meta",
]);
const REQUIRED_TRIGGER_READ_TABLES = Object.freeze([
  "public.batches",
  "public.tags",
  "public.events",
  "public.supplier_sub_batches",
  "public.supplier_orders",
  "public.supplier_pack_purpose_decisions",
]);
const REQUIRED_TRIGGER_FUNCTIONS = Object.freeze([
  "public.nexid_effective_supplier_pack_purpose_v1(uuid)",
  "public.nexid_assert_supplier_order_commercial_release_v1(uuid)",
  "public.nexid_assert_supplier_commercial_release_v1(uuid)",
]);

let pool;

function databaseUrl() {
  return String(process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

function getPool() {
  if (!databaseUrl()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
    });
  }
  return pool;
}

function required(value, field) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`polygon_mint_intent_${field}_required`);
  return normalized;
}

function canonicalUuid(value, field) {
  const normalized = required(value, field).toLowerCase();
  if (!UUID_PATTERN.test(normalized)) throw new Error(`polygon_mint_intent_${field}_invalid`);
  return normalized;
}

function normalizePolygonMintIntent(body) {
  const requestId = canonicalUuid(body?.request_id, "request_id");
  const tenantId = canonicalUuid(body?.tenant_id, "tenant_id");
  const leaseId = canonicalUuid(body?.lease_id, "lease_id");
  const network = required(body?.network, "network").toLowerCase();
  const executionClass = required(body?.execution_class, "execution_class").toLowerCase();
  const commercialDisposition = required(body?.commercial_disposition, "commercial_disposition").toUpperCase();
  const issuerWallet = required(body?.issuer_wallet, "issuer_wallet").toLowerCase();
  const chipUidHash = required(body?.chip_uid_hash, "chip_uid_hash").toLowerCase();
  const tokenUri = required(body?.token_uri, "token_uri");
  const assetRef = required(body?.asset_ref, "asset_ref");
  const intentDigest = required(body?.intent_digest, "intent_digest").toLowerCase();

  if (!ADDRESS_PATTERN.test(issuerWallet)) throw new Error("polygon_mint_intent_issuer_wallet_invalid");
  if (!CHIP_UID_HASH_PATTERN.test(chipUidHash)) throw new Error("polygon_mint_intent_chip_uid_hash_invalid");
  if (!DIGEST_PATTERN.test(intentDigest)) throw new Error("polygon_mint_intent_intent_digest_invalid");
  if (tokenUri.length > 2_048) throw new Error("polygon_mint_intent_token_uri_invalid");
  if (assetRef.length > 512) throw new Error("polygon_mint_intent_asset_ref_invalid");

  let parsedTokenUri;
  try {
    parsedTokenUri = new URL(tokenUri);
  } catch {
    throw new Error("polygon_mint_intent_token_uri_invalid");
  }
  if (parsedTokenUri.protocol !== "https:" || parsedTokenUri.username || parsedTokenUri.password || parsedTokenUri.hash) {
    throw new Error("polygon_mint_intent_token_uri_invalid");
  }

  const expectedDisposition = executionClass === "testnet_trial" && network === "polygon-amoy"
    ? "NON_SELLABLE"
    : executionClass === "live_chain" && network === "polygon"
      ? "COMMERCIAL_RELEASE"
      : null;
  if (!expectedDisposition || commercialDisposition !== expectedDisposition) {
    throw new Error("polygon_mint_intent_execution_scope_invalid");
  }

  return {
    requestId,
    tenantId,
    leaseId,
    network,
    executionClass,
    commercialDisposition,
    issuerWallet,
    chipUidHash,
    tokenUri,
    assetRef,
    intentDigest,
  };
}

function buildPolygonMintIntentDigest(input) {
  const canonical = [
    POLYGON_MINT_INTENT_VERSION,
    required(input.requestId, "request_id").toLowerCase(),
    required(input.tenantId, "tenant_id").toLowerCase(),
    required(input.leaseId, "lease_id").toLowerCase(),
    required(input.network, "network").toLowerCase(),
    required(input.executionClass, "execution_class").toLowerCase(),
    required(input.commercialDisposition, "commercial_disposition").toUpperCase(),
    required(input.issuerWallet, "issuer_wallet").toLowerCase(),
    required(input.chipUidHash, "chip_uid_hash").toLowerCase(),
    required(input.tokenUri, "token_uri"),
    required(input.assetRef, "asset_ref"),
  ];
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

function assertExactRowBinding(row, input) {
  const rowLeaseId = String(row?.lease_id || "").toLowerCase();
  const rowNetwork = String(row?.network || "").trim().toLowerCase();
  const rowExecutionClass = String(row?.execution_class || "").trim().toLowerCase();
  const rowIssuerWallet = String(row?.issuer_wallet || "").trim().toLowerCase();
  const rowAssetRef = String(row?.asset_ref || "");
  const rowCommercialDisposition = String(row?.commercial_disposition || "").trim().toUpperCase();
  const rowIntentVersion = String(row?.dispatch_intent_version || "");
  const rowIntentDigest = String(row?.dispatch_intent_digest || "").toLowerCase();
  const rowIntentLeaseId = String(row?.dispatch_intent_lease_id || "").toLowerCase();

  if (
    rowLeaseId !== input.leaseId
    || rowNetwork !== input.network
    || rowExecutionClass !== input.executionClass
    || rowIssuerWallet !== input.issuerWallet
    || rowAssetRef !== input.assetRef
    || rowCommercialDisposition !== input.commercialDisposition
    || rowIntentVersion !== POLYGON_MINT_INTENT_VERSION
    || rowIntentDigest !== input.intentDigest
    || rowIntentLeaseId !== input.leaseId
  ) {
    throw new Error("polygon_mint_intent_binding_mismatch");
  }
}

async function withTransaction(database, operation) {
  const owner = typeof database.connect === "function" ? await database.connect() : database;
  if (!owner || typeof owner.query !== "function") throw new Error("polygon_mint_intent_store_unavailable");
  const shouldRelease = owner !== database && typeof owner.release === "function";
  let began = false;
  try {
    await owner.query("BEGIN");
    began = true;
    const result = await operation(owner);
    await owner.query("COMMIT");
    began = false;
    return result;
  } catch (error) {
    if (began) await owner.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    if (shouldRelease) owner.release();
  }
}

async function reservePolygonMintIntent(body, options = {}) {
  const input = normalizePolygonMintIntent(body);
  const computedDigest = buildPolygonMintIntentDigest(input);
  if (computedDigest !== input.intentDigest) throw new Error("polygon_mint_intent_digest_mismatch");

  const database = options.database || getPool();
  if (!database) throw new Error("polygon_mint_intent_store_unavailable");

  try {
    return await withTransaction(database, async (client) => {
      const selected = await client.query({
        text: `
          SELECT
            id::text,
            tenant_id::text,
            lease_id::text,
            lease_expires_at > now() AS lease_valid,
            status,
            network,
            execution_class,
            issuer_wallet,
            asset_ref,
            COALESCE(meta, '{}'::jsonb)->>'commercial_disposition' AS commercial_disposition,
            COALESCE(meta, '{}'::jsonb)->>'dispatch_intent_version' AS dispatch_intent_version,
            COALESCE(meta, '{}'::jsonb)->>'dispatch_intent_digest' AS dispatch_intent_digest,
            COALESCE(meta, '{}'::jsonb)->>'dispatch_intent_lease_id' AS dispatch_intent_lease_id,
            COALESCE(meta, '{}'::jsonb)->>'dispatch_started_at' AS dispatch_started_at
          FROM tokenization_requests
          WHERE id = $1::uuid
            AND tenant_id = $2::uuid
          FOR UPDATE
        `,
        values: [input.requestId, input.tenantId],
        query_timeout: INTENT_STORE_QUERY_TIMEOUT_MS,
      });
      const row = selected.rows?.[0];
      if (!row) throw new Error("polygon_mint_intent_not_found");
      assertExactRowBinding(row, input);

      const status = String(row.status || "").toLowerCase();
      if (row.dispatch_started_at) {
        if (!new Set(["processing", "reconciling"]).has(status)) {
          throw new Error("polygon_mint_intent_replay_forbidden");
        }
        return { mode: "reconcile", input };
      }
      if (status !== "processing" || row.lease_valid !== true) {
        throw new Error("polygon_mint_intent_not_dispatchable");
      }

      const reserved = await client.query({
        text: `
          UPDATE tokenization_requests
          SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
            'dispatch_started_at', now(),
            'dispatch_intent_version', $4::text,
            'dispatch_intent_digest', $5::text,
            'dispatch_intent_lease_id', $3::text
          )
          WHERE id = $1::uuid
            AND tenant_id = $2::uuid
            AND lease_id = $3::uuid
            AND status = 'processing'
            AND lease_expires_at > now()
            AND network = $6::text
            AND execution_class = $7::text
            AND lower(issuer_wallet) = $8::text
            AND asset_ref = $9::text
            AND COALESCE(meta, '{}'::jsonb)->>'commercial_disposition' = $10::text
            AND COALESCE(meta, '{}'::jsonb)->>'dispatch_intent_version' = $4::text
            AND COALESCE(meta, '{}'::jsonb)->>'dispatch_intent_digest' = $5::text
            AND COALESCE(meta, '{}'::jsonb)->>'dispatch_intent_lease_id' = $3::text
            AND NOT (COALESCE(meta, '{}'::jsonb) ? 'dispatch_started_at')
          RETURNING id::text
        `,
        values: [
          input.requestId,
          input.tenantId,
          input.leaseId,
          POLYGON_MINT_INTENT_VERSION,
          input.intentDigest,
          input.network,
          input.executionClass,
          input.issuerWallet,
          input.assetRef,
          input.commercialDisposition === "NON_SELLABLE" ? "NON_SELLABLE" : "commercial_release",
        ],
        query_timeout: INTENT_STORE_QUERY_TIMEOUT_MS,
      });
      if (!reserved.rows?.[0]?.id) throw new Error("polygon_mint_intent_reservation_conflict");
      return { mode: "dispatch", input };
    });
  } catch (error) {
    if (error instanceof Error && /^polygon_mint_intent_/.test(error.message)) throw error;
    throw new Error("polygon_mint_intent_store_unavailable");
  }
}

function unavailableStore(reason, overrides = {}) {
  return {
    ok: false,
    reason,
    checks: {
      connectivity: false,
      table: false,
      columns: false,
      privileges: false,
      trigger_dependencies: false,
      trigger_functions: false,
      ...overrides,
    },
  };
}

async function checkPolygonMintIntentStore(options = {}) {
  const database = options.database || getPool();
  if (!database) return unavailableStore("database_unavailable");
  try {
    const result = await database.query({
      text: `
        WITH target AS (
          SELECT c.oid
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = 'tokenization_requests'
            AND c.relkind IN ('r', 'p')
        ), column_check AS (
          SELECT count(DISTINCT a.attname)::integer AS matched
          FROM target t
          JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid
          WHERE a.attnum > 0
            AND NOT a.attisdropped
            AND a.attname = ANY($1::text[])
        )
        , dependency_check AS (
          SELECT bool_and(
            to_regclass(table_name) IS NOT NULL
            AND has_table_privilege(current_user, to_regclass(table_name), 'SELECT')
          ) AS ready
          FROM unnest($3::text[]) AS dependency(table_name)
        ), function_check AS (
          SELECT bool_and(
            to_regprocedure(function_name) IS NOT NULL
            AND has_function_privilege(current_user, to_regprocedure(function_name), 'EXECUTE')
          ) AS ready
          FROM unnest($4::text[]) AS dependency(function_name)
        )
        SELECT
          TRUE AS connected,
          EXISTS(SELECT 1 FROM target) AS table_present,
          COALESCE((SELECT matched = $2::integer FROM column_check), FALSE) AS columns_present,
          COALESCE((
            SELECT has_table_privilege(current_user, t.oid, 'SELECT')
              AND has_column_privilege(current_user, t.oid, 'meta', 'UPDATE')
            FROM target t
          ), FALSE) AS privileges_present,
          COALESCE((SELECT ready FROM dependency_check), FALSE) AS trigger_dependencies_present,
          COALESCE((SELECT ready FROM function_check), FALSE) AS trigger_functions_present
      `,
      values: [
        REQUIRED_COLUMNS,
        REQUIRED_COLUMNS.length,
        REQUIRED_TRIGGER_READ_TABLES,
        REQUIRED_TRIGGER_FUNCTIONS,
      ],
      query_timeout: INTENT_STORE_QUERY_TIMEOUT_MS,
    });
    const row = result.rows?.[0];
    if (!row) return unavailableStore("database_unavailable");
    const checks = {
      connectivity: row.connected === true,
      table: row.table_present === true,
      columns: row.columns_present === true,
      privileges: row.privileges_present === true,
      trigger_dependencies: row.trigger_dependencies_present === true,
      trigger_functions: row.trigger_functions_present === true,
    };
    return {
      ok: Object.values(checks).every(Boolean),
      reason: Object.values(checks).every(Boolean) ? null : "polygon_mint_intent_store_invalid",
      checks,
    };
  } catch {
    return unavailableStore("database_unavailable");
  }
}

export {
  POLYGON_MINT_INTENT_VERSION,
  buildPolygonMintIntentDigest,
  checkPolygonMintIntentStore,
  normalizePolygonMintIntent,
  reservePolygonMintIntent,
};
