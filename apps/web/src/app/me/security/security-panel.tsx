"use client";

import { useState } from "react";
import { ShieldCheck, Mail, Phone, Lock, Sparkles, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Consumer = {
  id: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
};

export function SecurityPanel({ initialConsumer }: { initialConsumer: Consumer | null }) {
  const [consumer, setConsumer] = useState<Consumer | null>(initialConsumer);
  const [contactValue, setContactValue] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!consumer) {
    return (
      <div className="rounded-3xl border border-red-500/25 bg-red-950/10 p-6 text-center">
        <p className="text-red-400 font-bold">No se pudo cargar la sesión. Por favor inicia sesión de nuevo.</p>
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

  async function startAssociation() {
    if (!contactValue.trim()) {
      setErrorMsg("Por favor ingresa un contacto válido.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setStatusMsg("Generando código de seguridad...");

    const res = await fetch("/api/consumer/associate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(missingType === "email" ? { email: contactValue.trim() } : { phone: contactValue.trim() }),
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
        : "No se pudo iniciar el proceso de verificación. Revisa el formato.");
      return;
    }

    setCode("");
    setStep("verify");
    setStatusMsg(`Código enviado con éxito a ${data.contact}. Revisa tu ${data.deliveryChannel === "email" ? "correo" : "WhatsApp"}.`);
  }

  async function verifyAssociation() {
    if (!code.trim()) {
      setErrorMsg("Por favor ingresa el código de 6 dígitos.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setStatusMsg("Verificando código y aplicando bono de puntos...");

    const res = await fetch("/api/consumer/associate/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact: contactValue.trim(),
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
        ? "El código ingresado es incorrecto o ha expirado."
        : "Error en la verificación. Inténtalo de nuevo.");
      return;
    }

    // Association successful!
    setConsumer(data.consumer);
    setStep("input");
    setStatusMsg("¡Asociación de doble factor exitosa! Redirigiendo...");
    window.location.href = "/me";
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Back button */}
      <Link href="/me" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition">
        <ArrowLeft className="h-4 w-4" /> Volver al Pasaporte
      </Link>

      {isVerified2FA ? (
        /* 2FA Verified Success Panel */
        <div className="rounded-3xl border border-emerald-500/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.06)_0%,rgba(4,120,87,0.02)_100%)] p-6 text-center space-y-4 shadow-xl">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white tracking-tight">¡Doble Factor Activo!</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Tu Pasaporte cuenta con el máximo nivel de seguridad. Recibirás códigos de autenticación en ambos canales.
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
            <div className="flex items-center justify-between p-3.5 bg-emerald-500/5">
              <span className="flex items-center gap-2 text-emerald-400 font-bold"><Sparkles className="h-4 w-4" /> Bono 2FA</span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-400/25 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-300">Cargado (+100 pts)</span>
            </div>
          </div>
        </div>
      ) : (
        /* 2FA Association Form */
        <div className="rounded-3xl border border-white/10 bg-slate-900/55 p-6 space-y-5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight">Activar Doble Factor</h3>
              <p className="text-[11px] text-slate-400">Verificá tu segundo factor para proteger tu cuenta y ganar +100 puntos.</p>
            </div>
          </div>

          {step === "input" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {missingType === "email" ? "Vincular tu Correo Electrónico" : "Vincular tu WhatsApp"}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    {missingType === "email" ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  </div>
                  <input
                    type={missingType === "email" ? "email" : "tel"}
                    placeholder={missingType === "email" ? "correo@ejemplo.com" : "+549261..."}
                    value={contactValue}
                    onChange={(e) => setContactValue(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-500 text-sm focus:border-cyan-500 focus:outline-none transition"
                  />
                </div>
                {missingType === "phone" && (
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Importante: Ingresá el código de país completo sin espacios ni guiones (ej. +5492613168608 para Argentina).
                  </p>
                )}
              </div>

              <button
                disabled={loading || !contactValue.trim()}
                onClick={() => void startAssociation()}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 py-3 text-xs font-black text-slate-950 transition uppercase tracking-wider disabled:opacity-60 shadow"
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
                  onChange={(e) => setCode(e.target.value)}
                  className="block w-full text-center tracking-[0.3em] font-mono py-2.5 rounded-xl border border-white/10 bg-slate-950 text-slate-100 text-lg focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  disabled={loading}
                  onClick={() => setStep("input")}
                  className="flex-1 rounded-xl border border-white/10 hover:bg-white/5 py-3 text-xs font-black text-slate-300 transition uppercase tracking-wider"
                >
                  Atrás
                </button>
                <button
                  disabled={loading || code.trim().length !== 6}
                  onClick={() => void verifyAssociation()}
                  className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3 text-xs font-black text-slate-950 transition uppercase tracking-wider disabled:opacity-60"
                >
                  Verificar y Activar
                </button>
              </div>
            </div>
          )}

          {statusMsg && (
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3 text-xs text-cyan-200 leading-relaxed">
              {statusMsg}
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-200 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
