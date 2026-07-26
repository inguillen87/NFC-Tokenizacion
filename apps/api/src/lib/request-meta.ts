import { isIP } from "node:net";

function normalizeIp(value: string | null) {
  const candidate = String(value || "").trim();
  if (!candidate) return null;
  if (isIP(candidate)) return candidate;

  const bracketed = candidate.match(/^\[([^\]]+)](?::\d{1,5})?$/);
  if (bracketed && isIP(bracketed[1])) return bracketed[1];

  const ipv4WithPort = candidate.match(/^([^:]+):(\d{1,5})$/);
  if (ipv4WithPort && isIP(ipv4WithPort[1]) === 4) return ipv4WithPort[1];
  return null;
}

type Env = Record<string, string | undefined>;

function productionRuntime(env: Env) {
  return String(env.NODE_ENV || "").trim().toLowerCase() === "production"
    || String(env.VERCEL_ENV || "").trim().toLowerCase() === "production";
}

export function resolveRequestClientIp(req: Request, env: Env = process.env) {
  // The API proxy strips this marker from the external request and injects it
  // only after authenticating the Cloudflare -> Vercel edge secret.
  if (req.headers.get("x-nexid-edge-verified") === "1") {
    return normalizeIp(req.headers.get("cf-connecting-ip"));
  }

  // Vercel generates this header at its edge. Unlike a caller-provided XFF
  // chain, it is safe to use for direct/preview traffic and local diagnostics.
  const vercelForwardedFor = req.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor !== null) return normalizeIp(vercelForwardedFor);

  // A self-hosted production deployment must provide an authenticated proxy
  // signal instead of silently trusting caller-controlled forwarding headers.
  if (productionRuntime(env)) return null;

  // Self-hosted/local compatibility: accept only a single address. Multi-hop
  // XFF requires an explicit trusted-proxy policy and is therefore rejected.
  const forwardedFor = String(req.headers.get("x-forwarded-for") || "").trim();
  if (forwardedFor) {
    if (forwardedFor.includes(",")) return null;
    return normalizeIp(forwardedFor);
  }
  return normalizeIp(req.headers.get("x-real-ip"));
}

export function getRequestMeta(req: Request) {
  const ip = resolveRequestClientIp(req);
  const userAgent = req.headers.get("user-agent") || null;
  const traceId = req.headers.get("x-nexid-trace-id") || req.headers.get("x-request-id") || `nexid_${Date.now().toString(36)}`;
  return { ip, userAgent, traceId };
}
