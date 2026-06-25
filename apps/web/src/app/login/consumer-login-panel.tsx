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
  if (reason === "rate_limited") return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
  if (reason === "resend_api_key_missing" || reason === "consumer_auth_from_email_missing" || reason === "smtp_credentials_missing") {
    return "No se pudo enviar el email porque falta configurar el proveedor de correo en producción.";
  }
  if (reason === "twilio_credentials_missing" || reason === "twilio_sender_missing") {
    return "No se pudo enviar el código por teléfono porque falta configurar Twilio.";
  }
  if (reason === "twilio_delivery_failed" || reason === "resend_delivery_failed" || reason === "smtp_delivery_failed") {
    return "El proveedor de mensajes rechazó el envío. Revisá el email/teléfono o la configuración del tenant.";
  }
  return "No se pudo iniciar sesión.";
}

export function ConsumerLoginPanel({ nextPath }: { nextPath: string }) {
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"start" | "verify">("start");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const searchParams = useSearchParams();

  const isTapReturn = nextPath.includes("fromTap=1") || nextPath.includes("eventId=");
  const tapReturnCopy = isTapReturn
    ? "Validá email o teléfono para volver al producto. Garantía, ownership, wallet/NFT y puntos sensibles requieren compra validada, POS/PIN o política de la marca."
    : "Ingresá con email o teléfono para abrir tu Pasaporte, marketplace contextual y beneficios opt-in.";

  useEffect(() => {
    const magicToken = searchParams.get("t") || searchParams.get("token");
    const autoverify = searchParams.get("autoverify");
    const contactParam = searchParams.get("contact");
    const codeParam = searchParams.get("code");

    if (!magicToken && (autoverify !== "1" || !contactParam || !codeParam)) return;

    const legacyContact = contactParam || "";
    const legacyCode = codeParam || "";
    setContact(legacyContact);
    setCode(legacyCode);
    setStep("verify");
    setPending(true);
    setStatus("Autenticando automáticamente...");

    fetch("/api/consumer/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: magicToken
        ? JSON.stringify({ token: magicToken })
        : JSON.stringify(legacyContact.includes("@")
          ? { email: legacyContact, code: legacyCode.trim() }
          : { phone: legacyContact, code: legacyCode.trim() }),
    })
      .then(async (res) => {
        if (!res?.ok) {
          setStatus("El link de verificación falló o expiró. Pedí un nuevo código y volvé a intentar.");
          return;
        }
        const ready = await confirmSession();
        if (!ready) {
          setStatus("Verificación exitosa, pero la sesión no quedó activa. Revisá cookies o intentá de nuevo.");
          return;
        }
        window.location.href = nextPath || "/me";
      })
      .catch(() => {
        setStatus("Error en la conexión de verificación automática.");
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
      setStatus("Ingresá un email o teléfono válido.");
      return;
    }
    setPending(true);
    setStatus("Enviando código...");
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
      ? "Doble factor activo. Enviamos el código por los canales configurados de tu cuenta."
      : isTapReturn
        ? "Código enviado. Al validar volvemos al producto; cualquier claim queda sujeto a compra validada o POS/PIN."
        : "Código enviado. Ingresá el código recibido para entrar a tu Pasaporte.");
  }

  async function verify() {
    const parsed = parseContact(contact);
    if (!parsed.valid || !code.trim()) {
      setStatus("Revisá el contacto y el código.");
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
      setStatus("Código inválido o expirado. Pedí un nuevo código si el link anterior ya fue usado.");
      return;
    }
    const ready = await confirmSession();
    setPending(false);
    if (!ready) {
      setStatus("La identidad fue validada, pero el navegador no guardó la sesión. Probá de nuevo o revisá cookies.");
      return;
    }
    window.location.href = nextPath || "/me";
  }

  const parsed = parseContact(contact);

  return (
    <div className="mt-5 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Pasaporte nexID</p>
      <p className="mt-1 text-sm text-cyan-50/90">{tapReturnCopy}</p>

      <div className="mt-3 grid gap-2">
        <input
          suppressHydrationWarning
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email o teléfono"
          autoComplete="email"
          className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
        />

        {step === "verify" ? (
          <div className="grid gap-1.5">
            <input
              suppressHydrationWarning
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código recibido"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <p className="text-[11px] leading-4 text-slate-400">Por seguridad nexID no muestra ni completa el código por vos.</p>
          </div>
        ) : null}

        {step === "start" ? (
          <button
            suppressHydrationWarning
            disabled={pending || !parsed.valid}
            onClick={() => void start()}
            className="rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 py-2.5 text-sm font-semibold text-cyan-100 disabled:opacity-60"
          >
            Recibir código
          </button>
        ) : (
          <button
            suppressHydrationWarning
            disabled={pending || !code.trim()}
            onClick={() => void verify()}
            className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2.5 text-sm font-semibold text-emerald-100 disabled:opacity-60"
          >
            {isTapReturn ? "Validar y continuar" : "Entrar a mi Pasaporte"}
          </button>
        )}
      </div>

      {status ? <p className="mt-2 text-xs text-slate-300">{status}</p> : null}
    </div>
  );
}
