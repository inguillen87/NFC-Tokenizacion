import { json } from "../../../../../lib/http";
import {
  CBV_VERSION,
  EPCIS_CAPTURE_MAX_BYTES,
  EPCIS_CAPTURE_MAX_EVENTS,
  EPCIS_QUERY_MAX_LIMIT,
  EPCIS_RESPONSE_HEADERS,
  EPCIS_VERSION,
  EpcisError,
} from "../../../../../lib/epcis";

export function epcisErrorResponse(error: unknown) {
  if (error instanceof EpcisError) {
    return json({
      ok: false,
      reason: error.code,
      ...(error.status < 500 && error.detail ? { detail: error.detail } : {}),
      epcisVersion: EPCIS_VERSION,
      cbvVersion: CBV_VERSION,
    }, error.status, EPCIS_RESPONSE_HEADERS);
  }
  return json({
    ok: false,
    reason: "epcis_service_unavailable",
    epcisVersion: EPCIS_VERSION,
    cbvVersion: CBV_VERSION,
  }, 503, { ...EPCIS_RESPONSE_HEADERS, "retry-after": "5" });
}

export function epcisOptions(methods: string) {
  return new Response(null, {
    status: 204,
    headers: {
      ...EPCIS_RESPONSE_HEADERS,
      allow: methods,
      "access-control-allow-methods": methods,
      "access-control-allow-headers": "Authorization, Content-Type, Idempotency-Key, X-NexID-API-Key, X-NexID-Tenant-Slug, X-NexID-Trace-ID",
      "access-control-max-age": "86400",
      "epcis-capture-file-size-limit": String(EPCIS_CAPTURE_MAX_BYTES),
      "x-nexid-epcis-event-limit": String(EPCIS_CAPTURE_MAX_EVENTS),
      "x-nexid-epcis-query-limit": String(EPCIS_QUERY_MAX_LIMIT),
      "x-nexid-epcis-profile": "bounded-foundation-not-certified",
    },
  });
}

export const EPCIS_ROUTE_HEADERS = {
  ...EPCIS_RESPONSE_HEADERS,
  "x-nexid-epcis-profile": "bounded-foundation-not-certified",
} as const;
