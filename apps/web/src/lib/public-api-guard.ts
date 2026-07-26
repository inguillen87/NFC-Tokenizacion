type RateBucket = { count: number; resetAt: number };

const MAX_RATE_BUCKETS = 8_192;
const rateBuckets = new Map<string, RateBucket>();

function clean(value: unknown) {
  return String(value ?? "").trim();
}

/**
 * Public browser routes must never spend a server-owned provider credential in
 * production without a distributed quota and a signed/authenticated caller.
 * Local provider calls are opt-in so a developer can still exercise the live
 * integration without weakening the deployed fallback experience.
 */
export function allowLocalServerFundedProviderCalls() {
  const nodeEnv = clean(process.env.NODE_ENV).toLowerCase();
  const vercelEnv = clean(process.env.VERCEL_ENV).toLowerCase();
  if (nodeEnv === "production" || vercelEnv === "production") return false;
  return clean(process.env.NEXID_LOCAL_PROVIDER_CALLS_ENABLED).toLowerCase() === "true";
}

export function isSameOriginRequest(req: Request) {
  const origin = clean(req.headers.get("origin"));
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

export function isJsonRequest(req: Request) {
  return clean(req.headers.get("content-type")).toLowerCase().startsWith("application/json");
}

function clientKey(req: Request) {
  const forwarded = clean(req.headers.get("x-forwarded-for")).split(",")[0]?.trim();
  return forwarded || clean(req.headers.get("x-real-ip")) || "unknown";
}

export function consumePublicApiRateLimit(
  scope: string,
  req: Request,
  options: { max: number; windowMs: number; now?: number },
) {
  const now = options.now ?? Date.now();
  const key = `${scope}:${clientKey(req)}`;

  if (!rateBuckets.has(key) && rateBuckets.size >= MAX_RATE_BUCKETS) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
    while (rateBuckets.size >= MAX_RATE_BUCKETS) {
      const oldestKey = rateBuckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      rateBuckets.delete(oldestKey);
    }
  }

  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return 0;
  }
  if (current.count >= options.max) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  }
  current.count += 1;
  return 0;
}

export async function readBoundedText(req: Request, maxBytes: number) {
  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false as const, reason: "payload_too_large", status: 413 };
  }

  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false as const, reason: "payload_too_large", status: 413 };
  }
  return { ok: true as const, text };
}

export function parseJsonRecord(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}
