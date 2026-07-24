import { timingSafeEqual } from "node:crypto";

const PUBLIC_HEALTH_PATHS = new Set(["/health", "/api/health"]);

function exactSecret(provided: string, expected: string) {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Evaluates the Cloudflare-to-origin contract. The flag is intentionally
 * opt-in so provisioning a secret cannot silently lock out existing traffic.
 */
export function edgeOriginAllowed(input: { path: string; provided: string | null; expected: string | null; enforced?: string | boolean }) {
  const enforced = input.enforced === true || String(input.enforced || "").toLowerCase() === "true";
  if (!enforced) return { allowed: true, reason: "not_enforced" as const };
  if (PUBLIC_HEALTH_PATHS.has(input.path)) return { allowed: true, reason: "public_health" as const };
  const expected = String(input.expected || "").trim();
  if (!expected) return { allowed: false, reason: "origin_secret_missing" as const };
  return exactSecret(String(input.provided || "").trim(), expected)
    ? { allowed: true, reason: "cloudflare_origin" as const }
    : { allowed: false, reason: "origin_secret_mismatch" as const };
}
