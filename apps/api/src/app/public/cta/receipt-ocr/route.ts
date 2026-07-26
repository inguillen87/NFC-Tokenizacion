export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import {
  evaluateReceiptOcrForOwnership,
  performReceiptOcr,
  validateReceiptImageDataUrl,
} from "../../../../lib/ocr-service";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { consumeSunFreshHandoff } from "../../../../lib/sun-fresh-handoff";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { sql } from "../../../../lib/db";

const MAX_RECEIPT_REQUEST_BYTES = 8 * 1024 * 1024;

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

export async function POST(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `receipt_ocr_${Date.now().toString(36)}`;
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "platform",
    subjectId: "receipt-ocr:public",
  });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_RECEIPT_REQUEST_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json", trace_id: traceId }, tooLarge ? 413 : 400);
  }

  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, target.status);
  const auth = requireShareToken(req, target.bid, target.shareUid);
  if (!auth.ok) {
    return json({ ok: false, reason: auth.reason, share_token_status: auth.share_token_status, trace_id: traceId }, 401);
  }
  if (!target.eventId) {
    return json({
      ok: false,
      reason: "fresh_nfc_evidence_required_for_receipt_review",
      fresh_token_status: "fresh_event_required",
      trace_id: traceId,
    }, 403);
  }
  const receiptImage = validateReceiptImageDataUrl(body.receiptFileData);
  if (!receiptImage.ok) {
    return json({ ok: false, reason: receiptImage.reason, trace_id: traceId }, receiptImage.status);
  }
  const fresh = await consumeSunFreshHandoff(
    req,
    body,
    { bid: target.bid, eventId: target.eventId },
    "public_receipt_ocr",
  );
  if (!fresh.ok) {
    return json({
      ok: false,
      reason: "fresh_nfc_evidence_required_for_receipt_review",
      fresh_token_status: fresh.reason,
      trace_id: traceId,
    }, 403);
  }

  let expectedProduct = "Producto configurado";
  let expectedIssuer = "Emisor configurado";
  if (target.batchId && target.tenantId) {
    const rows = await sql/*sql*/`
      SELECT b.sdm_config, tn.name AS tenant_name
      FROM batches b
      JOIN tenants tn ON tn.id = b.tenant_id
      WHERE b.id = ${target.batchId}
        AND b.tenant_id = ${target.tenantId}
        AND b.status = 'active'
        AND tn.status = 'active'
      LIMIT 1
    `;
    const context = rows[0];
    const sdmConfig = asRecord(context?.sdm_config);
    const sunProduct = asRecord(asRecord(sdmConfig.sun).product);
    expectedProduct = String(sunProduct.name || sdmConfig.productName || sdmConfig.product_name || sdmConfig.title || expectedProduct);
    expectedIssuer = String(context?.tenant_name || expectedIssuer);
  }

  try {
    const receiptFileName = typeof body.receiptFileName === "string"
      ? body.receiptFileName.trim().slice(0, 200)
      : null;
    const ocrResult = await performReceiptOcr(
      receiptImage.dataUrl,
      expectedProduct,
      expectedIssuer,
      receiptFileName,
    );
    const decision = evaluateReceiptOcrForOwnership(ocrResult);
    const providerUnavailable = ocrResult.provenance.mode === "unavailable";

    return json({
      ok: !providerUnavailable,
      ocr: ocrResult,
      claim_eligible: false,
      review_required: true,
      reason: decision.ok ? "receipt_manual_review_required" : decision.reason,
      error: decision.ok
        ? "El OCR sólo asiste la extracción; ownership requiere POS firmado, PIN o aprobación manual."
        : decision.message,
      evidence_boundary: "OCR does not validate payment, retailer authorization, physical custody or ownership.",
      trace_id: traceId,
    }, providerUnavailable ? 503 : 200);
  } catch (error) {
    console.error("[receipt-ocr] provider processing failed", error);
    return json({ ok: false, reason: "ocr_internal_error", trace_id: traceId }, 500);
  }
}
