export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { productUrls } from "@product/config";
import {
  executeConfiguredOfflineSunSync,
  isOfflineSunScanId,
  normalizeOfflineSunParams,
  offlineSunIdFromParams,
} from "../../../../lib/offline-sun-contract";
import {
  consumePublicApiRateLimit,
  isJsonRequest,
  isSameOriginRequest,
  parseJsonRecord,
  readBoundedText,
} from "../../../../lib/public-api-guard";

const MAX_PAYLOAD_BYTES = 4_096;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const ALLOWED_BODY_KEYS = new Set(["schemaVersion", "scanId", "params"]);

function json(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
      "x-nexid-offline-level": "consumer-1",
      ...headers,
    },
  });
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return json({ ok: false, reason: "forbidden" }, 403);
  if (!isJsonRequest(req)) return json({ ok: false, reason: "unsupported_media_type" }, 415);

  const retryAfter = consumePublicApiRateLimit("offline-sun-sync", req, {
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (retryAfter > 0) {
    return json({ ok: false, reason: "rate_limited" }, 429, { "retry-after": String(retryAfter) });
  }

  const bounded = await readBoundedText(req, MAX_PAYLOAD_BYTES);
  if (!bounded.ok) return json({ ok: false, reason: bounded.reason }, bounded.status);
  const body = parseJsonRecord(bounded.text);
  if (!body) return json({ ok: false, reason: "invalid_json" }, 400);
  if (Object.keys(body).some((key) => !ALLOWED_BODY_KEYS.has(key))) {
    return json({ ok: false, reason: "unexpected_field" }, 400);
  }
  if (body.schemaVersion !== 1 || !isOfflineSunScanId(body.scanId)) {
    return json({ ok: false, reason: "invalid_scan_envelope" }, 400);
  }

  const normalized = normalizeOfflineSunParams(body.params);
  if (!normalized.ok) return json({ ok: false, reason: normalized.reason }, 400);
  const expectedScanId = await offlineSunIdFromParams(normalized.params);
  if (body.scanId !== expectedScanId) {
    return json({ ok: false, reason: "scan_fingerprint_mismatch" }, 400);
  }

  // The upstream host is deployment configuration. Caller input contributes
  // only validated SUN fields, never a URL, protocol, origin, host or path.
  const execution = await executeConfiguredOfflineSunSync(productUrls.api, normalized.params);
  if (!execution.ok) {
    return json(
      { ok: false, reason: execution.reason },
      execution.status,
      execution.retryAfter ? { "retry-after": String(execution.retryAfter) } : {},
    );
  }
  return json({ ok: true, scanId: body.scanId, ...execution.result });
}
