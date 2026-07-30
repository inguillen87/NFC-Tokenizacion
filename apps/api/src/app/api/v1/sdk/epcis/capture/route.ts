export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { RequestBodyTooLargeError, readRequestTextBounded } from "../../../../../../lib/bounded-request-body";
import { enforceSdkAuthenticationRateLimit, enforceSdkEpcisCaptureRateLimit } from "../../../../../../lib/critical-rate-limit";
import {
  captureEpcisDocument,
  EPCIS_CAPTURE_MAX_BYTES,
  EPCIS_RESPONSE_HEADERS,
  EpcisError,
} from "../../../../../../lib/epcis";
import { json } from "../../../../../../lib/http";
import { authenticateSdkRequest, logSdkUsage } from "../../../../../../lib/sdk-auth";
import { epcisErrorResponse, epcisOptions, EPCIS_ROUTE_HEADERS } from "../_shared";

const CONTENT_TYPES = ["application/json", "application/ld+json", "application/vnd.gs1.epcis+json"];

export async function OPTIONS() {
  return epcisOptions("POST, OPTIONS");
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const authLimited = await enforceSdkAuthenticationRateLimit(req);
  if (authLimited) return authLimited;
  const auth = await authenticateSdkRequest(req, "sdk:epcis:write");
  if (!auth.ok) {
    await logSdkUsage({ req, endpoint: "sdk.epcis.capture", statusCode: auth.response.status, startedAt, reason: "auth_failed" });
    return auth.response;
  }
  const limited = await enforceSdkEpcisCaptureRateLimit(req, auth.context);
  if (limited) return limited;
  const contentType = String(req.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (!CONTENT_TYPES.includes(contentType)) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.epcis.capture", statusCode: 415, startedAt, reason: "epcis_media_type_unsupported" });
    return json({ ok: false, reason: "epcis_media_type_unsupported" }, 415, EPCIS_RESPONSE_HEADERS);
  }

  let document: unknown;
  try {
    const raw = await readRequestTextBounded(req, EPCIS_CAPTURE_MAX_BYTES);
    document = JSON.parse(raw);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    const response = new EpcisError(tooLarge ? "epcis_document_too_large" : "epcis_json_invalid", tooLarge ? 413 : 400);
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.epcis.capture", statusCode: response.status, startedAt, reason: response.code });
    return epcisErrorResponse(response);
  }

  try {
    const receipt = await captureEpcisDocument({
      tenantId: auth.context.tenantId,
      apiKeyId: auth.context.apiKeyId,
      idempotencyKey: req.headers.get("idempotency-key") || "",
      document,
    });
    await logSdkUsage({
      req,
      context: auth.context,
      endpoint: "sdk.epcis.capture",
      statusCode: 200,
      startedAt,
      meta: {
        captureId: receipt.captureId,
        eventCount: receipt.eventCount,
        canonicalProjectionCount: receipt.canonicalProjectionCount,
        replayed: receipt.replayed,
      },
    });
    return json({
      ok: true,
      captureID: receipt.captureId,
      documentRecordID: receipt.documentRecordId,
      eventCount: receipt.eventCount,
      canonicalProjectionCount: receipt.canonicalProjectionCount,
      capturedAt: receipt.capturedAt,
      replayed: receipt.replayed,
      evidence: {
        level: "declared_business_event",
        cryptographicNfcAuthentication: false,
      },
    }, 200, {
      ...EPCIS_ROUTE_HEADERS,
      "idempotent-replayed": receipt.replayed ? "true" : "false",
    });
  } catch (error) {
    const response = epcisErrorResponse(error);
    const reason = error instanceof EpcisError ? error.code : "epcis_service_unavailable";
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.epcis.capture", statusCode: response.status, startedAt, reason });
    return response;
  }
}
