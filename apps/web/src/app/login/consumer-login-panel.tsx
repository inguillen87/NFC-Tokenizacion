"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { normalizeSafeReturnPath } from "@product/config/safe-return-path";
import { requestConsumerJson } from "../../lib/consumer-request";
import { authStartErrorMessage, consumerAuthStartMayHaveDeliveredCode, consumerDeliveryIsSimulation, consumerDeliveryMessage } from "./consumer-login-delivery";
import { consumerAuthStartPayload } from "./consumer-login-continuation";
import {
  ConsumerContactInput,
  consumerContactDraftFromValue,
  consumerContactDraftIsValid,
  consumerContactPayload,
  createEmptyConsumerContactDraft,
  type ConsumerContactDraft,
} from "../../components/consumer-contact-input";
import styles from "./consumer-login.module.css";

async function logoutConsumerSession() {
  return requestConsumerJson("/api/consumer/auth/logout", { method: "POST", credentials: "include" });
}

export function ConsumerLoginPanel({ nextPath }: { nextPath: string }) {
  const safeNextPath = normalizeSafeReturnPath(nextPath, "/me");
  const [contactDraft, setContactDraft] = useState<ConsumerContactDraft>(() => ({ ...createEmptyConsumerContactDraft(), channel: "email" }));
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"start" | "verify">("start");
  const [lateCodeAvailable, setLateCodeAvailable] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; tone: "info" | "error"; field?: "contact" | "code" }>({ message: "", tone: "info" });
  const [pending, setPending] = useState(false);
  const requestInFlight = useRef(false);
  const mounted = useRef(true);
  const codeRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const emailRecoveryRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const status = feedback.message;
  const searchParams = useSearchParams();
  const forceOtp = searchParams.get("forceOtp") === "1" || searchParams.get("fresh") === "1";
  const magicToken = searchParams.get("t") || searchParams.get("token");
  const contactParam = searchParams.get("contact");
  const codeParam = searchParams.get("code");
  const autoverify = searchParams.get("autoverify");
  const isTapReturn = safeNextPath.includes("fromTap=1") || safeNextPath.includes("eventId=");
  const preferEmailRecovery = step === "start" && contactDraft.channel === "whatsapp" && feedback.tone === "error" && !feedback.field;

  function setStatus(message: string, tone: "info" | "error" = "info", field?: "contact" | "code") {
    setFeedback({ message, tone, field });
  }

  function changeContact(nextDraft: ConsumerContactDraft) {
    setContactDraft(nextDraft);
    setStep("start");
    setLateCodeAvailable(false);
    setCode("");
    setStatus("");
  }

  function changeChannel() {
    changeContact({ ...contactDraft, channel: contactDraft.channel === "email" ? "whatsapp" : "email" });
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input[type="email"], input[type="tel"]')?.focus());
  }

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (step === "verify" && !pending) codeRef.current?.focus();
  }, [step, pending]);

  useEffect(() => {
    if (feedback.tone !== "error" || pending) return;
    if (feedback.field === "code") codeRef.current?.focus();
    if (feedback.field === "contact") formRef.current?.querySelector<HTMLInputElement>('input[type="email"], input[type="tel"]')?.focus();
    if (preferEmailRecovery && (document.activeElement === submitRef.current || document.activeElement === document.body)) emailRecoveryRef.current?.focus();
  }, [feedback, pending, preferEmailRecovery]);

  useEffect(() => {
    if (!forceOtp) return;
    let cancelled = false;
    requestInFlight.current = true;
    setPending(true);
    void logoutConsumerSession().then((response) => {
      if (cancelled) return;
      setStep("start");
      setCode("");
      setStatus(response.status === "received" && response.ok && response.payload?.ok === true
        ? "Pedí un nuevo código para continuar."
        : "No pudimos confirmar el cierre de la sesión anterior. Volvé a intentar antes de cambiar de cuenta.",
      response.status === "received" && response.ok && response.payload?.ok === true ? "info" : "error");
      setPending(false);
      requestInFlight.current = false;
    });
    return () => { cancelled = true; requestInFlight.current = false; setPending(false); };
  }, [forceOtp]);

  useEffect(() => {
    if (forceOtp || (!magicToken && (autoverify !== "1" || !contactParam || !codeParam))) return;
    let cancelled = false;
    const legacyContact = contactParam || "";
    const legacyCode = codeParam || "";
    setContactDraft(consumerContactDraftFromValue(legacyContact));
    setCode(legacyCode);
    setStep("verify");
    requestInFlight.current = true;
    setPending(true);
    setStatus("Estamos comprobando tu acceso…");
    void requestConsumerJson("/api/consumer/auth/verify", {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: magicToken ? JSON.stringify({ token: magicToken })
        : JSON.stringify(legacyContact.includes("@") ? { email: legacyContact, code: legacyCode.trim() } : { phone: legacyContact, code: legacyCode.trim() }),
    }).then(async (response) => {
      if (cancelled) return;
      if (response.status !== "received") {
        setStatus("No pudimos confirmar el acceso por la conexión. Tu cuenta sigue protegida. Volvé a intentar.", "error");
      } else if (!response.ok || response.payload?.ok !== true) {
        setStatus("No pudimos usar este enlace. Pedí un código nuevo para continuar.", "error", "code");
      } else {
        const ready = await confirmSession();
        if (cancelled) return;
        if (ready) { window.location.assign(safeNextPath); return; }
        setStatus("No pudimos confirmar tu sesión en este navegador. Volvé a intentar. Si se repite, revisá que las cookies estén habilitadas.", "error");
      }
      if (!cancelled) { setPending(false); requestInFlight.current = false; }
    });
    return () => {
      cancelled = true;
      requestInFlight.current = false;
      setPending(false);
      setStatus("La verificación se interrumpió. Podés pedir un código para continuar.");
    };
  }, [forceOtp, magicToken, autoverify, contactParam, codeParam, safeNextPath]);

  async function confirmSession() {
    const response = await requestConsumerJson("/api/consumer/session", { cache: "no-store", credentials: "include" });
    const session = response.status === "received" && response.ok ? response.payload : null;
    return Boolean(session?.ok && session?.authenticated);
  }

  async function start() {
    if (requestInFlight.current) return;
    const contactPayload = consumerContactPayload(contactDraft);
    if (!contactPayload) { setStatus("Ingresá un email válido o WhatsApp con prefijo y número local.", "error", "contact"); return; }
    requestInFlight.current = true;
    setPending(true);
    setStatus("Estamos solicitando tu código…");
    setLateCodeAvailable(false);
    const logout = await logoutConsumerSession();
    if (!mounted.current) return;
    if (logout.status !== "received" || !logout.ok || logout.payload?.ok !== true) {
      setPending(false); requestInFlight.current = false;
      setStatus("No pudimos preparar el acceso. Tu contacto se conserva; volvé a intentar cuando tengas conexión.", "error");
      return;
    }
    const response = await requestConsumerJson("/api/consumer/auth/start", {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(consumerAuthStartPayload(contactPayload, safeNextPath)),
    });
    if (!mounted.current) return;
    setPending(false); requestInFlight.current = false;
    if (response.status !== "received") {
      setLateCodeAvailable(true);
      setStatus("No pudimos confirmar la solicitud. Puede que el mensaje llegue igualmente. Esperá unos instantes; si pedís otro código, usá el más reciente.", "error");
      return;
    }
    const payload = response.payload;
    if (!payload) {
      setLateCodeAvailable(true);
      setStatus("No pudimos confirmar la solicitud. Puede que el mensaje llegue igualmente. Esperá unos instantes; si pedís otro código, usá el más reciente.", "error");
      return;
    }
    if (!response.ok || payload?.ok !== true) {
      setLateCodeAvailable(consumerAuthStartMayHaveDeliveredCode(payload?.error));
      setStatus(authStartErrorMessage(payload?.error), "error");
      return;
    }
    if (consumerDeliveryIsSimulation(payload)) {
      setStatus("Este acceso está en modo de prueba y no envió un código real. Probá el otro canal o consultá a la marca.", "error");
      return;
    }
    setCode("");
    setStep("verify");
    setStatus(consumerDeliveryMessage(payload));
  }

  async function verify() {
    if (requestInFlight.current) return;
    const contactPayload = consumerContactPayload(contactDraft);
    if (!contactPayload || !code.trim()) { setStatus("Revisá el contacto y el código.", "error", "code"); return; }
    requestInFlight.current = true;
    setPending(true);
    setStatus("Estamos comprobando tu código…");
    const response = await requestConsumerJson("/api/consumer/auth/verify", {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...contactPayload, code: code.trim() }),
    });
    if (!mounted.current) return;
    if (response.status !== "received") {
      setPending(false); requestInFlight.current = false;
      setStatus("No pudimos confirmar el acceso por la conexión. Conservamos el código que ingresaste; volvé a intentar.", "error");
      return;
    }
    if (!response.ok || response.payload?.ok !== true) {
      setPending(false); requestInFlight.current = false;
      setStatus(response.httpStatus === 429 ? "Demasiados intentos. Esperá unos minutos antes de volver a probar." : response.httpStatus >= 500
        ? "El servicio de acceso no está disponible ahora. Conservamos tu código; probá más tarde."
        : "No pudimos validar ese código. Revisá el mensaje más reciente o pedí uno nuevo.", "error", "code");
      return;
    }
    const ready = await confirmSession();
    if (!mounted.current) return;
    setPending(false); requestInFlight.current = false;
    if (!ready) { setStatus("No pudimos confirmar tu sesión en este navegador. Volvé a intentar. Si se repite, revisá que las cookies estén habilitadas.", "error"); return; }
    window.location.assign(safeNextPath);
  }

  const contactIsValid = consumerContactDraftIsValid(contactDraft);
  return (
    <div className={`consumer-login-panel ${styles.panel}`}>
      <ol className={styles.steps} aria-label="Pasos de acceso">
        <li aria-current={step === "start" ? "step" : undefined}><span aria-hidden="true">1</span>Tu contacto</li>
        <li aria-current={step === "verify" ? "step" : undefined}><span aria-hidden="true">2</span>Tu código</li>
      </ol>
      <p className={styles.intro}>Elegí email o WhatsApp. No necesitás contraseña.</p>
      <form ref={formRef} className={styles.form} aria-busy={pending} onSubmit={(event) => { event.preventDefault(); if (!pending) void (step === "start" ? start() : verify()); }}>
        <ConsumerContactInput draft={contactDraft} onChange={changeContact} disabled={pending} idPrefix="consumer-login" compact
          invalid={feedback.field === "contact" && feedback.tone === "error"} describedBy={feedback.field === "contact" ? "consumer-access-feedback" : undefined} />
        <p id="consumer-access-feedback" role="status" aria-live="polite" aria-atomic="true" hidden={!status} className={styles.feedback} data-tone={feedback.tone}>{status}</p>
        {preferEmailRecovery ? <button ref={emailRecoveryRef} type="button" disabled={pending} onClick={changeChannel} className={styles.primary} data-consumer-email-recovery="primary" aria-describedby="consumer-access-feedback">
          Continuar con email
        </button> : null}
        {step === "verify" ? <div className={styles.codeGroup}>
          <label htmlFor="consumer-access-code">Código de acceso</label>
          <input ref={codeRef} id="consumer-access-code" value={code} onChange={(event) => { setCode(event.target.value); if (feedback.field === "code") setStatus(""); }}
            placeholder="Código recibido" inputMode="numeric" autoComplete="one-time-code" maxLength={8} disabled={pending}
            aria-invalid={feedback.field === "code" && feedback.tone === "error" || undefined}
            aria-describedby={`consumer-code-hint${feedback.field === "code" ? " consumer-access-feedback" : ""}`} className={styles.codeInput} />
          <p id="consumer-code-hint" className={styles.hint}>Ingresá el código del mensaje más reciente.</p>
        </div> : null}
        <button ref={submitRef} type="submit" disabled={pending || (step === "start" ? !contactIsValid : !code.trim())} className={preferEmailRecovery ? styles.secondary : styles.primary}>
          {pending ? step === "start" ? "Solicitando código…" : "Comprobando acceso…" : step === "start" ? preferEmailRecovery ? "Reintentar WhatsApp" : lateCodeAvailable ? "Volver a pedir código" : "Recibir código" : isTapReturn ? "Validar y continuar" : "Entrar a mi Pasaporte"}
        </button>
        {step === "verify" ? <>
          <div className={styles.secondaryActions}>
            <button type="button" disabled={pending} onClick={() => void start()} className={styles.secondary}>Reenviar código</button>
            <button type="button" disabled={pending} onClick={() => { changeContact(contactDraft); requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input[type="email"], input[type="tel"]')?.focus()); }} className={styles.secondary}>Cambiar contacto</button>
            <button type="button" disabled={pending} onClick={changeChannel} className={styles.secondary}>{contactDraft.channel === "email" ? "Continuar con WhatsApp" : "Continuar con email"}</button>
          </div>
          <p className={styles.hint}>Puede demorar unos instantes. En email, revisá también Spam. Si pedís otro código, usá el más reciente.</p>
        </> : null}
        {step === "start" && lateCodeAvailable && contactIsValid ? <div className={styles.lateCodeRecovery}>
          <p>Si ya recibiste el código, podés ingresarlo sin pedir otro.</p>
          <button type="button" disabled={pending} className={styles.secondary} aria-describedby="consumer-access-feedback" onClick={() => {
            setCode("");
            setStep("verify");
            setStatus("Ingresá el código más reciente que recibiste. Todavía no confirmamos el envío ni tu acceso.");
          }}>Ya tengo un código</button>
        </div> : null}
        {step === "start" && contactDraft.channel === "email" && feedback.tone === "error" && !feedback.field ? <button type="button" disabled={pending} onClick={changeChannel} className={styles.secondary} aria-describedby="consumer-access-feedback">
          Continuar con WhatsApp
        </button> : null}
      </form>
    </div>
  );
}
