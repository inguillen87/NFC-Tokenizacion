function isProductionDeployment() {
  return process.env.VERCEL_ENV === "production";
}

function normalizeOrigin(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).origin;
  } catch {
    return "";
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getClerkPublishableKey() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "";
  if (!key) return "";
  if (isProductionDeployment() && !key.startsWith("pk_live_")) return "";
  return key;
}

export function getClerkAuthorizedParties() {
  const explicit = String(process.env.DASHBOARD_CLERK_AUTHORIZED_PARTIES || process.env.NEXT_PUBLIC_CLERK_AUTHORIZED_PARTIES || "")
    .split(/[\s,]+/)
    .map(normalizeOrigin);
  const dashboardOrigin = normalizeOrigin(
    process.env.NEXT_PUBLIC_DASHBOARD_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.nexid.lat",
  );
  const localOrigins = isProductionDeployment()
    ? []
    : ["http://localhost:3000", "http://localhost:3010", "http://127.0.0.1:3000", "http://127.0.0.1:3010"];
  return unique([...explicit, dashboardOrigin, ...localOrigins]);
}

export function getClerkProxyUrl() {
  return process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim() || "";
}

export function isClerkConfiguredForRuntime() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim() || "";
  if (!getClerkPublishableKey() || !secretKey) return false;
  if (isProductionDeployment() && !secretKey.startsWith("sk_live_")) return false;
  return true;
}
