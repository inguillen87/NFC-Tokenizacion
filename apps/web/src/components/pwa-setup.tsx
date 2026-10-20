"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyTheme } from "../../../../packages/ui/src/theme-toggle";
import { isOfflineRecoveryPath, readExplicitOfflineTheme } from "../lib/offline-theme-preference";

export function PwaSetup() {
  const pathname = usePathname() || "";

  useEffect(() => {
    if (!isOfflineRecoveryPath(pathname)) return;
    const preferred = readExplicitOfflineTheme({
      readCookies: () => document.cookie,
      readStorage: (key) => localStorage.getItem(key),
    });
    if (preferred) applyTheme(preferred);
  }, [pathname]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    const pwaEnabled =
      process.env.NEXT_PUBLIC_ENABLE_PWA === "true" ||
      (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_PWA !== "false");

    if (!pwaEnabled) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (disposed) return;
        registrations.forEach((registration) => {
          void registration.unregister().catch(() => undefined);
        });
      }).catch(() => undefined);
      return () => { disposed = true; };
    }

    let registering = false;
    let registered = false;
    const register = async () => {
      if (disposed || registering || registered || navigator.onLine === false) return;
      registering = true;
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (!disposed) registered = true;
      } catch {
        // A later real online event can retry; no background retry loop.
      } finally {
        registering = false;
      }
    };

    window.addEventListener("online", register);
    void register();
    return () => {
      disposed = true;
      window.removeEventListener("online", register);
    };
  }, []);

  return null;
}
