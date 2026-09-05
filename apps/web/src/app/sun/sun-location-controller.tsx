"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import type { LocationReceipt } from "./tap-location-model";
import { useSunLocale } from "./sun-locale-provider";

export type SunLocationState = "idle" | "requesting" | "saving" | "updated" | "denied" | "timeout"
  | "unsupported" | "invalid" | "stale" | "unavailable" | "retryable" | "fresh_tap_required" | "uncertain";

type LocationStatus = { state: SunLocationState; receipt: LocationReceipt | null };
type LocationController = LocationStatus & {
  ready: boolean;
  register: (request: () => void) => () => void;
  publish: (status: LocationStatus) => void;
  request: () => void;
};

const LocationContext = createContext<LocationController | null>(null);

// One controller per rendered tap. Both entry points use the same permission,
// in-flight guard and server-bound submission; no queued or automatic requests.
export function SunLocationProvider({ children }: { children: ReactNode }) {
  const handler = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<LocationStatus>({ state: "idle", receipt: null });
  const register = useCallback((request: () => void) => {
    handler.current = request;
    setReady(true);
    return () => {
      if (handler.current === request) {
        handler.current = null;
        setReady(false);
      }
    };
  }, []);
  const request = useCallback(() => handler.current?.(), []);
  const value = useMemo(() => ({ ...status, ready, register, publish: setStatus, request }), [status, ready, register, request]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useSunLocationController() {
  return useContext(LocationContext);
}

export function SunLocationRequestButton({ children, className }: { children: ReactNode; className?: string }) {
  const control = useSunLocationController();
  const { text } = useSunLocale();
  const state = control?.state || "idle";
  const busy = state === "requesting" || state === "saving";
  const unavailable = state === "fresh_tap_required" || state === "uncertain" || state === "unsupported";
  const label = state === "requesting" ? "Solicitando permiso..." : "Guardando zona...";

  if (unavailable) {
    return <a className={className} href="#tap-location-consent">{text("Ver estado de la ubicación")}</a>;
  }
  return (
    <button
      type="button"
      data-testid="sun-location-consent-cta"
      className={className}
      disabled={!control?.ready || busy || state === "updated"}
      aria-busy={busy}
      onClick={() => control?.request()}
    >
      {busy ? <><LocateFixed aria-hidden="true" className="h-5 w-5 shrink-0 animate-pulse" /><span role="status">{text(label)}</span></> : children}
    </button>
  );
}

// The server-provided network estimate is replaced only after the same
// telemetry component has validated the persistence receipt for this tap.
export function SunLocationSummary({ children }: { children: ReactNode }) {
  const control = useSunLocationController();
  const { text } = useSunLocale();
  const receipt = control?.state === "updated" ? control.receipt : null;
  if (!receipt) return <>{children}</>;
  const label = [receipt.city, receipt.countryCode].filter(Boolean).join(", ") || text("Zona aproximada del teléfono");
  return (
    <div data-testid="sun-summary-location-confirmed" role="status" className="space-y-3">
      <div className="flex items-start gap-3">
        <MapPin className="mt-1 h-6 w-6 shrink-0 text-emerald-400" aria-hidden="true" />
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-emerald-300">{text("Zona aproximada confirmada")}</p>
          <strong data-sun-server-evidence="true" className="mt-1 block text-lg font-black text-white">{label}</strong>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{text("El teléfono compartió una zona aproximada después del tap y con tu permiso.")}</p>
        </div>
      </div>
      <a href="#geo-trace" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/15 px-3 py-2 text-sm font-black text-emerald-100">
        {text("Ver zona en el mapa")}
      </a>
    </div>
  );
}

// Keep the heading on the same receipt as the summary and map. Until the
// update is confirmed, retain the complete server-rendered evidence instead.
export function SunLocationOriginHeading({
  children,
  titleClassName,
}: {
  children: ReactNode;
  titleClassName?: string;
}) {
  const control = useSunLocationController();
  const { text } = useSunLocale();
  const receipt = control?.state === "updated" ? control.receipt : null;
  if (!receipt) return <>{children}</>;

  return (
    <div
      data-testid="sun-origin-location-confirmed"
      data-location-source="browser-consented"
      className="flex flex-wrap items-end justify-between gap-3"
    >
      <div className="max-w-2xl">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">{text("Mapa del pasaporte")}</span>
        <h2 id="sun-origin-title" className={`${titleClassName || ""} mt-1 text-white`}>{text("Origen y zona compartida")}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">{text("La zona fue compartida por el teléfono después del tap y con permiso. Se muestra separada del origen, sin inventar un recorrido.")}</p>
      </div>
      <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.08em]">
        <span className="rounded-full border border-emerald-300/15 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">{text("Origen informado")}</span>
        <span className="rounded-full border border-cyan-300/15 bg-cyan-500/10 px-3 py-1.5 text-cyan-100">{text("Zona compartida por el teléfono")}</span>
      </div>
    </div>
  );
}
