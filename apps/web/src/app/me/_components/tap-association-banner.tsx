"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Step = "idle" | "code" | "done";

function parseBoolean(value: string | null) {
  if (!value) return false;
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

export function TapAssociationBanner() {
  const params = useSearchParams();
  const eventId = params.get("eventId");
  const tenant = params.get("tenant");
  const fromTap = parseBoolean(params.get("fromTap"));
  const preferredAction = params.get("action") || "portal";
  const [step, setStep] = useState<Step>("idle");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  const visible = useMemo(() => Boolean(fromTap && eventId), [fromTap, eventId]);

  async function associate(action: string, contactValue?: string) {
    if (!eventId) return false;
    await fetch(`/api/mobile/passport/${encodeURIComponent(eventId)}/consumer/join-tenant`, { method: "POST" }).catch(() => null);
    await fetch(`/api/mobile/passport/${encodeURIComponent(eventId)}/consumer/save-product`, { method: "POST" }).catch(() => null);
    if (action === "rewards" && contactValue?.trim()) {
      await fetch(`/api/mobile/passport/${encodeURIComponent(eventId)}/loyalty/enroll`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactValue.includes("@") ? { email: contactValue } : { phone: contactValue }),
      }).catch(() => null);
    }
    return true;
  }

  async function continueWithSession() {
    if (!eventId) return;
    setPending(true);
    setStatus("Asociando este tap verificado con tu cuenta...");
    try {
      const me = await fetch("/api/consumer/me", { cache: "no-store" }).then((res) => res.json()).catch(() => null);
      if (!me?.ok) {
        setStatus("Necesitamos que te registres/inicies sesión para asociar este producto.");
        setPending(false);
        return;
      }
      await associate(preferredAction);
      setStep("done");
      setStatus("Producto asociado correctamente al tenant. Ya podés usar marketplace, rewards y passport.");
    } finally {
      setPending(false);
    }
  }

  async function sendCode() {
    if (!contact.trim()) return;
    setPending(true);
    setStatus("Enviando código...");
    try {
      const start = await fetch("/api/consumer/auth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contact.includes("@") ? { email: contact } : { phone: contact }),
      }).then((res) => res.json()).catch(() => null);
      if (!start?.ok) {
        setStatus("No se pudo iniciar verificación. Probá con otro email/teléfono.");
        return;
      }
      setCode(String(start.code || ""));
      setStep("code");
      setStatus("Código enviado. Verificá para terminar la asociación.");
    } finally {
      setPending(false);
    }
  }

  async function verifyAndAssociate() {
    if (!contact.trim() || !code.trim()) return;
    setPending(true);
    setStatus("Verificando identidad y asociando...");
    try {
      const verify = await fetch("/api/consumer/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contact.includes("@") ? { email: contact, code } : { phone: contact, code }),
      }).then((res) => res.json()).catch(() => null);
      if (!verify?.ok) {
        setStatus("Código inválido o expirado.");
        return;
      }
      await associate(preferredAction, contact);
      setStep("done");
      setStatus("¡Listo! Quedaste registrado y asociado al tenant de este tap.");
    } finally {
      setPending(false);
    }
  }

  if (!visible) return null;

  return (
    <section className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">Tap verificado detectado</p>
      <h2 className="mt-1 text-lg font-semibold text-white">Activá tu experiencia del tenant</h2>
      <p className="mt-1 text-sm text-cyan-50/90">
        Evento: <span className="font-mono">{eventId}</span>{tenant ? <> · Tenant: <span className="font-semibold">{tenant}</span></> : null}
      </p>
      <p className="mt-2 text-sm text-slate-200">Asociá este producto a tu cuenta para desbloquear promos, marketplace y recompensas post-tap.</p>

      {step !== "done" ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <button suppressHydrationWarning disabled={pending} onClick={() => void continueWithSession()} className="rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-60">
            Ya tengo sesión, asociar ahora
          </button>
          <input suppressHydrationWarning
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="Email o teléfono"
            className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          {step === "idle" ? (
            <button suppressHydrationWarning disabled={pending || !contact.trim()} onClick={() => void sendCode()} className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60">
              Registrarme y asociar
            </button>
          ) : (
            <>
              <input suppressHydrationWarning
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Código"
                className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <button suppressHydrationWarning disabled={pending || !code.trim()} onClick={() => void verifyAndAssociate()} className="rounded-lg border border-violet-300/30 bg-violet-500/15 px-3 py-2 text-sm font-semibold text-violet-100 disabled:opacity-60">
                Verificar y finalizar
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Link href={`/me?tenant=${encodeURIComponent(tenant || "")}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-slate-100">Mi portal</Link>
          <Link href={`/me/marketplace?tenant=${encodeURIComponent(tenant || "")}`} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-center text-sm text-cyan-100">Marketplace</Link>
          <Link href={`/me/rewards?tenant=${encodeURIComponent(tenant || "")}`} className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-center text-sm text-violet-100">Promos</Link>
        </div>
      )}
      {status ? <p className="mt-2 text-xs text-slate-200">{status}</p> : null}
    </section>
  );
}
