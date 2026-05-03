"use client";

import { useEffect } from "react";

export function FreshHandoffUrlCleaner({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("fresh") && !url.searchParams.has("fresh_token")) return;
    url.searchParams.delete("fresh");
    url.searchParams.delete("fresh_token");
    url.searchParams.set("handoff", "fresh-consumed");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [enabled]);

  return null;
}
