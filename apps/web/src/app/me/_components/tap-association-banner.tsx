"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Step = "idle" | "code" | "done";

type AssociationResult = {
  action: "join" | "save" | "claim" | "rewards";
  ok: boolean;
  status: number;
  error?: string;
};

function parseBoolean(value: string | null) {
  if (!value) return false;
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

function parseContactPayload(contactValue: string) {
  const value = contactValue.trim();
  return value.includes("@") ? { email: value } : { phone: value };
}

function summarizeAssociation(results: AssociationResult[]) {
  const success = results.filter((item) => item.ok).map((item) => item.action);
  const blocked = results.filter((item) => !item.ok && ["tap_not_claimable", "blocked_replay", "revoked"].includes(String(item.error || "")));
  const unauthorized = results.some((item) => item.status === 401);
  if (unauthorized) return "La sesión no quedó activa. Ingresá otra vez para asociar el tap.";
  if (success.includes("claim")) return "Producto asociado, titularidad registrada y marketplace habilitado.";
  if (success.includes("save") || success.includes("join")) return "Producto guardado y club habilitado. Titularidad/token pueden requerir compra o validación del tenant.";
  if (blocked.length) return "El tap fue verificado, pero las acciones comerciales quedaron protegidas por política de seguridad.";
  return "No se pudo completar la asociación. Reintentá desde un tap físico fresco.";
}

export function TapAssociationBanner() {
  const params = useSearchParams();
  const eventId = params.get("eventId");
  const tenant = params.get("tenant");
  const bid = params.get("bid");
  const fromTap = parseBoolean(params.get("fromTap"));
  const preferredAction = params.get("action") || "portal";
  const [step, setStep] = useState<Step>("idle");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const autoStarted = useRef(false);

  const visible = useMemo(() => Boolean(fromTap && eventId), [fromTap, eventId]);

  async function postAssociationAction(action: AssociationResult["action"], path: string, body?: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    return {
      action,
      ok: Boolean(response?.ok && payload?.ok !== false),
      status: response?.status || 0,
      error: payload?.error || payload?.reason || undefined,
    } satisfies AssociationResult;
  }

  async function associate(action: string, contactValue?: string) {
    if (!eventId) return { ok: false, results: [] as AssociationResult[] };
    const payload = {
      ...(tenant ? { tenantId: tenant } : {}),
      ...(bid ? { bid } : {}),
    };
    const encodedEventId = encodeURIComponent(eventId);
    const results: AssociationResult[] = [];
    results.push(await postAssociationAction("join", `/api/mobile/passport/${encodedEventId}/consumer/join-tenant`, payload));
    results.push(await postAssociationAction("save", `/api/mobile/passport/${encodedEventId}/consumer/save-product`, payload));
    results.push(await postAssociationAction("claim", `/api/mobile/passport/${encodedEventId}/consumer/claim`, payload));
    if (action === "rewards" && contactValue?.trim()) {
      results.push(await postAssociationAction("rewards", `/api/mobile/passport/${encodedEventId}/loyalty/enroll`, parseContactPayload(contactValue)));
    }
    return { ok: results.some((item) => item.ok), results };
  }

  async function continueWithSession() {
    if (!eventId) return;
    setPending(true);
    setStatus("Asociando este tap verificado con tu cuenta...");
    try {
      const me = await fetch("/api/consumer/me", { cache: "no-store", credentials: "include" }).then((res) => res.json()).catch(() => null);
      if (!me?.ok) {
        setStatus("Necesitamos que ingreses o te registres para asociar este producto.");
        setPending(false);
        return;
      }
      const association = await associate(preferredAction);
      setStatus(summarizeAssociation(association.results));
      if (association.ok) setStep("done");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!visible || autoStarted.current || step !== "idle") return;
    autoStarted.current = true;
    void continueWithSession();
  // continueWithSession intentionally reads current query/state once when the tap banner appears.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step]);

  async function sendCode() {
    if (!contact.trim()) return;
    setPending(true);
    setStatus("Enviando código...");
    try {
      const start = await fetch("/api/consumer/auth/start", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parseContactPayload(contact)),
      }).then((res) => res.json()).catch(() => null);
      if (!start?.ok) {
        setStatus("No se pudo iniciar verificación. Probá con otro email o teléfono.");
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
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...parseContactPayload(contact), code }),
      }).then((res) => res.json()).catch(() => null);
      if (!verify?.ok) {
        setStatus("Código inválido o expirado.");
        return;
      }
      const association = await associate(preferredAction, contact);
      setStatus(summarizeAssociation(association.results));
      if (association.ok) setStep("done");
    } finally {
      setPending(false);
    }
  }

  if (!visible) return null;

  return (
    <section className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">Tap verificado detectado</p>
      <h2 className="mt-1 text-lg font-semibold text-white">Activá tu experiencia de marca</h2>
      <p className="mt-1 text-sm text-cyan-50/90">
        Evento: <span className="font-mono">{eventId}</span>{tenant ? <> · Tenant: <span className="font-semibold">{tenant}</span></> : null}
      </p>
      <p className="mt-2 text-sm text-slate-200">Asociá este producto a tu cuenta para desbloquear promos, marketplace, puntos y passport post-tap.</p>

      {step !== "done" ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <button suppressHydrationWarning disabled={pending} onClick={() => void continueWithSession()} className="rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-60">
            Ya tengo sesión, asociar ahora
          </button>
          <input
            suppressHydrationWarning
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
              <input
                suppressHydrationWarning
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
