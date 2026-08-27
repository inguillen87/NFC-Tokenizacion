"use client";

import { useEffect } from "react";

export function FreshHandoffUrlCleaner({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("fresh") && !url.searchParams.has("fresh_token")) return;
    url.searchParams.delete("fresh");
    url.searchParams.delete("fresh_token");
    // The capability remains retryable for this event until its short expiry;
    // only the address-bar copy is removed to avoid history/referrer leakage.
    url.searchParams.set("handoff", "fresh-secured");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [enabled]);

  return null;
}
