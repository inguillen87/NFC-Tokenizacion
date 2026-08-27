"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
const AUTO_LOCATION_PROMPT_VERSION = "v2";

type UserAgentDataLike = {
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
};

type NavigatorWithClientHints = Navigator & {
  deviceMemory?: number;
  userAgentData?: UserAgentDataLike;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
};

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

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function inferDeviceOs(platform: string, userAgent: string, maxTouchPoints: number) {
  const value = `${platform} ${userAgent}`.toLowerCase();
  if (/iphone|ipad|ios/.test(value)) return "iOS";
  if (/android/.test(value)) return "Android";
  if (/windows/.test(value)) return "Windows";
  if (/macintosh|macintel/.test(value) && maxTouchPoints > 1) return "iPadOS";
  if (/macintosh|mac os|macintel/.test(value)) return "macOS";
  if (/linux/.test(value)) return "Linux";
  return "Unknown";
}

function inferDeviceType(mobile: boolean, platform: string, userAgent: string, maxTouchPoints: number) {
  const value = `${platform} ${userAgent}`.toLowerCase();
  if (/ipad|tablet/.test(value) || (/macintel/.test(value) && maxTouchPoints > 1)) return "tablet";
  if (mobile || /mobi|iphone|android/.test(value)) return "mobile";
  return "desktop";
}

async function clientContext() {
  const nav = window.navigator as NavigatorWithClientHints;
  const userAgentData = nav.userAgentData;
  let highEntropy: Record<string, unknown> = {};
  if (typeof userAgentData?.getHighEntropyValues === "function") {
    try {
      highEntropy = await userAgentData.getHighEntropyValues([
        "architecture",
        "bitness",
        "model",
        "platformVersion",
      ]);
    } catch {
      // UA Client Hints are optional and may be restricted by the browser.
    }
  }

  const platform = cleanText(userAgentData?.platform) || cleanText(nav.platform) || "Unknown";
  const userAgent = cleanText(nav.userAgent) || "";
  const mobile = typeof userAgentData?.mobile === "boolean"
    ? userAgentData.mobile
    : /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const connection = nav.connection;
  const model = cleanText(highEntropy.model);

  return {
    language: nav.language || null,
    languages: Array.isArray(nav.languages) ? nav.languages.slice(0, 8) : [],
    platform,
    platformVersion: cleanText(highEntropy.platformVersion),
    architecture: cleanText(highEntropy.architecture),
    bitness: cleanText(highEntropy.bitness),
    model,
    modelSource: model ? "ua_ch_high_entropy" : null,
    userAgent: userAgent || null,
    mobile,
    os: inferDeviceOs(platform, userAgent, nav.maxTouchPoints || 0),
    deviceType: inferDeviceType(mobile, platform, userAgent, nav.maxTouchPoints || 0),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      availableWidth: window.screen.availWidth,
      availableHeight: window.screen.availHeight,
      colorDepth: window.screen.colorDepth,
    },
    hardware: {
      memoryGb: Number.isFinite(nav.deviceMemory) ? nav.deviceMemory : null,
      logicalProcessors: Number.isFinite(nav.hardwareConcurrency) ? nav.hardwareConcurrency : null,
      maxTouchPoints: Number.isFinite(nav.maxTouchPoints) ? nav.maxTouchPoints : null,
    },
    connection: connection
      ? {
          effectiveType: cleanText(connection.effectiveType),
          downlinkMbps: Number.isFinite(connection.downlink) ? connection.downlink : null,
          rttMs: Number.isFinite(connection.rtt) ? connection.rtt : null,
          saveData: connection.saveData === true,
        }
      : null,
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
  const promptStorageKey = useMemo(
    () => `nexid:tap-location-prompt:${AUTO_LOCATION_PROMPT_VERSION}:${eventId || "unknown"}`,
    [eventId],
  );
  const [capabilityToken, setCapabilityToken] = useState(() => String(freshToken || "").trim());
  const [consentOpen, setConsentOpen] = useState(false);
  const autoPromptAttemptedRef = useRef(false);

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

  const send = useCallback(async (payload: Record<string, unknown>) => {
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
      const payloadGeo = payload.geo && typeof payload.geo === "object" && !Array.isArray(payload.geo)
        ? payload.geo as Record<string, unknown>
        : {};
      const payloadAccuracy = Number(payloadGeo.accuracy);
      const storedAccuracy = Number.isFinite(responseAccuracy) && responseAccuracy > 0
        ? responseAccuracy
        : Number.isFinite(payloadAccuracy) && payloadAccuracy > 0
          ? payloadAccuracy
          : null;
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
  }, [capabilityStorageKey, capabilityToken, endpoint, freshToken, router, storageKey]);

  const shareApproximateLocation = useCallback(() => {
    if (state === "pending" || !enabled || !bid || (!uid && !eventId) || !endpoint) return;
    const activeFreshToken = capabilityToken || String(freshToken || "").trim();
    const expiresAt = activeFreshToken ? freshTokenExpiryMs(activeFreshToken) : null;
    if (!activeFreshToken || !expiresAt || expiresAt <= Date.now()) {
      setState("fresh_required");
      return;
    }
    setState("pending");
    const basePayload = {
      bid,
      uid: uid || undefined,
      eventId: eventId || undefined,
      ctr: typeof readCounter === "number" ? readCounter : undefined,
      contextStatus: contextStatus || "viewed",
      scannedAt: new Date().toISOString(),
      geoConsent: true,
      extendedContextConsent: true,
      geoPrecision: "approximate",
    };

    if (!("geolocation" in navigator)) {
      setState("unavailable");
      return;
    }

    // The person has already accepted the explicit nexID consent sheet. Start
    // browser context collection while the native location request is in
    // flight. Nothing is sent if the person denies that native permission.
    const clientContextPromise = clientContext();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextAccuracy = Math.max(
          APPROXIMATE_ACCURACY_FLOOR_M,
          Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : APPROXIMATE_ACCURACY_FLOOR_M,
        );
        setAccuracy(nextAccuracy);
        void clientContextPromise.then((client) => send({
            ...basePayload,
            client,
            geo: {
              lat: roundApproximateCoordinate(position.coords.latitude),
              lng: roundApproximateCoordinate(position.coords.longitude),
              accuracy: nextAccuracy,
            },
          }))
          .catch(() => setState("error"));
      },
      (error) => {
        // A denial is local-only: no device or network profile is transmitted.
        setState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [bid, capabilityToken, enabled, endpoint, eventId, freshToken, readCounter, send, state, uid]);

  useEffect(() => {
    if (typeof window === "undefined" || autoPromptAttemptedRef.current) return;
    if (state !== "idle" || !enabled || !eventId || !capabilityToken) return;
    const expiresAt = freshTokenExpiryMs(capabilityToken);
    if (!expiresAt || expiresAt <= Date.now()) return;

    try {
      if (window.sessionStorage.getItem(storageKey) || window.sessionStorage.getItem(promptStorageKey)) return;
      window.sessionStorage.setItem(promptStorageKey, JSON.stringify({
        eventId,
        requestedAt: new Date().toISOString(),
        version: AUTO_LOCATION_PROMPT_VERSION,
      }));
    } catch {
      // The in-memory guard still prevents duplicate prompts in this mount.
    }

    autoPromptAttemptedRef.current = true;
    setConsentOpen(true);
  }, [capabilityToken, enabled, eventId, promptStorageKey, state, storageKey]);

  const acceptContextConsent = useCallback(() => {
    setConsentOpen(false);
    shareApproximateLocation();
  }, [shareApproximateLocation]);

  const declineContextConsent = useCallback(() => {
    setConsentOpen(false);
    setState("denied");
  }, []);

  if (!enabled || !bid || (!uid && !eventId) || !endpoint) return null;
  if (state === "fresh_required") {
    return (
      <div className="sun-location-consent sun-location-consent--fresh-required rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100" role="status">
        <span className="block font-black">Hace falta un toque nuevo para actualizar la zona</span>
        <span className="mt-1 block font-normal leading-5 text-amber-100/80">
          Acercá nuevamente el teléfono a la etiqueta física y abrí la nueva notificación. La ubicación anterior queda intacta.
        </span>
      </div>
    );
  }
  if (state === "updated") {
    return (
      <div className="sun-location-consent sun-location-consent--updated rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-100" aria-live="polite">
        <span className="block font-black">Zona aproximada agregada</span>
        <span className="mt-1 block font-normal leading-5 text-emerald-100/80">
          Guardamos una posición redondeada{accuracy ? `, con un radio de al menos ±${accuracy} m` : ""}. El contexto técnico se usa sólo en estadísticas agregadas. No seguimos tu ubicación ni inferimos el recorrido del producto.
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
    <>
      {consentOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center" role="presentation">
          <div
            className="sun-location-permission-sheet w-full max-w-md rounded-[1.65rem] border border-cyan-200/30 bg-white p-5 text-left shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sun-location-permission-title"
            aria-describedby="sun-location-permission-description"
          >
            <span className="sun-location-permission-sheet__eyebrow">Lectura NFC real</span>
            <h2 id="sun-location-permission-title" className="mt-3 text-xl font-black tracking-tight text-slate-950">
              Mejorá la ubicación de este toque
            </h2>
            <p id="sun-location-permission-description" className="mt-2 text-sm leading-6 text-slate-600">
              Si aceptás, el navegador solicitará tu ubicación. nexID guardará una zona aproximada y redondeada junto con datos técnicos del dispositivo y la conexión para mejorar la experiencia y crear estadísticas agregadas.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              No seguimos tu recorrido, no mostramos el contexto individual a la marca y el pasaporte funciona aunque elijas ahora no.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={acceptContextConsent}
                className="min-h-12 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
              >
                Permitir zona y contexto
              </button>
              <button
                type="button"
                onClick={declineContextConsent}
                className="min-h-12 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sun-location-consent sun-location-consent--request rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-4 text-cyan-50" aria-live="polite" aria-busy={state === "pending"}>
        <p className="text-xs font-black">Ubicación de esta lectura</p>
        <p className="mt-1 text-[11px] leading-5 text-cyan-100/75">
          Con tu aceptación, guardamos una zona aproximada y datos técnicos del dispositivo y la conexión para mejorar la experiencia y generar estadísticas agregadas. No seguimos tu recorrido.
        </p>
        <button
          type="button"
          onClick={shareApproximateLocation}
          disabled={state === "pending"}
          className="mt-3 min-h-11 w-full rounded-xl border border-cyan-200/35 bg-cyan-300/10 px-4 text-xs font-black transition hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {state === "pending" ? "Buscando la mejor señal…" : "Compartir zona y contexto"}
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
    </>
  );
}
