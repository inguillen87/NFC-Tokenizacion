export type FleetRateLimitClass =
  | "auth"
  | "nfc"
  | "proof_write"
  | "ai_expensive"
  | "public_write"
  | "webhook"
  | "sdk_auth"
  | "sdk_read"
  | "sdk_write"
  | "public";

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
  nfc: { limit: 120, windowSeconds: 60 },
  proof_write: { limit: 60, windowSeconds: 60 },
  ai_expensive: { limit: 10, windowSeconds: 60 },
  public_write: { limit: 20, windowSeconds: 60 },
  webhook: { limit: 120, windowSeconds: 60 },
  sdk_auth: { limit: 1_200, windowSeconds: 60 },
  sdk_read: { limit: 1_200, windowSeconds: 60 },
  sdk_write: { limit: 600, windowSeconds: 60 },
  public: { limit: 120, windowSeconds: 60 },
};

function safePart(value: unknown, fallback: string) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z0-9:._-]{1,160}$/.test(normalized) ? normalized : fallback;
}

export function classifyFleetRateLimit(pathname: string, method: string): FleetRateLimitClass {
  const path = String(pathname || "").trim().toLowerCase().replace(/\/+$/, "") || "/";
  const verb = String(method || "GET").toUpperCase();
  if (
    path === "/auth/login"
    || path === "/api/session/login"
    || path.startsWith("/auth/")
    || path.startsWith("/consumer/auth/")
    || path.startsWith("/consumer/wallet/")
    || path.startsWith("/consumer/associate/")
    || path.startsWith("/api/consumer/auth/")
    || path.includes("/wallet/challenge")
  ) return "auth";
  if (path === "/_rate-limit/sdk-auth") return "sdk_auth";
  if (path.startsWith("/api/v1/sdk/")) return verb === "GET" ? "sdk_read" : "sdk_write";
  if (path === "/sun") return "nfc";
  if (path === "/assistant/chat" || path === "/realtime/session") return "ai_expensive";
  if (path === "/public/leads" || path === "/sun/context") return "public_write";
  if (path === "/public/proof/verify" || path === "/public/proof/decode" || path === "/public/cta/provenance") return "proof_write";
  if (verb !== "GET" && (
    path === "/sun/simulate"
    || path === "/admin/proof/anchor"
    || path === "/admin/proof/events"
    || path.includes("/proof/anchors")
    || path.includes("/anchor-evidence")
    || path.includes("/tokenization")
    || path === "/public/cta/tokenize-request"
    || path === "/public/cta/receipt-ocr"
    || path === "/public/cta/claim-ownership"
    || path === "/public/cta/report-problem"
    || path === "/public/cta/register-warranty"
    || path === "/marketplace/p2p/buy"
  )) return "proof_write";
  if (path.startsWith("/twilio/") || path.includes("/webhooks") || path.includes("/webhook")) return "webhook";
  if (verb !== "GET" && (path.startsWith("/consumer/") || path.startsWith("/mobile/"))) return "public_write";
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
