export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminPrincipal, type AdminPrincipal } from "../../../../../lib/auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../../../lib/bounded-request-body";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import {
  buildPackagingCarrierSpecFromApprovedSnapshot,
  createPackagingLabProject,
  decidePackagingLabProject,
  packagingLabPresetFor,
  packagingLabPresetsForCarrier,
  recordPackagingLabTest,
} from "../../../../../lib/packaging-lab";
import { permissionDenied, permissionMatches } from "../../../../../lib/permission-matcher.js";
import { roleMayUseEnterpriseCapability } from "../../../../../lib/enterprise-capability-policy";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 256 * 1024;
const FORBIDDEN_CONTEXT_FIELDS = new Set([
  "tenant", "tenant_id", "tenantId", "tenant_slug", "tenantSlug",
  "supplier_order_id", "supplierOrderId", "order_id", "orderId",
  "actor_id", "actorId", "auth_session_id", "authSessionId",
  "carrier_profile_code", "carrierProfileCode", "approved_packaging_revision",
  "approvedPackagingRevision", "approved_packaging_hash", "approvedPackagingHash",
  "approved_by", "approvedBy", "approved_at", "approvedAt",
]);

type Row = Record<string, any>;

function can(principal: AdminPrincipal, permission: string) {
  if (!roleMayUseEnterpriseCapability(principal.role, permission)) return false;
  if (permissionDenied(principal.deniedPermissions, permission)) return false;
  return principal.scope === "super_admin"
    || permissionMatches(principal.permissions, permission, principal.deniedPermissions);
}

function idempotencyKey(req: Request) {
  const key = String(req.headers.get("idempotency-key") || "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key) ? key : null;
}

async function loadOrder(orderId: string, principal: AdminPrincipal): Promise<Row | null> {
  const rows = principal.scope === "super_admin"
    ? await sql/*sql*/`
        SELECT supplier_order.*, tenant.slug AS tenant_slug, tenant.name AS tenant_name
        FROM supplier_orders supplier_order
        JOIN tenants tenant ON tenant.id = supplier_order.tenant_id
        WHERE supplier_order.id = ${orderId}::uuid
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT supplier_order.*, tenant.slug AS tenant_slug, tenant.name AS tenant_name
        FROM supplier_orders supplier_order
        JOIN tenants tenant ON tenant.id = supplier_order.tenant_id
        WHERE supplier_order.id = ${orderId}::uuid
          AND supplier_order.tenant_id = ${principal.tenantId}::uuid
        LIMIT 1
      `;
  return rows[0] || null;
}

function safeDatabaseCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const value = String((error as { code?: unknown }).code || "");
  return /^[A-Z0-9]{5}$/.test(value) ? value : "";
}

function failure(error: unknown) {
  const reason = error instanceof Error ? error.message : "packaging_lab_operation_failed";
  const code = safeDatabaseCode(error);
  if (["42P01", "42703", "42883"].includes(code)) {
    return { status: 503, reason: "packaging_lab_migration_required", required_migration: "20260802220000_0087_packaging_lab_foundation.sql" };
  }
  if (code === "42501" || /(?:forbidden|scope_invalid|separation_required)/.test(reason)) {
    return { status: 403, reason };
  }
  if (["23505", "40001", "55000"].includes(code)
    || /(?:conflict|required_tests|approval_required|transition_invalid|snapshot_required|placement_required|tamper_claim_forbidden)/.test(reason)) {
    return { status: 409, reason };
  }
  if (code.startsWith("22") || /(?:_invalid|_required|_too_long|_unsafe|_forbidden)$/.test(reason)) {
    return { status: 400, reason };
  }
  console.error("[packaging_lab_operation_failed]", code || "unknown");
  return { status: 500, reason: "packaging_lab_operation_failed" };
}

async function readPayload(req: Request) {
  try {
    const body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
    const forged = Object.keys(body).filter((key) => FORBIDDEN_CONTEXT_FIELDS.has(key));
    if (forged.length) return { response: json({ ok: false, reason: "packaging_lab_context_server_derived", rejected_fields: forged }, 400) };
    return { body };
  } catch (error) {
    return {
      response: json({
        ok: false,
        reason: error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json_body",
      }, error instanceof RequestBodyTooLargeError ? 413 : 400),
    };
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator"]);
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
  if (!can(principal, "packaging_lab.manage")) {
    return json({ ok: false, reason: "packaging_lab_read_forbidden" }, 403);
  }
  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) return json({ ok: false, reason: "supplier_order_not_found" }, 404);

  try {
    const order = await loadOrder(orderId, principal);
    if (!order) return json({ ok: false, reason: "supplier_order_not_found" }, 404);
    const carrierSpecs = await sql/*sql*/`
      SELECT *
      FROM packaging_carrier_specs spec
      WHERE spec.tenant_id = ${order.tenant_id}::uuid
        AND spec.carrier_profile_code = ${String(order.carrier_profile_code).toLowerCase()}
      ORDER BY spec.updated_at DESC
      LIMIT 100
    `;
    const placements = await sql/*sql*/`
      SELECT placement.*
      FROM packaging_placements placement
      JOIN packaging_carrier_specs spec
        ON spec.id = placement.carrier_spec_id
       AND spec.tenant_id = placement.tenant_id
      WHERE placement.tenant_id = ${order.tenant_id}::uuid
        AND spec.carrier_profile_code = ${String(order.carrier_profile_code).toLowerCase()}
      ORDER BY placement.updated_at DESC
      LIMIT 200
    `;
    const projects = await sql/*sql*/`
      SELECT project.*,
        approval.receipt_digest,
        approval.override_used,
        approval.override_reason,
        spec.name AS carrier_spec_name,
        spec.delivery_format,
        spec.assurance_model,
        spec.tamper_evidence_mode,
        spec.key_material_policy,
        placement.placement_zone,
        placement.placement_image_url,
        placement.crosses_opening,
        placement.requires_tail_break,
        placement.validated,
        placement.validation_report_id
      FROM packaging_lab_projects project
      JOIN packaging_carrier_specs spec
        ON spec.id = project.carrier_spec_id AND spec.tenant_id = project.tenant_id
      JOIN packaging_placements placement
        ON placement.id = project.placement_id AND placement.tenant_id = project.tenant_id
      LEFT JOIN packaging_lab_approvals approval
        ON approval.id = project.approval_id AND approval.tenant_id = project.tenant_id
      WHERE project.supplier_order_id = ${order.id}::uuid
        AND project.tenant_id = ${order.tenant_id}::uuid
      ORDER BY CASE project.status WHEN 'APPROVED' THEN 0 WHEN 'TESTING' THEN 1 ELSE 2 END,
        project.updated_at DESC
      LIMIT 50
    `;
    const projectIds = projects.map((project) => String(project.id));
    const tests = projectIds.length
      ? await sql/*sql*/`
          SELECT *
          FROM packaging_lab_test_cases test
          WHERE test.tenant_id = ${order.tenant_id}::uuid
            AND test.project_id = ANY(${projectIds}::uuid[])
          ORDER BY test.project_id, test.sequence
        `
      : [];
    const gates = await sql/*sql*/`
      SELECT sub_batch.id AS supplier_sub_batch_id,
        sub_batch.batch_id,
        sub_batch.bid,
        sub_batch.manifest_status,
        sub_batch.expected_quantity,
        sub_batch.manifest_count,
        receipt.project_id,
        receipt.approval_id,
        receipt.receipt_digest,
        receipt.override_used,
        (receipt.approval_id IS NOT NULL) AS packaging_lab_ready
      FROM supplier_sub_batches sub_batch
      LEFT JOIN LATERAL public.nexid_packaging_lab_activation_receipt_v1(sub_batch.batch_id) receipt ON true
      WHERE sub_batch.supplier_order_id = ${order.id}::uuid
        AND sub_batch.tenant_id = ${order.tenant_id}::uuid
      ORDER BY sub_batch.sequence_index
    `;
    return json({
      ok: true,
      order: {
        id: order.id,
        tenant_id: order.tenant_id,
        tenant_slug: order.tenant_slug,
        tenant_name: order.tenant_name,
        order_name: order.order_name,
        carrier_profile_code: order.carrier_profile_code,
        packaging_governance_status: order.packaging_governance_status,
        packaging_spec_revision: order.packaging_spec_revision,
        packaging_spec_hash: order.packaging_spec_hash,
        packaging_carrier_spec_id: order.packaging_carrier_spec_id,
      },
      carrier_specs: carrierSpecs,
      placements,
      projects,
      tests,
      activation_gates: gates,
      presets: packagingLabPresetsForCarrier(order.carrier_profile_code),
      principal: { user_id: principal.userId, scope: principal.scope },
      permissions: {
        can_manage: can(principal, "packaging_lab.manage"),
        can_approve: can(principal, "qa.approve") && principal.mfaVerified,
        can_override: can(principal, "packaging_lab.override"),
      },
      contract: {
        gs1_identity_is_declarative: true,
        uhf_sun_keys_forbidden: true,
        non_tt_tamper_claims_forbidden: true,
        tt_requires_opening_bridge: true,
      },
    });
  } catch (error) {
    const mapped = failure(error);
    return json({ ok: false, ...mapped }, mapped.status);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator"]);
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) return json({ ok: false, reason: "supplier_order_not_found" }, 404);
  const parsed = await readPayload(req);
  if (parsed.response) return parsed.response;
  const body = parsed.body!;
  const action = String(body.action || "").trim().toLowerCase();
  const operation = idempotencyKey(req);

  try {
    const order = await loadOrder(orderId, principal);
    if (!order) return json({ ok: false, reason: "supplier_order_not_found" }, 404);

    if (action === "create_project") {
      if (!can(principal, "packaging_lab.manage")) {
        return json({ ok: false, reason: "packaging_lab_manage_forbidden" }, 403);
      }
      if (!operation) return json({ ok: false, reason: "idempotency_key_required" }, 400);
      if (order.packaging_governance_status !== "approved" || !order.packaging_spec_snapshot) {
        return json({ ok: false, reason: "approved_supplier_packaging_snapshot_required" }, 409);
      }
      const presetCode = body.preset_code ?? body.presetCode;
      const preset = presetCode
        ? packagingLabPresetFor(presetCode, order.carrier_profile_code)
        : null;
      const carrierSpecId = body.carrier_spec_id ?? body.carrierSpecId;
      const carrierSpec = carrierSpecId ? null : buildPackagingCarrierSpecFromApprovedSnapshot({
        carrierProfileCode: order.carrier_profile_code,
        deliveryFormat: body.delivery_format ?? body.deliveryFormat ?? preset?.delivery_format,
        name: body.carrier_spec_name ?? body.carrierSpecName ?? preset?.carrier_spec_name ?? `${order.order_name} construction`,
        specSnapshot: order.packaging_spec_snapshot,
        targetSubstrates: body.target_substrates ?? body.targetSubstrates ?? preset?.target_substrates,
        forbiddenConditions: body.forbidden_conditions ?? body.forbiddenConditions ?? preset?.forbidden_conditions,
        notes: body.carrier_spec_notes ?? body.carrierSpecNotes ?? preset?.description,
      });
      const result = await createPackagingLabProject({
        tenantId: order.tenant_id,
        supplierOrderId: order.id,
        actorId: principal.userId,
        authSessionId: principal.sessionId,
        operationKey: operation,
        carrierProfileCode: order.carrier_profile_code,
        approvedPackagingRevision: order.packaging_spec_revision,
        approvedPackagingHash: order.packaging_spec_hash,
        carrierSpecId,
        placementId: body.placement_id ?? body.placementId,
        carrierSpec,
        productId: body.product_id ?? body.productId,
        sku: body.sku,
        packagingType: body.packaging_type ?? body.packagingType ?? preset?.packaging_type,
        placementZone: body.placement_zone ?? body.placementZone ?? preset?.placement_zone,
        placementImageUrl: body.placement_image_url ?? body.placementImageUrl,
        crossesOpening: body.crosses_opening ?? body.crossesOpening ?? preset?.crosses_opening,
        requiresTailBreak: body.requires_tail_break ?? body.requiresTailBreak ?? preset?.requires_tail_break,
        objective: body.objective ?? preset?.objective,
        ownerUserId: principal.userId,
      });
      return json({
        ok: true,
        commit_state: "committed",
        retry_required: false,
        project: result,
        preset: preset ? { code: preset.code, version: preset.version } : null,
      }, 201);
    }

    if (action === "record_test") {
      if (!can(principal, "packaging_lab.manage")) {
        return json({ ok: false, reason: "packaging_lab_manage_forbidden" }, 403);
      }
      const result = await recordPackagingLabTest({
        tenantId: order.tenant_id,
        projectId: body.project_id ?? body.projectId,
        testCaseId: body.test_case_id ?? body.testCaseId,
        actorId: principal.userId,
        authSessionId: principal.sessionId,
        expectedVersion: body.expected_version ?? body.expectedVersion,
        status: body.status,
        result: body.result,
        evidenceUrls: body.evidence_urls ?? body.evidenceUrls,
        requestId: req.headers.get("x-request-id"),
      });
      return json({ ok: true, commit_state: "committed", retry_required: false, test: result });
    }

    if (action === "decide_project") {
      if (!can(principal, "qa.approve")) {
        return json({ ok: false, reason: "packaging_lab_approve_forbidden" }, 403);
      }
      if (String(body.decision || "").trim().toUpperCase() === "APPROVE" && !principal.mfaVerified) {
        return json({ ok: false, reason: "packaging_lab_approval_mfa_required" }, 403);
      }
      if (!operation) return json({ ok: false, reason: "idempotency_key_required" }, 400);
      const override = body.override === true;
      if (override && !can(principal, "packaging_lab.override")) {
        return json({ ok: false, reason: "packaging_lab_override_forbidden" }, 403);
      }
      const result = await decidePackagingLabProject({
        tenantId: order.tenant_id,
        projectId: body.project_id ?? body.projectId,
        actorId: principal.userId,
        authSessionId: principal.sessionId,
        operationKey: operation,
        decision: body.decision,
        reason: body.reason,
        recommendation: body.recommendation,
        override,
        overrideReason: body.override_reason ?? body.overrideReason,
        requestId: req.headers.get("x-request-id"),
      });
      return json({ ok: true, commit_state: "committed", retry_required: false, decision: result });
    }

    return json({ ok: false, reason: "packaging_lab_action_invalid" }, 400);
  } catch (error) {
    const mapped = failure(error);
    return json({ ok: false, ...mapped }, mapped.status);
  }
}
