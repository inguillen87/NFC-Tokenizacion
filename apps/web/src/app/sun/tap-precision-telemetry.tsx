"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [state, setState] = useState<TelemetryState>("idle");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const storageKey = useMemo(
    () => `nexid:tap-context:${bid}:${eventId || uid || "unknown"}:${readCounter ?? "latest"}`,
    [bid, eventId, readCounter, uid],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (!stored) return;
      if (stored === "sent") {
        setState("updated");
        return;
      }
      const parsed = JSON.parse(stored) as { accuracyM?: unknown };
      const storedAccuracy = Number(parsed.accuracyM);
      if (Number.isFinite(storedAccuracy) && storedAccuracy > 0) setAccuracy(storedAccuracy);
      setState("updated");
    } catch {
      // Session storage can be unavailable in restricted browser modes.
    }
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
      const response = await request.json().catch(() => null) as { accuracyM?: unknown } | null;
      const responseAccuracy = Number(response?.accuracyM);
      const storedAccuracy = Number.isFinite(responseAccuracy) && responseAccuracy > 0 ? responseAccuracy : accuracy;
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify({ accuracyM: storedAccuracy }));
      } catch {
        // A successful API update must not depend on local browser storage.
      }
      setState("updated");
      // The SUN snapshot endpoint re-reads the event location. Refreshing the
      // server component updates the map without creating a second tap event.
      router.refresh();
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
      <div className="sun-location-consent rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-100" aria-live="polite">
        <span className="block font-black">Ubicación aproximada actualizada</span>
        <span className="mt-1 block font-normal leading-5 text-emerald-100/80">
          El mapa usa la posición redondeada{accuracy ? ` con un radio informado de ±${accuracy} m` : ""}. No demuestra el recorrido físico del producto.
        </span>
      </div>
    );
  }

  return (
    <div className="sun-location-consent rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-4 text-cyan-50" aria-live="polite" aria-busy={state === "pending"}>
      <p className="text-xs font-black">¿Querés mejorar la ubicación de esta lectura?</p>
      <p className="mt-1 text-[11px] leading-5 text-cyan-100/75">
        Es opcional. Solo pedimos permiso al tocar el botón y enviamos una posición aproximada, redondeada y con un radio mínimo de 150 m.
      </p>
      <button
        type="button"
        onClick={shareApproximateLocation}
        disabled={state === "pending"}
        className="mt-3 min-h-11 w-full rounded-xl border border-cyan-200/35 bg-cyan-300/10 px-4 text-xs font-black transition hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {state === "pending" ? "Esperando permiso…" : "Compartir ubicación aproximada"}
      </button>
      {state === "denied" || state === "unavailable" || state === "error" ? (
        <p className="mt-2 text-[11px] leading-5 text-amber-200">
          {state === "denied"
            ? "No autorizaste la ubicación. El pasaporte sigue funcionando normalmente."
            : state === "error"
              ? "No pudimos actualizarla ahora. Podés reintentar; el pasaporte sigue disponible."
              : "Este dispositivo no pudo obtener ubicación. El pasaporte sigue disponible."}
        </p>
      ) : null}
    </div>
  );
}
