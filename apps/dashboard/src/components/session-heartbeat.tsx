"use client";

import { useEffect } from "react";

export function SessionHeartbeat() {
  useEffect(() => {
    let active = true;
    const ping = async () => {
      await fetch("/api/session/current", { cache: "no-store" }).catch(() => null);
      if (!active) return;
    };
    void ping();
    const id = window.setInterval(() => { void ping(); }, 1000 * 60 * 5);
    return () => { active = false; window.clearInterval(id); };
  }, []);

  return null;
}
