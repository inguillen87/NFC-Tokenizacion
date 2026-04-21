"use client";

import { useEffect } from "react";

export function SessionHeartbeat() {
  useEffect(() => {
    let active = true;
    let stopHeartbeat = false;
    let failures = 0;
    let timer: number | null = null;
    const baseInterval = 1000 * 60 * 5;
    const maxInterval = 1000 * 60 * 30;

    const schedule = () => {
      if (!active || stopHeartbeat) return;
      const next = Math.min(maxInterval, baseInterval * Math.max(1, 2 ** failures));
      timer = window.setTimeout(() => {
        void ping();
      }, next);
    };

    const ping = async () => {
      if (stopHeartbeat || document.visibilityState === "hidden") return;
      const response = await fetch("/api/session/current", { cache: "no-store" }).catch(() => null);
      if (!active) return;
      if (response && (response.status === 401 || response.status === 403)) {
        stopHeartbeat = true;
        return;
      }
      if (!response || response.status >= 500) failures = Math.min(4, failures + 1);
      else failures = 0;
      schedule();
    };
    void ping();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
