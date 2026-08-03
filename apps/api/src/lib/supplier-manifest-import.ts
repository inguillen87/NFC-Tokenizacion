import { sql, type SqlExecutor } from "./db";

export const SUPPLIER_MANIFEST_IMPORT_V2_BASE_MIGRATION =
  "20260802160000_0081_supplier_manifest_atomic_import.sql";
export const SUPPLIER_MANIFEST_IMPORT_V2_MIGRATION =
  "20260802270000_0092_supplier_carrier_scope_integrity.sql";

export type AtomicManifestRow = {
  uidHex: string;
  carrierProfileCode: string;
  profile: {
    sku: string | null;
    product_name: string | null;
    notes: string | null;
    image_url: string | null;
    locale_data: Record<string, unknown>;
  } | null;
  sunPayload: {
    raw_url_hash: string;
    picc_data_hash: string;
    enc_hash: string;
    cmac_hash: string;
  } | null;
};

export type AtomicManifestImportInput = {
  tenantId: string;
  batchId: string;
  bid: string;
  carrierProfileCode: string;
  manifestType: "csv" | "txt";
  contentHash: string;
  activateImported: boolean;
  supplierOrderId: string | null;
  supplierSubBatchId: string | null;
  expectedQuantity: number | null;
  quantityOverride: { reason: string } | null;
  actorId: string;
  authSessionId: string;
  requestId: string | null;
  userAgent: string | null;
  rows: AtomicManifestRow[];
};

export type AtomicManifestImportResult = {
  manifestId: string;
  inserted: number;
  reactivated: number;
  registeredSunPayloads: number;
  evidenceEventHashes: string[];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** Rolling-safe: this capability probe uses PostgreSQL catalog lookups only. */
export async function hasSupplierManifestImportV2(query: SqlExecutor = sql) {
  const rows = await query/*sql*/`
    SELECT
      to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_manifest_import_v2_capability()') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_carrier_scope_integrity_v1_capability()') IS NOT NULL
      AND to_regclass('public.uq_tags_uid_hex_global') IS NOT NULL
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)'),
        'EXECUTE'
      ), false)
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_supplier_manifest_import_v2_capability()'),
        'EXECUTE'
      ), false)
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_supplier_carrier_scope_integrity_v1_capability()'),
        'EXECUTE'
      ), false) AS available
  `;
  return rows[0]?.available === true;
}

export async function importTagManifestV2(
  input: AtomicManifestImportInput,
  query: SqlExecutor = sql,
): Promise<AtomicManifestImportResult> {
  const payload = {
    tenant_id: input.tenantId,
    batch_id: input.batchId,
    bid: input.bid,
    carrier_profile_code: input.carrierProfileCode,
    manifest_type: input.manifestType,
    content_hash: input.contentHash,
    activate_imported: input.activateImported,
    supplier_order_id: input.supplierOrderId,
    supplier_sub_batch_id: input.supplierSubBatchId,
    expected_quantity: input.expectedQuantity,
    quantity_override: input.quantityOverride,
    actor_id: input.actorId,
    auth_session_id: input.authSessionId,
    request_id: input.requestId,
    user_agent: input.userAgent,
    rows: input.rows.map((row) => ({
      uid_hex: row.uidHex,
      carrier_profile_code: row.carrierProfileCode,
      profile: row.profile,
      sun_payload: row.sunPayload,
    })),
  };
  const rows = await query/*sql*/`
    SELECT *
    FROM public.nexid_import_tag_manifest_v2(${JSON.stringify(payload)}::jsonb)
  `;
  if (rows.length !== 1) throw new Error("supplier_manifest_import_readback_missing");
  const row = rows[0];
  const result: AtomicManifestImportResult = {
    manifestId: String(row.manifest_id || "").toLowerCase(),
    inserted: Number(row.inserted_count || 0),
    reactivated: Number(row.reactivated_count || 0),
    registeredSunPayloads: Number(row.registered_sun_payload_count || 0),
    evidenceEventHashes: Array.isArray(row.evidence_event_hashes)
      ? row.evidence_event_hashes.map((value) => String(value || "").toLowerCase())
      : [],
  };
  const supplierEvidenceExpected = input.supplierSubBatchId ? 2 : 0;
  const expectedSunPayloadCount = input.rows.filter((item) => item.sunPayload !== null).length;
  if (
    !UUID_PATTERN.test(result.manifestId)
    || !Number.isInteger(result.inserted) || result.inserted < 0 || result.inserted > input.rows.length
    || !Number.isInteger(result.reactivated) || result.reactivated < 0 || result.reactivated > input.rows.length
    || !Number.isInteger(result.registeredSunPayloads)
    || result.registeredSunPayloads !== expectedSunPayloadCount
    || result.evidenceEventHashes.length !== supplierEvidenceExpected
    || new Set(result.evidenceEventHashes).size !== supplierEvidenceExpected
    || result.evidenceEventHashes.some((hash) => !SHA256_PATTERN.test(hash))
  ) {
    throw new Error("supplier_manifest_import_readback_invalid");
  }
  return result;
}

const BAD_INPUT_REASONS = [
  "supplier_manifest_activation_flag_invalid",
  "supplier_manifest_contract_invalid",
  "supplier_manifest_expected_quantity_mismatch",
  "supplier_manifest_input_invalid",
  "supplier_manifest_identity_invalid",
  "supplier_manifest_non_supplier_scope_invalid",
  "supplier_manifest_profile_invalid",
  "supplier_manifest_quantity_override_not_applicable",
  "supplier_manifest_quantity_override_reason_required",
  "supplier_manifest_row_count_invalid",
  "supplier_manifest_row_invalid",
  "supplier_manifest_row_projection_invalid",
  "supplier_manifest_sun_payload_duplicate",
  "supplier_manifest_uid_duplicate",
];

const CONFLICT_REASONS = [
  "supplier_manifest_activation_requires_qa",
  "supplier_manifest_batch_state_changed",
  "supplier_manifest_batch_state_invalid",
  "supplier_manifest_carrier_mismatch",
  "supplier_manifest_global_uid_duplicate",
  "supplier_manifest_immutable",
  "supplier_manifest_state_ineligible",
  "supplier_manifest_sub_batch_state_changed",
  "supplier_manifest_sun_binding_conflict",
];

export function supplierManifestImportError(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "").trim();
  const message = error instanceof Error ? error.message : String(error || "");
  const badInput = BAD_INPUT_REASONS.find((reason) => message.includes(reason));
  if (badInput) return { status: 400, reason: badInput };
  const conflict = CONFLICT_REASONS.find((reason) => message.includes(reason));
  if (conflict) return { status: 409, reason: conflict };
  if (message.includes("supplier_manifest_quantity_override_forbidden")) {
    return { status: 403, reason: "supplier_manifest_quantity_override_forbidden" };
  }
  if (message.includes("supplier_manifest_actor_scope_invalid") || message.includes("supplier_manifest_supplier_scope_mismatch")) {
    return { status: 403, reason: "supplier_manifest_scope_forbidden" };
  }
  if (message.includes("supplier_manifest_batch_not_found") || message.includes("supplier_manifest_sub_batch_not_found") || code === "P0002") {
    return { status: 404, reason: "supplier_manifest_scope_not_found" };
  }
  if (code === "23505") return { status: 409, reason: "supplier_manifest_global_uid_duplicate" };
  if (
    code === "42P01"
    || code === "42703"
    || code === "42883"
    || message.includes("nexid_import_tag_manifest_v2")
    || message.includes("nexid_supplier_manifest_import_v2_capability")
    || message.includes("nexid_supplier_carrier_scope_integrity_v1_capability")
  ) {
    return {
      status: 503,
      reason: "supplier_manifest_import_v2_migration_required",
      requiredMigration: SUPPLIER_MANIFEST_IMPORT_V2_MIGRATION,
    };
  }
  if (code === "42501") return { status: 503, reason: "supplier_manifest_import_v2_runtime_grant_required" };
  return { status: 503, reason: "supplier_manifest_import_v2_unavailable" };
}
