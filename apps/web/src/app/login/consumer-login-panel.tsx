"use client";

import { useState } from "react";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function parseContact(value: string) {
  const input = value.trim();
  const email = input.includes("@");
  const valid = email ? isValidEmail(input) : isValidPhone(input);
  return { input, email, valid };
}

export function ConsumerLoginPanel({ nextPath }: { nextPath: string }) {
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"start" | "verify">("start");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const demoConsumerEmail = "demo.consumer@nexid.local";
  const isTapReturn = nextPath.includes("fromTap=1") || nextPath.includes("eventId=");
  const isDemoTap = nextPath.toLowerCase().includes("tenant=demo") || nextPath.toUpperCase().includes("DEMO-");

  async function confirmSession() {
    const session = await fetch("/api/consumer/session", {
      cache: "no-store",
      credentials: "include",
    })
      .then((res) => res.json().catch(() => null))
      .catch(() => null);
    return Boolean(session?.ok);
  }

  async function start() {
    const parsed = parseContact(contact);
    if (!parsed.valid) {
      setStatus("Ingresa un email o telefono valido.");
      return;
    }
    setPending(true);
    setStatus("Enviando codigo...");
    const payload = await fetch("/api/consumer/auth/start", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.email ? { email: parsed.input } : { phone: parsed.input }),
    })
      .then((res) => res.json().catch(() => null))
      .catch(() => null);
    setPending(false);
    if (!payload?.ok) {
      setStatus("No se pudo iniciar sesion de consumidor.");
      return;
    }
    setCode(String(payload.code || ""));
    setStep("verify");
    setStatus(isTapReturn ? "Codigo enviado. Al validar volvemos al tap para asociar el Passport." : "Codigo enviado. Verificalo para entrar al portal.");
  }

  async function verify() {
    const parsed = parseContact(contact);
    if (!parsed.valid || !code.trim()) {
      setStatus("Revisa el contacto y el codigo.");
      return;
    }
    setPending(true);
    setStatus("Verificando...");
    const response = await fetch("/api/consumer/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.email ? { email: parsed.input, code: code.trim() } : { phone: parsed.input, code: code.trim() }),
    }).catch(() => null);
    if (!response || !response.ok) {
      setPending(false);
      setStatus("Codigo invalido o expirado.");
      return;
    }
    const ready = await confirmSession();
    setPending(false);
    if (!ready) {
      setStatus("La identidad fue validada, pero el navegador no guardo la sesion. Proba de nuevo o revisa cookies.");
      return;
    }
    window.location.href = nextPath || "/me";
  }

  async function quickDemoPortal() {
    setPending(true);
    setStatus("Preparando portal demo...");
    const startPayload = await fetch("/api/consumer/auth/start", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: demoConsumerEmail }),
    })
      .then((res) => res.json().catch(() => null))
      .catch(() => null);
    const demoCode = String(startPayload?.code || "000000").trim();
    if (!startPayload?.ok || !demoCode) {
      setPending(false);
      setStatus("No se pudo iniciar demo consumer. Verifica DEMO_MODE o CONSUMER_AUTH_MODE en API.");
      return;
    }
    const verifyResponse = await fetch("/api/consumer/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: demoConsumerEmail, code: demoCode }),
    }).catch(() => null);
    if (!verifyResponse || !verifyResponse.ok) {
      setPending(false);
      setStatus("No se pudo validar sesion demo consumer.");
      return;
    }
    const ready = await confirmSession();
    setPending(false);
    if (!ready) {
      setStatus("Demo validada, pero la sesion no quedo activa en el navegador. Proba recargar e ingresar otra vez.");
      return;
    }
    window.location.href = nextPath || "/me";
  }

  async function quickClerkLogin() {
    setPending(true);
    setStatus("Estableciendo conexión segura con Clerk Auth...");
    const clerkEmail = "clerk.user@nexid.lat";
    const startPayload = await fetch("/api/consumer/auth/start", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: clerkEmail }),
    })
      .then((res) => res.json().catch(() => null))
      .catch(() => null);
    const code = String(startPayload?.code || "000000").trim();
    if (!startPayload?.ok || !code) {
      setPending(false);
      setStatus("No se pudo conectar con el proveedor de autenticación Clerk.");
      return;
    }
    const verifyResponse = await fetch("/api/consumer/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: clerkEmail, code }),
    }).catch(() => null);
    if (!verifyResponse || !verifyResponse.ok) {
      setPending(false);
      setStatus("Error en la firma del token emitido por Clerk.");
      return;
    }
    const ready = await confirmSession();
    setPending(false);
    if (!ready) {
      setStatus("Clerk validado, pero la sesión no quedó activa en tu navegador.");
      return;
    }
    window.location.href = nextPath || "/me";
  }

  return (
    <div className="mt-5 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Portal consumidor</p>
      <p className="mt-1 text-sm text-cyan-50/90">
        {isTapReturn
          ? "Valida email o telefono y volvemos al tap para asociar este producto al tenant, activar ownership, wallet/NFT y marketplace."
          : "Ingresa con email o telefono para abrir tu Passport, wallet/NFT y marketplace contextual."}
      </p>
      <div className="mt-3 grid gap-2">
        <input
          suppressHydrationWarning
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email o telefono"
          className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
        />
        {step === "verify" ? (
          <input
            suppressHydrationWarning
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Codigo"
            className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
          />
        ) : null}
        {step === "start" ? (
          <button suppressHydrationWarning disabled={pending || !parseContact(contact).valid} onClick={() => void start()} className="rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 py-2.5 text-sm font-semibold text-cyan-100 disabled:opacity-60">
            Recibir codigo rapido
          </button>
        ) : (
          <button suppressHydrationWarning disabled={pending || !code.trim()} onClick={() => void verify()} className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2.5 text-sm font-semibold text-emerald-100 disabled:opacity-60">
            {isTapReturn ? "Validar y asociar tap" : "Entrar al portal"}
          </button>
        )}
        <button
          suppressHydrationWarning
          disabled={pending}
          type="button"
          onClick={() => void quickClerkLogin()}
          className="rounded-xl border border-purple-500/40 bg-purple-950/20 hover:bg-purple-900/30 px-3 py-2.5 text-sm font-bold text-purple-300 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          🔐 Iniciar Sesión Express con Clerk (WhatsApp/Google)
        </button>
        <button
          suppressHydrationWarning
          disabled={pending}
          type="button"
          onClick={() => void quickDemoPortal()}
          className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700/80 px-3 py-2.5 text-xs text-slate-300 transition disabled:opacity-60"
        >
          Entrar como Consumidor Demo (Un clic)
        </button>
      </div>
      {status ? <p className="mt-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
