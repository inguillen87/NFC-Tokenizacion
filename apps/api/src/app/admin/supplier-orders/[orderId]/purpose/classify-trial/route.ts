export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";

import {
  checkAdmin,
  checkAdminPermission,
  getAdminActor,
  getAdminTenantScope,
} from "../../../../../../lib/auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../../../../lib/bounded-request-body";
import {
  adminCriticalRateLimitIdentity,
  enforceCriticalRateLimit,
} from "../../../../../../lib/critical-rate-limit";
import { sql } from "../../../../../../lib/db";
import { json } from "../../../../../../lib/http";
import {
  classifyLegacySupplierOrderTrial,
  legacyTrialClassificationError,
  parseLegacyTrialClassificationBody,
  validLegacyTrialClassificationIdempotencyKey,
} from "../../../../../../lib/supplier-pack-purpose-classification";

const MAX_CLASSIFICATION_BODY_BYTES = 4 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;

function classificationRequestId(req: Request) {
  const supplied = String(req.headers.get("x-request-id") || "").trim();
  return REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID();
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "supplier:pack_purpose_classify_trial");
  if (permission) {
    return json({
      ok: false,
      reason: "supplier_pack_purpose_classification_forbidden",
      message: "Legacy supplier classification requires superadmin or explicit supplier:pack_purpose_classify_trial permission.",
    }, 403);
  }
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;

  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) {
    return json({ ok: false, reason: "supplier_order_not_found" }, 404);
  }

  let untrustedBody: unknown;
  try {
    untrustedBody = await readBoundedJsonBody<unknown>(req, MAX_CLASSIFICATION_BODY_BYTES);
  } catch (error) {
    return json({
      ok: false,
      reason: error instanceof RequestBodyTooLargeError
        ? "request_body_too_large"
        : "invalid_json_body",
    }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  const body = parseLegacyTrialClassificationBody(untrustedBody);
  if (!body.ok) return json({ ok: false, reason: body.reason }, 400);

  const operationKey = String(req.headers.get("idempotency-key") || "").trim();
  if (!validLegacyTrialClassificationIdempotencyKey(operationKey)) {
    return json({
      ok: false,
      reason: "idempotency_key_required",
      message: "Send an Idempotency-Key header with 8-128 safe characters and reuse it only for an exact retry.",
    }, 400);
  }

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const actor = getAdminActor(req);
  try {
    const orderRows = forcedTenantSlug
      ? await sql/*sql*/`
          SELECT supplier_order.id AS supplier_order_id, supplier_order.tenant_id
          FROM supplier_orders supplier_order
          JOIN tenants tenant ON tenant.id = supplier_order.tenant_id
          WHERE supplier_order.id = ${orderId}::uuid
            AND tenant.slug = ${forcedTenantSlug}
          LIMIT 1
        `
      : await sql/*sql*/`
          SELECT supplier_order.id AS supplier_order_id, supplier_order.tenant_id
          FROM supplier_orders supplier_order
          WHERE supplier_order.id = ${orderId}::uuid
          LIMIT 1
        `;
    const order = orderRows[0];
    if (!order) return json({ ok: false, reason: "supplier_order_not_found" }, 404);

    // This complete scope is derived from current database state. Caller input
    // cannot select, omit, duplicate, or replace sub-batches or QA receipts.
    const scopeRows = await sql/*sql*/`
      SELECT
        sub_batch.id::text AS supplier_sub_batch_id,
        latest_passed_qa.id::text AS qa_check_id
      FROM supplier_sub_batches sub_batch
      JOIN batches batch
        ON batch.id = sub_batch.batch_id
       AND batch.tenant_id = sub_batch.tenant_id
       AND upper(batch.bid) = upper(sub_batch.bid)
      LEFT JOIN LATERAL (
        SELECT qa_check.id
        FROM supplier_qa_checks qa_check
        WHERE qa_check.supplier_sub_batch_id = sub_batch.id
          AND qa_check.supplier_order_id = sub_batch.supplier_order_id
          AND qa_check.tenant_id = sub_batch.tenant_id
          AND qa_check.batch_id = sub_batch.batch_id
          AND upper(qa_check.bid) = upper(sub_batch.bid)
          AND qa_check.status = 'passed'
        ORDER BY qa_check.created_at DESC, qa_check.id DESC
        LIMIT 1
      ) latest_passed_qa ON true
      WHERE sub_batch.supplier_order_id = ${order.supplier_order_id}::uuid
        AND sub_batch.tenant_id = ${order.tenant_id}::uuid
      ORDER BY sub_batch.id
    `;
    if (scopeRows.length < 1 || scopeRows.length > 52) {
      return json({ ok: false, reason: "supplier_pack_purpose_scope_unavailable" }, 409);
    }

    const receipt = await classifyLegacySupplierOrderTrial({
      tenantId: String(order.tenant_id),
      supplierOrderId: String(order.supplier_order_id),
      actorId: actor.id,
      operationKey,
      reason: body.reason,
      confirmation: body.confirmation,
      requestId: classificationRequestId(req),
      items: scopeRows.map((scopeRow) => ({
        supplier_sub_batch_id: String(scopeRow.supplier_sub_batch_id),
        qa_check_id: scopeRow.qa_check_id ? String(scopeRow.qa_check_id) : null,
      })),
    });

    return json({
      ok: true,
      supplier_order_id: receipt.supplierOrderId,
      decision_id: receipt.decisionId,
      effective_pack_purpose: receipt.effectivePackPurpose,
      commercial_disposition: "NON_SELLABLE",
      production_acceptance: false,
      activation_allowed: false,
      scope_digest: receipt.scopeDigest,
      scope_item_count: scopeRows.length,
      idempotent_replay: receipt.idempotentReplay,
    });
  } catch (error) {
    const failure = legacyTrialClassificationError(error);
    return json({
      ok: false,
      reason: failure.reason,
      ...(failure.requiredMigration ? { required_migration: failure.requiredMigration } : {}),
    }, failure.status);
  }
}
