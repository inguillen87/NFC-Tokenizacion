"use client";

import { useEffect } from "react";

export function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const pwaEnabled = process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_PWA === "true";

    if (!pwaEnabled) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (!registrations.length) return;
        void Promise.all(registrations.map((registration) => registration.unregister())).then(() => {
          const reloadKey = "nexid-dashboard-sw-cleared-v3";
          if (sessionStorage.getItem(reloadKey) === "1") return;
          sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
        });
      });
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Silent fail to avoid disrupting UX in unsupported edge contexts.
      }
    };

    void register();
  }, []);

  return null;
}
