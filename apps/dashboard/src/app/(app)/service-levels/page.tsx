import Link from "next/link";
import { Activity, AlertTriangle, BookOpenCheck, CircleGauge, Database, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@product/ui";
import { createAdminPageContext, fetchAdminPage } from "../../../lib/admin-page-access";
import { requireDashboardSession } from "../../../lib/session";

type State = "healthy" | "breach" | "insufficient_data" | "no_data" | "ticket" | "page" | "unavailable";

type Indicator = {
  id: string;
  name: string;
  objective: string;
  target: number;
  minimumSample: number;
  eligibleEvents: number | null;
  goodEvents: number | null;
  badEvents: number | null;
  ratio: number | null;
  errorBudgetRemaining: number | null;
  burnRate: number | null;
  evaluationWindow: "1h" | "24h" | "7d" | "30d";
  alertThresholds: { page: number | null; ticket: number | null };
  state: State;
  runbookId: string;
};

type Signal = {
  id: string;
  name: string;
  value: number;
  unit: "count" | "seconds";
  warningThreshold: number;
  criticalThreshold: number;
  state: "healthy" | "ticket" | "page";
  runbookId: string;
};

type Service = {
  id: string;
  name: string;
  availability: "ready" | "unavailable";
  reason: string | null;
  indicators: Indicator[];
  signals: Signal[];
};

type Alert = {
  id: string;
  serviceId: string;
  severity: "ticket" | "page";
  sourceId: string;
  summary: string;
  runbookId: string;
};

type Snapshot = {
  ok: true;
  schemaVersion: "nexid.service-levels.v1";
  observedAt: string;
  scope: { kind: "tenant" | "global" };
  window: { id: "1h" | "24h" | "7d" | "30d"; startsAt: string; endsAt: string };
  provenance: {
    source: "persisted_database_aggregates";
    synthetic: false;
    fixtures: false;
    demoExcluded: true;
    tenantIdentifiersExposed: false;
    limitation: string;
  };
  alertPolicy: {
    automated: false;
    snapshotAlertsAreCandidates: true;
    pageBurnRate: number | null;
    ticketBurnRate: number | null;
    evaluation: string;
    contracts: Array<{ severity: "page" | "ticket"; fastWindow: string; fastBurnRate: number; slowWindow: string; slowBurnRate: number }>;
  };
  services: Service[];
  alerts: Alert[];
};

const RUNBOOKS: Record<string, { title: string; firstResponse: string; escalation: string }> = {
  "sun-adjudication": {
    title: "SUN adjudication",
    firstResponse: "Confirmar watermark, errores estructurados de /sun y si el evento se persistió; separar rechazo criptográfico válido de falla de plataforma.",
    escalation: "No alterar KFile/KMeta ni desactivar anti-replay. Escalar a seguridad NFC si falta evidencia atómica o sube el gap de persistencia.",
  },
  "canonical-event-outbox": {
    title: "Canonical event + outbox",
    firstResponse: "Bloquear reintentos manuales no idempotentes, comprobar operation_key y la identidad particionada del evento, luego revisar deliveries evt_canonical_*.",
    escalation: "Escalar a plataforma si existe un huérfano o mismatch; preservar filas y logs para reconstrucción, sin editar historial append-only.",
  },
  "webhook-delivery": {
    title: "Webhook delivery",
    firstResponse: "Revisar backlog, oldest age, endpoint lifecycle y códigos sanitizados. Reintentar solo deliveries cuya transición durable permite retry.",
    escalation: "Rotar el signing secret únicamente mediante dual-secret overlap; nunca copiar secretos o payload privado al ticket.",
  },
  "incident-response": {
    title: "Incident response",
    firstResponse: "Asignar owner, pasar a investigating y documentar evidencia. Para critical, contener antes de resolver y mantener el ticket enlazado.",
    escalation: "Escalar al responsable del tenant con referencias opacas; no incluir UID completo, llaves, URLs firmadas ni datos personales.",
  },
  "polygon-queue": {
    title: "Polygon queue",
    firstResponse: "Verificar modo real, executor, nonce, gas y receipt. No asumir éxito por tx_hash: exigir receipt y evidencia on-chain validada.",
    escalation: "No reemitir mint ambiguo. Preservar idempotency key y escalar el estado incierto para reconciliación antes de otro envío.",
  },
  "iota-queue": {
    title: "IOTA queue",
    firstResponse: "Revisar pending/submitted/reconciling, lease y receipt. Confirmar proof_id, chain y publisher sin revelar memo privado.",
    escalation: "No volver a publicar una transacción ambigua. Reconciliar por proof_id/tx antes de habilitar un retry.",
  },
};

function validSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<Snapshot>;
  return payload.ok === true
    && payload.schemaVersion === "nexid.service-levels.v1"
    && Array.isArray(payload.services)
    && Array.isArray(payload.alerts)
    && payload.provenance?.source === "persisted_database_aggregates"
    && payload.provenance.synthetic === false
    && payload.provenance.fixtures === false
    && payload.provenance.demoExcluded === true
    && payload.alertPolicy?.automated === false
    && payload.alertPolicy.snapshotAlertsAreCandidates === true;
}

function stateLabel(state: State | "ticket" | "page") {
  if (state === "healthy") return "Dentro del objetivo";
  if (state === "page") return "Page / respuesta inmediata";
  if (state === "ticket") return "Ticket / investigar";
  if (state === "breach") return "Objetivo excedido / correlacionar";
  if (state === "insufficient_data") return "Muestra insuficiente";
  if (state === "no_data") return "Sin eventos elegibles";
  return "Fuente no disponible";
}

function stateClass(state: State | "ticket" | "page") {
  if (state === "healthy") return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  if (state === "page") return "border-rose-300/30 bg-rose-500/10 text-rose-100";
  if (state === "ticket") return "border-amber-300/30 bg-amber-500/10 text-amber-100";
  if (state === "breach") return "border-orange-300/25 bg-orange-500/10 text-orange-100";
  return "border-slate-300/15 bg-slate-500/10 text-slate-300";
}

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(value >= 0.999 ? 3 : 2)}%`;
}

function signalValue(signal: Signal) {
  if (signal.unit === "count") return signal.value.toLocaleString("es-AR");
  if (signal.value < 60) return `${Math.round(signal.value)} s`;
  if (signal.value < 3600) return `${Math.round(signal.value / 60)} min`;
  return `${(signal.value / 3600).toFixed(1)} h`;
}

async function loadSnapshot(context: Awaited<ReturnType<typeof createAdminPageContext>>, window: string) {
  try {
    const query = new URLSearchParams({ window });
    const response = await fetchAdminPage(context, `observability/service-levels?${query.toString()}`);
    if (!response.ok || response.headers.get("x-nexid-data-mode") === "demo") return null;
    const payload = await response.json().catch(() => null);
    return validSnapshot(payload) ? payload : null;
  } catch {
    return null;
  }
}

export default async function ServiceLevelsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const selectedWindow = ["1h", "24h", "7d", "30d"].includes(String(query.window || "")) ? String(query.window) : "24h";
  const session = await requireDashboardSession();
  const context = await createAdminPageContext(session, query.tenant);
  const snapshot = session.isDemo ? null : await loadSnapshot(context, selectedWindow);

  const unavailable = snapshot?.services.filter((service) => service.availability === "unavailable").length ?? 0;
  const pageAlerts = snapshot?.alerts.filter((alert) => alert.severity === "page").length ?? 0;
  const ticketAlerts = snapshot?.alerts.filter((alert) => alert.severity === "ticket").length ?? 0;

  return (
    <main className="space-y-8" data-testid="service-level-operations">
      <SectionHeading
        eyebrow="Reliability engineering"
        title="SLOs y respuesta operativa"
        description="Indicadores calculados desde registros persistidos del alcance autenticado. No usa fixtures, no mezcla demo y no declara automatización de alertas que aún no está conectada."
      />

      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-5" aria-label="Provenance del snapshot">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 text-cyan-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-white">Fuente: agregados persistidos, solo lectura</p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">
                {snapshot
                  ? `${snapshot.scope.kind === "tenant" ? "Tenant autenticado" : "Vista global autorizada"} · ${snapshot.window.id} · observado ${new Date(snapshot.observedAt).toLocaleString("es-AR", { timeZone: "UTC" })} UTC. ${snapshot.provenance.limitation}`
                  : "La fuente real no está disponible o esta sesión es demo. El tablero no sustituye esa ausencia con ceros ni datos simulados."}
              </p>
            </div>
          </div>
          <form className="flex items-end gap-2" aria-label="Ventana de SLO">
            <label className="grid gap-1 text-xs font-semibold text-slate-300">
              Ventana
              <select name="window" defaultValue={selectedWindow} className="min-h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white">
                <option value="1h">1 hora</option>
                <option value="24h">24 horas</option>
                <option value="7d">7 días</option>
                <option value="30d">30 días</option>
              </select>
            </label>
            <button className="min-h-10 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100" type="submit">Aplicar</button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4" aria-label="Resumen operativo">
        {[
          { label: "Servicios medidos", value: snapshot?.services.length ?? "—", icon: Activity },
          { label: "Page candidates", value: snapshot ? pageAlerts : "—", icon: AlertTriangle },
          { label: "Ticket candidates", value: snapshot ? ticketAlerts : "—", icon: CircleGauge },
          { label: "Fuentes no disponibles", value: snapshot ? unavailable : "—", icon: Database },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-4" key={metric.label}>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400"><Icon className="h-4 w-4" aria-hidden="true" />{metric.label}</div>
              <strong className="mt-3 block text-3xl font-light text-white">{metric.value}</strong>
            </article>
          );
        })}
      </section>

      {!snapshot ? (
        <section className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-6 text-amber-100" role="status">
          <h2 className="font-semibold">Snapshot operativo no disponible</h2>
          <p className="mt-2 text-sm leading-6">Se requiere una sesión real con analytics:read y el esquema de producción actualizado. No se muestran métricas de demostración como si fueran SLOs.</p>
        </section>
      ) : (
        <>
          {snapshot.alerts.length ? (
            <section className="space-y-3" aria-labelledby="active-alerts-title">
              <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden="true" /><h2 id="active-alerts-title" className="text-lg font-semibold text-white">Candidatos de alerta en la ventana seleccionada</h2></div>
              <p className="text-sm text-slate-400">No son páginas enviadas: el contrato automático debe confirmar también la segunda ventana de burn rate.</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {snapshot.alerts.map((alert) => (
                  <article className={`rounded-2xl border p-4 ${stateClass(alert.severity)}`} key={alert.id}>
                    <div className="flex items-center justify-between gap-3"><strong>{stateLabel(alert.severity)}</strong><span className="font-mono text-[11px] uppercase">{alert.serviceId}</span></div>
                    <p className="mt-2 text-sm">{alert.summary}</p>
                    <a className="mt-3 inline-flex text-xs font-semibold underline underline-offset-4" href={`#runbook-${alert.runbookId}`}>Abrir respuesta operativa</a>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-5 xl:grid-cols-2" aria-label="Indicadores por servicio">
            {snapshot.services.map((service) => (
              <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5" key={service.id} data-service={service.id}>
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">{service.id}</p><h2 className="mt-1 text-lg font-semibold text-white">{service.name}</h2></div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${service.availability === "ready" ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : "border-slate-300/15 bg-slate-500/10 text-slate-300"}`}>{service.availability === "ready" ? "Fuente lista" : "No disponible"}</span>
                </div>

                {service.availability === "unavailable" ? (
                  <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">{service.reason || "query_unavailable"}. No se infiere un estado saludable.</p>
                ) : null}

                <div className="mt-5 space-y-4">
                  {service.indicators.map((indicator) => (
                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4" key={indicator.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white">{indicator.name}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stateClass(indicator.state)}`}>{stateLabel(indicator.state)}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{indicator.objective}</p>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                        <div><dt className="text-slate-500">Medido</dt><dd className="mt-1 font-mono text-white">{percent(indicator.ratio)}</dd></div>
                        <div><dt className="text-slate-500">Objetivo</dt><dd className="mt-1 font-mono text-white">{percent(indicator.target)}</dd></div>
                        <div><dt className="text-slate-500">Elegibles</dt><dd className="mt-1 font-mono text-white">{indicator.eligibleEvents ?? "—"}</dd></div>
                        <div><dt className="text-slate-500">Burn rate</dt><dd className="mt-1 font-mono text-white">{indicator.burnRate === null ? "—" : `${indicator.burnRate}x`}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>

                {service.signals.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {service.signals.map((signal) => (
                      <div className={`rounded-xl border p-3 ${stateClass(signal.state)}`} key={signal.id}>
                        <p className="text-xs">{signal.name}</p><strong className="mt-1 block font-mono text-lg">{signalValue(signal)}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        </>
      )}

      <section className="space-y-4" aria-labelledby="runbooks-title">
        <div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" /><h2 id="runbooks-title" className="text-lg font-semibold text-white">Contratos de respuesta</h2></div>
        <p className="text-sm text-slate-400">Estas acciones son runbooks operativos; la evaluación es read-only. Paging automático requiere conectar el endpoint a un scheduler/alert manager y demostrar su entrega.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(RUNBOOKS).map(([id, runbook]) => (
            <article className="scroll-mt-24 rounded-2xl border border-white/10 bg-slate-900/60 p-5" id={`runbook-${id}`} key={id}>
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" aria-hidden="true" /><h3 className="font-semibold text-white">{runbook.title}</h3></div>
              <p className="mt-3 text-sm leading-6 text-slate-300"><b className="text-white">Primera respuesta:</b> {runbook.firstResponse}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300"><b className="text-white">Escalación:</b> {runbook.escalation}</p>
            </article>
          ))}
        </div>
        <Link className="inline-flex rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100" href="/analytics">Volver a Analytics</Link>
      </section>
    </main>
  );
}
