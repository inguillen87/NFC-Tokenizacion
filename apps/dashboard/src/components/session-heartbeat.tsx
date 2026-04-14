"use client";

import { useEffect } from "react";

export function SessionHeartbeat() {
  useEffect(() => {
    let active = true;
    let stopHeartbeat = false;
    const ping = async () => {
      if (stopHeartbeat || document.visibilityState === "hidden") return;
      const response = await fetch("/api/session/current", { cache: "no-store" }).catch(() => null);
      if (!active) return;
      if (response && (response.status === 401 || response.status === 403)) {
        stopHeartbeat = true;
      }
    };
    void ping();
    const id = window.setInterval(() => { void ping(); }, 1000 * 60 * 5);
    return () => { active = false; window.clearInterval(id); };
  }, []);

  return null;
}
