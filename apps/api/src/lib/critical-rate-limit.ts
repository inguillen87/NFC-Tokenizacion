import { getAdminPrincipal } from "./auth";
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
  "auth" | "proof_write" | "ai_expensive" | "public_write" | "webhook" | "sdk_read" | "sdk_write" | "sdk_epcis_capture" | "observability_read" | "public"
>;

type CriticalRateLimitInput = {
  rateClass: CriticalRateLimitClass;
  tenantId?: string | null;
  subjectId?: string | null;
  globalPrincipal?: boolean;
  tenantWide?: boolean;
  limitScale?: number;
  rateLimitProfile?: string;
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
  rateLimitProfile?: "conservative" | "standard" | "high_throughput";
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
  const effectiveLimit = Math.max(1, Math.floor(decision.limit * Math.min(Math.max(input.limitScale ?? 1, 0.1), 4)));
  const effectiveDecision = {
    ...decision,
    limit: effectiveLimit,
    headers: {
      ...decision.headers,
      "x-ratelimit-limit": String(effectiveLimit),
      ...(input.rateLimitProfile ? { "x-nexid-rate-limit-profile": input.rateLimitProfile } : {}),
    },
  };

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
    // The principal and contextual tenant buckets isolate callers. Expensive
    // fan-out routes can additionally reserve one tenant-wide bucket that is
    // invariant across credentials, sessions and source addresses.
    const principalDecision = buildFleetRateLimitDecision({
      method: req.method,
      pathname: new URL(req.url).pathname,
      tenantId: "all-tenants",
      subjectId: input.subjectId,
      clientIp: input.globalPrincipal ? "all-sources" : meta.ip,
    });
    const tenantWideDecision = input.tenantWide
      ? buildFleetRateLimitDecision({
          method: req.method,
          pathname: new URL(req.url).pathname,
          tenantId: input.tenantId,
          subjectId: "all-subjects",
          clientIp: "all-sources",
        })
      : null;
    const buckets = [
      ...(tenantWideDecision
        ? [{ scope: `fleet:${decision.rateClass}:tenant-wide`, key: tenantWideDecision.key }]
        : []),
      { scope: `fleet:${decision.rateClass}:principal`, key: principalDecision.key },
      { scope: `fleet:${decision.rateClass}:tenant`, key: decision.key },
    ];
    for (const bucket of buckets) {
      const reservation = await reserve(
        bucket.scope,
        bucket.key,
        decision.windowSeconds,
        effectiveLimit,
      );
      if (reservation.unavailable) {
        if (!failClosed()) return null;
        return json(
          { ok: false, reason: "rate_limit_unavailable" },
          503,
          responseHeaders(effectiveDecision, reservation.retryAfterSeconds || 30),
        );
      }
      if (reservation.limited) {
        return json(
          { ok: false, reason: "rate_limited" },
          429,
          responseHeaders(effectiveDecision, reservation.retryAfterSeconds),
        );
      }
    }
    return null;
  } catch {
    if (!failClosed()) return null;
    return json(
      { ok: false, reason: "rate_limit_unavailable" },
      503,
      responseHeaders(effectiveDecision, 30),
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
  const profile = context.rateLimitProfile || "standard";
  const limitScale = profile === "conservative" ? 0.5 : profile === "high_throughput" ? 2 : 1;
  return enforceCriticalRateLimit(req, {
    rateClass: req.method.toUpperCase() === "GET" ? "sdk_read" : "sdk_write",
    tenantId: context.tenantId,
    subjectId: `sdk-key:${context.apiKeyId}`,
    limitScale,
    rateLimitProfile: profile,
  }, dependencies);
}

export function enforceSdkEpcisCaptureRateLimit(
  req: Request,
  context: SdkRateLimitContext,
  dependencies: CriticalRateLimitDependencies = {},
) {
  const profile = context.rateLimitProfile || "standard";
  const limitScale = profile === "conservative" ? 0.5 : profile === "high_throughput" ? 2 : 1;
  return enforceCriticalRateLimit(req, {
    rateClass: "sdk_epcis_capture",
    tenantId: context.tenantId,
    subjectId: `sdk-key:${context.apiKeyId}`,
    globalPrincipal: true,
    tenantWide: true,
    limitScale,
    rateLimitProfile: profile,
  }, dependencies);
}

export function adminCriticalRateLimitIdentity(req: Request) {
  const principal = getAdminPrincipal(req);
  return {
    tenantId: principal.tenantId || "platform",
    // Called only after checkAdmin succeeds. Stable database identities prevent
    // caller headers or token rotation from sharding the rate-limit bucket.
    subjectId: `admin-user:${principal.userId}`,
    globalPrincipal: true,
  };
}
