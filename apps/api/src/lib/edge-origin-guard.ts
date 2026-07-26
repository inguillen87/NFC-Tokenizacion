import { timingSafeEqual } from "node:crypto";

export const EDGE_ORIGIN_AUTH_HEADER = "x-nexid-edge-auth";
export const EDGE_ORIGIN_VERIFIED_HEADER = "x-nexid-edge-verified";

const DEFAULT_PROTECTED_HOSTS = new Set(["api.nexid.lat"]);
const MIN_SECRET_LENGTH = 32;
const MAX_SECRET_LENGTH = 256;

type GuardReason =
  | "not_enforced"
  | "non_protected_runtime"
  | "public_health"
  | "enforcement_config_invalid"
  | "origin_secret_missing"
  | "origin_secret_invalid"
  | "origin_secret_previous_invalid"
  | "origin_secret_mismatch"
  | "trusted_origin_current"
  | "trusted_origin_previous";

export type EdgeOriginDecision = {
  allowed: boolean;
  verified: boolean;
  reason: GuardReason;
};

export type EdgeOriginInput = {
  path: string;
  method?: string | null;
  host?: string | null;
  provided: string | null;
  expected: string | null;
  previousExpected?: string | null;
  enforced?: string | boolean | null;
  vercelEnvironment?: string | null;
  nodeEnvironment?: string | null;
  protectedHosts?: string | readonly string[] | null;
};

function allow(reason: GuardReason, verified = false): EdgeOriginDecision {
  return { allowed: true, verified, reason };
}

function deny(reason: GuardReason): EdgeOriginDecision {
  return { allowed: false, verified: false, reason };
}

function normalizeHost(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return end > 0 ? raw.slice(1, end).replace(/\.$/, "") : "";
  }
  return raw.split(":", 1)[0].replace(/\.$/, "");
}

function protectedHostSet(configured: EdgeOriginInput["protectedHosts"]) {
  const values = Array.isArray(configured)
    ? configured
    : String(configured || "").split(",");
  const hosts = new Set(DEFAULT_PROTECTED_HOSTS);
  for (const value of values) {
    const host = normalizeHost(String(value));
    if (host) hosts.add(host);
  }
  return hosts;
}

function isProtectedRuntime(input: EdgeOriginInput) {
  const vercelEnvironment = String(input.vercelEnvironment || "").trim().toLowerCase();
  const nodeEnvironment = String(input.nodeEnvironment || "").trim().toLowerCase();
  // Vercel previews run with NODE_ENV=production, so an explicit VERCEL_ENV
  // always wins. Self-hosted production falls back to NODE_ENV.
  const production = vercelEnvironment
    ? vercelEnvironment === "production"
    : nodeEnvironment === "production";
  return production || protectedHostSet(input.protectedHosts).has(normalizeHost(input.host));
}

function enforcementState(value: EdgeOriginInput["enforced"]) {
  if (value === true) return "enabled" as const;
  if (value === false || value == null) return "disabled" as const;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "on", "enforce"].includes(normalized)) return "enabled" as const;
  if (["", "false", "0", "off", "disabled"].includes(normalized)) return "disabled" as const;
  return "invalid" as const;
}

function configuredSecret(value: string | null | undefined) {
  if (value == null || value === "") return { state: "missing" as const, value: "" };
  const secret = String(value);
  const hasWhitespaceOrControl = /[\u0000-\u0020\u007f]/.test(secret);
  if (secret.length < MIN_SECRET_LENGTH || secret.length > MAX_SECRET_LENGTH || hasWhitespaceOrControl) {
    return { state: "invalid" as const, value: "" };
  }
  return { state: "valid" as const, value: secret };
}

function exactSecret(provided: string, expected: string) {
  const candidate = Buffer.from(provided, "utf8");
  const configured = Buffer.from(expected, "utf8");
  return candidate.length > 0
    && candidate.length === configured.length
    && timingSafeEqual(candidate, configured);
}

function isPublicHealthcheck(path: string, method: string | null | undefined) {
  const normalizedMethod = String(method || "GET").trim().toUpperCase();
  return path === "/health" && (normalizedMethod === "GET" || normalizedMethod === "HEAD");
}

/**
 * Evaluates the Cloudflare-to-origin credential at the global API boundary.
 * Enforcement is opt-in for a two-phase rollout, but once enabled it applies
 * to every production request except the exact public healthcheck.
 */
export function edgeOriginAllowed(input: EdgeOriginInput): EdgeOriginDecision {
  if (!isProtectedRuntime(input)) return allow("non_protected_runtime");

  const enforcement = enforcementState(input.enforced);
  if (enforcement === "disabled") return allow("not_enforced");
  if (enforcement === "invalid") return deny("enforcement_config_invalid");
  if (isPublicHealthcheck(input.path, input.method)) return allow("public_health");

  const current = configuredSecret(input.expected);
  if (current.state === "missing") return deny("origin_secret_missing");
  if (current.state === "invalid") return deny("origin_secret_invalid");

  const previous = configuredSecret(input.previousExpected);
  if (previous.state === "invalid") return deny("origin_secret_previous_invalid");

  const provided = String(input.provided || "");
  if (exactSecret(provided, current.value)) return allow("trusted_origin_current", true);
  if (previous.state === "valid" && exactSecret(provided, previous.value)) {
    return allow("trusted_origin_previous", true);
  }
  return deny("origin_secret_mismatch");
}
