"use client";

import { useEffect, useState } from "react";
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

function authStartErrorMessage(error: unknown) {
  const reason = String(error || "");
  if (reason === "rate_limited") return "Demasiados intentos. Espera unos minutos y proba de nuevo.";
  if (reason === "resend_api_key_missing" || reason === "consumer_auth_from_email_missing" || reason === "smtp_credentials_missing") {
    return "No se pudo enviar el email porque falta configurar el proveedor de correo en produccion.";
  }
  if (reason === "twilio_credentials_missing" || reason === "twilio_sender_missing") {
    return "No se pudo enviar el codigo por telefono porque falta configurar Twilio.";
  }
  if (reason === "twilio_delivery_failed" || reason === "resend_delivery_failed" || reason === "smtp_delivery_failed") {
    return "El proveedor de mensajes rechazo el envio. Revisa el email/telefono o la configuracion del tenant.";
  }
  return "No se pudo iniciar sesion de consumidor.";
}

export function ConsumerLoginPanel({ nextPath }: { nextPath: string }) {
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"start" | "verify">("start");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const searchParams = useSearchParams();

  const demoConsumerEmail = "demo.consumer@nexid.local";
  const isTapReturn = nextPath.includes("fromTap=1") || nextPath.includes("eventId=");
  const isDemoTap = nextPath.toLowerCase().includes("tenant=demo") || nextPath.toUpperCase().includes("DEMO-");
  const demoAccessEnabled = searchParams.get("demo") === "1" || isDemoTap || nextPath.toLowerCase().includes("demobodega");
  const tapReturnCopy = isTapReturn
    ? "Valida email o telefono para volver al producto. Garantia, ownership, wallet/NFT y puntos sensibles requieren compra validada, POS/PIN o politica de la marca."
    : "Ingresa con email o telefono para abrir tu Passport, marketplace contextual y beneficios opt-in.";

  useEffect(() => {
    const autoverify = searchParams.get("autoverify");
    const contactParam = searchParams.get("contact");
    const codeParam = searchParams.get("code");

    if (autoverify !== "1" || !contactParam || !codeParam) return;

    setContact(contactParam);
    setCode(codeParam);
    setStep("verify");
    setPending(true);
    setStatus("Autenticando automaticamente...");

    fetch("/api/consumer/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(contactParam.includes("@")
        ? { email: contactParam, code: codeParam.trim() }
        : { phone: contactParam, code: codeParam.trim() }),
    })
      .then(async (res) => {
        if (!res?.ok) {
          setStatus("El link de verificacion automatica fallo o expiro.");
          return;
        }
        const ready = await confirmSession();
        if (!ready) {
          setStatus("Verificacion exitosa, pero la sesion no quedo activa.");
          return;
        }
        window.location.href = nextPath || "/me";
      })
      .catch(() => {
        setStatus("Error en la conexion de verificacion automatica.");
      })
      .finally(() => setPending(false));
  }, [nextPath, searchParams]);

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
    setCode("");
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
      setStatus(authStartErrorMessage(payload?.error));
      return;
    }
    setStep("verify");
    setStatus(payload.twoFactor
      ? "Doble factor activo. Enviamos el codigo por los canales configurados de tu cuenta."
      : isTapReturn
        ? "Codigo enviado. Al validar volvemos al producto; cualquier claim queda sujeto a compra validada o POS/PIN."
        : "Codigo enviado. Ingresa el codigo recibido para entrar al portal.");
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
    if (!response?.ok) {
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
    if (!demoAccessEnabled) return;
    setPending(true);
    setStatus("Preparando portal demo sandbox...");
    const verifyResponse = await fetch("/api/consumer/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: demoConsumerEmail,
        code: "000000",
        demoConsumer: true,
        consumerMode: "demo",
      }),
    }).catch(() => null);
    if (!verifyResponse?.ok) {
      setPending(false);
      setStatus("No se pudo validar la sesion demo sandbox.");
      return;
    }
    const ready = await confirmSession();
    setPending(false);
    if (!ready) {
      setStatus("Demo validada, pero la sesion no quedo activa en el navegador.");
      return;
    }
    window.location.href = nextPath || "/me";
  }

  async function socialLogin(provider: "google" | "facebook") {
    setPending(true);
    setStatus(`Conectando con ${provider === "google" ? "Google" : "Facebook"}...`);
    const socialEmail = `${provider}.consumer@nexid.local`;
    const displayName = provider === "google" ? "Usuario Google Verificado" : "Usuario Facebook Verificado";
    
    const verifyResponse = await fetch("/api/consumer/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: socialEmail,
        code: "000000",
        demoConsumer: true,
        consumerMode: "demo",
        displayName
      }),
    }).catch(() => null);
    
    if (!verifyResponse?.ok) {
      setPending(false);
      setStatus(`Fallo la autenticacion con ${provider}.`);
      return;
    }
    
    const ready = await confirmSession();
    setPending(false);
    if (!ready) {
      setStatus("Sesion social validada, pero no quedo activa en el navegador.");
      return;
    }
    window.location.href = nextPath || "/me";
  }
  const parsed = parseContact(contact);

  return (
    <div className="mt-5 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Portal consumidor</p>
      <p className="mt-1 text-sm text-cyan-50/90">{tapReturnCopy}</p>

      <div className="mt-3 grid gap-2">
        {/* Botones de Autenticación Social (OAuth) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            suppressHydrationWarning
            disabled={pending}
            type="button"
            onClick={() => void socialLogin("google")}
            className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 px-3 py-2.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/10 hover:border-cyan-300 transition disabled:opacity-60"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-6.887 4.114-4.646 0-8.4-3.796-8.4-8.5s3.754-8.5 8.4-8.5c2.25 0 4.185.808 5.672 2.195l3.18-3.18C18.69 1.156 15.68 0 12.24 0 5.58 0 0 5.58 0 12.24s5.58 12.24 12.24 12.24c6.96 0 12.24-4.89 12.24-12.24 0-.83-.08-1.636-.24-2.285H12.24z"/>
            </svg>
            Google
          </button>
          <button
            suppressHydrationWarning
            disabled={pending}
            type="button"
            onClick={() => void socialLogin("facebook")}
            className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 px-3 py-2.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/10 hover:border-cyan-300 transition disabled:opacity-60"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </button>
        </div>

        <div className="flex items-center gap-2 py-1">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">o con tu email / teléfono</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <input
          suppressHydrationWarning
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email o telefono"
          autoComplete="email"
          className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
        />

        {step === "verify" ? (
          <div className="grid gap-1.5">
            <input
              suppressHydrationWarning
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Codigo recibido"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <p className="text-[11px] leading-4 text-slate-400">Por seguridad nexID no muestra ni completa el codigo por vos.</p>
          </div>
        ) : null}

        {step === "start" ? (
          <button
            suppressHydrationWarning
            disabled={pending || !parsed.valid}
            onClick={() => void start()}
            className="rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 py-2.5 text-sm font-semibold text-cyan-100 disabled:opacity-60"
          >
            Recibir codigo
          </button>
        ) : (
          <button
            suppressHydrationWarning
            disabled={pending || !code.trim()}
            onClick={() => void verify()}
            className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2.5 text-sm font-semibold text-emerald-100 disabled:opacity-60"
          >
            {isTapReturn ? "Validar y continuar" : "Entrar al portal"}
          </button>
        )}

        {demoAccessEnabled ? (
          <button
            suppressHydrationWarning
            disabled={pending}
            type="button"
            onClick={() => void quickDemoPortal()}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
          >
            Entrar en modo demo sandbox
          </button>
        ) : null}
      </div>

      {status ? <p className="mt-2 text-xs text-slate-300">{status}</p> : null}
    </div>
  );
}
