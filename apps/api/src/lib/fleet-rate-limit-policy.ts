export type FleetRateLimitClass = "auth" | "proof_write" | "webhook" | "public";

export type FleetRateLimitInput = {
  method: string;
  pathname: string;
  tenantId?: string | null;
  subjectId?: string | null;
  clientIp?: string | null;
};

export type FleetRateLimitDecision = {
  rateClass: FleetRateLimitClass;
  key: string;
  limit: number;
  windowSeconds: number;
  retryAfterSeconds: number;
  headers: Record<string, string>;
};

const classes: Record<FleetRateLimitClass, { limit: number; windowSeconds: number }> = {
  auth: { limit: 20, windowSeconds: 60 },
  proof_write: { limit: 60, windowSeconds: 60 },
  webhook: { limit: 120, windowSeconds: 60 },
  public: { limit: 120, windowSeconds: 60 },
};

function safePart(value: unknown, fallback: string) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z0-9:._-]{1,160}$/.test(normalized) ? normalized : fallback;
}

export function classifyFleetRateLimit(pathname: string, method: string): FleetRateLimitClass {
  const path = String(pathname || "");
  const verb = String(method || "GET").toUpperCase();
  if (path === "/auth/login" || path.startsWith("/auth/") || path.includes("/wallet/challenge")) return "auth";
  if (verb !== "GET" && (path.includes("/proof/anchors") || path.includes("/anchor-evidence") || path.includes("/tokenization"))) return "proof_write";
  if (path.includes("/webhooks") || path.includes("/webhook")) return "webhook";
  return "public";
}

export function buildFleetRateLimitDecision(input: FleetRateLimitInput): FleetRateLimitDecision {
  const rateClass = classifyFleetRateLimit(input.pathname, input.method);
  const config = classes[rateClass];
  const tenant = safePart(input.tenantId, "tenant:unknown");
  const subject = safePart(input.subjectId, "subject:anonymous");
  const ip = safePart(input.clientIp, "ip:unknown");
  const key = `${rateClass}:${tenant}:${subject}:${ip}`;
  return {
    rateClass,
    key,
    limit: config.limit,
    windowSeconds: config.windowSeconds,
    retryAfterSeconds: config.windowSeconds,
    headers: {
      "x-ratelimit-policy": `nexid-${rateClass}`,
      "x-ratelimit-limit": String(config.limit),
      "x-ratelimit-window": String(config.windowSeconds),
      "retry-after": String(config.windowSeconds),
    },
  };
}
