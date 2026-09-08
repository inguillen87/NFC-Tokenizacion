"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { normalizeSafeReturnPath } from "@product/config/safe-return-path";
import { consumerDeliveryIsSimulation, consumerDeliveryMessage } from "./consumer-login-delivery";
import {
  ConsumerContactInput,
  consumerContactDraftFromValue,
  consumerContactDraftIsValid,
  consumerContactPayload,
  createEmptyConsumerContactDraft,
  type ConsumerContactDraft,
} from "../../components/consumer-contact-input";

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
    return "No se pudo confirmar el envío. Revisá el contacto o probá el otro canal. Si se repite, contactá a soporte.";
  }
  if (["otp_provider_unavailable", "consumer_auth_mode_invalid", "consumer_auth_demo_forbidden", "consumer_phone_otp_channel_invalid", "smtp_receipt_invalid", "resend_receipt_invalid", "twilio_receipt_invalid", "smtp_delivery_timeout", "resend_delivery_timeout", "twilio_delivery_timeout"].includes(reason)) return "Este canal no pudo confirmar el envío del código. Probá el otro medio de acceso. Si el mensaje llega más tarde, usá siempre el código más reciente.";
  return "No se pudo iniciar sesión.";
}

async function logoutConsumerSession() {
  await fetch("/api/consumer/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => null);
}

export function ConsumerLoginPanel({ nextPath }: { nextPath: string }) {
  const safeNextPath = normalizeSafeReturnPath(nextPath, "/me");
  const [contactDraft, setContactDraft] = useState(() => createEmptyConsumerContactDraft());
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"start" | "verify">("start");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const searchParams = useSearchParams();
  const forceOtp = searchParams.get("forceOtp") === "1" || searchParams.get("fresh") === "1";

  const isTapReturn = safeNextPath.includes("fromTap=1") || safeNextPath.includes("eventId=");
  const tapReturnCopy = isTapReturn
    ? "Recibí un código y volvé al producto que estabas consultando. Tus beneficios mantienen las condiciones de la marca."
    : "Elegí dónde recibir tu código para entrar a tus productos y beneficios. No necesitás una contraseña.";

  function changeContact(nextDraft: ConsumerContactDraft) {
    setContactDraft(nextDraft);
    setStep("start");
    setCode("");
    setStatus("");
  }

  useEffect(() => {
    if (!forceOtp) return;
    let cancelled = false;
    setPending(true);
    void logoutConsumerSession().finally(() => {
      if (cancelled) return;
      setStep("start");
      setCode("");
      setStatus("Sesión local reiniciada. Pedí un código real para continuar.");
      setPending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [forceOtp]);

  useEffect(() => {
    if (forceOtp) return;
    const magicToken = searchParams.get("t") || searchParams.get("token");
    const autoverify = searchParams.get("autoverify");
    const contactParam = searchParams.get("contact");
    const codeParam = searchParams.get("code");

    if (!magicToken && (autoverify !== "1" || !contactParam || !codeParam)) return;

    const legacyContact = contactParam || "";
    const legacyCode = codeParam || "";
    setContactDraft(consumerContactDraftFromValue(legacyContact));
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
        window.location.assign(safeNextPath);
      })
      .catch(() => {
        setStatus("Error en la conexión de verificación automática.");
      })
      .finally(() => setPending(false));
  }, [forceOtp, safeNextPath, searchParams]);

  async function confirmSession() {
    const session = await fetch("/api/consumer/session", {
      cache: "no-store",
      credentials: "include",
    })
      .then((res) => res.json().catch(() => null))
      .catch(() => null);
    return Boolean(session?.ok && session?.authenticated);
  }

  async function start() {
    const contactPayload = consumerContactPayload(contactDraft);
    if (!contactPayload) {
      setStatus("Ingresá un email válido o WhatsApp con prefijo y número local.");
      return;
    }
    setPending(true);
    setStatus("Enviando código...");
    setCode("");
    await logoutConsumerSession();
    const payload = await fetch("/api/consumer/auth/start", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(contactPayload),
    })
      .then((res) => res.json().catch(() => null))
      .catch(() => null);
    setPending(false);
    if (!payload?.ok) {
      setStatus(authStartErrorMessage(payload?.error));
      return;
    }
    if (consumerDeliveryIsSimulation(payload)) {
      setStatus("El acceso respondió en modo de prueba y no envió un código real. Contactá a soporte para habilitar este canal.");
      return;
    }
    setStep("verify");
    setStatus(consumerDeliveryMessage(payload));
  }

  async function verify() {
    const contactPayload = consumerContactPayload(contactDraft);
    if (!contactPayload || !code.trim()) {
      setStatus("Revisá el contacto y el código.");
      return;
    }
    setPending(true);
    setStatus("Verificando...");
    const response = await fetch("/api/consumer/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...contactPayload, code: code.trim() }),
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
    window.location.assign(safeNextPath);
  }

  const contactIsValid = consumerContactDraftIsValid(contactDraft);

  return (
    <div className="consumer-login-panel mt-5 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Pasaporte nexID</p>
      <p className="mt-1 text-sm text-cyan-50/90">{tapReturnCopy}</p>

      <form className="mt-3 grid gap-3" aria-busy={pending} onSubmit={(event) => { event.preventDefault(); if (!pending) void (step === "start" ? start() : verify()); }}>
        <ConsumerContactInput draft={contactDraft} onChange={changeContact} disabled={pending} idPrefix="consumer-login" />

        {step === "verify" ? (
          <div className="grid gap-1.5">
            <label htmlFor="consumer-access-code" className="text-sm font-semibold">Código de acceso</label>
            <input
              id="consumer-access-code"
              suppressHydrationWarning
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código recibido"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              disabled={pending}
              className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <p className="text-[11px] leading-4 text-slate-400">Por seguridad nexID no muestra ni completa el código por vos.</p>
          </div>
        ) : null}

        {step === "start" ? (
          <button
            suppressHydrationWarning
            type="submit"
            disabled={pending || !contactIsValid}
            className="min-h-12 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 py-2.5 text-sm font-semibold text-cyan-100 disabled:opacity-60"
          >
            {pending ? "Solicitando código…" : "Recibir código"}
          </button>
        ) : (
          <button
            suppressHydrationWarning
            type="submit"
            disabled={pending || !code.trim()}
            className="min-h-12 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2.5 text-sm font-semibold text-emerald-100 disabled:opacity-60"
          >
            {pending ? "Verificando…" : isTapReturn ? "Validar y continuar" : "Entrar a mi Pasaporte"}
          </button>
        )}
        {step === "verify" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={pending} onClick={() => void start()} className="min-h-11 rounded-xl border border-current/20 px-3 text-sm font-semibold disabled:opacity-60">Reenviar código</button>
            <button type="button" disabled={pending} onClick={() => changeContact({ ...contactDraft, channel: contactDraft.channel === "email" ? "whatsapp" : "email" })} className="min-h-11 rounded-xl border border-current/20 px-3 text-sm font-semibold disabled:opacity-60">{contactDraft.channel === "email" ? "Probar con WhatsApp" : "Probar con email"}</button>
            <p className="text-xs leading-5 text-slate-400 sm:col-span-2">Puede demorar unos instantes. En email, revisá también Spam. Si pedís otro código, usá el más reciente.</p>
          </div>
        ) : null}
      </form>

      {status ? <p role="status" aria-live="polite" className="mt-3 text-sm leading-6 text-slate-300">{status}</p> : null}
    </div>
  );
}
