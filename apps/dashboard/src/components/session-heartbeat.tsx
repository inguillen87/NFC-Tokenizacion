"use client";

import { useEffect } from "react";
import { dashboardAuthPath, normalizeDashboardReturnPath } from "../lib/dashboard-return-path";

export function SessionHeartbeat() {
  useEffect(() => {
    let active = true;
    let stopHeartbeat = false;
    let pingInFlight = false;
    let failures = 0;
    let timer: number | null = null;
    const baseInterval = 1000 * 60 * 5;
    const maxInterval = 1000 * 60 * 30;

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    const schedule = () => {
      if (!active || stopHeartbeat) return;
      clearTimer();
      const next = Math.min(maxInterval, baseInterval * Math.max(1, 2 ** failures));
      timer = window.setTimeout(() => {
        void ping();
      }, next);
    };

    const ping = async () => {
      clearTimer();
      if (!active || stopHeartbeat || pingInFlight) return;
      // A hidden tab waits for visibility/focus instead of losing its only
      // scheduled heartbeat forever.
      if (document.visibilityState === "hidden") return;
      pingInFlight = true;
      try {
        const response = await fetch("/api/session/current", { cache: "no-store" }).catch(() => null);
        if (!active) return;
        if (response && (response.status === 401 || response.status === 403)) {
          stopHeartbeat = true;
          const returnPath = normalizeDashboardReturnPath(
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
          );
          window.location.replace(dashboardAuthPath("/login", returnPath, { auth_error: "session_expired" }));
          return;
        }
        if (!response || response.status >= 500) failures = Math.min(4, failures + 1);
        else failures = 0;
      } finally {
        pingInFlight = false;
        schedule();
      }
    };

    const resumeHeartbeat = () => {
      if (!active || stopHeartbeat || document.visibilityState === "hidden") return;
      clearTimer();
      void ping();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") resumeHeartbeat();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", resumeHeartbeat);
    void ping();
    return () => {
      active = false;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", resumeHeartbeat);
    };
  }, []);

  return null;
}
