"use client";

import { LocateFixed, MapPinned, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { requestApproximateBrowserLocation } from "./tap-location-model";

type TelemetryState = "idle" | "pending" | "updated" | "denied" | "timeout" | "unsupported" | "invalid" | "stale" | "unavailable" | "error";

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

function clientContext() {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  };
}

function validReceipt(value: unknown): value is LocationReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as LocationReceipt;
  const source = String(receipt.source || "").toLowerCase();
  return ["browser_geolocation_approximate_consent", "browser_gps_approximate_consent"].includes(source)
    && receipt.precision === "approximate"
    && typeof receipt.lat === "number"
    && Number.isFinite(receipt.lat)
    && receipt.lat >= -90
    && receipt.lat <= 90
    && typeof receipt.lng === "number"
    && Number.isFinite(receipt.lng)
    && receipt.lng >= -180
    && receipt.lng <= 180;
}

function failureCopy(state: TelemetryState) {
  if (state === "denied") return "El permiso fue denegado. Podés habilitarlo en el navegador y volver a intentar; el pasaporte sigue funcionando sin ubicación.";
  if (state === "timeout") return "El teléfono no obtuvo una ubicación a tiempo. Revisá señal y permisos; la validación SUN sigue disponible.";
  if (state === "unsupported") return "Este navegador o contexto no permite geolocalización. Abrí el pasaporte por HTTPS en el navegador del teléfono; la validación sigue funcionando.";
  return "No se pudo obtener una zona aproximada. El pasaporte sigue funcionando sin ella.";
}

function receiptLocationLabel(receipt: LocationReceipt | null) {
  return [receipt?.city, receipt?.countryCode].filter(Boolean).join(", ")
    || (typeof receipt?.lat === "number" && typeof receipt?.lng === "number"
      ? `${receipt.lat.toFixed(2)}, ${receipt.lng.toFixed(2)}`
      : "Zona aproximada del teléfono");
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
  const successRef = useRef<HTMLDivElement | null>(null);
  const focusSuccessRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const storageKey = useMemo(
    () => `nexid:tap-context:${bid}:${eventId || "unknown"}:${readCounter ?? "latest"}`,
    [bid, eventId, readCounter],
  );
  const hasBoundTap = enabled
    && Boolean(endpoint && bid && eventId && freshToken)
    && typeof readCounter === "number"
    && Number.isSafeInteger(readCounter)
    && readCounter >= 0;

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
    try {
      const parsed = JSON.parse(saved) as { status?: string; receipt?: unknown };
      if (parsed.status !== "sent" || !validReceipt(parsed.receipt)) return;
      setReceipt(parsed.receipt);
      setState("updated");
      onLocationConfirmed?.(parsed.receipt);
    } catch {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        // Storage is an optional UX receipt; location persistence happens server-side.
      }
    }
  }, [onLocationConfirmed, storageKey]);

  useEffect(() => {
    if (state !== "updated" || !focusSuccessRef.current) return;
    focusSuccessRef.current = false;
    successRef.current?.focus();
  }, [state]);

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
      const nextReceipt = response?.location;
      const rejectedLegacySource = nextReceipt?.source !== "browser_gps_approximate_consent";
      if (
        !response?.ok
        || !validReceipt(nextReceipt)
        || (rejectedLegacySource && nextReceipt?.source !== "browser_geolocation_approximate_consent")
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
      focusSuccessRef.current = true;
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

  async function shareApproximateLocation() {
    if (state === "pending" || requestInFlightRef.current || !hasBoundTap) return;
    if (typeof window === "undefined" || !window.isSecureContext || !("geolocation" in navigator)) {
      setState("unsupported");
      return;
    }

    requestInFlightRef.current = true;
    setState("pending");
    const locationRequestedAt = new Date().toISOString();
    const locationRequestedAtMs = Date.parse(locationRequestedAt);
    const basePayload = {
      bid,
      uid: uid || undefined,
      eventId,
      fresh_token: freshToken,
      ctr: readCounter,
      contextStatus: contextStatus || "viewed",
      locationRequestedAt,
      geoConsent: true,
      geoPrecision: "approximate",
      client: clientContext(),
    };

    try {
      const result = await requestApproximateBrowserLocation(navigator.geolocation, locationRequestedAtMs);
      if (!result.ok) {
        setState(result.reason);
        return;
      }
      await send({
        ...basePayload,
        geo: {
          lat: result.location.lat,
          lng: result.location.lng,
          accuracy: result.location.accuracyM,
          measuredAt: result.location.measuredAt,
        },
      });
    } finally {
      requestInFlightRef.current = false;
    }
  }

  if (!hasBoundTap) return null;
  if (state === "updated") {
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
      <div
        ref={successRef}
        tabIndex={-1}
        className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-emerald-50 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200" aria-hidden="true">
            <ShieldCheck className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-200">Ubicación opcional guardada</p>
            <strong className="mt-1 block break-words text-sm text-white">{receiptLocationLabel(receipt)}</strong>
            <p className="mt-1 text-xs leading-5 text-emerald-100/80">El mapa ya usa la zona aproximada que compartiste después del tap.</p>
          </div>
        </div>
        <details className="mt-3 border-t border-emerald-200/10 pt-2 text-xs leading-5 text-emerald-100/75">
          <summary className="min-h-11 cursor-pointer py-2 font-bold text-emerald-100">Ver comprobante de ubicación</summary>
          <dl className="grid gap-1 leading-4 sm:grid-cols-2">
            <div><dt className="inline font-bold">Fuente: </dt><dd className="inline">geolocalización aproximada del navegador con permiso</dd></div>
            <div><dt className="inline font-bold">Precisión publicada: </dt><dd className="inline">{accuracyLabel}</dd></div>
            <div><dt className="inline font-bold">Tap recibido: </dt><dd className="inline">{formatTime(receipt?.tapReceivedAt)}</dd></div>
            <div><dt className="inline font-bold">Ubicación medida: </dt><dd className="inline">{formatTime(receipt?.measuredAt)}</dd></div>
          </dl>
          <p className="mt-2 leading-4">
            El teléfono reportó esta zona y se actualizó el evento sin repetir el tap. La medición ocurre después de abrir la página: no es una coordenada emitida por el NFC ni prueba el instante RF exacto, recorrido, custodia o autenticidad física. Como contexto agregado, nexID sólo guarda la zona horaria del navegador.
          </p>
        </details>
        {mapHref ? (
          <a href={mapHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200/15 bg-emerald-400/10 px-3 text-xs font-black text-emerald-50 transition hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
            <MapPinned className="h-4 w-4" aria-hidden="true" />
            Abrir zona aproximada en OpenStreetMap (sitio externo)
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(8,145,178,0.13),rgba(15,23,42,0.78))] p-4 text-cyan-50 shadow-inner" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200" aria-hidden="true">
          <LocateFixed className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-200">Ubicación de este teléfono</p>
          <p className="mt-1 text-sm font-black text-white">Agregá la zona del teléfono a esta lectura</p>
          <p id="tap-location-help" className="mt-1 text-xs leading-5 text-cyan-100/80">La ciudad estimada por la red puede ser incorrecta. Sólo pediremos ubicación al tocar el botón. El origen reportado del producto no se modifica.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={shareApproximateLocation}
        disabled={state === "pending"}
        aria-describedby="tap-location-help tap-location-privacy"
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/25 bg-cyan-300/15 px-4 text-xs font-black transition hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-wait disabled:opacity-60"
      >
        <LocateFixed className="h-4 w-4" aria-hidden="true" />
        {state === "pending" ? "Solicitando permiso..." : state === "idle" ? "Agregar zona al pasaporte" : "Volver a intentar"}
      </button>
      <p id="tap-location-privacy" className="mt-2 text-center text-xs font-semibold leading-4 text-cyan-100/65">Opcional · ubicación aproximada · zona redondeada · sin cambiar la validación</p>
      {state === "error" ? (
        <div role="alert" className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>No pudimos asociar la ubicación a este evento. La validación SUN no cambió; hacé un nuevo tap físico para volver a intentarlo.</p>
          </div>
        </div>
      ) : state === "denied" || state === "timeout" || state === "unsupported" || state === "unavailable" ? (
        <p role="status" className="mt-3 rounded-xl border border-amber-300/15 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">{failureCopy(state)}</p>
      ) : null}
      <details className="mt-2 border-t border-cyan-200/10 pt-1 text-xs leading-5 text-cyan-100/70">
        <summary className="min-h-11 cursor-pointer py-2 font-bold text-cyan-100/85">Cómo funciona</summary>
        <p>El NFC pasivo no aporta ubicación. La geolocalización del navegador toma una medición nueva después de tocar el botón; puede usar señales del dispositivo como Wi-Fi, red móvil o GPS. nexID redondea la zona y guarda fuente, precisión y horarios separados del tap. Como contexto agrega sólo la zona horaria: no agrega idioma, user-agent, plataforma ni tamaño de pantalla.</p>
      </details>
    </div>
  );
}
