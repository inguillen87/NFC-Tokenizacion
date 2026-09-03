"use client";

import { useEffect, useRef, useState } from "react";
import { dashboardAuthPath, normalizeDashboardReturnPath } from "../lib/dashboard-return-path";
import { dashboardFetch } from "../lib/dashboard-fetch";

type SessionConnectionState = "confirmed" | "checking" | "degraded";

export function SessionHeartbeat() {
  const [connectionState, setConnectionState] = useState<SessionConnectionState>("confirmed");
  const [recoveryHref, setRecoveryHref] = useState("/session-recovery?next=%2F");
  const retryRef = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    let stopHeartbeat = false;
    let pingInFlight = false;
    let failures = 0;
    let timer: number | null = null;
    const baseInterval = 1000 * 60 * 5;
    const maxInterval = 1000 * 60 * 30;

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    const schedule = () => {
      if (!active || stopHeartbeat) return;
      clearTimer();
      const next = Math.min(maxInterval, baseInterval * (2 ** Math.max(0, failures - 1)));
      timer = window.setTimeout(() => {
        void ping();
      }, next);
    };

    const ping = async () => {
      clearTimer();
      if (!active || stopHeartbeat || pingInFlight) return;
      // A hidden tab waits for visibility/focus instead of losing its only
      // scheduled heartbeat forever.
      if (document.visibilityState === "hidden") return;
      pingInFlight = true;
      setConnectionState((current) => current === "degraded" ? "checking" : current);
      try {
        const response = await dashboardFetch("/api/session/current", { cache: "no-store" }).catch(() => null);
        if (!active) return;
        if (response && (response.status === 401 || response.status === 403)) {
          stopHeartbeat = true;
          const returnPath = normalizeDashboardReturnPath(
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
          );
          window.location.replace(dashboardAuthPath("/login", returnPath, { auth_error: "session_expired" }));
          return;
        }
        const payload = response?.ok ? await response.json().catch(() => null) : null;
        const sessionConfirmed = Boolean(
          payload
          && payload.ok === true
          && payload.session
          && typeof payload.session === "object",
        );
        if (!sessionConfirmed) {
          failures = Math.min(4, failures + 1);
          const returnPath = normalizeDashboardReturnPath(
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
          );
          const nextRecoveryHref = dashboardAuthPath("/session-recovery", returnPath);
          setRecoveryHref(nextRecoveryHref);
          setConnectionState("degraded");
          if (failures >= 2) {
            stopHeartbeat = true;
            window.location.replace(nextRecoveryHref);
          }
          return;
        }
        failures = 0;
        setConnectionState("confirmed");
      } finally {
        pingInFlight = false;
        schedule();
      }
    };

    const resumeHeartbeat = () => {
      if (!active || stopHeartbeat || document.visibilityState === "hidden") return;
      clearTimer();
      void ping();
    };
    retryRef.current = resumeHeartbeat;

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") resumeHeartbeat();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", resumeHeartbeat);
    void ping();
    return () => {
      active = false;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", resumeHeartbeat);
      retryRef.current = () => {};
    };
  }, []);

  if (connectionState === "confirmed") return null;

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 z-[70] rounded-2xl border border-amber-300/30 bg-slate-950/95 p-4 text-sm text-amber-50 shadow-2xl backdrop-blur-xl lg:bottom-6 lg:left-auto lg:max-w-xl"
      data-testid="session-heartbeat-degraded"
      role="status"
    >
      <p className="font-black text-white">
        {connectionState === "checking" ? "Revalidando la sesión…" : "La sesión no pudo confirmarse."}
      </p>
      <p className="mt-1 leading-6 text-amber-100/85">
        No se toma una respuesta vacía o inválida como sesión activa. Conservamos la credencial y evitamos afirmar que los datos nuevos están disponibles.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={connectionState === "checking"}
          onClick={() => retryRef.current()}
          className="min-h-10 rounded-xl border border-amber-200/35 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-50 disabled:cursor-wait disabled:opacity-60"
        >
          {connectionState === "checking" ? "Verificando…" : "Reintentar ahora"}
        </button>
        <a
          href={recoveryHref}
          className="inline-flex min-h-10 items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-100"
        >
          Abrir verificación segura
        </a>
      </div>
    </aside>
  );
}
