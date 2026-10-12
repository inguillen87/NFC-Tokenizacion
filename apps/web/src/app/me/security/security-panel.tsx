"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./security-panel.module.css";
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Mail, Phone } from "lucide-react";
import {
  ConsumerContactInput,
  consumerContactDraftIsValid,
  consumerContactPayload,
  createEmptyConsumerContactDraft,
  type ConsumerContactDraft,
} from "../../../components/consumer-contact-input";

type Consumer = {
  id: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
};

function contactFromPayload(payload: { email: string } | { phone: string }) {
  return "email" in payload ? payload.email : payload.phone;
}

export function SecurityPanel({ initialConsumer }: { initialConsumer: Consumer | null }) {
  const [consumer, setConsumer] = useState<Consumer | null>(initialConsumer);
  const [contactDraft, setContactDraft] = useState<ConsumerContactDraft>(() => createEmptyConsumerContactDraft());
  const [pendingContact, setPendingContact] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const hasEmail = !!consumer?.email;
  const hasPhone = !!consumer?.phone;
  const hasBothLinkedChannels = hasEmail && hasPhone;
  const missingType = !hasEmail ? "email" : !hasPhone ? "phone" : null;
  const lockedChannel: ConsumerContactDraft["channel"] = missingType === "email" ? "email" : "whatsapp";
  const effectiveContactDraft = useMemo(
    () => (contactDraft.channel === lockedChannel ? contactDraft : { ...contactDraft, channel: lockedChannel }),
    [contactDraft, lockedChannel],
  );
  const contactIsValid = consumerContactDraftIsValid(effectiveContactDraft);

  if (!consumer) {
    return (
      <div className={`${styles.root} ${styles.card} rounded-3xl border p-6 text-center`}>
        <p role="alert">No pudimos consultar tus contactos. Reintentá para revisar tu cuenta.</p>
        <button type="button" className={styles.recovery} onClick={() => window.location.reload()}>
          Reintentar consulta
        </button>
        <Link href="/me" prefetch={false} className={`${styles.back} mt-3 inline-flex items-center`}>Volver a mi espacio</Link>
      </div>
    );
  }

  async function startAssociation() {
    const payload = consumerContactPayload(effectiveContactDraft);
    if (!payload) {
      setErrorMsg(missingType === "email" ? "Ingresá un correo válido." : "Ingresá el prefijo y el número local de WhatsApp.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setStatusMsg("Generando código de seguridad...");

    const res = await fetch("/api/consumer/associate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    setLoading(false);
    if (!res) {
      setErrorMsg("Error de conexión al iniciar la asociación.");
      return;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setErrorMsg(data?.error === "contact_already_linked"
        ? "Este contacto ya está vinculado a otra cuenta."
        : "No se pudo iniciar el proceso de verificación. Revisá el formato.");
      return;
    }

    const nextContact = String(data.contact || contactFromPayload(payload));
    setPendingContact(nextContact);
    setCode("");
    setStep("verify");
    setStatusMsg(`Código enviado a ${nextContact}. Revisá tu ${data.deliveryChannel === "email" ? "correo" : "WhatsApp"}.`);
  }

  async function verifyAssociation() {
    const payload = consumerContactPayload(effectiveContactDraft);
    const contact = pendingContact || (payload ? contactFromPayload(payload) : "");
    if (!code.trim()) {
      setErrorMsg("Ingresá el código de 6 dígitos.");
      return;
    }
    if (!contact) {
      setErrorMsg("Falta el contacto asociado. Volvé a pedir el código.");
      setStep("input");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setStatusMsg("Verificando código y asociando el canal...");

    const res = await fetch("/api/consumer/associate/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact,
        code: code.trim(),
      }),
    }).catch(() => null);

    setLoading(false);
    if (!res) {
      setErrorMsg("Error de conexión al verificar el código.");
      return;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setErrorMsg(data?.error === "invalid_code"
        ? "El código ingresado es incorrecto o expiró."
        : "Error en la verificación. Intentá de nuevo.");
      return;
    }

    setConsumer(data.consumer);
    setStep("input");
    setStatusMsg("Canal de contacto asociado. Redirigiendo...");
    window.location.href = "/me";
  }

  return (
    <div className={`${styles.root} mx-auto max-w-xl v3-space-y-6`}>
      <Link href="/me" prefetch={false} className={`${styles.back} inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider`}>
        <ArrowLeft className="h-4 w-4" /> Volver al Pasaporte
      </Link>

      {hasBothLinkedChannels ? (
        <div className={`${styles.card} v3-space-y-4 rounded-3xl border p-6 text-center shadow-xl`}>
          <div className={`${styles.successIcon} mx-auto grid h-16 w-16 place-items-center rounded-2xl border shadow-inner`}>
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="v3-space-y-1">
            <h2 className="text-xl font-black tracking-tight text-white">Canales de contacto vinculados</h2>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-400">
              Tenés email y WhatsApp vinculados a tu cuenta. Un solo código alcanza para entrar; podés usar cualquiera de los canales disponibles.
            </p>
          </div>

          <div className={`${styles.contacts} mt-4 divide-y rounded-2xl border text-left text-xs`}>
            <div className={`${styles.contactRow} flex items-center justify-between p-3.5`}>
              <span className="flex items-center gap-2 text-slate-400"><Mail className="h-4 w-4" /> Correo electrónico</span>
              <span className={`${styles.contactValue} font-mono`}>{consumer.email}</span>
            </div>
            <div className={`${styles.contactRow} flex items-center justify-between p-3.5`}>
              <span className="flex items-center gap-2 text-slate-400"><Phone className="h-4 w-4" /> WhatsApp</span>
              <span className={`${styles.contactValue} font-mono`}>{consumer.phone}</span>
            </div>

          </div>
        </div>
      ) : (
        <div className={`${styles.card} v3-space-y-5 rounded-3xl border p-6 shadow-lg`}>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white">Vincular canal de contacto</h3>
              <p className="text-[11px] text-slate-400">Agregá el contacto faltante para tener otra opción de acceso y recuperación.</p>
            </div>
          </div>

          {step === "input" ? (
            <div className="v3-space-y-4">
              <div className="v3-space-y-2">
                <p className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {missingType === "email" ? "Vincular correo electrónico" : "Vincular WhatsApp"}
                </p>
                <ConsumerContactInput
                  draft={effectiveContactDraft}
                  onChange={setContactDraft}
                  disabled={loading}
                  idPrefix="security-contact"
                  channelLocked={lockedChannel}
                />
              </div>

              <button
                disabled={loading || !contactIsValid}
                onClick={() => void startAssociation()}
                aria-busy={loading} className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow transition hover:from-amber-400 hover:to-amber-300 disabled:opacity-60"
              >
                Enviar código de verificación
              </button>
            </div>
          ) : (
            <div className="v3-space-y-4">
              <div className="v3-space-y-2">
                <label htmlFor="security-association-code" className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Código de verificación recibido
                </label>
                <input
                  id="security-association-code" type="text"
                  placeholder="------"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  className="block w-full rounded-xl border border-white/10 bg-slate-950 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-slate-100 transition focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  disabled={loading}
                  onClick={() => setStep("input")}
                  className={`${styles.secondary} flex-1 rounded-xl border py-3 text-xs font-black uppercase tracking-wider transition`}
                >
                  Atrás
                </button>
                <button
                  disabled={loading || code.trim().length !== 6}
                  onClick={() => void verifyAssociation()}
                  aria-busy={loading} className="flex-1 rounded-xl bg-emerald-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  Verificar y vincular
                </button>
              </div>
            </div>
          )}

          {statusMsg ? (
            <div role="status" aria-live="polite" className={`${styles.status} rounded-xl border p-3 text-xs leading-relaxed`}>
              {statusMsg}
            </div>
          ) : null}

          {errorMsg ? (
            <div role="alert" className={`${styles.error} flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          ) : null}
        </div>
      )}
      <Link href="/me/rewards" prefetch={false} className={styles.benefits}>Ver mis beneficios</Link>
    </div>
  );
}
