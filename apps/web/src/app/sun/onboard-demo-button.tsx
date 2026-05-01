"use client";

import { useState } from "react";

export function OnboardDemoButton({ bid }: { bid: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function onboard() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/demo/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bid, tenant_slug: "demobodega", tenant_name: "Demo Bodega" }),
      });
      const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
      if (!response.ok || data?.ok === false) {
        setMessage(`❌ ${String(data?.reason || "Onboarding failed")}`);
      } else {
        setMessage(`✅ Onboarding listo: ${data.imported || 0} UIDs importadas, ${data.activated || 0} activadas. Refrescá esta página.`);
      }
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : "Onboarding failed"}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3">
      <p className="text-xs text-cyan-100">¿Querés que lo haga por vos? Botón 1-click para crear tenant + batch + import + activate (modo demo).</p>
      <button suppressHydrationWarning
        type="button"
        disabled={pending}
        onClick={() => void onboard()}
        className="mt-2 rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-3 py-1 text-xs text-cyan-50 disabled:opacity-60"
      >
        {pending ? "Onboarding en curso..." : `Auto-onboard ${bid}`}
      </button>
      {message ? <p className="mt-2 text-xs text-cyan-100">{message}</p> : null}
    </div>
  );
}
