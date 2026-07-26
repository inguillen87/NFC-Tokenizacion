import { json } from "../../../../lib/http";
import { recordDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import { consumeSunFreshHandoff } from "../../../../lib/sun-fresh-handoff";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";

const MAX_WARRANTY_BODY_BYTES = 32 * 1024;

function text(value: unknown, maximum: number) {
  return String(value || "").trim().slice(0, maximum);
}

function contactLooksUsable(value: string) {
  if (!value) return false;
  if (/^[^\s@]{1,64}@[^\s@]{1,255}$/.test(value)) return true;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export async function POST(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "platform",
    subjectId: "register-warranty:public",
  });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_WARRANTY_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json", trace_id: traceId }, tooLarge ? 413 : 400);
  }
  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, target.status);
  const { bid, uid, eventId } = target;

  const auth = requireShareToken(req, bid, target.shareUid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);
  if (!eventId) {
    return json({
      ok: false,
      reason: "fresh_nfc_evidence_required_for_warranty",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: "fresh_event_required",
    }, 403);
  }
  if (!target.warrantyPolicy || target.warrantyPolicy === "disabled") {
    return json({
      ok: false,
      reason: target.warrantyPolicy === "disabled" ? "warranty_requests_disabled" : "warranty_policy_configuration_required",
      trace_id: traceId,
      warranty_confirmed: false,
    }, 403);
  }

  const consumer = await getConsumerFromRequest(req).catch(() => null);
  const providedContact = text(body.contact || body.email || body.phone || body.whatsapp, 320);
  const verifiedContact = text(consumer?.email || consumer?.phone, 320);
  const contactAvailable = Boolean(verifiedContact) || contactLooksUsable(providedContact);
  const purchaseReference = text(body.purchase_reference || body.receipt_reference || body.receiptDate || body.purchase_date, 160);
  const purchaseEvidenceProvided = Boolean(purchaseReference || body.receiptFileData || body.receipt_file_data);
  const termsAccepted = body.terms_accepted === true || body.termsAccepted === true;
  const missingRequirements = [
    !contactAvailable ? "consumer_or_contact" : "",
    !purchaseEvidenceProvided ? "purchase_evidence" : "",
    !termsAccepted ? "warranty_terms_acceptance" : "",
  ].filter(Boolean);

  const fresh = await consumeSunFreshHandoff(req, body, { bid, eventId }, "public_register_warranty");
  if (!fresh.ok) {
    const freshReason = fresh.reason;
    return json({
      ok: false,
      reason: "fresh_nfc_evidence_required_for_warranty",
      trace_id: traceId,
      share_token_status: auth.share_token_status,
      fresh_token_status: freshReason,
    }, 403);
  }

  const saved = await recordDemoCta("warranty_review_requested", bid, uid, {
    request_status: "pending_review",
    provenance: "demo_cta_action_log",
    event_id: eventId,
    tenant_id: target.tenantId,
    warranty_policy: target.warrantyPolicy,
    warranty_policy_source: target.warrantyPolicySource,
    consumer_authenticated: Boolean(consumer?.id),
    contact_provided: contactAvailable,
    purchase_evidence_provided: purchaseEvidenceProvided,
    terms_accepted: termsAccepted,
    missing_requirements: missingRequirements,
    fresh_handoff_exp: fresh.payload.exp,
  });
  return json({
    ok: true,
    action: "register_warranty",
    request_status: "pending_review",
    outcome: "request_recorded",
    warranty_confirmed: false,
    warranty: { status: "pending_review", confirmed: false },
    request: { id: saved.id, recorded_at: saved.created_at },
    requirements: {
      tenant_policy: "configured",
      consumer_or_contact: contactAvailable,
      purchase_evidence: purchaseEvidenceProvided,
      terms_accepted: termsAccepted,
      missing: missingRequirements,
    },
    provenance: { mode: "demo_action_log", system: "demo_cta_actions", real_warranty_service: false },
    trace_id: traceId,
    share_token_status: auth.share_token_status,
    fresh_token_status: "accepted",
  }, 202);
}
