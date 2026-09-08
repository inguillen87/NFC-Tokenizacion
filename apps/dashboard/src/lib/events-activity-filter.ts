import { isRealtimeRisk } from "./realtime-feed";

export type EventsActivityFilter = "all" | "risk";

export function normalizeEventsActivityFilter(value: unknown): EventsActivityFilter {
  return value === "risk" ? "risk" : "all";
}

/** This refines only the already authorized, bounded response. It is not a historic total. */
export function filterEventsActivitySample<T extends { event: { verdict?: unknown; reason?: unknown } }>(
  sample: readonly T[],
  filter: EventsActivityFilter,
): T[] {
  return sample.filter(({ event }) => filter !== "risk" || isRealtimeRisk(event.verdict, event.reason));
}

/** Use the resolved server query so retry never drops the selected tenant or source. */
export function eventsFilterHref(params: URLSearchParams, filter: EventsActivityFilter): string {
  const query = new URLSearchParams(params);
  query.delete("limit");
  if (filter === "risk") query.set("filter", "risk");
  else query.delete("filter");
  const search = query.toString();
  return search ? `/events?${search}` : "/events";
}
