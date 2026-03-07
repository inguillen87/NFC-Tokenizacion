const PROD_WEB_URL = "https://nexid.lat";
const PROD_APP_URL = "https://app.nexid.lat";
const PROD_API_URL = "https://api.nexid.lat";

function clean(url: string | undefined, fallback: string) {
  const value = (url || "").trim();
  if (!value) return fallback;
  return value.replace(/\/$/, "");
}

export const productUrls = {
  web: clean(process.env.NEXT_PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL, PROD_WEB_URL),
  app: clean(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL, PROD_APP_URL),
  api: clean(process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL, PROD_API_URL),
};

export function withPath(base: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
