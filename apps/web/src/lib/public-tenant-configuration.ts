import { productUrls } from "@product/config";
import { fetchConsumerJson } from "../app/me/_components/consumer-bounded-fetch";
import { parseTenantActionConfiguration } from "../app/sun/tenant-action-availability";
import { fetchRuntimeApi } from "../app/api/_lib/server-api-transport";

export function configurationEventId(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 19 || value[0] === "0") return false;
  for (const digit of value) {
    if (digit < "0" || digit > "9") return false;
  }
  return value.length < 19 || value <= "9223372036854775807";
}

/** Public settings only. The destination is trusted configuration, never a caller URL.
 * No browser/product cookies or client-supplied credentials are forwarded. */
export async function readPublicTenantConfiguration(eventId: unknown, options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}) {
  if (!configurationEventId(eventId)) return null;
  const result = await fetchConsumerJson(`${productUrls.api}/public/passport/${encodeURIComponent(eventId)}/configuration`, {
    method: "GET", cache: "no-store", redirect: "error", credentials: "omit", headers: { accept: "application/json" },
  }, { ...options, fetchImpl: options.fetchImpl ?? fetchRuntimeApi });
  if (result.status !== "ready" || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) return null;
  const body = result.data as Record<string, unknown>;
  return body.ok === true ? parseTenantActionConfiguration(body.configuration) : null;
}
