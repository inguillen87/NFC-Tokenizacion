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

  async function start() {
    const parsed = parseContact(contact);
    if (!parsed.valid) {
      setStatus("Ingresá un email o teléfono válido.");
      return;
    }
    setPending(true);
    setStatus("Enviando código...");
    const payload = await fetch("/api/consumer/auth/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.email ? { email: parsed.input } : { phone: parsed.input }),
    }).then((res) => res.json().catch(() => null)).catch(() => null);
    setPending(false);
    if (!payload?.ok) {
      setStatus("No se pudo iniciar sesión de consumidor.");
      return;
    }
    setCode(String(payload.code || ""));
    setStep("verify");
    setStatus("Código enviado. Verificalo para entrar al portal.");
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.email ? { email: parsed.input, code: code.trim() } : { phone: parsed.input, code: code.trim() }),
    }).catch(() => null);
    setPending(false);
    if (!response || !response.ok) {
      setStatus("Código inválido o expirado.");
      return;
    }
    window.location.href = nextPath || "/me";
  }

  return (
    <div className="mt-5 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Portal consumidor</p>
      <p className="mt-1 text-sm text-cyan-50/90">Ingresá con email o teléfono para asociar tu tap y abrir tu marketplace contextual.</p>
      <div className="mt-3 grid gap-2">
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email o teléfono" className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500" />
        {step === "verify" ? <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código" className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500" /> : null}
        {step === "start" ? (
          <button disabled={pending || !parseContact(contact).valid} onClick={() => void start()} className="rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 py-2.5 text-sm font-semibold text-cyan-100 disabled:opacity-60">Recibir código</button>
        ) : (
          <button disabled={pending || !code.trim()} onClick={() => void verify()} className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2.5 text-sm font-semibold text-emerald-100 disabled:opacity-60">Entrar al portal</button>
        )}
      </div>
      {status ? <p className="mt-2 text-xs text-slate-200">{status}</p> : null}
    </div>
  );
}
