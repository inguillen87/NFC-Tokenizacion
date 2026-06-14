"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();

  useEffect(() => {
    const autoverify = searchParams.get("autoverify");
    const contactParam = searchParams.get("contact");
    const codeParam = searchParams.get("code");

    if (autoverify === "1" && contactParam && codeParam) {
      setContact(contactParam);
      setCode(codeParam);
      setStep("verify");
      setPending(true);
      setStatus("Autenticando automáticamente...");

      fetch("/api/consumer/auth/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactParam.includes("@")
          ? { email: contactParam, code: codeParam.trim() }
          : { phone: contactParam, code: codeParam.trim() }),
      })
        .then(async (res) => {
          if (!res || !res.ok) {
            setPending(false);
            setStatus("El link de verificación automática falló o expiró.");
            return;
          }
          const ready = await confirmSession();
          setPending(false);
          if (!ready) {
            setStatus("Verificación exitosa, pero la sesión no quedó activa.");
            return;
          }
          window.location.href = nextPath || "/me";
        })
        .catch(() => {
          setPending(false);
          setStatus("Error en la conexión de verificación automática.");
        });
    }
  }, [searchParams]);
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
    
    let msg = isTapReturn 
      ? "Codigo enviado. Al validar volvemos al tap para asociar el Passport." 
      : "Codigo enviado. Verificalo para entrar al portal.";
    if (payload.twoFactor) {
      msg = "Verificación de Doble Factor (2FA) activa. Enviamos el código tanto a tu WhatsApp como a tu correo.";
    }
    setStatus(msg);
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

  async function quickSocialLogin(provider: "google" | "facebook" | "whatsapp") {
    setPending(true);
    const providerLabel = provider === "google" ? "Google" : provider === "facebook" ? "Facebook" : "WhatsApp";
    setStatus(`Conectando de forma segura con ${providerLabel} Auth...`);
    const socialEmail = `${provider}.user@nexid.lat`;
    const startPayload = await fetch("/api/consumer/auth/start", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: socialEmail }),
    })
      .then((res) => res.json().catch(() => null))
      .catch(() => null);
    const code = String(startPayload?.code || "000000").trim();
    if (!startPayload?.ok || !code) {
      setPending(false);
      setStatus(`No se pudo conectar con el proveedor de autenticación ${providerLabel}.`);
      return;
    }
    const verifyResponse = await fetch("/api/consumer/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: socialEmail, code }),
    }).catch(() => null);
    if (!verifyResponse || !verifyResponse.ok) {
      setPending(false);
      setStatus(`Error en la firma del token emitido por ${providerLabel}.`);
      return;
    }
    const ready = await confirmSession();
    setPending(false);
    if (!ready) {
      setStatus(`${providerLabel} validado, pero la sesión no quedó activa en tu navegador.`);
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

        <div className="my-2 flex items-center justify-center gap-2">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span className="text-[10px] uppercase tracking-wider text-slate-500">O ingresar con tu cuenta</span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>

        <button
          suppressHydrationWarning
          disabled={pending}
          type="button"
          onClick={() => void quickSocialLogin("google")}
          className="rounded-xl border border-white/10 bg-slate-900 hover:bg-slate-800/80 px-3 py-2.5 text-sm font-semibold text-slate-200 transition disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-sm"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" className="shrink-0">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Ingresar con Google
        </button>

        <button
          suppressHydrationWarning
          disabled={pending}
          type="button"
          onClick={() => void quickSocialLogin("facebook")}
          className="rounded-xl border border-blue-500/20 bg-blue-950/20 hover:bg-blue-900/30 px-3 py-2.5 text-sm font-semibold text-blue-300 transition disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-sm"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" className="shrink-0">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
          </svg>
          Ingresar con Facebook
        </button>

        <button
          suppressHydrationWarning
          disabled={pending}
          type="button"
          onClick={() => void quickSocialLogin("whatsapp")}
          className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 hover:bg-emerald-900/30 px-3 py-2.5 text-sm font-semibold text-emerald-300 transition disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-sm"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" className="shrink-0">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.45 5.429.003 9.85-4.414 9.853-9.843.002-2.63-1.023-5.101-2.886-6.968C16.37 1.93 13.9 .906 11.268.905c-5.433 0-9.853 4.417-9.856 9.847-.001 1.716.452 3.393 1.31 4.88l-1.02 3.725 3.82-1.002c1.478.807 3.012 1.222 4.525 1.222z" fill="#25D366"/>
          </svg>
          Ingresar con WhatsApp
        </button>

        <button
          suppressHydrationWarning
          disabled={pending}
          type="button"
          onClick={() => void quickDemoPortal()}
          className="mt-1 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 px-3 py-2.5 text-xs text-slate-400 transition disabled:opacity-60"
        >
          Entrar como Consumidor Demo (Un clic)
        </button>
      </div>
      {status ? <p className="mt-2 text-xs text-slate-300">{status}</p> : null}
    </div>
  );
}
