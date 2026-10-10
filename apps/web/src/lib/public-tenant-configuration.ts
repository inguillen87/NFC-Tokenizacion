import { productUrls } from "@product/config";
import { fetchConsumerJson } from "../app/me/_components/consumer-bounded-fetch";
import { parseTenantActionConfiguration } from "../app/sun/tenant-action-availability";
import { fetchRuntimeApi } from "../app/api/_lib/server-api-transport";

export function configurationEventId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value));
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
