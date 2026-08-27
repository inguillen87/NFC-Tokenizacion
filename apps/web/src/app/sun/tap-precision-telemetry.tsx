"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TelemetryState = "idle" | "pending" | "updated" | "denied" | "unavailable" | "error" | "fresh_required";

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

function freshTokenExpiryMs(token: string) {
  const body = token.split(".")[0];
  if (!body) return null;
  try {
    const normalized = body.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded)) as { exp?: unknown };
    const expiresAt = Number(payload.exp) * 1000;
    return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null;
  } catch {
    return null;
  }
}

function roundApproximateCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clientContext() {
  const nav = window.navigator;
  return {
    language: nav.language || null,
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
  const capabilityStorageKey = useMemo(
    () => `nexid:tap-context-capability:${bid}:${eventId || uid || "unknown"}:${readCounter ?? "latest"}`,
    [bid, eventId, readCounter, uid],
  );
  const [capabilityToken, setCapabilityToken] = useState(() => String(freshToken || "").trim());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const incomingToken = String(freshToken || "").trim();
    let candidate = incomingToken;
    if (!candidate) {
      try {
        candidate = window.sessionStorage.getItem(capabilityStorageKey) || "";
      } catch {
        // Restricted browser modes still retain the token in component memory.
      }
    }
    const expiresAt = candidate ? freshTokenExpiryMs(candidate) : null;
    if (!candidate || !expiresAt || expiresAt <= Date.now()) {
      if (candidate) {
        try {
          window.sessionStorage.removeItem(capabilityStorageKey);
        } catch {
          // Session storage is optional.
        }
      }
      if (!incomingToken) setCapabilityToken("");
      return;
    }
    setCapabilityToken(candidate);
    try {
      // The signed token is event-bound and expires in minutes. Keeping it in
      // this tab allows safe retries after the URL is scrubbed.
      window.sessionStorage.setItem(capabilityStorageKey, candidate);
    } catch {
      // A retry in the current render still works from component memory.
    }
    const expiryTimer = window.setTimeout(() => {
      setCapabilityToken("");
      try {
        window.sessionStorage.removeItem(capabilityStorageKey);
      } catch {
        // Session storage is optional.
      }
    }, Math.max(1, expiresAt - Date.now()));
    return () => window.clearTimeout(expiryTimer);
  }, [capabilityStorageKey, freshToken]);

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
    const activeFreshToken = capabilityToken || String(freshToken || "").trim();
    try {
      const request = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, fresh_token: activeFreshToken || undefined }),
        cache: "no-store",
      });
      const response = await request.json().catch(() => null) as { accuracyM?: unknown; fresh_token_status?: unknown } | null;
      if (!request.ok) {
        const tokenStatus = String(response?.fresh_token_status || "");
        if (request.status === 403 && /fresh_token_(?:missing|expired|invalid|mismatch|already_used)/.test(tokenStatus)) {
          setCapabilityToken("");
          try {
            window.sessionStorage.removeItem(capabilityStorageKey);
          } catch {
            // Session storage is optional.
          }
          setState("fresh_required");
        } else {
          setState("error");
        }
        return;
      }
      const responseAccuracy = Number(response?.accuracyM);
      const storedAccuracy = Number.isFinite(responseAccuracy) && responseAccuracy > 0 ? responseAccuracy : accuracy;
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify({ accuracyM: storedAccuracy }));
      } catch {
        // A successful API update must not depend on local browser storage.
      }
      setState("updated");
      // Re-open the same signed snapshot once so the server-rendered map reads
      // the updated event. replace() avoids a history entry and the URL cleaner
      // immediately removes the short-lived capability again.
      if (activeFreshToken) {
        const refreshUrl = new URL(window.location.href);
        refreshUrl.searchParams.delete("fresh_token");
        refreshUrl.searchParams.set("fresh", activeFreshToken);
        refreshUrl.searchParams.set("handoff", "fresh-retry");
        window.location.replace(`${refreshUrl.pathname}${refreshUrl.search}${refreshUrl.hash}`);
      } else {
        router.refresh();
      }
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  if (!enabled || !bid || (!uid && !eventId) || !endpoint) return null;
  if (state === "fresh_required") {
    return (
      <div className="sun-location-consent rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100" role="status">
        <span className="block font-black">Hace falta un toque nuevo para actualizar la zona</span>
        <span className="mt-1 block font-normal leading-5 text-amber-100/80">
          Acercá nuevamente el teléfono a la etiqueta física y abrí la nueva notificación. La ubicación anterior queda intacta.
        </span>
      </div>
    );
  }
  if (state === "updated") {
    return (
      <div className="sun-location-consent rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-100" aria-live="polite">
        <span className="block font-black">Zona de este teléfono agregada</span>
        <span className="mt-1 block font-normal leading-5 text-emerald-100/80">
          Guardamos una posición aproximada y redondeada{accuracy ? `, con un radio de al menos ±${accuracy} m` : ""}. No seguimos tu ubicación ni inferimos el recorrido del producto.
        </span>
        <button
          type="button"
          onClick={shareApproximateLocation}
          className="mt-3 min-h-11 rounded-xl border border-emerald-200/35 bg-emerald-300/10 px-4 text-xs font-black transition hover:bg-emerald-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          Actualizar mi zona
        </button>
      </div>
    );
  }

  return (
    <div className="sun-location-consent rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-4 text-cyan-50" aria-live="polite" aria-busy={state === "pending"}>
      <p className="text-xs font-black">¿Querés agregar la zona de este teléfono?</p>
      <p className="mt-1 text-[11px] leading-5 text-cyan-100/75">
        Es opcional. Sirve para registrar dónde hiciste este toque. Pedimos permiso una sola vez y enviamos la coordenada redondeada, no una ubicación exacta.
      </p>
      <button
        type="button"
        onClick={shareApproximateLocation}
        disabled={state === "pending"}
        className="mt-3 min-h-11 w-full rounded-xl border border-cyan-200/35 bg-cyan-300/10 px-4 text-xs font-black transition hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {state === "pending" ? "Buscando la mejor señal…" : "Usar mi zona actual"}
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
