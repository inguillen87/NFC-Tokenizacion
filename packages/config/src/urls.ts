const PROD_WEB_URL = "https://nexid.lat";
const PROD_APP_URL = "https://app.nexid.lat";
const PROD_API_URL = "https://api.nexid.lat";
const LOCAL_HOST_PATTERN = /(localhost|127\.0\.0\.1|0\.0\.0\.0)/i;

function clean(url: string | undefined, fallback: string) {
  const value = (url || "").trim();
  if (!value) return fallback;
  return value.replace(/\/$/, "");
}

function ensureAbsoluteHttps(url: string, label: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[nexID][config] ${label} must be a valid absolute URL. Received: ${url}`);
  }
  if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error(`[nexID][config] ${label} must use https in production. Received: ${url}`);
  }
  if (LOCAL_HOST_PATTERN.test(parsed.hostname) && process.env.NODE_ENV === "production") {
    throw new Error(`[nexID][config] ${label} cannot point to localhost in production. Received: ${url}`);
  }
  return parsed.origin;
}

function resolveEnvUrl(candidates: Array<string | undefined>, fallback: string, label: string) {
  const firstPresent = candidates.find((entry) => (entry || "").trim().length > 0);
  const resolved = clean(firstPresent, fallback);
  return ensureAbsoluteHttps(resolved, label);
}

export const productUrls = {
  web: resolveEnvUrl([process.env.NEXT_PUBLIC_WEB_URL, process.env.NEXT_PUBLIC_WEB_BASE_URL], PROD_WEB_URL, "NEXT_PUBLIC_WEB_URL"),
  app: resolveEnvUrl([process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_DASHBOARD_URL], PROD_APP_URL, "NEXT_PUBLIC_APP_URL"),
  api: resolveEnvUrl([process.env.NEXT_PUBLIC_API_URL, process.env.API_BASE_URL, process.env.NEXT_PUBLIC_API_BASE_URL], PROD_API_URL, "NEXT_PUBLIC_API_URL"),
};

export function withPath(base: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
