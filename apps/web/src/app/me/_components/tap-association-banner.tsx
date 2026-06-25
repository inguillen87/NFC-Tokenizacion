"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ConsumerContactInput,
  type ConsumerContactPayload,
  consumerContactDraftIsValid,
  consumerContactPayload,
  createEmptyConsumerContactDraft,
} from "../../../components/consumer-contact-input";

type Step = "idle" | "code" | "done";
type SessionState = "checking" | "active" | "none";

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

function maskId(value: string | null) {
  const text = String(value || "");
  if (text.length <= 8) return text || "tap verificado";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function summarizeAssociation(results: AssociationResult[]) {
  const success = results.filter((item) => item.ok).map((item) => item.action);
  const blocked = results.filter((item) => !item.ok && ["tap_not_claimable", "blocked_replay", "revoked", "snapshot_blocked"].includes(String(item.error || "")));
  const unauthorized = results.some((item) => item.status === 401);
  if (unauthorized) return "La sesión no quedó activa. Validá tu email o celular para terminar la asociación.";
  if (success.includes("claim")) return "Producto asociado, titularidad registrada y beneficios habilitados.";
  if (success.includes("save") || success.includes("join")) return "Producto guardado y club habilitado. Titularidad o tokenización pueden requerir validación del comercio.";
  if (blocked.length) return "El tap fue verificado, pero las acciones comerciales quedaron protegidas por política de seguridad.";
  return "No se pudo completar la asociación. Reintentá desde un tap físico fresco.";
}

async function logoutConsumerSession() {
  await fetch("/api/consumer/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => null);
}

async function hasConsumerSession() {
  const response = await fetch("/api/consumer/session", {
    cache: "no-store",
    credentials: "include",
  }).catch(() => null);
  const payload = await response?.json().catch(() => null);
  return Boolean(response?.ok && payload?.ok);
}

function buildTapNextPath(eventId: string | null, tenant: string | null, bid: string | null, preferredAction: string) {
  const next = new URLSearchParams();
  next.set("fromTap", "1");
  if (eventId) next.set("eventId", eventId);
  if (tenant) next.set("tenant", tenant);
  if (bid) next.set("bid", bid);
  if (preferredAction) next.set("action", preferredAction);
  return `/me?${next.toString()}`;
}

export function TapAssociationBanner() {
  const params = useSearchParams();
  const eventId = params.get("eventId");
  const tenant = params.get("tenant");
  const bid = params.get("bid");
  const fromTap = parseBoolean(params.get("fromTap"));
  const preferredAction = params.get("action") || "portal";
  const [step, setStep] = useState<Step>("idle");
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [contactDraft, setContactDraft] = useState(() => createEmptyConsumerContactDraft());
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  const visible = useMemo(() => Boolean(fromTap && eventId), [fromTap, eventId]);
  const contactIsValid = useMemo(() => consumerContactDraftIsValid(contactDraft), [contactDraft]);
  const nextPath = useMemo(() => buildTapNextPath(eventId, tenant, bid, preferredAction), [bid, eventId, preferredAction, tenant]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setSessionState("checking");
    void hasConsumerSession().then((active) => {
      if (cancelled) return;
      setSessionState(active ? "active" : "none");
      setStatus(active
        ? "Hay una sesión activa en este navegador. Para una presentación limpia, reiniciá y pedí un código nuevo."
        : "Validá WhatsApp, celular o email para asociar este tap a tu Passport.");
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

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

  async function associate(action: string, contactPayload?: ConsumerContactPayload | null) {
    if (!eventId) return { ok: false, results: [] as AssociationResult[] };
    const payload = {
      ...(tenant ? { tenantSlug: tenant } : {}),
      ...(bid ? { bid } : {}),
    };
    const encodedEventId = encodeURIComponent(eventId);
    const results: AssociationResult[] = [];
    results.push(await postAssociationAction("join", `/api/mobile/passport/${encodedEventId}/consumer/join-tenant`, payload));
    results.push(await postAssociationAction("save", `/api/mobile/passport/${encodedEventId}/consumer/save-product`, payload));
    results.push(await postAssociationAction("claim", `/api/mobile/passport/${encodedEventId}/consumer/claim`, payload));
    if (action === "rewards" && contactPayload) {
      results.push(await postAssociationAction("rewards", `/api/mobile/passport/${encodedEventId}/loyalty/enroll`, contactPayload));
    }
    return { ok: results.some((item) => item.ok), results };
  }

  async function continueWithCurrentSession() {
    if (!eventId || pending) return;
    setPending(true);
    setStatus("Asociando este tap verificado con la sesión actual...");
    try {
      const ready = await hasConsumerSession();
      if (!ready) {
        setSessionState("none");
        setStatus("No hay una sesión consumer activa. Pedí un código para continuar.");
        return;
      }
      const association = await associate(preferredAction);
      setStatus(summarizeAssociation(association.results));
      if (association.ok) setStep("done");
    } finally {
      setPending(false);
    }
  }

  async function resetPresentation() {
    setPending(true);
    setStatus("Reiniciando sesión local para pedir un código real...");
    try {
      await logoutConsumerSession();
      setSessionState("none");
      setStep("idle");
      setCode("");
      setStatus("Sesión local reiniciada. Ingresá WhatsApp, celular o email y nexID enviará un código real.");
    } finally {
      setPending(false);
    }
  }

  async function openCleanLogin() {
    setPending(true);
    try {
      await logoutConsumerSession();
      window.location.href = `/login?consumer=1&forceOtp=1&next=${encodeURIComponent(nextPath)}`;
    } finally {
      setPending(false);
    }
  }

  async function sendCode() {
    const contactPayload = consumerContactPayload(contactDraft);
    if (!contactPayload) {
      setStatus("Ingresá un email válido o WhatsApp con prefijo y número local.");
      return;
    }
    setPending(true);
    setStatus("Enviando código real...");
    try {
      await logoutConsumerSession();
      setSessionState("none");
      const start = await fetch("/api/consumer/auth/start", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactPayload),
      }).then((res) => res.json()).catch(() => null);
      if (!start?.ok) {
        setStatus("No se pudo iniciar verificación. Probá con otro email o teléfono.");
        return;
      }
      setCode("");
      setStep("code");
      setStatus("Código enviado. Validá para asociar el tap, guardar el producto y habilitar beneficios.");
    } finally {
      setPending(false);
    }
  }

  async function verifyAndAssociate() {
    const contactPayload = consumerContactPayload(contactDraft);
    if (!contactPayload || !code.trim()) {
      setStatus("Revisá el contacto y el código.");
      return;
    }
    setPending(true);
    setStatus("Verificando identidad y asociando el tap...");
    try {
      const verify = await fetch("/api/consumer/auth/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...contactPayload, code: code.trim() }),
      }).then((res) => res.json()).catch(() => null);
      if (!verify?.ok) {
        setStatus("Código inválido o expirado. Pedí uno nuevo si el anterior ya fue usado.");
        return;
      }
      setSessionState("active");
      const association = await associate(preferredAction, contactPayload);
      setStatus(summarizeAssociation(association.results));
      if (association.ok) setStep("done");
    } finally {
      setPending(false);
    }
  }

  if (!visible) return null;

  return (
    <section className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">Tap físico verificado</p>
      <h2 className="mt-1 text-lg font-semibold text-white">Activá tu Passport antes de recibir beneficios</h2>
      <p className="mt-1 text-sm text-cyan-50/90">
        Evento seguro: <span className="font-mono">{maskId(eventId)}</span>
      </p>
      <p className="mt-2 text-sm text-slate-200">
        nexID no emite voucher, ownership ni claim antes de validar identidad. Usá WhatsApp, celular o email para que el flujo sea auditable.
      </p>

      {step !== "done" ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <button
            suppressHydrationWarning
            type="button"
            disabled={pending}
            onClick={() => void openCleanLogin()}
            title="Cierra la sesión consumer local y abre el login con pedido de código real."
            className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
          >
            Presentación limpia con código
          </button>
          <button
            suppressHydrationWarning
            type="button"
            disabled={pending}
            onClick={() => void resetPresentation()}
            title="Limpia la sesión guardada para que este navegador vuelva a pedir OTP."
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60"
          >
            Reiniciar sesión local
          </button>

          <div className="md:col-span-1">
            <ConsumerContactInput draft={contactDraft} onChange={setContactDraft} disabled={pending} idPrefix="tap-association" compact />
          </div>
          {step === "idle" ? (
            <button
              suppressHydrationWarning
              type="button"
              disabled={pending || !contactIsValid}
              onClick={() => void sendCode()}
              title="Envía un código OTP real por el canal configurado."
              className="rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-60"
            >
              Enviar código real
            </button>
          ) : (
            <>
              <input
                suppressHydrationWarning
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Código recibido"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <button
                suppressHydrationWarning
                type="button"
                disabled={pending || !code.trim()}
                onClick={() => void verifyAndAssociate()}
                title="Valida identidad y recién ahí asocia el tap al Passport."
                className="rounded-lg border border-violet-300/30 bg-violet-500/15 px-3 py-2 text-sm font-semibold text-violet-100 disabled:opacity-60"
              >
                Verificar y asociar
              </button>
            </>
          )}

          {sessionState === "active" ? (
            <button
              suppressHydrationWarning
              type="button"
              disabled={pending}
              onClick={() => void continueWithCurrentSession()}
              title="Usa la sesión consumer actual. Para una presentación limpia, elegí el botón de código."
              className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-60 md:col-span-2"
            >
              Usar sesión actual de este navegador
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <Link href={`/me?tenant=${encodeURIComponent(tenant || "")}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-slate-100">Mi portal</Link>
          <Link href={`/me/marketplace?tenant=${encodeURIComponent(tenant || "")}`} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-center text-sm text-cyan-100">Marketplace</Link>
          <Link href={`/me/wallet?tenant=${encodeURIComponent(tenant || "")}`} className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-100">Wallet/NFT</Link>
          <Link href={`/me/experiences?tenant=${encodeURIComponent(tenant || "")}&eventId=${encodeURIComponent(eventId || "")}`} className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-100">Experiencia</Link>
          <Link href={`/me/rewards?tenant=${encodeURIComponent(tenant || "")}`} className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-center text-sm text-violet-100">Promos</Link>
        </div>
      )}
      {!contactIsValid && (contactDraft.email.trim() || contactDraft.localPhone.trim()) ? <p className="mt-2 text-xs text-amber-200">Usá un email válido o WhatsApp con prefijo y número local.</p> : null}
      {status ? <p className="mt-2 text-xs text-slate-200">{status}</p> : null}
    </section>
  );
}
