export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { enforceSdkAuthenticationRateLimit, enforceSdkRateLimit } from "../../../../../../lib/critical-rate-limit";
import { json } from "../../../../../../lib/http";
import { authenticateSdkRequest, logSdkUsage } from "../../../../../../lib/sdk-auth";
import {
  parseSdkIdempotencyOperation,
  readSdkIdempotencyStatus,
  SDK_IDEMPOTENCY_OPERATIONS,
} from "../../_idempotency";

async function handle(req: Request, reconcile: boolean) {
  const startedAt = Date.now();
  const operationName = parseSdkIdempotencyOperation(new URL(req.url).searchParams.get("operation"));
  if (!operationName) {
    return json({
      ok: false,
      reason: "idempotency_operation_required",
      allowed: Object.keys(SDK_IDEMPOTENCY_OPERATIONS),
    }, 400, { "cache-control": "no-store" });
  }

  const authRateLimited = await enforceSdkAuthenticationRateLimit(req);
  if (authRateLimited) return authRateLimited;
  const definition = SDK_IDEMPOTENCY_OPERATIONS[operationName];
  const auth = await authenticateSdkRequest(req, definition.scope);
  if (!auth.ok) {
    await logSdkUsage({
      req,
      endpoint: reconcile ? "sdk.idempotency.reconcile" : "sdk.idempotency.status",
      statusCode: auth.response.status,
      startedAt,
      reason: "auth_failed",
      meta: { operation: operationName },
    });
    return auth.response;
  }
  const rateLimited = await enforceSdkRateLimit(req, auth.context);
  if (rateLimited) return rateLimited;

  const key = String(req.headers.get("idempotency-key") || "").trim();
  try {
    const result = await readSdkIdempotencyStatus({
      tenantId: auth.context.tenantId,
      route: definition.route,
      key,
      reconcile,
    });
    if (!result.ok) {
      await logSdkUsage({
        req,
        context: auth.context,
        endpoint: reconcile ? "sdk.idempotency.reconcile" : "sdk.idempotency.status",
        statusCode: result.status,
        startedAt,
        reason: result.reason,
        meta: { operation: operationName },
      });
      return json({ ok: false, reason: result.reason, traceId: auth.context.traceId }, result.status, {
        "cache-control": "no-store",
        "x-nexid-trace-id": auth.context.traceId,
      });
    }
    await logSdkUsage({
      req,
      context: auth.context,
      endpoint: reconcile ? "sdk.idempotency.reconcile" : "sdk.idempotency.status",
      statusCode: 200,
      startedAt,
      meta: { operation: operationName, state: result.body.state, resourceId: result.body.resourceId },
    });
    return json({ ...result.body, operation: operationName, reconciled: reconcile }, 200, {
      "cache-control": "no-store",
      "x-nexid-trace-id": auth.context.traceId,
    });
  } catch {
    await logSdkUsage({
      req,
      context: auth.context,
      endpoint: reconcile ? "sdk.idempotency.reconcile" : "sdk.idempotency.status",
      statusCode: 503,
      startedAt,
      reason: "idempotency_store_unavailable",
      meta: { operation: operationName },
    });
    return json({
      ok: false,
      reason: "idempotency_store_unavailable",
      retryable: true,
      traceId: auth.context.traceId,
    }, 503, {
      "cache-control": "no-store",
      "retry-after": "2",
      "x-nexid-trace-id": auth.context.traceId,
    });
  }
}

export async function GET(req: Request) {
  return handle(req, false);
}

/**
 * Performs a read-only reconciliation scan against the linked business record.
 * It never re-executes the original mutation and never invents a successful
 * webhook delivery when the outbox outcome is still uncertain.
 */
export async function POST(req: Request) {
  return handle(req, true);
}
