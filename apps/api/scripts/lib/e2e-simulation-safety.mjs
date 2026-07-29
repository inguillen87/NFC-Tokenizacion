export const E2E_MUTATION_CONFIRMATION = "I_UNDERSTAND_NEXID_E2E_MUTATES_TEST_DATA";

const PRODUCTION_API_HOSTS = new Set([
  "api.nexid.lat",
  "app.nexid.lat",
  "nexid.lat",
  "www.nexid.lat",
]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function required(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(`${name} is required; the E2E harness never falls back to production or shared credentials.`);
  return value;
}

function parseUrl(value, name, protocols) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
  if (!protocols.includes(parsed.protocol)) throw new Error(`${name} must use ${protocols.join(" or ")}.`);
  return parsed;
}

function isRecognizableNonProductionHost(hostname) {
  return /(^|[.-])(staging|stage|preview|test|e2e)([.-]|$)/i.test(hostname) || hostname.endsWith(".vercel.app");
}

export function readE2eSimulationConfig(env = process.env) {
  const target = required(env, "E2E_TARGET").toLowerCase();
  if (target !== "local" && target !== "staging") throw new Error("E2E_TARGET must be exactly local or staging.");
  if (required(env, "E2E_ALLOW_MUTATION") !== E2E_MUTATION_CONFIRMATION) {
    throw new Error(`E2E_ALLOW_MUTATION must equal ${E2E_MUTATION_CONFIRMATION}.`);
  }

  const apiUrl = parseUrl(required(env, "E2E_API_BASE"), "E2E_API_BASE", ["http:", "https:"]);
  const apiHostname = apiUrl.hostname.toLowerCase();
  if (PRODUCTION_API_HOSTS.has(apiHostname)) throw new Error(`Refusing to run destructive E2E against production host ${apiHostname}.`);
  if (target === "local" && !LOOPBACK_HOSTS.has(apiHostname)) throw new Error("E2E_TARGET=local requires a loopback E2E_API_BASE host.");
  if (target === "staging" && !isRecognizableNonProductionHost(apiHostname)) {
    throw new Error("E2E_TARGET=staging requires an API hostname explicitly labelled staging, preview, test, e2e, or a Vercel preview hostname.");
  }
  if (target === "staging" && apiUrl.protocol !== "https:") throw new Error("Staging E2E_API_BASE must use HTTPS.");

  const databaseUrl = parseUrl(required(env, "E2E_DATABASE_URL"), "E2E_DATABASE_URL", ["postgres:", "postgresql:"]);
  const databaseHostname = databaseUrl.hostname.toLowerCase();
  const databaseAllowlist = required(env, "E2E_DATABASE_HOST_ALLOWLIST")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!databaseAllowlist.includes(databaseHostname)) {
    throw new Error(`E2E database host ${databaseHostname} is not present in E2E_DATABASE_HOST_ALLOWLIST.`);
  }
  if (target === "local" && !LOOPBACK_HOSTS.has(databaseHostname)) throw new Error("E2E_TARGET=local requires a loopback E2E database host.");

  return Object.freeze({
    target,
    apiBase: apiUrl.toString().replace(/\/$/, ""),
    databaseUrl: databaseUrl.toString(),
    adminSessionToken: required(env, "E2E_ADMIN_SESSION_TOKEN"),
  });
}
