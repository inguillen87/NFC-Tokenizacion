function isProductionDeployment() {
  return process.env.VERCEL_ENV === "production";
}

export function getClerkPublishableKey() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "";
  if (!key) return "";
  if (isProductionDeployment() && !key.startsWith("pk_live_")) return "";
  return key;
}

export function isClerkConfiguredForRuntime() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim() || "";
  if (!getClerkPublishableKey() || !secretKey) return false;
  if (isProductionDeployment() && !secretKey.startsWith("sk_live_")) return false;
  return true;
}
