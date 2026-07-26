import { createHash } from "node:crypto";
import {
  buildFleetRateLimitDecision,
  type FleetRateLimitClass,
} from "./fleet-rate-limit-policy";
import { json } from "./http";
import { getRequestMeta } from "./request-meta";
import {
  hitSunRateLimit,
  shouldFailClosedSunRateLimit,
} from "./sun-rate-limit-store";

export type CriticalRateLimitClass = Extract<
  FleetRateLimitClass,
  "auth" | "proof_write" | "ai_expensive" | "public_write" | "webhook" | "sdk_read" | "sdk_write" | "public"
>;

type CriticalRateLimitInput = {
  rateClass: CriticalRateLimitClass;
  tenantId?: string | null;
  subjectId?: string | null;
  globalPrincipal?: boolean;
};

type Reservation = Awaited<ReturnType<typeof hitSunRateLimit>>;

type CriticalRateLimitDependencies = {
  reserve?: (
    scope: string,
    scopeKey: string,
    windowSeconds: number,
    maxHits: number,
  ) => Promise<Reservation>;
  requestMeta?: typeof getRequestMeta;
  failClosed?: () => boolean;
};

type SdkRateLimitContext = {
  tenantId: string;
  apiKeyId: string;
};

function responseHeaders(
  decision: ReturnType<typeof buildFleetRateLimitDecision>,
  retryAfterSeconds: number,
) {
  return {
    ...decision.headers,
    "cache-control": "no-store",
    "retry-after": String(Math.max(1, Math.ceil(retryAfterSeconds))),
  };
}

/**
 * Enforces route-local critical and SDK limits. The raw dimensions exist only in
 * memory; hitSunRateLimit HMACs the complete key before it reaches PostgreSQL.
 * Authentication must run before this helper for credentialed routes.
 */
export async function enforceCriticalRateLimit(
  req: Request,
  input: CriticalRateLimitInput,
  dependencies: CriticalRateLimitDependencies = {},
): Promise<Response | null> {
  const meta = (dependencies.requestMeta || getRequestMeta)(req);
  const decision = buildFleetRateLimitDecision({
    method: req.method,
    pathname: new URL(req.url).pathname,
    tenantId: input.tenantId,
    subjectId: input.subjectId,
    clientIp: meta.ip,
  });

  // A route added without a matching central policy is an unsafe deployment,
  // not a reason to silently fall back to the broader public allowance.
  if (decision.rateClass !== input.rateClass) {
    return json(
      { ok: false, reason: "rate_limit_policy_mismatch" },
      503,
      responseHeaders(decision, 30),
    );
  }

  const reserve = dependencies.reserve || hitSunRateLimit;
  const failClosed = dependencies.failClosed || shouldFailClosedSunRateLimit;
  try {
    // The tenant bucket provides fair isolation. The additional principal
    // bucket prevents an authenticated caller from evading the limit by
    // rotating otherwise-valid tenant or scope headers.
    const principalDecision = buildFleetRateLimitDecision({
      method: req.method,
      pathname: new URL(req.url).pathname,
      tenantId: "all-tenants",
      subjectId: input.subjectId,
      clientIp: input.globalPrincipal ? "all-sources" : meta.ip,
    });
    const buckets = [
      { scope: `fleet:${decision.rateClass}:principal`, key: principalDecision.key },
      { scope: `fleet:${decision.rateClass}:tenant`, key: decision.key },
    ];
    for (const bucket of buckets) {
      const reservation = await reserve(
        bucket.scope,
        bucket.key,
        decision.windowSeconds,
        decision.limit,
      );
      if (reservation.unavailable) {
        if (!failClosed()) return null;
        return json(
          { ok: false, reason: "rate_limit_unavailable" },
          503,
          responseHeaders(decision, reservation.retryAfterSeconds || 30),
        );
      }
      if (reservation.limited) {
        return json(
          { ok: false, reason: "rate_limited" },
          429,
          responseHeaders(decision, reservation.retryAfterSeconds),
        );
      }
    }
    return null;
  } catch {
    if (!failClosed()) return null;
    return json(
      { ok: false, reason: "rate_limit_unavailable" },
      503,
      responseHeaders(decision, 30),
    );
  }
}

/** Source-only guard that runs before an untrusted SDK key reaches auth SQL. */
export async function enforceSdkAuthenticationRateLimit(
  req: Request,
  dependencies: CriticalRateLimitDependencies = {},
): Promise<Response | null> {
  const meta = (dependencies.requestMeta || getRequestMeta)(req);
  const decision = buildFleetRateLimitDecision({
    method: "POST",
    pathname: "/_rate-limit/sdk-auth",
    tenantId: "platform",
    subjectId: "sdk:unauthenticated",
    clientIp: meta.ip,
  });
  const reserve = dependencies.reserve || hitSunRateLimit;
  const failClosed = dependencies.failClosed || shouldFailClosedSunRateLimit;
  try {
    const reservation = await reserve(
      "fleet:sdk_auth:source",
      decision.key,
      decision.windowSeconds,
      decision.limit,
    );
    if (reservation.unavailable) {
      if (!failClosed()) return null;
      return json(
        { ok: false, reason: "rate_limit_unavailable" },
        503,
        responseHeaders(decision, reservation.retryAfterSeconds || 30),
      );
    }
    if (!reservation.limited) return null;
    return json(
      { ok: false, reason: "rate_limited" },
      429,
      responseHeaders(decision, reservation.retryAfterSeconds),
    );
  } catch {
    if (!failClosed()) return null;
    return json(
      { ok: false, reason: "rate_limit_unavailable" },
      503,
      responseHeaders(decision, 30),
    );
  }
}

/** Source-only guard that runs before an untrusted webhook reaches body parsing or signature work. */
export async function enforceWebhookAuthenticationRateLimit(
  req: Request,
  dependencies: CriticalRateLimitDependencies = {},
): Promise<Response | null> {
  const meta = (dependencies.requestMeta || getRequestMeta)(req);
  const decision = buildFleetRateLimitDecision({
    method: req.method,
    pathname: new URL(req.url).pathname,
    tenantId: "platform",
    subjectId: "webhook:unauthenticated",
    clientIp: meta.ip,
  });
  if (decision.rateClass !== "webhook") {
    return json(
      { ok: false, reason: "rate_limit_policy_mismatch" },
      503,
      responseHeaders(decision, 30),
    );
  }

  const reserve = dependencies.reserve || hitSunRateLimit;
  const failClosed = dependencies.failClosed || shouldFailClosedSunRateLimit;
  try {
    const reservation = await reserve(
      "fleet:webhook:source",
      decision.key,
      decision.windowSeconds,
      decision.limit,
    );
    if (reservation.unavailable) {
      if (!failClosed()) return null;
      return json(
        { ok: false, reason: "rate_limit_unavailable" },
        503,
        responseHeaders(decision, reservation.retryAfterSeconds || 30),
      );
    }
    if (!reservation.limited) return null;
    return json(
      { ok: false, reason: "rate_limited" },
      429,
      responseHeaders(decision, reservation.retryAfterSeconds),
    );
  } catch {
    if (!failClosed()) return null;
    return json(
      { ok: false, reason: "rate_limit_unavailable" },
      503,
      responseHeaders(decision, 30),
    );
  }
}

export function enforceSdkRateLimit(
  req: Request,
  context: SdkRateLimitContext,
  dependencies: CriticalRateLimitDependencies = {},
) {
  return enforceCriticalRateLimit(req, {
    rateClass: req.method.toUpperCase() === "GET" ? "sdk_read" : "sdk_write",
    tenantId: context.tenantId,
    subjectId: `sdk-key:${context.apiKeyId}`,
  }, dependencies);
}

export function adminCriticalRateLimitIdentity(req: Request) {
  const tenant = String(req.headers.get("x-nexid-tenant-slug") || "").trim();
  const authorization = String(req.headers.get("authorization") || "").trim();
  const credentialDigest = createHash("sha256")
    .update(`nexid-admin-rate-principal-v1\0${authorization}`, "utf8")
    .digest("hex");
  return {
    tenantId: tenant || "platform",
    // Called only after checkAdmin succeeds. The credential never enters the
    // bucket key or database; arbitrary identity/scope headers cannot shard it.
    subjectId: `admin-credential:${credentialDigest}`,
    globalPrincipal: true,
  };
}
