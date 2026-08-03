export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";
import { checkAdmin, checkAdminPermission, checkAdminWithPermission, getAdminActor, getAdminPrincipal, getAdminTenantScope } from "../../../lib/auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../lib/bounded-request-body";
import { ensureCarrierProfileSchema } from "../../../lib/commercial-runtime-schema";
import { ensureSupplierOpsSchema } from "../../../lib/supplier-ops-schema";
import { getCarrierProfile, inferCarrierProfileFromPayload } from "../../../lib/carrier-profiles";
import { buildBatchKeyLifecycleRecords } from "../../../lib/batch-keys";
import {
  buildSupplierSubBatchPlan,
  generateSupplierBatchKeys,
  normalizeSupplierPackPurpose,
  requiresSecureSunEncoding,
} from "../../../lib/supplier-ops";
import { requireTenantSunProfile } from "../../../lib/tenant-onboarding";
import {
  createSupplierOrderV2,
  hasSupplierOrderCreateV2,
  supplierOrderCreateError,
  type SupplierOrderCreateSubBatchInput,
} from "../../../lib/supplier-order-create";
import { resolveSupplierPublicTagOrigin } from "../../../lib/supplier-public-tag-origin";

const MAX_SUPPLIER_ORDER_BODY_BYTES = 64 * 1024;
const MAX_SUPPLIER_ORDER_QUANTITY = 100_000_000;
const MAX_SUPPLIER_SUB_BATCHES = 52;

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function positiveInt(value: unknown, field: string) {
  const parsed = Number(value || 0);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${field} must be greater than zero`);
  return parsed;
}

async function resolveTenant(input: string) {
  const normalized = input.trim();
  if (!normalized) return null;
  const rows = /^[0-9a-f-]{36}$/i.test(normalized)
    ? await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE id = ${normalized}::uuid LIMIT 1`
    : await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE slug = ${normalized.toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

function buildSupplierUrlTemplate(apiOrigin: string, carrierProfileCode: string, bid: string, tenantSlug: string) {
  const encodedBid = encodeURIComponent(bid);
  const encodedTenant = encodeURIComponent(tenantSlug);
  if (requiresSecureSunEncoding(carrierProfileCode)) {
    return `${apiOrigin}/sun?v=1&bid=${encodedBid}&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>`;
  }
  switch (carrierProfileCode) {
    case "gs1_digital_link":
      return `${apiOrigin}/01/<GTIN>/10/<LOT>/21/<SERIAL>`;
    case "qr_basic":
      return `${apiOrigin}/sun?qr=1&carrier=qr_basic&tenant=${encodedTenant}&bid=${encodedBid}&uid=<UID_HEX>`;
    case "ntag213":
    case "ntag215":
    case "ntag216":
      return `${apiOrigin}/sun?channel=static_nfc&carrier=${carrierProfileCode}&tenant=${encodedTenant}&bid=${encodedBid}&uid=<UID_HEX>`;
    case "uhf_rfid":
      return `${apiOrigin}/ops/rfid/${encodedBid}/<EPC_OR_UID>`;
    case "event_wristband":
      return `${apiOrigin}/event/${encodedBid}/<UID_HEX>`;
    case "hotel_keycard":
      return `${apiOrigin}/credential/${encodedBid}/<UID_HEX>`;
    case "iot_tracker_placeholder":
      return `${apiOrigin}/telemetry/${encodedBid}/<DEVICE_ID>`;
    default:
      throw new Error("unsupported_supplier_carrier_url_template");
  }
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const rows = forcedTenantSlug
    ? await sql/*sql*/`
        SELECT
          so.*,
          so.pack_purpose AS declared_pack_purpose,
          COALESCE(purpose_decision.to_purpose, so.pack_purpose) AS effective_pack_purpose,
          purpose_decision.id AS classification_decision_id,
          t.slug AS tenant_slug,
          (
            SELECT MAX(lifecycle_event.created_at)
            FROM evidence_events lifecycle_event
            WHERE lifecycle_event.tenant_id = so.tenant_id
              AND lifecycle_event.resource_type = 'supplier_order'
              AND lifecycle_event.resource_id = so.id::text
              AND lifecycle_event.event_type = 'supplier_order_sent_to_supplier'
          ) AS sent_to_supplier_at,
          (
            SELECT MAX(lifecycle_event.created_at)
            FROM evidence_events lifecycle_event
            WHERE lifecycle_event.tenant_id = so.tenant_id
              AND lifecycle_event.resource_type = 'supplier_order'
              AND lifecycle_event.resource_id = so.id::text
              AND lifecycle_event.event_type = 'supplier_order_tenant_handover_recorded'
          ) AS tenant_handover_recorded_at,
          COUNT(ssb.id)::int AS sub_batch_count,
          COALESCE(SUM(ssb.expected_quantity), 0)::int AS planned_quantity,
          COUNT(*) FILTER (WHERE ssb.manifest_status = 'imported')::int AS manifests_imported,
          COUNT(*) FILTER (WHERE ssb.qa_status = 'passed')::int AS qa_passed,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', ssb.id,
                'bid', ssb.bid,
                'batch_id', ssb.batch_id,
                'sequence_index', ssb.sequence_index,
                'expected_quantity', ssb.expected_quantity,
                'manifest_count', ssb.manifest_count,
                'manifest_status', ssb.manifest_status,
                'qa_status', ssb.qa_status,
                'status', ssb.status,
                'manufacturing_state', ssb.manufacturing_state,
                'key_export_count', ssb.key_export_count,
                'key_exported_at', ssb.key_exported_at,
                'activated_at', ssb.activated_at,
                'key_fingerprint', ssb.metadata_json->>'key_fingerprint',
                'url_template', ssb.metadata_json->>'url_template'
              )
              ORDER BY ssb.sequence_index
            ) FILTER (WHERE ssb.id IS NOT NULL),
            '[]'::jsonb
          ) AS sub_batches
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        LEFT JOIN supplier_pack_purpose_decisions purpose_decision
          ON purpose_decision.supplier_order_id = so.id
         AND purpose_decision.tenant_id = so.tenant_id
        LEFT JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id
        WHERE t.slug = ${forcedTenantSlug}
        GROUP BY so.id, t.slug, purpose_decision.id, purpose_decision.to_purpose
        ORDER BY so.created_at DESC
        LIMIT 100
      `
    : await sql/*sql*/`
        SELECT
          so.*,
          so.pack_purpose AS declared_pack_purpose,
          COALESCE(purpose_decision.to_purpose, so.pack_purpose) AS effective_pack_purpose,
          purpose_decision.id AS classification_decision_id,
          t.slug AS tenant_slug,
          (
            SELECT MAX(lifecycle_event.created_at)
            FROM evidence_events lifecycle_event
            WHERE lifecycle_event.tenant_id = so.tenant_id
              AND lifecycle_event.resource_type = 'supplier_order'
              AND lifecycle_event.resource_id = so.id::text
              AND lifecycle_event.event_type = 'supplier_order_sent_to_supplier'
          ) AS sent_to_supplier_at,
          (
            SELECT MAX(lifecycle_event.created_at)
            FROM evidence_events lifecycle_event
            WHERE lifecycle_event.tenant_id = so.tenant_id
              AND lifecycle_event.resource_type = 'supplier_order'
              AND lifecycle_event.resource_id = so.id::text
              AND lifecycle_event.event_type = 'supplier_order_tenant_handover_recorded'
          ) AS tenant_handover_recorded_at,
          COUNT(ssb.id)::int AS sub_batch_count,
          COALESCE(SUM(ssb.expected_quantity), 0)::int AS planned_quantity,
          COUNT(*) FILTER (WHERE ssb.manifest_status = 'imported')::int AS manifests_imported,
          COUNT(*) FILTER (WHERE ssb.qa_status = 'passed')::int AS qa_passed,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', ssb.id,
                'bid', ssb.bid,
                'batch_id', ssb.batch_id,
                'sequence_index', ssb.sequence_index,
                'expected_quantity', ssb.expected_quantity,
                'manifest_count', ssb.manifest_count,
                'manifest_status', ssb.manifest_status,
                'qa_status', ssb.qa_status,
                'status', ssb.status,
                'manufacturing_state', ssb.manufacturing_state,
                'key_export_count', ssb.key_export_count,
                'key_exported_at', ssb.key_exported_at,
                'activated_at', ssb.activated_at,
                'key_fingerprint', ssb.metadata_json->>'key_fingerprint',
                'url_template', ssb.metadata_json->>'url_template'
              )
              ORDER BY ssb.sequence_index
            ) FILTER (WHERE ssb.id IS NOT NULL),
            '[]'::jsonb
          ) AS sub_batches
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        LEFT JOIN supplier_pack_purpose_decisions purpose_decision
          ON purpose_decision.supplier_order_id = so.id
         AND purpose_decision.tenant_id = so.tenant_id
        LEFT JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id
        GROUP BY so.id, t.slug, purpose_decision.id, purpose_decision.to_purpose
        ORDER BY so.created_at DESC
        LIMIT 100
      `;
  return json({ ok: true, orders: rows });
}

export async function POST(req: Request) {
  const auth = await checkAdminWithPermission(req, "supplier_order.create");
  if (auth) return auth;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_SUPPLIER_ORDER_BODY_BYTES);
  } catch (error) {
    return json({
      ok: false,
      reason: error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json_body",
      ...(error instanceof RequestBodyTooLargeError ? { max_bytes: MAX_SUPPLIER_ORDER_BODY_BYTES } : {}),
    }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  await ensureCarrierProfileSchema();
  await ensureSupplierOpsSchema();
  const tenantInput = firstString(body.tenant_id, body.tenantId, body.tenant_slug, body.tenantSlug, body.tenant);
  const tenant = await resolveTenant(tenantInput);
  if (!tenant) return json({ ok: false, reason: "tenant_not_found" }, 404);

  const tenantScope = getAdminTenantScope(req);
  if (tenantScope.forcedTenantSlug && tenantScope.forcedTenantSlug !== tenant.slug) {
    return json({ ok: false, reason: "tenant_scope_forbidden" }, 403);
  }

  try {
    const customerSlug = firstString(body.customer_slug, body.customerSlug, tenant.slug);
    const orderName = firstString(body.order_name, body.orderName);
    const baseBatchId = firstString(body.base_batch_id, body.baseBatchId, orderName);
    const totalQuantity = positiveInt(body.total_quantity ?? body.totalQuantity, "total_quantity");
    const subBatchSize = positiveInt(body.sub_batch_size ?? body.subBatchSize, "sub_batch_size");
    if (totalQuantity > MAX_SUPPLIER_ORDER_QUANTITY) {
      return json({
        ok: false,
        reason: "supplier_order_quantity_out_of_range",
        max: MAX_SUPPLIER_ORDER_QUANTITY,
      }, 400);
    }
    if (subBatchSize > totalQuantity) {
      return json({ ok: false, reason: "supplier_order_sub_batch_size_invalid" }, 400);
    }
    const plannedSubBatchCount = Math.ceil(totalQuantity / subBatchSize);
    if (plannedSubBatchCount > MAX_SUPPLIER_SUB_BATCHES) {
      return json({
        ok: false,
        reason: "too_many_sub_batches",
        max: MAX_SUPPLIER_SUB_BATCHES,
        received: plannedSubBatchCount,
      }, 400);
    }
    const chipModel = firstString(body.chip_model, body.chipModel, body.chip);
    const packPurpose = normalizeSupplierPackPurpose(body.pack_purpose ?? body.packPurpose);
    const carrierProfileCode = inferCarrierProfileFromPayload(body);
    const carrierProfile = getCarrierProfile(carrierProfileCode);
    if (!orderName || !chipModel || !carrierProfileCode || !carrierProfile) {
      return json({
        ok: false,
        reason: "supplier_order_identity_required",
        missing: [
          !orderName ? "order_name" : "",
          !chipModel ? "chip_model" : "",
          !carrierProfileCode ? "carrier_profile_code" : "",
        ].filter(Boolean),
      }, 400);
    }
    if (!packPurpose) {
      return json({
        ok: false,
        reason: "supplier_pack_purpose_required",
        allowed: ["trial_integration", "production"],
        message: "Choose the pack purpose explicitly. Trial packs are non-sellable; production remains blocked until a tenant-approved production QA plan exists.",
      }, 400);
    }
    const secureSunProfile = requiresSecureSunEncoding(carrierProfileCode);

    if (secureSunProfile) {
      const keyGenerationPermission = checkAdminPermission(req, "batch.keys.generate");
      if (keyGenerationPermission) return keyGenerationPermission;
      if (!getAdminPrincipal(req).mfaVerified) {
        return json({ ok: false, reason: "supplier_batch_key_generation_mfa_required" }, 403);
      }
      const readiness = await requireTenantSunProfile(String(tenant.id)).catch((error) => ({
        ok: false,
        missing: (error as Error & { missing?: string[] }).missing || ["tenant_sun_profiles"],
      }));
      if (!readiness.ok) {
        return json({
          ok: false,
          reason: "tenant_sun_profile_incomplete",
          message: "Complete SUN tenant profile before creating NTAG 424 DNA supplier orders.",
          missing: readiness.missing,
        }, 409);
      }
    }

    const plan = buildSupplierSubBatchPlan({
      customerSlug,
      orderName,
      baseBatchId,
      totalQuantity,
      subBatchSize,
    });
    if (plan.length > MAX_SUPPLIER_SUB_BATCHES) {
      return json({ ok: false, reason: "too_many_sub_batches", max: MAX_SUPPLIER_SUB_BATCHES, received: plan.length }, 400);
    }

    const existingBids = await sql/*sql*/`
      SELECT bid FROM batches WHERE bid = ANY(${plan.map((item) => item.bid)})
      UNION
      SELECT bid FROM supplier_sub_batches WHERE bid = ANY(${plan.map((item) => item.bid)})
    `;
    if (existingBids.length) {
      return json({
        ok: false,
        reason: "batch_bid_already_exists",
        bids: existingBids.map((row) => row.bid),
      }, 409);
    }

    if (!await hasSupplierOrderCreateV2(sql, {
      requireKeylessCarrierSupport: !secureSunProfile,
    })) {
      return json({
        ok: false,
        reason: secureSunProfile
          ? "supplier_order_create_v2_migration_required"
          : "supplier_order_keyless_carrier_migration_required",
        required_migration: secureSunProfile
          ? "20260802150000_0079_supplier_order_atomic_create.sql"
          : "20260802250000_0090_supplier_carrier_key_scope.sql",
      }, 503);
    }

    const actorIdentity = getAdminActor(req);
    const actor = actorIdentity.email;
    const supplierOrderId = randomUUID();
    const apiOrigin = resolveSupplierPublicTagOrigin();
    const preparedSubBatches: SupplierOrderCreateSubBatchInput[] = [];

    for (const subBatch of plan) {
      const urlTemplate = buildSupplierUrlTemplate(apiOrigin, carrierProfileCode, subBatch.bid, String(tenant.slug));
      const sdmConfig = {
        profile: secureSunProfile ? "enterprise_supplier_sun" : "enterprise_supplier_declared",
        sku: firstString(body.sku) || orderName,
        chip_model: chipModel,
        carrier_profile_code: carrierProfileCode,
        carrier_label: carrierProfile.label,
        requested_quantity: subBatch.expectedQuantity,
        supplier_order_id: supplierOrderId,
        supplier_sequence_index: subBatch.sequenceIndex,
        source: "supplier_order",
        mode: "supplier",
        key_material_mode: secureSunProfile ? "secure_sun" : "none",
        url_template: urlTemplate,
        ...(secureSunProfile ? {
          key_version: 1,
          mac_input: "enc_plus_cmac_literal",
          tagtamper_enabled: carrierProfileCode === "ntag424_dna_tt",
          ttstatus_enabled: carrierProfileCode === "ntag424_dna_tt",
          ...(carrierProfileCode === "ntag424_dna_tt" ? {
            ttstatus_source: "enc_decrypted",
            ttstatus_offset: 0,
            ttstatus_length: 2,
            ttstatus_closed_values: ["4343"],
            ttstatus_opened_values: ["4F4F", "4F43"],
            ttstatus_invalid_values: ["4949"],
          } : {}),
        } : {
          mac_input: "not_applicable",
        }),
      };
      if (secureSunProfile) {
        const keys = generateSupplierBatchKeys();
        const keyMaterial = buildBatchKeyLifecycleRecords({
          tenantId: String(tenant.id),
          bid: subBatch.bid,
          kMetaHex: keys.kMetaHex,
          kFileHex: keys.kFileHex,
          keyVersion: 1,
          createdBy: actor,
        });
        const metaKey = keyMaterial.find((item) => item.keyRole === "K_META_BATCH");
        const fileKey = keyMaterial.find((item) => item.keyRole === "K_FILE_BATCH");
        if (!metaKey || !fileKey) throw new Error("supplier_batch_key_material_missing");
        preparedSubBatches.push({
          bid: subBatch.bid,
          sequenceIndex: subBatch.sequenceIndex,
          expectedQuantity: subBatch.expectedQuantity,
          keyMaterialMode: "secure_sun",
          metaKeyCt: metaKey.encryptedKeyCt,
          fileKeyCt: fileKey.encryptedKeyCt,
          pairFingerprint: keys.fingerprint,
          metaKeyFingerprint: metaKey.keyFingerprint,
          fileKeyFingerprint: fileKey.keyFingerprint,
          urlTemplate,
          sdmConfig,
        });
      } else {
        preparedSubBatches.push({
          bid: subBatch.bid,
          sequenceIndex: subBatch.sequenceIndex,
          expectedQuantity: subBatch.expectedQuantity,
          keyMaterialMode: "none",
          urlTemplate,
          sdmConfig,
        });
      }
    }

    const created = await createSupplierOrderV2({
      supplierOrderId,
      tenantId: String(tenant.id),
      actorId: actorIdentity.id,
      authSessionId: actorIdentity.sessionId,
      customerSlug,
      orderName,
      baseBatchId,
      totalQuantity,
      subBatchSize,
      chipModel,
      carrierProfileCode,
      packPurpose,
      materialType: firstString(body.material_type, body.materialType) || null,
      notes: firstString(body.notes) || null,
      requestId: req.headers.get("x-request-id"),
      userAgent: req.headers.get("user-agent"),
      subBatches: preparedSubBatches,
    });
    const order = created.order;
    const subBatches = created.subBatches;

    return json({
      ok: true,
      order: { ...order, tenant_slug: tenant.slug },
      sub_batches: subBatches,
      packaging_governance: {
        status: String(order.packaging_governance_status || "legacy_unverified"),
        spec_revision: Number(order.packaging_spec_revision || 0),
        initial_spec_accepted: false,
        supplied_spec_was_persisted: false,
        next: `/admin/supplier-orders/${order.id}/packaging`,
      },
      warning: secureSunProfile
        ? "K_META_BATCH and K_FILE_BATCH are stored only as context-bound software envelopes. Atomic provisioning leaves packaging legacy_unverified; approve its packaging specification before the explicit supplier-pack export endpoint can release factory material. This is not managed KMS or HSM custody."
        : "This carrier is provisioned without K_META_BATCH/K_FILE_BATCH or batch-key records. Atomic provisioning leaves packaging legacy_unverified; approve its packaging specification before exporting the keyless factory pack.",
    }, 201);
  } catch (error) {
    const mapped = supplierOrderCreateError(error);
    return json({
      ok: false,
      reason: mapped.reason,
      ...(mapped.requiredMigration ? { required_migration: mapped.requiredMigration } : {}),
    }, mapped.status);
  }
}
