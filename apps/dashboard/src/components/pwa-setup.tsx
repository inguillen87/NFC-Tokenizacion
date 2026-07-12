"use client";

import { useEffect } from "react";

const DASHBOARD_CACHE_PREFIX = "nexid-dash-";
const DASHBOARD_RUNTIME_VERSION = "v7";

async function clearLegacyDashboardRuntime() {
  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  const cacheKeys = "caches" in window ? await caches.keys().catch(() => []) : [];
  const dashboardCacheKeys = cacheKeys.filter((key) => key.startsWith(DASHBOARD_CACHE_PREFIX));

  await Promise.all([
    ...registrations.map((registration) => registration.unregister().catch(() => false)),
    ...dashboardCacheKeys.map((key) => caches.delete(key).catch(() => false)),
  ]);

  return registrations.length > 0 || dashboardCacheKeys.length > 0;
}

export function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const pwaEnabled = process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_PWA === "true";

    if (!pwaEnabled) {
      void clearLegacyDashboardRuntime().then((hadLegacyRuntime) => {
        if (!hadLegacyRuntime) return;
        const reloadKey = `nexid-dashboard-sw-cleared-${DASHBOARD_RUNTIME_VERSION}`;
        if (sessionStorage.getItem(reloadKey) === "1") return;
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
      });
      return;
    }

    const handleRuntimeUpdate = (event: MessageEvent<{ type?: string; version?: string }>) => {
      if (event.data?.type !== "NEXID_DASHBOARD_RUNTIME_UPDATED") return;
      const version = String(event.data.version || DASHBOARD_RUNTIME_VERSION);
      const reloadKey = `nexid-dashboard-runtime-update-${version}`;
      if (sessionStorage.getItem(reloadKey) === "1") return;
      sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("message", handleRuntimeUpdate);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await registration.update();
      } catch {
        // Silent fail to avoid disrupting UX in unsupported edge contexts.
      }
    };

    void register();

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleRuntimeUpdate);
    };
  }, []);

  return null;
}
