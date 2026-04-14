"use client";

import { useEffect } from "react";

export function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const pwaEnabled = process.env.NEXT_PUBLIC_ENABLE_PWA === "true";

    if (!pwaEnabled) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
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
