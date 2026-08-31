"use client";

import { LocateFixed, MapPinned, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TelemetryState = "idle" | "pending" | "updated" | "denied" | "unavailable" | "error";

export type LocationReceipt = {
  source?: string | null;
  precision?: string | null;
  accuracyM?: number | null;
  city?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  tapReceivedAt?: string | null;
  measuredAt?: string | null;
  receivedAt?: string | null;
  timing?: string | null;
};

export type TapPrecisionTelemetryProps = {
  endpoint: string;
  bid: string;
  uid?: string | null;
  eventId?: string | null;
  freshToken?: string | null;
  readCounter?: number | null;
  contextStatus?: string | null;
  enabled?: boolean;
  onLocationConfirmed?: (receipt: LocationReceipt) => void;
};

const APPROXIMATE_ACCURACY_FLOOR_M = 150;

function roundApproximateCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clientContext() {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
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
  onLocationConfirmed,
}: TapPrecisionTelemetryProps) {
  const [state, setState] = useState<TelemetryState>("idle");
  const [receipt, setReceipt] = useState<LocationReceipt | null>(null);
  const storageKey = useMemo(
    () => `nexid:tap-context:${bid}:${eventId || uid || "unknown"}:${readCounter ?? "latest"}`,
    [bid, eventId, readCounter, uid],
  );

  useEffect(() => {
    setState("idle");
    setReceipt(null);
    if (typeof window === "undefined") return;
    let saved: string | null = null;
    try {
      saved = window.sessionStorage.getItem(storageKey);
    } catch {
      return;
    }
    if (!saved) return;
    if (saved === "sent") {
      setState("updated");
      return;
    }
    try {
      const parsed = JSON.parse(saved) as { status?: string; receipt?: LocationReceipt | null };
      if (parsed.status === "sent") {
        const savedReceipt = parsed.receipt || null;
        setReceipt(savedReceipt);
        setState("updated");
        if (savedReceipt) onLocationConfirmed?.(savedReceipt);
      }
    } catch {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        // Storage is an optional UX receipt; location persistence happens server-side.
      }
    }
  }, [onLocationConfirmed, storageKey]);

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
      const response = await request.json().catch(() => null) as { ok?: boolean; location?: LocationReceipt } | null;
      const nextReceipt = response?.location || null;
      if (
        !response?.ok
        || nextReceipt?.source !== "browser_gps_approximate_consent"
        || nextReceipt?.precision !== "approximate"
        || typeof nextReceipt?.lat !== "number"
        || typeof nextReceipt?.lng !== "number"
      ) {
        setState("error");
        return;
      }
      setReceipt(nextReceipt);
      onLocationConfirmed?.(nextReceipt);
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify({ status: "sent", receipt: nextReceipt }));
      } catch {
        // A blocked/full sessionStorage must not turn a successful update into an error.
      }
      setState("updated");
      // Keep the original fresh handoff in memory. Refreshing this Server
      // Component after FreshHandoffUrlCleaner removes the one-time token would
      // reload the snapshot as historical and incorrectly disable claim,
      // warranty and other actions from the still-active physical tap. The
      // parent updates the map immediately from this receipt instead.
    } catch {
      setState("error");
    }
  }

  function shareApproximateLocation() {
    if (state === "pending" || !enabled || !bid || (!uid && !eventId) || !endpoint) return;
    setState("pending");
    const locationRequestedAt = new Date().toISOString();
    const locationRequestedAtMs = Date.parse(locationRequestedAt);
    const basePayload = {
      bid,
      uid: uid || undefined,
      eventId: eventId || undefined,
      fresh_token: freshToken || undefined,
      ctr: typeof readCounter === "number" ? readCounter : undefined,
      contextStatus: contextStatus || "viewed",
      scannedAt: locationRequestedAt,
      locationRequestedAt,
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
        const locationMeasuredAtMs = Number(position.timestamp);
        if (
          !Number.isFinite(locationMeasuredAtMs)
          || locationMeasuredAtMs < locationRequestedAtMs
          || !Number.isFinite(position.coords.accuracy)
          || position.coords.accuracy < 0
          || position.coords.accuracy > 50_000
        ) {
          setState("unavailable");
          return;
        }
        const nextAccuracy = Math.max(
          APPROXIMATE_ACCURACY_FLOOR_M,
          Math.round(position.coords.accuracy),
        );
        void send({
          ...basePayload,
          geo: {
            lat: roundApproximateCoordinate(position.coords.latitude),
            lng: roundApproximateCoordinate(position.coords.longitude),
            accuracy: nextAccuracy,
            measuredAt: new Date(locationMeasuredAtMs).toISOString(),
          },
        });
      },
      (error) => {
        setState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 },
    );
  }

  if (!enabled || !bid || (!uid && !eventId) || !endpoint) return null;
  if (state === "updated") {
    const locationLabel = [receipt?.city, receipt?.countryCode].filter(Boolean).join(", ")
      || (typeof receipt?.lat === "number" && typeof receipt?.lng === "number"
        ? `${receipt.lat.toFixed(2)}, ${receipt.lng.toFixed(2)}`
        : "Zona guardada en el evento");
    const accuracyLabel = typeof receipt?.accuracyM === "number"
      ? `±${Math.round(receipt.accuracyM)} m o más`
      : "aproximada";
    const mapHref = typeof receipt?.lat === "number" && typeof receipt?.lng === "number"
      ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(receipt.lat))}&mlon=${encodeURIComponent(String(receipt.lng))}#map=11/${encodeURIComponent(String(receipt.lat))}/${encodeURIComponent(String(receipt.lng))}`
      : "";
    const formatTime = (value: string | null | undefined) => {
      if (!value) return "No informado";
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? date.toLocaleString("es-AR") : "No informado";
    };
    return (
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/[0.08] p-3.5 text-emerald-50 shadow-inner" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200" aria-hidden="true">
            <ShieldCheck className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">Ubicación opcional guardada</p>
            <strong className="mt-1 block break-words text-sm text-white">{locationLabel}</strong>
            <p className="mt-1 text-[10px] leading-4 text-emerald-100/75">El mapa ya usa la zona aproximada que compartiste después del tap.</p>
          </div>
        </div>
        <details className="mt-3 border-t border-emerald-200/10 pt-2 text-[10px] text-emerald-100/75">
          <summary className="min-h-9 cursor-pointer py-2 font-bold text-emerald-100">Ver comprobante de ubicación</summary>
          <dl className="grid gap-1 leading-4 sm:grid-cols-2">
            <div><dt className="inline font-bold">Fuente: </dt><dd className="inline">GPS del navegador con permiso</dd></div>
            <div><dt className="inline font-bold">Precisión publicada: </dt><dd className="inline">{accuracyLabel}</dd></div>
            <div><dt className="inline font-bold">Tap recibido: </dt><dd className="inline">{formatTime(receipt?.tapReceivedAt)}</dd></div>
            <div><dt className="inline font-bold">GPS medido: </dt><dd className="inline">{formatTime(receipt?.measuredAt)}</dd></div>
          </dl>
          <p className="mt-2 leading-4">
            El teléfono reportó esta zona y se actualizó el evento sin repetir el tap. La medición ocurre después de abrir la página: no es una coordenada emitida por el NFC ni prueba el instante RF exacto o el recorrido del producto. Como contexto agregado, nexID sólo guarda la zona horaria del navegador.
          </p>
        </details>
        {mapHref ? (
          <a href={mapHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200/15 bg-emerald-400/10 px-3 text-[10px] font-black text-emerald-50 transition hover:bg-emerald-400/15">
            <MapPinned className="h-4 w-4" aria-hidden="true" />
            Abrir zona aproximada
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(8,145,178,0.13),rgba(15,23,42,0.72))] p-3.5 text-cyan-50 shadow-inner" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200" aria-hidden="true">
          <LocateFixed className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200">Ubicación de este teléfono</p>
          <p className="mt-1 text-sm font-black text-white">Mostrá la zona donde hiciste esta lectura</p>
          <p className="mt-1 text-[10px] leading-4 text-cyan-100/75">La ciudad estimada por la red puede ser incorrecta. Sólo pediremos ubicación al tocar el botón.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={shareApproximateLocation}
        disabled={state === "pending"}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/25 bg-cyan-300/15 px-3 text-[10px] font-black transition hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-wait disabled:opacity-60"
      >
        <LocateFixed className="h-4 w-4" aria-hidden="true" />
        {state === "pending" ? "Solicitando permiso..." : "Compartir ubicación aproximada"}
      </button>
      <p className="mt-1.5 text-center text-[9px] font-bold text-cyan-100/60">Opcional · se guarda una zona redondeada, no tu coordenada exacta</p>
      {state === "denied" || state === "unavailable" || state === "error" ? (
        <p className="mt-2 rounded-xl border border-amber-300/15 bg-amber-500/10 p-2.5 text-[10px] leading-4 text-amber-100">No se confirmó ubicación GPS. El pasaporte sigue funcionando sin ella; la zona de red/IP, si existió al recibir el tap, permanece identificada por separado.</p>
      ) : null}
      <details className="mt-2 border-t border-cyan-200/10 pt-1 text-[9px] leading-4 text-cyan-100/65">
        <summary className="min-h-9 cursor-pointer py-2 font-bold text-cyan-100/80">Cómo funciona</summary>
        <p>El NFC pasivo no trae GPS. El navegador toma una medición nueva después de abrir esta página, nexID redondea la zona y guarda fuente, precisión y horarios separados del tap. Como contexto agrega sólo la zona horaria: no agrega idioma, user-agent, plataforma ni tamaño de pantalla.</p>
      </details>
    </div>
  );
}
