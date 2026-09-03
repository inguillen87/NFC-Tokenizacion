"use client";

import { RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SecureDashboardLogoutButton } from "../../components/secure-dashboard-logout-button";

type RecoveryState = "checking" | "waiting";

const RETRY_INTERVAL_MS = 5_000;

export function SessionRecoveryClient({ clerkEnabled = false }: { clerkEnabled?: boolean }) {
  const [state, setState] = useState<RecoveryState>("checking");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const requestInFlight = useRef(false);
  const stopped = useRef(false);

  const validateSession = useCallback(async () => {
    if (requestInFlight.current || stopped.current) return;
    requestInFlight.current = true;
    setState("checking");

    try {
      const response = await fetch("/api/session/current", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401 || response.status === 403) {
        stopped.current = true;
        window.location.replace("/login?auth_error=session_expired");
        return;
      }

      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok === true && payload?.session) {
        stopped.current = true;
        window.location.replace("/");
        return;
      }

      setState("waiting");
      setLastCheckedAt(new Date());
    } catch {
      setState("waiting");
      setLastCheckedAt(new Date());
    } finally {
      requestInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    stopped.current = false;
    void validateSession();
    const timer = window.setInterval(() => void validateSession(), RETRY_INTERVAL_MS);
    const resume = () => {
      if (document.visibilityState === "visible") void validateSession();
    };

    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);

    return () => {
      stopped.current = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [validateSession]);

  const checking = state === "checking";

  return (
    <div className="pt-7 sm:pt-9">
      <div className="grid gap-7 md:grid-cols-[auto_1fr] md:items-start">
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200 shadow-[0_18px_50px_rgba(34,211,238,.16)]">
          {checking ? (
            <RefreshCw aria-hidden="true" className="h-9 w-9 animate-spin" />
          ) : (
            <WifiOff aria-hidden="true" className="h-9 w-9" />
          )}
          <span className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full border border-emerald-300/30 bg-emerald-400/15 text-emerald-100">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          </span>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            Verificando conexión segura
          </p>
          <h1 id="session-recovery-title" className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Tu sesión sigue protegida.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            El centro de control no puede confirmar tu acceso en este momento. Conservamos tu sesión y reintentamos automáticamente;
            no mostramos información del tenant hasta recibir una respuesta válida.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">1 · Protegida</span>
          <p className="mt-2 text-sm leading-6 text-slate-300">La credencial no se elimina por una interrupción temporal.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">2 · Sin datos viejos</span>
          <p className="mt-2 text-sm leading-6 text-slate-300">La consola permanece cerrada hasta validar una fuente actual.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">3 · Automática</span>
          <p className="mt-2 text-sm leading-6 text-slate-300">Volverás al panel apenas la conexión se restablezca.</p>
        </div>
      </div>

      <div aria-live="polite" className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
        {checking
          ? "Comprobando el estado de tu sesión…"
          : `La conexión todavía no responde. Reintentaremos en unos segundos${lastCheckedAt ? ` · Último intento ${lastCheckedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}.`}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void validateSession()}
          disabled={checking}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-400/15 px-5 py-3 text-sm font-bold text-cyan-50 transition hover:border-cyan-200/70 hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-70"
        >
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Verificando…" : "Reintentar ahora"}
        </button>
        <SecureDashboardLogoutButton
          clerkEnabled={clerkEnabled}
          label="Cerrar sesión de forma segura"
          pendingLabel="Cerrando sesión…"
          testId="session-recovery-secure-logout"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-300 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
        />
      </div>
    </div>
  );
}
