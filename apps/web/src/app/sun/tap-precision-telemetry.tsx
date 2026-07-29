"use client";

import { useEffect, useMemo, useState } from "react";

type TelemetryState = "idle" | "pending" | "updated" | "denied" | "unavailable" | "error";

type TapPrecisionTelemetryProps = {
  endpoint: string;
  bid: string;
  uid?: string | null;
  eventId?: string | null;
  freshToken?: string | null;
  readCounter?: number | null;
  contextStatus?: string | null;
  enabled?: boolean;
};

const APPROXIMATE_ACCURACY_FLOOR_M = 150;

function roundApproximateCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

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
  freshToken,
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
    if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey) === "sent") setState("updated");
  }, [storageKey]);

  async function send(payload: Record<string, unknown>) {
    try {
      const request = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!request.ok) {
        setState("error");
        return;
      }
      window.sessionStorage.setItem(storageKey, "sent");
      setState("updated");
    } catch {
      setState("error");
    }
  }

  function shareApproximateLocation() {
    if (state === "pending" || !enabled || !bid || (!uid && !eventId) || !endpoint) return;
    setState("pending");
    const basePayload = {
      bid,
      uid: uid || undefined,
      eventId: eventId || undefined,
      fresh_token: freshToken || undefined,
      ctr: typeof readCounter === "number" ? readCounter : undefined,
      contextStatus: contextStatus || "viewed",
      scannedAt: new Date().toISOString(),
      geoConsent: true,
      geoPrecision: "approximate",
      client: clientContext(),
    };

    if (!("geolocation" in navigator)) {
      setState("unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextAccuracy = Math.max(
          APPROXIMATE_ACCURACY_FLOOR_M,
          Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : APPROXIMATE_ACCURACY_FLOOR_M,
        );
        setAccuracy(nextAccuracy);
        void send({
          ...basePayload,
          geo: {
            lat: roundApproximateCoordinate(position.coords.latitude),
            lng: roundApproximateCoordinate(position.coords.longitude),
            accuracy: nextAccuracy,
          },
        });
      },
      (error) => {
        setState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }

  if (!enabled || !bid || (!uid && !eventId) || !endpoint) return null;
  if (state === "updated") {
    return (
      <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-semibold text-emerald-100" aria-live="polite">
        Ubicacion aproximada compartida{accuracy ? ` (precision declarada: ${accuracy} m o mayor)` : ""}. El CRM recibio la actualizacion.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-3 text-cyan-50" aria-live="polite">
      <p className="text-[11px] font-bold">Ubicacion aproximada opcional</p>
      <p className="mt-1 text-[10px] leading-relaxed text-cyan-100/75">
        Solo se solicita al tocar el boton, se redondea antes de enviarla y no demuestra el recorrido fisico del producto.
      </p>
      <button
        type="button"
        onClick={shareApproximateLocation}
        disabled={state === "pending"}
        className="mt-2 min-h-11 rounded-lg border border-cyan-200/30 bg-cyan-300/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] transition hover:bg-cyan-300/20 disabled:cursor-wait disabled:opacity-60"
      >
        {state === "pending" ? "Solicitando permiso..." : "Compartir ubicacion aproximada"}
      </button>
      {state === "denied" || state === "unavailable" || state === "error" ? (
        <p className="mt-2 text-[10px] text-amber-200">No se compartio ubicacion. El pasaporte sigue funcionando sin ella.</p>
      ) : null}
    </div>
  );
}
