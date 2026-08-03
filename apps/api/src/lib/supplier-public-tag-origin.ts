const DEFAULT_SUPPLIER_PUBLIC_TAG_ORIGIN = "https://nexid.lat";

type PublicTagOriginEnv = Partial<Record<
  "NEXID_PUBLIC_TAG_ORIGIN" | "NEXID_PUBLIC_TAG_ALLOWED_ORIGINS" | "NEXT_PUBLIC_WEB_URL",
  string | undefined
>>;

function cleanEnvValue(value: string | undefined) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function normalizedHttpsOrigin(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Supplier URLs are programmed into physical tags and therefore must never be
 * derived from request Host/X-Forwarded-Host headers. Only an explicit,
 * allowlisted HTTPS origin may replace the canonical nexid.lat web PWA.
 */
export function resolveSupplierPublicTagOrigin(
  env?: PublicTagOriginEnv,
) {
  const source = env || (process.env as unknown as PublicTagOriginEnv);
  const allowedOrigins = new Set([
    DEFAULT_SUPPLIER_PUBLIC_TAG_ORIGIN,
    "https://www.nexid.lat",
  ]);
  for (const entry of cleanEnvValue(source.NEXID_PUBLIC_TAG_ALLOWED_ORIGINS).split(",")) {
    const normalized = normalizedHttpsOrigin(entry.trim());
    if (normalized) allowedOrigins.add(normalized);
  }

  const configured = cleanEnvValue(
    source.NEXID_PUBLIC_TAG_ORIGIN || source.NEXT_PUBLIC_WEB_URL,
  ) || DEFAULT_SUPPLIER_PUBLIC_TAG_ORIGIN;
  const normalized = normalizedHttpsOrigin(configured);
  return normalized && allowedOrigins.has(normalized)
    ? normalized
    : DEFAULT_SUPPLIER_PUBLIC_TAG_ORIGIN;
}
