import { readTicketResponse } from "./ticket-request-deadline";
export type TicketLookupLocale = "es-AR" | "en" | "pt-BR";
export type TicketLookupState = {
  status: "idle" | "loading" | "invalid" | "found" | "not_found" | "forbidden" | "unconfirmed";
  reference?: string;
  ticket?: Record<string, unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function canonicalTicketReference(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function nullableText(value: unknown, maximum: number) {
  return value === null || (typeof value === "string" && value.length <= maximum);
}

export function parseTicketLookupResponse(status: number, payload: unknown, reference: string, tenant: string, dataMode: string | null): TicketLookupState {
  const base = { reference };
  const body = object(payload);
  if (status === 401 || status === 403) return { ...base, status: "forbidden" };
  if (dataMode !== "production" || body?.demoMode === true || body?.dataSource === "demo") return { ...base, status: "unconfirmed" };
  if (status === 404 && body?.ok === false && body.reason === "ticket_not_found") return { ...base, status: "not_found" };
  if (status < 200 || status >= 300 || body?.ok !== true || body.protocol !== "nexid.support-ticket-lookup.v1") return { ...base, status: "unconfirmed" };
  const scope = object(body.scope), row = object(body.ticket);
  if (!scope || !row || row.id !== reference || !canonicalTicketReference(row.id)) return { ...base, status: "unconfirmed" };
  if (tenant ? scope.mode !== "tenant" || scope.tenantSlug !== tenant || row.tenant_slug !== tenant || typeof scope.tenantId !== "string" || !scope.tenantId || row.tenant_id !== scope.tenantId
    : scope.mode !== "global" || scope.tenantId !== null || scope.tenantSlug !== null) return { ...base, status: "unconfirmed" };
  if (!nullableText(row.title, 500)
    || !nullableText(row.detail, 200_000) || !nullableText(row.contact, 320)
    || !nullableText(row.status, 64)
    || !["available", "not_recorded", "unavailable"].includes(String(row.detail_state))
    || (row.detail_state === "available" ? typeof row.detail !== "string" || !row.detail.trim() : row.detail !== null)
    || typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))
    || !nullableText(row.bid, 256) || !nullableText(row.tenant_name, 500)
    || !nullableText(row.tenant_slug, 128) || !nullableText(row.tenant_id, 128)
    || !(row.tap_event_id === null || typeof row.tap_event_id === "string" && /^[1-9]\d{0,18}$/.test(row.tap_event_id))) return { ...base, status: "unconfirmed" };
  // This is a display projection, not a claim that caller-supplied detail authenticates scope.
  const ticket = Object.fromEntries(["id", "title", "detail", "detail_state", "status", "contact", "created_at", "source", "category", "locale", "bid", "tap_event_id", "tenant_id", "tenant_slug", "tenant_name"].map(key => [key, row[key]]));
  return { ...base, status: "found", ticket };
}

/** Abort plus a generation guard also rejects stale responses from transports that ignore abort. */
export function createTicketLookupRunner(fetcher: typeof fetch = fetch) {
  let generation = 0;
  let controller: AbortController | null = null;
  function cancel() { generation += 1; controller?.abort(); controller = null; }
  return {
    cancel,
    async search(referenceInput: string, tenant: string): Promise<TicketLookupState | null> {
      cancel();
      const reference = canonicalTicketReference(referenceInput);
      if (!reference) return { status: "invalid" };
      const ownGeneration = generation;
      controller = new AbortController();
      const ownController = controller;
      const query = new URLSearchParams();
      if (tenant) query.set("tenant", tenant);
      try {
        const { response, body } = await readTicketResponse(fetcher, `/api/admin/tickets/${reference}${query.size ? `?${query}` : ""}`, {
          method: "GET", cache: "no-store", credentials: "same-origin", redirect: "error", signal: ownController.signal,
          headers: { Accept: "application/json" },
        }, ownController);
        if (generation !== ownGeneration) return null;
        return parseTicketLookupResponse(response.status, body, reference, tenant, response.headers.get("x-nexid-data-mode"));
      } catch {
        return generation === ownGeneration ? { status: "unconfirmed", reference } : null;
      }
    },
  };
}
