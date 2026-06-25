"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Mail, Phone, Sparkles } from "lucide-react";
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

  if (!consumer) {
    return (
      <div className="rounded-3xl border border-red-500/25 bg-red-950/10 p-6 text-center">
        <p className="font-bold text-red-400">No se pudo cargar la sesión. Por favor iniciá sesión de nuevo.</p>
        <Link href="/login" className="mt-4 inline-block rounded-xl bg-slate-800 px-4 py-2 text-xs font-black text-slate-100">
          Ir al Login
        </Link>
      </div>
    );
  }

  const hasEmail = !!consumer.email;
  const hasPhone = !!consumer.phone;
  const isVerified2FA = consumer.status === "verified";
  const missingType = !hasEmail ? "email" : !hasPhone ? "phone" : null;
  const lockedChannel: ConsumerContactDraft["channel"] = missingType === "email" ? "email" : "whatsapp";
  const effectiveContactDraft = useMemo(
    () => (contactDraft.channel === lockedChannel ? contactDraft : { ...contactDraft, channel: lockedChannel }),
    [contactDraft, lockedChannel],
  );
  const contactIsValid = consumerContactDraftIsValid(effectiveContactDraft);

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
    setStatusMsg("Verificando código y aplicando bono de puntos...");

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
    setStatusMsg("Asociación de doble factor exitosa. Redirigiendo...");
    window.location.href = "/me";
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/me" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Volver al Pasaporte
      </Link>

      {isVerified2FA ? (
        <div className="space-y-4 rounded-3xl border border-emerald-500/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.06)_0%,rgba(4,120,87,0.02)_100%)] p-6 text-center shadow-xl">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-inner">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black tracking-tight text-white">Doble factor activo</h2>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-400">
              Tu Pasaporte cuenta con un nivel superior de seguridad. Vas a recibir códigos de autenticación en ambos canales.
            </p>
          </div>

          <div className="mt-4 divide-y divide-white/5 rounded-2xl border border-white/5 bg-black/40 text-left text-xs">
            <div className="flex items-center justify-between p-3.5">
              <span className="flex items-center gap-2 text-slate-400"><Mail className="h-4 w-4" /> Correo electrónico</span>
              <span className="font-mono text-slate-200">{consumer.email}</span>
            </div>
            <div className="flex items-center justify-between p-3.5">
              <span className="flex items-center gap-2 text-slate-400"><Phone className="h-4 w-4" /> WhatsApp</span>
              <span className="font-mono text-slate-200">{consumer.phone}</span>
            </div>
            <div className="flex items-center justify-between bg-emerald-500/5 p-3.5">
              <span className="flex items-center gap-2 font-bold text-emerald-400"><Sparkles className="h-4 w-4" /> Bono 2FA</span>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-300">Cargado (+100 pts)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/55 p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white">Activar doble factor</h3>
              <p className="text-[11px] text-slate-400">Verificá tu segundo canal para proteger tu cuenta y ganar +100 puntos.</p>
            </div>
          </div>

          {step === "input" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {missingType === "email" ? "Vincular correo electrónico" : "Vincular WhatsApp"}
                </label>
                <ConsumerContactInput
                  draft={effectiveContactDraft}
                  onChange={setContactDraft}
                  disabled={loading}
                  idPrefix="security-2fa"
                  channelLocked={lockedChannel}
                />
              </div>

              <button
                disabled={loading || !contactIsValid}
                onClick={() => void startAssociation()}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow transition hover:from-amber-400 hover:to-amber-300 disabled:opacity-60"
              >
                Enviar código de verificación
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Código de verificación recibido
                </label>
                <input
                  type="text"
                  placeholder="------"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  className="block w-full rounded-xl border border-white/10 bg-slate-950 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-slate-100 transition focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  disabled={loading}
                  onClick={() => setStep("input")}
                  className="flex-1 rounded-xl border border-white/10 py-3 text-xs font-black uppercase tracking-wider text-slate-300 transition hover:bg-white/5"
                >
                  Atrás
                </button>
                <button
                  disabled={loading || code.trim().length !== 6}
                  onClick={() => void verifyAssociation()}
                  className="flex-1 rounded-xl bg-emerald-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  Verificar y activar
                </button>
              </div>
            </div>
          )}

          {statusMsg ? (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs leading-relaxed text-cyan-200">
              {statusMsg}
            </div>
          ) : null}

          {errorMsg ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs leading-relaxed text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
