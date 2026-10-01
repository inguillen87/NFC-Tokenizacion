"use client";

import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { requestConsumerJson } from "../../../lib/consumer-request";

export function ConsumerLogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function logout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    const response = await requestConsumerJson("/api/consumer/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    if (response.status !== "received" || !response.ok || response.payload?.ok !== true) {
      setError("No pudimos confirmar la salida. Volvé a intentar cuando tengas conexión.");
      setPending(false);
      inFlight.current = false;
      return;
    }
    window.location.assign("/login?next=/me");
  }

  return (
    <div style={{ position: "relative" }}>
    <button
      type="button"
      disabled={pending}
      onClick={() => void logout()}
      className="flex items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 md:px-3 md:py-2 text-[11px] font-black uppercase tracking-wider text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-60"
      title={pending ? "Saliendo" : "Salir"}
      aria-label={pending ? "Saliendo" : "Salir"}
      aria-describedby={error ? "consumer-logout-error" : undefined}
    >
      <LogOut className="h-4 w-4 md:h-3.5 md:w-3.5" aria-hidden="true" />
      <span className="hidden md:inline">{pending ? "Saliendo" : "Salir"}</span>
    </button>
    {error ? <p id="consumer-logout-error" role="status" style={{ position: "absolute", right: 0, top: "100%", width: "min(18rem, calc(100vw - 2rem))", padding: ".8rem", border: "1px solid var(--portal-border)", borderRadius: ".75rem", color: "var(--portal-danger)", background: "var(--portal-surface)", fontSize: ".875rem", lineHeight: 1.6 }}>{error}</p> : null}
    </div>
  );
}
