import { readTicketResponse } from "./ticket-request-deadline";
import {
  parseCustomerMemberTimelinePayload,
  validCustomerMemberTimelineConsumerId,
  validCustomerMemberTimelineCursor,
  validCustomerMemberTimelineTenant,
  type CustomerMemberTimelineScope,
  type CustomerMemberTimelineState,
} from "./customer-member-timeline";

export type MemberTimelinePageResult =
  | { status: "ready"; page: Omit<CustomerMemberTimelineState, "availability"> }
  | { status: "access_denied" | "member_not_found" | "invalid_payload" | "unavailable" };

/** One manual page request at a time. Failed or canceled pages remain retryable. */
export function createMemberTimelineReader(scope: CustomerMemberTimelineScope, fetcher: typeof fetch = fetch) {
  const tenant = typeof scope?.tenant === "string" ? scope.tenant.trim().toLowerCase() : "";
  const consumerId = typeof scope?.consumerId === "string" ? scope.consumerId.trim().toLowerCase() : "";
  const consumed = new Set<string>();
  let generation = 0;
  let active: AbortController | null = null;
  function cancel() { generation += 1; active?.abort(); active = null; }
  return {
    cancel,
    isBusy: () => active !== null,
    async read(cursor: string): Promise<MemberTimelinePageResult | null> {
      if (active) return null;
      if (!validCustomerMemberTimelineTenant(tenant) || !validCustomerMemberTimelineConsumerId(consumerId)
        || !validCustomerMemberTimelineCursor(cursor) || consumed.has(cursor)) return { status: "invalid_payload" };
      const controller = new AbortController(), ownGeneration = ++generation;
      active = controller;
      try {
        const query = new URLSearchParams({ tenant, cursor });
        const { response, body } = await readTicketResponse(fetcher,
          `/api/customer-member-timeline/${encodeURIComponent(consumerId)}?${query}`,
          { method: "GET", cache: "no-store", credentials: "same-origin", redirect: "error", headers: { Accept: "application/json" } }, controller);
        if (generation !== ownGeneration) return null;
        if (response.status === 401 || response.status === 403) return { status: "access_denied" };
        if (response.status === 404) return { status: "member_not_found" };
        if (!response.ok) return { status: response.status === 400 || response.status === 422 ? "invalid_payload" : "unavailable" };
        const page = parseCustomerMemberTimelinePayload(body, { tenant, consumerId });
        if (!page || page.hasMore && (page.nextCursor === cursor || consumed.has(page.nextCursor!))) return { status: "invalid_payload" };
        // A partial page cannot advance the global cursor across a missing source.
        if (page.partial || page.sourceErrors.length) return { status: "ready", page: { ...page, partial: true, hasMore: false, nextCursor: null } };
        consumed.add(cursor);
        return { status: "ready", page };
      } catch { return generation === ownGeneration ? { status: "unavailable" } : null; }
      finally { if (active === controller) active = null; }
    },
  };
}
