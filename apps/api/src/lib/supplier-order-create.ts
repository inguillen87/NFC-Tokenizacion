import { sql, type SqlExecutor } from "./db";

export const SUPPLIER_ORDER_CREATE_V2_MIGRATION =
  "20260802150000_0079_supplier_order_atomic_create.sql";

type SupplierOrderCreateSubBatchBaseInput = {
  bid: string;
  sequenceIndex: number;
  expectedQuantity: number;
  urlTemplate: string;
  sdmConfig: Record<string, unknown>;
};

export type SupplierOrderCreateSubBatchInput = SupplierOrderCreateSubBatchBaseInput & (
  | {
      keyMaterialMode: "secure_sun";
      metaKeyCt: string;
      fileKeyCt: string;
      pairFingerprint: string;
      metaKeyFingerprint: string;
      fileKeyFingerprint: string;
    }
  | {
      keyMaterialMode: "none";
    }
);

export type SupplierOrderCreateInput = {
  supplierOrderId: string;
  tenantId: string;
  actorId: string;
  authSessionId: string;
  customerSlug: string;
  orderName: string;
  baseBatchId: string;
  totalQuantity: number;
  subBatchSize: number;
  chipModel: string;
  carrierProfileCode: string;
  packPurpose: "trial_integration" | "production";
  materialType: string | null;
  notes: string | null;
  requestId: string | null;
  userAgent: string | null;
  subBatches: SupplierOrderCreateSubBatchInput[];
  sourceRequestId?: string;
  sourceRequestRevision?: number;
};

export type SupplierOrderCreateResult = {
  order: Record<string, unknown>;
  subBatches: Array<{
    id: string;
    bid: string;
    batch_id: string;
    sequence_index: number;
    expected_quantity: number;
    key_fingerprint: string | null;
    url_template: string;
  }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^[0-9A-F]{16}$/;

/** Rolling-safe: the lookup only references PostgreSQL catalog objects. */
export async function hasSupplierOrderCreateV2(
  query: SqlExecutor = sql,
  options: { requireKeylessCarrierSupport?: boolean } = {},
) {
  const rows = await query/*sql*/`
    SELECT
      to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_order_create_v2_capability()') IS NOT NULL
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)'),
        'EXECUTE'
      ), false)
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_supplier_order_create_v2_capability()'),
        'EXECUTE'
      ), false) AS available,
      to_regprocedure('public.nexid_supplier_order_create_keyless_v1_capability()') IS NOT NULL
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_supplier_order_create_keyless_v1_capability()'),
        'EXECUTE'
      ), false) AS keyless_carrier_available
  `;
  return rows[0]?.available === true
    && (!options.requireKeylessCarrierSupport || rows[0]?.keyless_carrier_available === true);
}

export async function createSupplierOrderV2(
  input: SupplierOrderCreateInput,
  query: SqlExecutor = sql,
): Promise<SupplierOrderCreateResult> {
  const payload = {
    supplier_order_id: input.supplierOrderId,
    tenant_id: input.tenantId,
    actor_id: input.actorId,
    auth_session_id: input.authSessionId,
    customer_slug: input.customerSlug,
    order_name: input.orderName,
    base_batch_id: input.baseBatchId,
    total_quantity: input.totalQuantity,
    sub_batch_size: input.subBatchSize,
    chip_model: input.chipModel,
    carrier_profile_code: input.carrierProfileCode,
    pack_purpose: input.packPurpose,
    material_type: input.materialType,
    notes: input.notes,
    request_id: input.requestId,
    user_agent: input.userAgent,
    sub_batches: input.subBatches.map((item) => ({
      bid: item.bid,
      sequence_index: item.sequenceIndex,
      expected_quantity: item.expectedQuantity,
      key_material_mode: item.keyMaterialMode,
      ...(item.keyMaterialMode === "secure_sun" ? {
        meta_key_ct: item.metaKeyCt,
        file_key_ct: item.fileKeyCt,
        pair_fingerprint: item.pairFingerprint,
        meta_key_fingerprint: item.metaKeyFingerprint,
        file_key_fingerprint: item.fileKeyFingerprint,
      } : {}),
      url_template: item.urlTemplate,
      sdm_config: item.sdmConfig,
    })),
  };
  const rows = input.sourceRequestId ? await query/*sql*/`
    SELECT * FROM public.nexid_convert_supplier_request_v1(${input.sourceRequestId}::uuid, ${input.sourceRequestRevision}::integer, ${JSON.stringify(payload)}::jsonb)
  ` : await query/*sql*/`
    SELECT *
    FROM public.nexid_create_supplier_order_v2(${JSON.stringify(payload)}::jsonb)
  `;
  if (rows.length !== 1) throw new Error("supplier_order_create_readback_missing");
  const order = rows[0].supplier_order;
  const subBatches = rows[0].sub_batches;
  if (!order || typeof order !== "object" || Array.isArray(order) || !Array.isArray(subBatches)) {
    throw new Error("supplier_order_create_readback_invalid");
  }
  const orderRecord = order as Record<string, unknown>;
  const normalizedSubBatches = subBatches.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("supplier_order_create_readback_invalid");
    }
    const item = value as Record<string, unknown>;
    return {
      id: String(item.id || "").toLowerCase(),
      bid: String(item.bid || "").toUpperCase(),
      batch_id: String(item.batch_id || "").toLowerCase(),
      sequence_index: Number(item.sequence_index || 0),
      expected_quantity: Number(item.expected_quantity || 0),
      key_fingerprint: item.key_fingerprint == null
        ? null
        : String(item.key_fingerprint).toUpperCase(),
      url_template: String(item.url_template || ""),
    };
  });
  const expectedByBid = new Map(input.subBatches.map((item) => [item.bid.toUpperCase(), item]));
  const returnedBids = new Set(normalizedSubBatches.map((item) => item.bid));
  const returnedSubBatchIds = new Set(normalizedSubBatches.map((item) => item.id));
  const returnedBatchIds = new Set(normalizedSubBatches.map((item) => item.batch_id));
  const readbackValid =
    String(orderRecord.id || "").toLowerCase() === input.supplierOrderId.toLowerCase()
    && String(orderRecord.tenant_id || "").toLowerCase() === input.tenantId.toLowerCase()
    && String(orderRecord.pack_purpose || "") === input.packPurpose
    && normalizedSubBatches.length === input.subBatches.length
    && returnedBids.size === input.subBatches.length
    && returnedSubBatchIds.size === input.subBatches.length
    && returnedBatchIds.size === input.subBatches.length
    && normalizedSubBatches.every((item) => {
      const expected = expectedByBid.get(item.bid);
      return Boolean(
        expected
        && UUID_PATTERN.test(item.id)
        && UUID_PATTERN.test(item.batch_id)
        && item.sequence_index === expected.sequenceIndex
        && item.expected_quantity === expected.expectedQuantity
        && (expected.keyMaterialMode === "secure_sun"
          ? item.key_fingerprint === expected.pairFingerprint.toUpperCase()
            && FINGERPRINT_PATTERN.test(item.key_fingerprint || "")
          : item.key_fingerprint === null)
        && item.url_template === expected.urlTemplate,
      );
    });
  if (!readbackValid) throw new Error("supplier_order_create_readback_invalid");
  return { order: orderRecord, subBatches: normalizedSubBatches };
}

const BAD_INPUT_REASONS = [
  "supplier_order_identity_invalid",
  "supplier_order_input_invalid",
  "supplier_order_input_object_required",
  "supplier_order_payload_invalid",
  "supplier_order_quantity_plan_mismatch",
  "supplier_order_sdm_binding_invalid",
  "supplier_order_sub_batch_count_invalid",
  "supplier_order_sub_batch_identity_duplicate",
  "supplier_order_sub_batch_payload_invalid",
];

export function supplierOrderCreateError(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "").trim();
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("must be greater than zero")) {
    return { status: 400, reason: "supplier_order_quantity_invalid" };
  }
  const badInput = BAD_INPUT_REASONS.find((reason) => message.includes(reason));
  if (badInput) return { status: 400, reason: badInput };
  if (message.includes("supplier_order_actor_scope_invalid")) {
    return { status: 403, reason: "supplier_order_actor_scope_invalid" };
  }
  if (message.includes("supplier_order_bid_already_exists") || code === "23505" || code === "40001") {
    return { status: 409, reason: "supplier_order_bid_already_exists" };
  }
  if (
    code === "42P01"
    || code === "42703"
    || code === "42883"
    || message.includes("nexid_create_supplier_order_v2")
    || message.includes("nexid_supplier_order_create_v2_capability")
  ) {
    return {
      status: 503,
      reason: "supplier_order_create_v2_migration_required",
      requiredMigration: SUPPLIER_ORDER_CREATE_V2_MIGRATION,
    };
  }
  if (code === "42501") return { status: 503, reason: "supplier_order_create_v2_runtime_grant_required" };
  return { status: 503, reason: "supplier_order_create_v2_unavailable" };
}
