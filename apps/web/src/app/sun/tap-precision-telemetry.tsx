"use client";

import { useEffect, useMemo, useState } from "react";

type TelemetryState = "idle" | "pending" | "updated" | "denied" | "unavailable" | "error";

type TapPrecisionTelemetryProps = {
  endpoint: string;
  bid: string;
  uid?: string | null;
  eventId?: string | null;
  readCounter?: number | null;
  contextStatus?: string | null;
  enabled?: boolean;
};

function clientContext() {
  const nav = window.navigator;
  return {
    language: nav.language || null,
    languages: Array.from(nav.languages || []),
    platform: nav.platform || null,
    userAgent: nav.userAgent || null,
    mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || ""),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
    },
  };
}

export function TapPrecisionTelemetry({
  endpoint,
  bid,
  uid,
  eventId,
  readCounter,
  contextStatus,
  enabled = true,
}: TapPrecisionTelemetryProps) {
  const [state, setState] = useState<TelemetryState>("idle");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const storageKey = useMemo(
    () => `nexid:tap-context:${bid}:${eventId || uid || "unknown"}:${readCounter ?? "latest"}`,
    [bid, eventId, readCounter, uid],
  );

  useEffect(() => {
    if (!enabled || !bid || (!uid && !eventId) || !endpoint) return;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(storageKey) === "sent") return;

    let cancelled = false;
    const basePayload = {
      bid,
      uid: uid || undefined,
      eventId: eventId || undefined,
      ctr: typeof readCounter === "number" ? readCounter : undefined,
      contextStatus: contextStatus || "viewed",
      scannedAt: new Date().toISOString(),
      client: clientContext(),
    };

    async function send(payload: Record<string, unknown>) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        if (!cancelled && response.ok) {
          window.sessionStorage.setItem(storageKey, "sent");
          setState("updated");
        } else if (!cancelled) {
          setState("error");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    if (!("geolocation" in navigator)) {
      setState("unavailable");
      void send({ ...basePayload, geoError: "geolocation_unavailable" });
      return () => {
        cancelled = true;
      };
    }

    setState("pending");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const nextAccuracy = Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null;
        setAccuracy(nextAccuracy);
        void send({
          ...basePayload,
          geo: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
          },
        });
      },
      (error) => {
        if (cancelled) return;
        setState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
        void send({ ...basePayload, geoError: error.message || `geolocation_error_${error.code}` });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );

    return () => {
      cancelled = true;
    };
  }, [bid, contextStatus, enabled, endpoint, eventId, readCounter, storageKey, uid]);

  if (state !== "updated") return null;

  return (
    <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-semibold text-emerald-100">
      GPS del telefono registrado{accuracy ? ` (${accuracy} m)` : ""}. El CRM se actualiza en vivo.
    </div>
  );
}
