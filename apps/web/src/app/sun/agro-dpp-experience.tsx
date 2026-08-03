"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  Headphones,
  Leaf,
  PackageCheck,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import {
  AGRO_DPP_PROFILE_VERSION,
  type AgroDppProfile,
  type AgroExperienceEventType,
  resolveAgroSensitiveActionGate,
  resolveAgroTrustCopy,
} from "./agro-dpp-model";

type TimelineItem = {
  at?: string | null;
  result?: string | null;
  city?: string | null;
  country?: string | null;
};

type AgroDppExperienceProps = {
  profile: AgroDppProfile;
  bid: string;
  eventId: string;
  productName: string;
  brand: string;
  statusCode: string;
  statusLabel: string;
  statusSummary: string;
  productState: string;
  verdict: string;
  riskLevel: string;
  isQr: boolean;
  isFreshTap: boolean;
  timeline: TimelineItem[];
};

type ActionState = { kind: "idle" | "working" | "done" | "error"; message?: string };

function visible(value: string | null | undefined, fallback = "No informado") {
  return value?.trim() || fallback;
}

function localDate(value: string | null | undefined) {
  if (!value) return "No informada";
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(parsed))
    : value;
}

function destinationHost(value: string | null | undefined) {
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function eventKey(eventId: string, eventType: AgroExperienceEventType, placement: string) {
  return `nexid:agro-event:${eventId}:${eventType}:${placement}`;
}

function idempotencyKey(eventId: string, eventType: AgroExperienceEventType, placement: string) {
  const key = eventKey(eventId, eventType, placement);
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = `agro_${crypto.randomUUID()}`;
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return `agro_${eventId}_${eventType}_${placement}`.replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 128);
  }
}

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
      <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-bold leading-5 text-slate-100">{visible(value)}</dd>
    </div>
  );
}

export function AgroDppExperience(props: AgroDppExperienceProps) {
  const [online, setOnline] = useState(true);
  const [action, setAction] = useState<ActionState>({ kind: "idle" });
  const [ppeOpen, setPpeOpen] = useState(false);
  const profile = props.profile;

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const trust = useMemo(() => resolveAgroTrustCopy({
    isQr: props.isQr,
    isOffline: !online,
    statusCode: props.statusCode,
    label: props.statusLabel,
    summary: props.statusSummary,
  }), [online, props.isQr, props.statusCode, props.statusLabel, props.statusSummary]);

  const sensitiveGate = useMemo(() => resolveAgroSensitiveActionGate({
    statusCode: props.statusCode,
    productState: props.productState,
    verdict: props.verdict,
    riskLevel: props.riskLevel,
    isOffline: !online,
    isQr: props.isQr,
    isFreshTap: props.isFreshTap,
  }), [online, props.isFreshTap, props.isQr, props.productState, props.riskLevel, props.statusCode, props.verdict]);

  const recordEvent = useCallback(async (
    eventType: AgroExperienceEventType,
    placement: string,
    data: Record<string, string | number | boolean> = {},
  ) => {
    if (!online) return { ok: false, reason: "VERIFICATION_PENDING" };
    if (!props.eventId || !props.bid) return { ok: false, reason: "event_scope_unavailable" };
    const key = idempotencyKey(props.eventId, eventType, placement);
    try {
      const response = await fetch("/api/public-cta/experience-event", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({
          bid: props.bid,
          event_id: props.eventId,
          event_type: eventType,
          idempotency_key: key,
          data: { surface: "agro_dpp", placement, profileVersion: AGRO_DPP_PROFILE_VERSION, ...data },
        }),
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json().catch(() => null) as { ok?: unknown; reason?: unknown } | null;
      return payload?.ok === true
        ? { ok: true as const }
        : { ok: false as const, reason: String(payload?.reason || "event_record_failed") };
    } catch {
      return { ok: false as const, reason: "network_unavailable" };
    }
  }, [online, props.bid, props.eventId]);

  useEffect(() => {
    if (!props.eventId || !online) return;
    void recordEvent("PRODUCT_VIEWED", "identity");
  }, [online, props.eventId, recordEvent]);

  const runRecordedAction = async (input: {
    eventType: AgroExperienceEventType;
    placement: string;
    href?: string | null;
    sensitive?: boolean;
    doneMessage?: string;
    data?: Record<string, string | number | boolean>;
  }) => {
    if (input.sensitive && !sensitiveGate.allowed) {
      setAction({ kind: "error", message: `Acción protegida: ${sensitiveGate.reason}. Hacé un nuevo tap NFC válido.` });
      return;
    }
    setAction({ kind: "working", message: "Registrando la acción…" });
    const saved = await recordEvent(input.eventType, input.placement, input.data);
    if (!saved.ok) {
      if (input.href && !input.sensitive) {
        setAction({ kind: "error", message: "El recurso se abrirá, pero la analítica no pudo registrarse." });
        window.location.assign(input.href);
        return;
      }
      setAction({ kind: "error", message: saved.reason === "VERIFICATION_PENDING" ? trust.summary : "No pudimos registrar la acción. Reintentá sin cerrar esta pantalla." });
      return;
    }
    setAction({ kind: "done", message: input.doneMessage || "Acción registrada." });
    if (input.href) window.location.assign(input.href);
  };

  const supportHref = profile.support.url
    || (profile.support.email ? `mailto:${profile.support.email}` : null)
    || (profile.support.phone ? `tel:${profile.support.phone.replace(/[^+0-9]/g, "")}` : null);
  const hasPpe = Boolean(profile.ppe.summary || profile.ppe.items.length);
  const hasStewardship = Boolean(profile.stewardship.summary || profile.stewardship.items.length);

  return (
    <section id="agro-dpp" aria-label="Pasaporte digital agro" className="space-y-4">
      <section className="rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-950/50 via-slate-950 to-cyan-950/30 p-5 shadow-2xl shadow-emerald-950/20">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200"><Sprout aria-hidden="true" size={24} /></span>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Pasaporte digital agro</span>
            <h1 className="mt-1 text-2xl font-black leading-tight text-white">{profile.productName || props.productName}</h1>
            <p className="mt-1 text-sm text-slate-300">{profile.brand || props.brand}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-2">
          <Spec label="Cultivo" value={profile.crop} />
          <Spec label="Variedad" value={profile.seedVariety} />
          <Spec label="Familia" value={profile.productFamily} />
          <Spec label="Formulación" value={profile.formulation} />
        </dl>
      </section>

      <section className={`rounded-3xl border p-5 ${trust.code === "VERIFICATION_PENDING" || props.isQr ? "border-amber-300/25 bg-amber-400/[0.08]" : "border-cyan-300/20 bg-cyan-400/[0.06]"}`}>
        <div className="flex gap-3">
          {trust.code === "VERIFICATION_PENDING" || props.isQr
            ? <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-200" size={22} />
            : <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-cyan-200" size={22} />}
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Confianza</span>
            <h2 className="mt-1 text-lg font-black text-white">{trust.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-300">{trust.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.12em]">
              <code className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-slate-200">{trust.code}</code>
              <code className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-slate-300">{trust.authenticationLevel}</code>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5">
        <div className="flex items-center gap-2"><PackageCheck aria-hidden="true" className="text-cyan-300" size={20} /><h2 className="font-black text-white">Lote, registro y canal</h2></div>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <Spec label="Lote" value={profile.batchLot || props.bid} />
          <Spec label="Registro" value={profile.registrationNumber} />
          <Spec label="Producción" value={localDate(profile.productionDate)} />
          <Spec label="Vencimiento" value={localDate(profile.expirationDate)} />
          <Spec label="Distribuidor" value={profile.distributor} />
          <Spec label="Canal autorizado" value={profile.authorizedChannel} />
        </dl>
        <div id="recall-status" className="mt-3 scroll-mt-24 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
          {profile.recallStatusUrl ? <a href={profile.recallStatusUrl} className="inline-flex min-h-11 items-center gap-2 font-black text-cyan-200 underline-offset-4 hover:underline">Consultar estado o recall <ExternalLink aria-hidden="true" size={15} /></a> : "La marca no publicó un recurso específico de estado o recall para este lote."}
        </div>
      </section>

      <section id="technical-sheet" className="scroll-mt-24 rounded-3xl border border-white/10 bg-slate-950/80 p-5">
        <div className="flex items-center gap-2"><FileCheck2 aria-hidden="true" className="text-cyan-300" size={20} /><h2 className="font-black text-white">Información técnica</h2></div>
        <p className="mt-2 text-sm leading-6 text-slate-400">Ingrediente activo: <strong className="text-slate-200">{visible(profile.activeIngredient)}</strong></p>
        <div className="mt-4 grid gap-2">
          {profile.technicalSheetUrl ? <button type="button" onClick={() => void runRecordedAction({ eventType: "TECHNICAL_SHEET_VIEWED", placement: "technical_sheet", href: profile.technicalSheetUrl, data: { destinationHost: destinationHost(profile.technicalSheetUrl) } })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 text-sm font-black text-slate-950"><ExternalLink aria-hidden="true" size={16} /> Abrir ficha técnica</button> : <p className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-500">Ficha técnica no publicada por la marca.</p>}
          {profile.safetySheetUrl ? <button id="safety-sheet" type="button" onClick={() => void runRecordedAction({ eventType: "SAFETY_SHEET_VIEWED", placement: "safety_sheet", href: profile.safetySheetUrl, data: { destinationHost: destinationHost(profile.safetySheetUrl) } })} className="scroll-mt-24 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 text-sm font-black text-amber-100"><ExternalLink aria-hidden="true" size={16} /> Abrir hoja de seguridad</button> : <p id="safety-sheet" className="scroll-mt-24 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-500">Hoja de seguridad no publicada por la marca.</p>}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.055] p-5">
        <div className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="text-amber-200" size={20} /><h2 className="font-black text-white">Uso responsable y EPP</h2></div>
        {hasPpe ? <button type="button" onClick={() => { setPpeOpen((current) => !current); if (!ppeOpen) void recordEvent("PPE_CONTENT_VIEWED", "ppe"); }} className="mt-4 flex min-h-11 w-full items-center justify-between rounded-2xl border border-white/10 bg-black/15 px-4 text-left text-sm font-black text-amber-50">Ver equipo de protección <ChevronDown aria-hidden="true" size={17} className={ppeOpen ? "rotate-180 transition" : "transition"} /></button> : null}
        {ppeOpen ? <div className="mt-3 rounded-2xl border border-white/8 bg-black/15 p-4 text-sm leading-6 text-slate-200"><p>{profile.ppe.summary}</p>{profile.ppe.items.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{profile.ppe.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div> : null}
        {hasStewardship ? <div className="mt-3 rounded-2xl border border-white/8 bg-black/15 p-4 text-sm leading-6 text-slate-200"><p>{profile.stewardship.summary}</p>{profile.stewardship.items.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{profile.stewardship.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}<button type="button" disabled={!sensitiveGate.allowed} onClick={() => void runRecordedAction({ eventType: "STEWARDSHIP_CONFIRMED", placement: "stewardship", sensitive: true, doneMessage: "Confirmación de lectura registrada." })} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-300 px-4 text-sm font-black text-emerald-950 disabled:cursor-not-allowed disabled:opacity-45">Confirmar que leí las indicaciones</button></div> : null}
      </section>

      <section id="support" className="scroll-mt-24 rounded-3xl border border-white/10 bg-slate-950/80 p-5">
        <div className="flex items-center gap-2"><Headphones aria-hidden="true" className="text-violet-300" size={20} /><h2 className="font-black text-white">Soporte y asesor</h2></div>
        <p className="mt-2 text-sm text-slate-400">{profile.support.label || "Canal de soporte configurado por la marca."}</p>
        {supportHref ? <button type="button" disabled={!sensitiveGate.allowed} onClick={() => void runRecordedAction({ eventType: "ADVISOR_CONTACT_REQUESTED", placement: "support", href: supportHref, sensitive: true, doneMessage: "Solicitud de contacto registrada." })} className="mt-4 min-h-11 w-full rounded-2xl border border-violet-300/25 bg-violet-300/10 px-4 text-sm font-black text-violet-100 disabled:cursor-not-allowed disabled:opacity-45">Contactar a un asesor</button> : <p className="mt-4 text-xs text-slate-500">La marca todavía no publicó un canal de soporte.</p>}
      </section>

      {profile.cropwiseUrl ? <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5"><div className="flex items-center gap-2"><Leaf aria-hidden="true" className="text-emerald-300" size={20} /><h2 className="font-black text-white">Herramienta agronómica</h2></div><p className="mt-2 text-sm leading-6 text-slate-400">Acceso externo configurado por la marca. NexID no afirma una integración nativa ni reemplaza la recomendación profesional.</p><button type="button" disabled={!sensitiveGate.allowed} onClick={() => void runRecordedAction({ eventType: "CROPWISE_CTA_CLICKED", placement: "cropwise", href: profile.cropwiseUrl, sensitive: true, data: { destinationHost: destinationHost(profile.cropwiseUrl) } })} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 text-sm font-black text-emerald-950 disabled:cursor-not-allowed disabled:opacity-45"><ExternalLink aria-hidden="true" size={16} /> Abrir Cropwise</button></section> : null}

      {(profile.trainingUrl || profile.loyaltyUrl) ? <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5"><div className="flex items-center gap-2"><BookOpenCheck aria-hidden="true" className="text-cyan-300" size={20} /><h2 className="font-black text-white">Capacitación y beneficios</h2></div><div className="mt-4 grid gap-2">{profile.trainingUrl ? <button type="button" onClick={() => void runRecordedAction({ eventType: "TRAINING_STARTED", placement: "training", href: profile.trainingUrl, data: { destinationHost: destinationHost(profile.trainingUrl) } })} className="min-h-11 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 text-sm font-black text-cyan-100">Comenzar capacitación</button> : null}{profile.loyaltyUrl ? <button type="button" disabled={!sensitiveGate.allowed} onClick={() => void runRecordedAction({ eventType: "LOYALTY_OFFER_VIEWED", placement: "loyalty_offer", href: profile.loyaltyUrl, sensitive: true, doneMessage: "Acceso al beneficio registrado.", data: { destinationHost: destinationHost(profile.loyaltyUrl) } })} className="min-h-11 rounded-2xl border border-violet-300/25 bg-violet-300/10 px-4 text-sm font-black text-violet-100 disabled:cursor-not-allowed disabled:opacity-45">Ver beneficio disponible</button> : null}</div><p className="mt-3 text-xs leading-5 text-slate-500">Abrir el beneficio registra intención, no adhesión. LOYALTY_JOINED, LEAD_CREATED y TRAINING_COMPLETED se registran únicamente cuando el sistema responsable confirma el resultado.</p></section> : null}

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5">
        <div className="flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="text-cyan-300" size={20} /><h2 className="font-black text-white">Procedencia y eventos</h2></div>
        {props.timeline.length ? <ol className="mt-4 space-y-3">{props.timeline.slice(0, 6).map((item, index) => <li key={`${item.at || "event"}-${index}`} className="border-l border-cyan-300/30 pl-4"><strong className="block text-sm text-slate-100">{visible(item.result, "Evento registrado")}</strong><span className="text-xs text-slate-500">{item.at ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.at)) : "Fecha no disponible"}{item.city || item.country ? ` · ${[item.city, item.country].filter(Boolean).join(", ")}` : ""}</span></li>)}</ol> : <p className="mt-3 text-sm text-slate-500">No hay eventos públicos adicionales para mostrar.</p>}
        <button type="button" onClick={() => void runRecordedAction({ eventType: "PROBLEM_REPORTED", placement: "problem_report", doneMessage: "Se registró el pedido de revisión." })} className="mt-4 min-h-11 w-full rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] px-4 text-sm font-black text-rose-100">Reportar un problema</button>
      </section>

      <details className="group rounded-3xl border border-white/10 bg-slate-950/70 p-5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-black text-slate-200">Datos técnicos del pasaporte <ChevronDown aria-hidden="true" size={17} className="transition group-open:rotate-180" /></summary>
        <dl className="mt-3 grid gap-2 text-xs">
          <Spec label="Esquema" value={profile.schemaVersion} />
          <Spec label="GTIN" value={profile.gtin} />
          <Spec label="SKU" value={profile.sku} />
          <Spec label="Estado" value={trust.code} />
          <Spec label="Autenticación" value={trust.authenticationLevel} />
        </dl>
      </details>

      {!sensitiveGate.allowed ? <aside className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-xs leading-5 text-amber-50/85"><strong className="block">Acciones sensibles bloqueadas</strong><span>{sensitiveGate.reason === "VERIFICATION_PENDING" ? trust.summary : `Motivo: ${sensitiveGate.reason}. Realizá un nuevo tap NFC válido para habilitarlas.`}</span></aside> : null}
      <p aria-live="polite" className={`min-h-5 text-center text-xs ${action.kind === "error" ? "text-rose-300" : action.kind === "done" ? "text-emerald-300" : "text-slate-500"}`}>{action.message || ""}</p>
    </section>
  );
}
