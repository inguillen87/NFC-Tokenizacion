"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./security-panel.module.css";
import { AlertTriangle, ArrowLeft, Lock, Mail, Phone } from "lucide-react";
import {
  ConsumerContactInput,
  consumerContactDraftIsValid,
  consumerContactPayload,
  createEmptyConsumerContactDraft,
  type ConsumerContactDraft,
} from "../../../components/consumer-contact-input";

// Public NexID contacts already published on the landing; independent of the
// signed-in consumer and separate from the outbound authentication sender.
const NEXID_CONTACT = {
  email: "info@nexid.lat",
  argentina: "https://api.whatsapp.com/send?phone=5492613168608",
  chile: "https://api.whatsapp.com/send?phone=56988689095",
} as const;

function NexidContactCard() {
  return (
    <section className={`${styles.card} ${styles.supportCard}`} aria-labelledby="security-nexid-contact-title">
      <h2 id="security-nexid-contact-title">Contactar a NexID</h2>
      <p>Consultas sobre tu cuenta y la plataforma.</p>
      <a href={`mailto:${NEXID_CONTACT.email}`} className={styles.supportPrimary}>
        <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{NEXID_CONTACT.email}</span>
      </a>
      <div className={styles.supportChannels}>
        <a href={NEXID_CONTACT.argentina} target="_blank" rel="noopener noreferrer" aria-label="Contactar a NexID por WhatsApp Argentina (abre una pestaña nueva)">
          <Phone aria-hidden="true" className="h-4 w-4 shrink-0" /><span>WhatsApp Argentina</span>
        </a>
        <a href={NEXID_CONTACT.chile} target="_blank" rel="noopener noreferrer" aria-label="Contactar a NexID por WhatsApp Chile (abre una pestaña nueva)">
          <Phone aria-hidden="true" className="h-4 w-4 shrink-0" /><span>WhatsApp Chile</span>
        </a>
      </div>
      <p className={styles.supportHint}>Tus códigos de acceso son personales. No los compartas.</p>
    </section>
  );
}
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
      <div className={`${styles.root} mx-auto max-w-xl v3-space-y-6`}>
        <section className={`${styles.card} rounded-3xl border p-6 text-center`} aria-label="Tus medios de acceso">
          <p role="alert">No pudimos consultar tus medios de acceso. Reintentá para revisar tu cuenta.</p>
          <button type="button" className={styles.recovery} onClick={() => window.location.reload()}>Reintentar consulta</button>
          <Link href="/me" prefetch={false} className={`${styles.back} mt-3 inline-flex items-center`}>Volver a mi espacio</Link>
        </section>
        <NexidContactCard />
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
        <ArrowLeft className="h-4 w-4" /> Volver a mi espacio
      </Link>

      <section className={`${styles.card} ${styles.accessCard}`} aria-labelledby="security-access-title">
        <h2 id="security-access-title">Tus medios de acceso</h2>
        <p>Estos son tus datos personales para recibir códigos al entrar a tu cuenta.</p>
        <dl className={`${styles.contacts} mt-4 divide-y rounded-2xl border text-left`}>
          <div className={`${styles.contactRow} flex items-center justify-between p-3.5`}>
            <dt className={styles.contactLabel}><Mail aria-hidden="true" className="h-4 w-4 shrink-0" />Tu email</dt>
            <dd className={styles.contactValue}>{hasEmail ? consumer.email : "Sin agregar"}</dd>
          </div>
          <div className={`${styles.contactRow} flex items-center justify-between p-3.5`}>
            <dt className={styles.contactLabel}><Phone aria-hidden="true" className="h-4 w-4 shrink-0" />Tu WhatsApp</dt>
            <dd className={styles.contactValue}>{hasPhone ? consumer.phone : "Sin agregar"}</dd>
          </div>
        </dl>
        <p className={styles.accessHint}>Al ingresar, elegís uno de tus medios vinculados para recibir el código.</p>
      </section>

      {!hasBothLinkedChannels ? (
        <section className={`${styles.card} v3-space-y-5 rounded-3xl border p-6 shadow-lg`} aria-labelledby="security-add-access-title">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 id="security-add-access-title" className="text-sm font-black tracking-tight text-white">Agregá otra opción de acceso</h2>
              <p className="text-[11px] text-slate-400">Sumá otro medio para recibir un código cuando ingresás a tu cuenta.</p>
            </div>
          </div>

          {step === "input" ? (
            <div className="v3-space-y-4">
              <div className="v3-space-y-2">
                <p className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {missingType === "email" ? "Tu nuevo email" : "Tu nuevo WhatsApp"}
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
        </section>
      ) : null}
      <NexidContactCard />
      <Link href="/me/rewards" prefetch={false} className={styles.benefits}>Ver mis beneficios</Link>
    </div>
  );
}
