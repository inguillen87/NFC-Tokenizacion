import { json } from "./http";

export type ConsumerMutationOriginReason =
  | "configured_origin"
  | "origin_missing"
  | "origin_invalid"
  | "origin_not_allowed"
  | "fetch_site_conflict";

export type ConsumerMutationOriginDecision = {
  allowed: boolean;
  reason: ConsumerMutationOriginReason;
  origin: string | null;
};

type ConsumerMutationOriginOptions = {
  allowedOrigins?: readonly string[];
  nodeEnvironment?: string;
  vercelEnvironment?: string;
};

const PRODUCTION_ORIGINS = [
  "https://nexid.lat",
  "https://www.nexid.lat",
  "https://api.nexid.lat",
] as const;

const LOCAL_DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3003",
  "http://127.0.0.1:3003",
] as const;

const ORIGIN_ENV_NAMES = [
  "CONSUMER_PORTAL_URL",
  "NEXID_PUBLIC_WEB_URL",
  "NEXT_PUBLIC_WEB_URL",
  "NEXT_PUBLIC_WEB_BASE_URL",
  "WEB_BASE_URL",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "API_BASE_URL",
] as const;

function clean(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function loopback(hostname: string) {
  return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(hostname);
}

function exactOrigin(value: unknown, allowLoopbackHttp: boolean) {
  const raw = clean(value);
  if (!raw || raw === "null") return null;
  try {
    const parsed = new URL(raw);
    const safeProtocol = parsed.protocol === "https:"
      || (allowLoopbackHttp && parsed.protocol === "http:" && loopback(parsed.hostname));
    if (!safeProtocol) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (parsed.pathname !== "/") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function productionRuntime(options: ConsumerMutationOriginOptions) {
  const nodeEnvironment = clean(options.nodeEnvironment ?? process.env.NODE_ENV).toLowerCase();
  const vercelEnvironment = clean(options.vercelEnvironment ?? process.env.VERCEL_ENV).toLowerCase();
  return nodeEnvironment === "production" || vercelEnvironment === "production";
}

function configuredOrigins(options: ConsumerMutationOriginOptions) {
  const production = productionRuntime(options);
  const candidates = options.allowedOrigins
    ? [...options.allowedOrigins]
    : [
        ...PRODUCTION_ORIGINS,
        ...(production ? [] : LOCAL_DEVELOPMENT_ORIGINS),
        ...ORIGIN_ENV_NAMES.map((name) => process.env[name]),
        ...clean(process.env.CONSUMER_MUTATION_ALLOWED_ORIGINS).split(/[\s,]+/),
      ];
  return new Set(
    candidates
      .map((candidate) => exactOrigin(candidate, !production))
      .filter((candidate): candidate is string => Boolean(candidate)),
  );
}

/**
 * Protects cookie-authenticated consumer mutations from cross-site and hostile
 * same-site subdomain requests. The request Host/X-Forwarded-Host is never an
 * authorization input: callers must present an exact configured Origin.
 *
 * Fetch Metadata is an additional contradiction check, not a replacement for
 * Origin. Server/BFF callers must forward or set the canonical public Origin.
 */
export function consumerMutationOriginDecision(
  req: Request,
  options: ConsumerMutationOriginOptions = {},
): ConsumerMutationOriginDecision {
  const rawOrigin = req.headers.get("origin");
  if (!rawOrigin) return { allowed: false, reason: "origin_missing", origin: null };

  const origin = exactOrigin(rawOrigin, !productionRuntime(options));
  if (!origin) return { allowed: false, reason: "origin_invalid", origin: null };
  if (!configuredOrigins(options).has(origin)) {
    return { allowed: false, reason: "origin_not_allowed", origin };
  }

  const fetchSite = clean(req.headers.get("sec-fetch-site")).toLowerCase();
  if (fetchSite === "cross-site") {
    return { allowed: false, reason: "fetch_site_conflict", origin };
  }
  return { allowed: true, reason: "configured_origin", origin };
}

export function enforceConsumerMutationOrigin(
  req: Request,
  options: ConsumerMutationOriginOptions = {},
) {
  const decision = consumerMutationOriginDecision(req, options);
  if (decision.allowed) return null;
  return json({ ok: false, error: "cross_site_request_blocked" }, 403, {
    "cache-control": "no-store",
    vary: "Origin, Sec-Fetch-Site",
  });
}
