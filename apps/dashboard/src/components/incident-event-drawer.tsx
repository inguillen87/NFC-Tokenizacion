"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, LoaderCircle, ShieldAlert, ShieldCheck, TicketCheck } from "lucide-react";
import { classifyRealtimeVerdict, type TenantTapRealtimeEvent } from "../lib/realtime-feed";
import { incidentEventNavigationKey } from "../lib/incident-event-navigation";
import { formatOperationalDateTime, formatReadingDateTime, type OperationalTimeZone } from "../lib/operational-reading-time";
import { IncidentEventDrawerFrame, type IncidentEventDrawerNavigation } from "./incident-event-drawer-frame";
import {
  allowedIncidentTransitions,
  deterministicIncidentExplanation,
  incidentStatusLabel,
  type DashboardIncident,
  type DashboardIncidentHistory,
  type DashboardIncidentSeverity,
  type DashboardIncidentStatus,
} from "../lib/incident-workflow";

const SEVERITY_LABEL: Record<DashboardIncidentSeverity, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

const HISTORY_ACTION_LABEL: Record<DashboardIncidentHistory["action"], string> = {
  opened: "Expediente abierto",
  transitioned: "Estado actualizado",
  severity_changed: "Severidad actualizada",
};

async function responseJson(response: Response) {
  return response.json().catch(() => ({ ok: false, reason: `http_${response.status}` })) as Promise<Record<string, any>>;
}

export function IncidentEventDrawer({
  event,
  incident,
  incidentAvailability,
  canRead,
  canWrite,
  onClose,
  onIncident,
  navigation,
  operationalTimeZone,
}: {
  event: TenantTapRealtimeEvent;
  incident: DashboardIncident | null;
  incidentAvailability: "loading" | "ready" | "unavailable";
  canRead: boolean;
  canWrite: boolean;
  onClose: () => void;
  onIncident: (incident: DashboardIncident) => void;
  navigation?: IncidentEventDrawerNavigation;
  operationalTimeZone?: OperationalTimeZone;
}) {
  const explanation = useMemo(() => deterministicIncidentExplanation(event), [event]);
  const isDemo = event.source === "demo" || event.eventSource === "demo";
  const hasNormalEvidence = classifyRealtimeVerdict(event.verdict, event.reason) === "valid" && explanation.severity === "low";
  const canEditIncident = canWrite && event.source === "production" && !isDemo;
  const [severity, setSeverity] = useState<DashboardIncidentSeverity>(incident?.severity || explanation.severity);
  const [title, setTitle] = useState(incident?.title || explanation.title);
  const [summary, setSummary] = useState(incident?.summary || explanation.summary);
  const [reason, setReason] = useState(incident ? "" : "Escalado desde la consola operativa después de revisar la evidencia del evento.");
  const [nextStatus, setNextStatus] = useState<DashboardIncidentStatus>(() => incident ? (allowedIncidentTransitions(incident.status)[0] || "investigating") : "investigating");
  const [history, setHistory] = useState<DashboardIncidentHistory[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [eventLookupState, setEventLookupState] = useState<"loading" | "ready" | "unavailable">(incident ? "ready" : "loading");
  const [lookupRevision, setLookupRevision] = useState(0);
  const tenantSlug = String(event.tenantSlug || incident?.tenantSlug || "").trim().toLowerCase();

  useEffect(() => {
    setSeverity(incident?.severity || explanation.severity);
    setTitle(incident?.title || explanation.title);
    setSummary(incident?.summary || explanation.summary);
    setNextStatus(incident ? (allowedIncidentTransitions(incident.status)[0] || "investigating") : "investigating");
  }, [explanation, incident]);

  useEffect(() => {
    setError("");
    if (!canRead) {
      setEventLookupState("unavailable");
      return;
    }
    if (incident) {
      setEventLookupState("ready");
      return;
    }
    if (!tenantSlug || !event.eventId) {
      setEventLookupState("unavailable");
      return;
    }

    const controller = new AbortController();
    const url = new URL("/api/admin/incidents", window.location.origin);
    url.searchParams.set("tenant", tenantSlug);
    url.searchParams.set("eventId", String(event.eventId));
    url.searchParams.set("limit", "2");
    setEventLookupState("loading");
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, payload: await responseJson(response) }))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.ok || !Array.isArray(payload.incidents)) {
          setEventLookupState("unavailable");
          return;
        }
        const matches = (payload.incidents as DashboardIncident[]).filter((candidate) => (
          String(candidate.eventId) === String(event.eventId)
          && String(candidate.tenantSlug || "").toLowerCase() === tenantSlug
        ));
        if (matches.length !== payload.incidents.length || matches.length > 1) {
          setEventLookupState("unavailable");
          return;
        }
        if (matches[0]) onIncident(matches[0]);
        setEventLookupState("ready");
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setEventLookupState("unavailable");
      });
    return () => controller.abort();
  }, [canRead, event.eventId, incident, lookupRevision, onIncident, tenantSlug]);

  useEffect(() => {
    if (!incident || !canRead) {
      setHistory([]);
      return;
    }
    const controller = new AbortController();
    const url = new URL(`/api/admin/incidents/${encodeURIComponent(incident.id)}`, window.location.origin);
    if (tenantSlug) url.searchParams.set("tenant", tenantSlug);
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, payload: await responseJson(response) }))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.ok) return;
        if (payload.incident) onIncident(payload.incident as DashboardIncident);
        setHistory(Array.isArray(payload.history) ? payload.history as DashboardIncidentHistory[] : []);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [canRead, incident?.id, incident?.version, lookupRevision, onIncident, tenantSlug]);

  async function openIncident() {
    if (!canEditIncident || !tenantSlug || !event.eventId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/incidents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          eventId: event.eventId,
          severity,
          title,
          summary,
          reason,
        }),
      });
      const payload = await responseJson(response);
      if (!response.ok || !payload.ok || !payload.incident) {
        const failure = String(payload.reason || `http_${response.status}`);
        if (failure === "incident_event_already_open_conflict") setLookupRevision((current) => current + 1);
        throw new Error(failure);
      }
      onIncident(payload.incident as DashboardIncident);
      setEventLookupState("ready");
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "incident_open_failed");
    } finally {
      setBusy(false);
    }
  }

  async function transitionIncident() {
    if (!canEditIncident || !incident || !tenantSlug) return;
    setBusy(true);
    setError("");
    try {
      const idempotencyKey = typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `incident-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const response = await fetch(`/api/admin/incidents/${encodeURIComponent(incident.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({
          tenantSlug,
          expectedVersion: incident.version,
          status: nextStatus,
          severity,
          reason,
        }),
      });
      const payload = await responseJson(response);
      if (!response.ok || !payload.ok || !payload.incident) {
        const failure = String(payload.reason || `http_${response.status}`);
        if (response.status === 409 && failure === "stale_version") {
          setLookupRevision((current) => current + 1);
          throw new Error("Otro operador actualizó este incidente. Recargamos el expediente para que decidas sobre la versión vigente.");
        }
        throw new Error(failure);
      }
      onIncident(payload.incident as DashboardIncident);
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "incident_transition_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <IncidentEventDrawerFrame
      eventKey={incidentEventNavigationKey(event)}
      title={event.productName?.trim() || "Lectura NFC"}
      description={formatReadingDateTime(event, operationalTimeZone)}
      navigation={navigation}
      navigationDisabled={busy}
      onClose={onClose}
    >

        <p className="text-xs leading-5 text-slate-400">{isDemo
          ? "Muestra de la consola: datos ilustrativos, sin una lectura física real."
          : "Resumen basado en los datos registrados de esta lectura, sin inferencias generativas."}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Empresa · identificador</p>
            <p className="mt-1 text-sm font-bold text-white">{tenantSlug || "No informado"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Lote</p>
            <p className="mt-1 text-sm font-bold text-white">{event.batchId || "No informado"}</p>
          </div>
        </div>

        <section data-evidence-tone={hasNormalEvidence ? "normal" : "attention"} className={`mt-4 rounded-xl border p-4 ${hasNormalEvidence ? "border-emerald-300/20 bg-emerald-500/[0.07]" : "border-amber-300/20 bg-amber-400/[0.07]"}`}>
          <div className={`flex items-center gap-2 ${hasNormalEvidence ? "text-emerald-100" : "text-amber-100"}`}>
            {hasNormalEvidence ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4" aria-hidden="true" />}
            <b>{hasNormalEvidence ? "Resumen de la lectura" : "Por qué requiere atención"}</b>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-200">{explanation.decision}</p>
        </section>

        {!canRead ? (
          <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100">
            Tu rol no tiene `incidents:read`. El evento sigue visible, pero no se expone información del expediente.
          </div>
        ) : incident ? (
          <section className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/7 p-4" data-testid="incident-existing-state">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-300">{isDemo ? "Expediente ilustrativo · sólo lectura" : "Incidente durable vinculado"}</p>
              </div>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">{incidentStatusLabel(incident.status)}</span>
            </div>
            <div className="mt-3 text-xs text-slate-300">
              <p>Severidad: <b className="text-white">{SEVERITY_LABEL[incident.severity]}</b></p>
            </div>
            <a href={`/leads-tickets?tenant=${encodeURIComponent(tenantSlug)}`} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-cyan-300 hover:text-cyan-200"><TicketCheck className="h-4 w-4" /> Ver cola de tickets <ExternalLink className="h-3 w-3" /></a>
          </section>
        ) : eventLookupState === "ready" ? (
          <section className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/7 p-4" data-testid="incident-empty-state">
            <p className="text-sm font-bold text-cyan-100">Todavía no existe un incidente para este evento.</p>
            <p className="mt-1 text-xs text-slate-400">{isDemo ? "Este evento de muestra no tiene un expediente ilustrativo vinculado. La demo es de sólo lectura." : "Al abrirlo se crea, en una sola transacción, el expediente, el ticket vinculado y su primer asiento histórico."}</p>
          </section>
        ) : eventLookupState === "loading" ? (
          <section className="mt-4 rounded-xl border border-cyan-300/20 bg-slate-950/55 p-4" data-testid="incident-loading-state" role="status" aria-live="polite" aria-busy="true">
            <p className="flex items-center gap-2 text-sm font-bold text-cyan-100"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Consultando el expediente</p>
            <p className="mt-1 text-xs text-slate-400">Estamos comprobando si hay un expediente vinculado a esta lectura.</p>
          </section>
        ) : (
          <section className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/7 p-4" data-testid="incident-unconfirmed-state">
            <p className="text-sm font-bold text-amber-100">El estado del expediente todavía no está confirmado.</p>
            <p className="mt-1 text-xs text-slate-400">La consulta puntual por evento no respondió. No se interpreta la ausencia de datos como “sin incidente”{incidentAvailability === "unavailable" ? "; la sincronización general también está degradada" : ""}.</p>
            {eventLookupState === "unavailable" ? (
              <button type="button" onClick={() => setLookupRevision((current) => current + 1)} className="mt-3 rounded-lg border border-amber-200/30 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-300/10">Reintentar consulta segura</button>
            ) : null}
          </section>
        )}

        {canEditIncident ? (
          <details className="mt-4 rounded-xl border border-white/10 bg-slate-950/55" data-testid="incident-edit-disclosure">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-cyan-200">{incident ? "Actualizar expediente" : "Abrir un expediente"}</summary>
          <section className="mt-4 space-y-3 rounded-xl border border-white/10 bg-slate-950/55 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {incident ? (
                <label className="text-xs text-slate-300">Próximo estado
                  <select value={nextStatus} onChange={(entry) => setNextStatus(entry.target.value as DashboardIncidentStatus)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white">
                    {allowedIncidentTransitions(incident.status).map((status) => <option key={status} value={status}>{incidentStatusLabel(status)}</option>)}
                  </select>
                </label>
              ) : (
                <label className="text-xs text-slate-300">Título
                  <input value={title} maxLength={160} onChange={(entry) => setTitle(entry.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                </label>
              )}
              <label className="text-xs text-slate-300">Severidad
                <select value={severity} onChange={(entry) => setSeverity(entry.target.value as DashboardIncidentSeverity)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white">
                  {Object.entries(SEVERITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            {!incident ? <label className="block text-xs text-slate-300">Resumen
              <textarea value={summary} maxLength={4000} rows={3} onChange={(entry) => setSummary(entry.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
            </label> : null}
            <label className="block text-xs text-slate-300">Razón auditable de la decisión
              <textarea value={reason} maxLength={2000} rows={3} onChange={(entry) => setReason(entry.target.value)} placeholder="Explicá por qué abrís o cambiás el estado." className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
            </label>
            {error ? <p className="rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100" role="alert">No se pudo aplicar: {error}</p> : null}
            <button
              type="button"
              disabled={busy || reason.trim().length < 3 || !tenantSlug || (!incident && (eventLookupState !== "ready" || title.trim().length < 3 || summary.trim().length < 3))}
              onClick={() => void (incident ? transitionIncident() : openIncident())}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : incident ? <TicketCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
              {incident ? "Registrar transición" : "Abrir incidente y ticket"}
            </button>
          </section>
          </details>
        ) : canRead ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-400">{isDemo ? "Expediente ilustrativo · sólo lectura. Esta muestra no permite abrir ni modificar casos reales." : event.source !== "production" ? "La fuente de esta lectura no permite habilitar cambios del expediente." : "Modo lectura: se requiere `incidents:write` para abrir o cambiar el expediente."}</p>
        ) : null}

        {history.length ? (
          <section className="mt-4 rounded-xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">{isDemo ? "Historial de ejemplo" : "Historial inmutable"}</p>
            <div className="mt-3 space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className="border-l-2 border-cyan-300/30 pl-3 text-xs text-slate-300">
                  <p><b className="text-white">{entry.actorLabel}</b> · {HISTORY_ACTION_LABEL[entry.action] || entry.action} · {incidentStatusLabel(entry.toStatus)}</p>
                  <p className="mt-0.5 text-slate-400">{entry.reason}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{formatOperationalDateTime(entry.createdAt, operationalTimeZone)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <details className="mt-4 rounded-xl border border-white/10 bg-slate-950/55" data-testid="incident-technical-disclosure">
          <summary className="min-h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500">Datos técnicos de la lectura</summary>
          <div className="space-y-2 px-4 pb-4 text-xs text-slate-400">
            <p>UID enmascarada: <span className="font-mono">{event.uidMasked || "no disponible"}</span></p>
            <p>Identificador del evento: <span className="font-mono">{event.eventId}</span></p>
            {event.timezone ? <p>Zona horaria informada: <span className="font-mono">{event.timezone}</span></p> : null}
            <ul className="space-y-1">
              {explanation.facts.map((fact) => <li key={fact}>• {fact}</li>)}
            </ul>
            {canRead && incident ? <div className="space-y-2 border-t border-white/10 pt-2">
              <p>Identificador del expediente: <span className="font-mono">{incident.id}</span></p>
              <p>Identificador del ticket: <span className="font-mono">{incident.ticketId}</span></p>
              <p>Versión del expediente: {incident.version}</p>
            </div> : null}
          </div>
        </details>
    </IncidentEventDrawerFrame>
  );
}
