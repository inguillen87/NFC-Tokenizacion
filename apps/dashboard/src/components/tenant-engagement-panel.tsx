"use client";

import {
  Activity,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  Database,
  Fingerprint,
  Gift,
  Headphones,
  Layers3,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TENANT_ENGAGEMENT_DOMAINS,
  TENANT_ENGAGEMENT_SOURCES,
  TENANT_ENGAGEMENT_STAGES,
  parseTenantEngagementPayload,
  readableEngagementEvent,
  type TenantEngagementActivity,
  type TenantEngagementDomain,
  type TenantEngagementRange,
  type TenantEngagementSource,
  type TenantEngagementView,
} from "../lib/tenant-engagement-view";
import { dashboardRealtimeConsumerFellBehind, unreadDashboardRealtimeFrames } from "../lib/dashboard-realtime-buffer";
import { useDashboardRealtime } from "./dashboard-realtime-provider";
import styles from "./tenant-engagement-panel.module.css";

type FilterDomain = TenantEngagementDomain | "all";
type FilterSource = TenantEngagementSource | "all";
type LoadPhase = "idle" | "loading" | "refreshing" | "ready" | "error";
type StreamPhase = "disabled" | "connecting" | "live" | "reconnecting";

const ENGAGEMENT_EVENT_REFRESH_DEBOUNCE_MS = 2_000;

const RANGE_OPTIONS: Array<{ value: TenantEngagementRange; label: string }> = [
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
];

const DOMAIN_META: Record<TenantEngagementDomain, {
  label: string;
  short: string;
  description: string;
  Icon: typeof BookOpen;
}> = {
  passport: { label: "Pasaporte", short: "Ficha abierta", description: "Accesos a la identidad e historia del producto.", Icon: Fingerprint },
  content: { label: "Contenido", short: "Información", description: "Fichas, seguridad, recomendaciones y capacitación.", Icon: BookOpen },
  warranty: { label: "Garantía", short: "Postventa", description: "Solicitudes y registros durables de garantía.", Icon: ShieldCheck },
  support: { label: "Soporte", short: "Atención", description: "Contactos, reportes y casos creados desde el producto.", Icon: Headphones },
  ownership: { label: "Titularidad", short: "Propiedad", description: "Reclamos de titularidad registrados sobre una unidad.", Icon: PackageCheck },
  loyalty: { label: "Fidelización", short: "Relación", description: "Beneficios consultados y adhesiones confirmadas.", Icon: Gift },
};

const STAGE_META: Record<TenantEngagementActivity["stage"], { label: string; explanation: string }> = {
  VIEWED: { label: "Consultó", explanation: "La fuente registró una vista o apertura." },
  STARTED: { label: "Inició", explanation: "La fuente registró el inicio de una acción, sin afirmar que terminó." },
  CONFIRMED: { label: "Confirmó", explanation: "El sistema de origen persistió el resultado de la acción." },
};

const SOURCE_META: Record<TenantEngagementSource, { label: string; description: string }> = {
  real: { label: "Real", description: "Vinculada a una fuente productiva identificada." },
  demo: { label: "Demo", description: "Simulación separada de la actividad productiva." },
  imported: { label: "Importada", description: "Incorporada desde una fuente externa declarada." },
  unknown: { label: "Sin clasificar", description: "La evidencia disponible no permite afirmar el origen." },
};

const CONSENT_LABELS = { email: "Email", phone: "Teléfono", whatsapp: "WhatsApp" } as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function actorLabel(activity: TenantEngagementActivity) {
  if (activity.contactable) {
    return `Contacto habilitado: ${activity.consentChannels.map((channel) => CONSENT_LABELS[channel]).join(", ")}`;
  }
  if (activity.actorState === "linked_without_contact_consent") return "Actor vinculado, sin permiso de contacto";
  if (activity.actorState === "ambiguous_link") return "Vínculo ambiguo; no se habilita contacto";
  return "Actividad anónima";
}

function isTenantEngagementStreamEvent(value: unknown, tenantSlug: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  const eventTenant = String(event.tenant_slug || event.tenantSlug || "").trim().toLowerCase();
  const eventType = String(event.event_type || event.eventType || "").trim().toLowerCase();
  if (eventTenant !== tenantSlug.trim().toLowerCase() || !eventType) return false;
  return eventType !== "realtime.transport_reset"
    && !eventType.startsWith("incident.")
    && eventType !== "security_alert.created";
}

function isTenantEngagementSnapshot(value: unknown, tenantSlug: string, window: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as { availability?: unknown; scope?: { tenant?: unknown; window?: unknown } };
  const expectedTenant = tenantSlug.trim().toLowerCase();
  const reportedTenant = String(snapshot.scope?.tenant || "").trim().toLowerCase();
  return snapshot.availability === "ready"
    && (expectedTenant ? reportedTenant === expectedTenant : reportedTenant === "global")
    && String(snapshot.scope?.window || "").trim().toLowerCase() === window;
}

function ActivityRow({ activity }: { activity: TenantEngagementActivity }) {
  const domain = DOMAIN_META[activity.domain];
  const stage = STAGE_META[activity.stage];
  const Icon = domain.Icon;
  const context = [
    activity.unit.bid ? `BID ${activity.unit.bid}` : null,
    activity.unit.sourceTapEventId ? `tap ${activity.unit.sourceTapEventId}` : null,
    activity.unit.batchId ? `lote ${activity.unit.batchId}` : null,
  ].filter(Boolean);

  return (
    <li className={styles.activityRow} data-domain={activity.domain}>
      <div className={styles.activityRail} aria-hidden="true">
        <span className={styles.activityIcon}><Icon size={17} strokeWidth={2} /></span>
        <span className={styles.activityLine} />
      </div>
      <div className={styles.activityContent}>
        <div className={styles.activityTopline}>
          <div>
            <span className={styles.domainEyebrow}>{domain.label} · {stage.label}</span>
            <h4>{readableEngagementEvent(activity.sourceEventType)}</h4>
          </div>
          <div className={styles.activityBadges}>
            <span className={styles.sourceBadge} data-source={activity.source}>{SOURCE_META[activity.source].label}</span>
            <time dateTime={activity.occurredAt}>{formatTimestamp(activity.occurredAt)}</time>
          </div>
        </div>

        <div className={styles.activityFacts}>
          <span className={activity.contactable ? styles.contactable : styles.actorBoundary}>
            {activity.contactable ? <UserCheck size={14} /> : <CircleUserRound size={14} />}
            {actorLabel(activity)}
          </span>
          {context.length ? (
            <span><Layers3 size={14} /> Contexto técnico: {context.join(" · ")}</span>
          ) : (
            <span><Layers3 size={14} /> Unidad no informada por la fuente</span>
          )}
        </div>

        <details className={styles.provenance}>
          <summary>Ver evidencia y trazabilidad</summary>
          <dl>
            <div><dt>Fuente</dt><dd>{activity.provenance.sourceKind || "No informada"}</dd></div>
            <div><dt>Registro</dt><dd>{activity.provenance.recordType || "No informado"}</dd></div>
            <div><dt>Evidencia</dt><dd>{activity.provenance.evidence || "No informada"}</dd></div>
            <div><dt>Idempotencia</dt><dd>{activity.provenance.idempotencyStatus === "recorded" ? "Clave registrada" : activity.provenance.idempotencyStatus === "registry_deduplicated" ? "Duplicados bloqueados por registro" : "No informada"}</dd></div>
          </dl>
        </details>
      </div>
    </li>
  );
}

function LoadingState() {
  return (
    <div className={styles.loadingState} role="status" aria-live="polite">
      <span className={styles.loadingOrb}><Activity size={24} /></span>
      <div>
        <strong>Consultando actividad durable…</strong>
        <p>Validamos alcance tenant, fuente y consentimiento antes de mostrar resultados.</p>
      </div>
    </div>
  );
}

export function TenantEngagementPanel({
  tenantSlug,
  tenantName,
  canRead,
  streamEnabled = false,
}: {
  tenantSlug: string | null;
  tenantName?: string;
  canRead: boolean;
  streamEnabled?: boolean;
}) {
  const [range, setRange] = useState<TenantEngagementRange>("24h");
  const [domain, setDomain] = useState<FilterDomain>("all");
  const [source, setSource] = useState<FilterSource>("all");
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [data, setData] = useState<TenantEngagementView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>(streamEnabled ? "connecting" : "disabled");
  const eventRefreshTimerRef = useRef<number | null>(null);
  const consumedEventSequenceRef = useRef(0);
  const realtime = useDashboardRealtime();

  const queueEngagementRefresh = useCallback(() => {
    if (eventRefreshTimerRef.current !== null) return;
    eventRefreshTimerRef.current = window.setTimeout(() => {
      eventRefreshTimerRef.current = null;
      setRefreshTick((current) => current + 1);
    }, ENGAGEMENT_EVENT_REFRESH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!canRead || !tenantSlug) {
      setPhase("idle");
      setData(null);
      return;
    }

    const controller = new AbortController();
    setPhase(data ? "refreshing" : "loading");
    setError(null);
    const query = new URLSearchParams({ range, limit: "120" });
    if (domain !== "all") query.set("domain", domain);
    if (source !== "all") query.set("source", source);
    query.set("tenant", tenantSlug);

    fetch(`/api/admin/engagement?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const reason = payload && typeof payload === "object" && "reason" in payload
            ? String((payload as { reason?: unknown }).reason || "")
            : "";
          throw new Error(reason || `engagement_http_${response.status}`);
        }
        const parsed = parseTenantEngagementPayload(payload, tenantSlug);
        if (!parsed) throw new Error("engagement_contract_invalid");
        return parsed;
      })
      .then((parsed) => {
        if (controller.signal.aborted) return;
        setData(parsed);
        setUpdatedAt(new Date().toISOString());
        setPhase("ready");
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setPhase("error");
        setError(requestError instanceof Error ? requestError.message : "engagement_unavailable");
      });

    return () => controller.abort();
    // `data` intentionally stays outside the dependency list so a successful
    // response does not create a request loop; the current render still lets
    // us distinguish initial loading from a background refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, tenantSlug, range, domain, source, refreshTick]);

  useEffect(() => {
    if (!canRead || !tenantSlug || !streamEnabled) {
      setStreamPhase("disabled");
      return;
    }
    setStreamPhase(realtime.status === "connected"
      ? "live"
      : realtime.status === "reconnecting" ? "reconnecting" : "connecting");
  }, [canRead, realtime.status, streamEnabled, tenantSlug]);

  useEffect(() => {
    if (!canRead || !tenantSlug || !streamEnabled) return;
    const frame = realtime.snapshot;
    if (!frame || frame.scopeKey !== realtime.activeScopeKey) return;
    if (!isTenantEngagementSnapshot(frame.data, realtime.activeScope.tenant, realtime.activeScope.window)) {
      setStreamPhase("reconnecting");
      return;
    }
    setStreamPhase("live");
    // Reconcile the connect-time race once from the durable engagement view.
    queueEngagementRefresh();
  }, [canRead, queueEngagementRefresh, realtime.activeScope.tenant, realtime.activeScope.window, realtime.activeScopeKey, realtime.snapshot, streamEnabled, tenantSlug]);

  useEffect(() => {
    if (!canRead || !tenantSlug || !streamEnabled) return;
    const frames = unreadDashboardRealtimeFrames(
      realtime.events,
      consumedEventSequenceRef.current,
      realtime.activeScopeKey,
    );
    const fellBehind = dashboardRealtimeConsumerFellBehind(
      consumedEventSequenceRef.current,
      realtime.droppedThroughSequence,
    );
    if (!frames.length && !fellBehind) return;
    consumedEventSequenceRef.current = frames[frames.length - 1]?.sequence || realtime.droppedThroughSequence;
    if (!fellBehind && !frames.some((frame) => isTenantEngagementStreamEvent(frame.data, tenantSlug))) return;
    setStreamPhase(realtime.status === "connected" ? "live" : "reconnecting");
    queueEngagementRefresh();
  }, [canRead, queueEngagementRefresh, realtime.activeScopeKey, realtime.droppedThroughSequence, realtime.events, realtime.status, streamEnabled, tenantSlug]);

  useEffect(() => {
    const frame = realtime.warning;
    if (canRead && tenantSlug && streamEnabled && frame?.scopeKey === realtime.activeScopeKey) setStreamPhase("reconnecting");
  }, [canRead, realtime.activeScopeKey, realtime.warning, streamEnabled, tenantSlug]);

  useEffect(() => {
    if (!canRead || !tenantSlug) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") queueEngagementRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (eventRefreshTimerRef.current !== null) window.clearTimeout(eventRefreshTimerRef.current);
      eventRefreshTimerRef.current = null;
    };
  }, [canRead, queueEngagementRefresh, tenantSlug]);

  const stageMaximum = useMemo(() => data
    ? Math.max(1, ...TENANT_ENGAGEMENT_STAGES.map((stage) => data.counts.byStage[stage]))
    : 1, [data]);

  const selectRange = (value: TenantEngagementRange) => {
    setData(null);
    setRange(value);
  };
  const selectDomain = (value: FilterDomain) => {
    setData(null);
    setDomain(value);
  };
  const selectSource = (value: FilterSource) => {
    setData(null);
    setSource(value);
  };

  if (!canRead) {
    return (
      <section className={styles.root} aria-labelledby="engagement-title">
        <div className={styles.permissionState} role="status">
          <ShieldCheck size={24} />
          <div><strong>Actividad post-tap protegida</strong><p>Este perfil no tiene el permiso CRM necesario para consultar la actividad del tenant.</p></div>
        </div>
      </section>
    );
  }

  if (!tenantSlug) {
    return (
      <section className={styles.root} aria-labelledby="engagement-title">
        <div className={styles.permissionState} role="status">
          <Database size={24} />
          <div><strong>Seleccioná un tenant</strong><p>La actividad no se combina entre empresas. Elegí un tenant para abrir su recorrido post-tap.</p></div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.root} aria-labelledby="engagement-title" aria-busy={phase === "loading" || phase === "refreshing"}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}><Sparkles size={15} /> Inteligencia post-tap · {tenantName || tenantSlug}</span>
          <h2 id="engagement-title">Del pasaporte a la relación: qué ocurrió y qué podés activar</h2>
          <p>Cada registro es una <strong>interacción posterior al tap</strong> respaldada por una fuente. La lectura NFC sigue siendo actividad de una unidad, no una persona; un contacto aparece únicamente cuando existe identidad vinculada y consentimiento vigente.</p>
        </div>
        <div className={styles.syncStatus}>
          <span data-state={phase}><span />{phase === "refreshing" ? "Sincronizando actividad" : phase === "error" ? "Fuente no disponible" : streamPhase === "live" ? "Canal en vivo" : streamPhase === "connecting" ? "Conectando stream" : streamPhase === "reconnecting" ? "Reconectando stream" : "Actualización manual"}</span>
          <button type="button" onClick={() => setRefreshTick((current) => current + 1)} disabled={phase === "loading" || phase === "refreshing"}>
            <RefreshCw size={15} /> Actualizar
          </button>
          {updatedAt ? <small>Última consulta {formatTimestamp(updatedAt)}</small> : null}
        </div>
      </header>

      <div className={styles.filters} aria-label="Filtros de actividad post-tap">
        <fieldset>
          <legend>Período</legend>
          <div className={styles.segmented}>
            {RANGE_OPTIONS.map((option) => (
              <button key={option.value} type="button" aria-pressed={range === option.value} onClick={() => selectRange(option.value)}>{option.label}</button>
            ))}
          </div>
        </fieldset>
        <label>
          Dominio
          <select value={domain} onChange={(event) => selectDomain(event.target.value as FilterDomain)}>
            <option value="all">Todo el recorrido</option>
            {TENANT_ENGAGEMENT_DOMAINS.map((item) => <option key={item} value={item}>{DOMAIN_META[item].label}</option>)}
          </select>
        </label>
        <label>
          Evidencia de origen
          <select value={source} onChange={(event) => selectSource(event.target.value as FilterSource)}>
            <option value="all">Todas, separadas</option>
            {TENANT_ENGAGEMENT_SOURCES.map((item) => <option key={item} value={item}>{SOURCE_META[item].label}</option>)}
          </select>
        </label>
      </div>

      {phase === "loading" && !data ? <LoadingState /> : null}

      {phase === "error" ? (
        <div className={styles.errorState} role="alert">
          <Database size={24} />
          <div>
            <strong>No pudimos confirmar esta fuente</strong>
            <p>No se muestran ceros ni estimaciones. Conservamos el último snapshot visible sólo si ya había sido validado.</p>
            <code>{error || "tenant_engagement_unavailable"}</code>
          </div>
          <button type="button" onClick={() => setRefreshTick((current) => current + 1)}>Reintentar</button>
        </div>
      ) : null}

      {data ? (
        <div className={styles.content}>
          {phase === "refreshing" ? <div className={styles.refreshLine} aria-hidden="true" /> : null}
          <div className={styles.kpiGrid}>
            <article>
              <span><Activity size={17} /> Actividades coincidentes</span>
              <strong>{formatNumber(data.matched)}</strong>
              <p>{data.truncated ? `${formatNumber(data.returned)} filas analizadas en esta vista` : "Registros confirmados por la consulta"}</p>
            </article>
            <article>
              <span><UserCheck size={17} /> Contacto permitido</span>
              <strong>{formatNumber(data.counts.contactable)}</strong>
              <p>Entre las filas devueltas, con consentimiento vigente</p>
            </article>
            <article>
              <span><BadgeCheck size={17} /> Resultados confirmados</span>
              <strong>{formatNumber(data.counts.byStage.CONFIRMED)}</strong>
              <p>Persistidos por su sistema de origen; no implica autenticidad física</p>
            </article>
            <article>
              <span><Database size={17} /> Origen productivo</span>
              <strong>{formatNumber(data.counts.bySource.real)}</strong>
              <p>Filas reales separadas de demo, importadas y sin clasificar</p>
            </article>
          </div>

          <div className={styles.domainGrid}>
            <button type="button" className={styles.allDomains} aria-pressed={domain === "all"} onClick={() => selectDomain("all")}>
              <Layers3 size={19} /><span><strong>Todo el recorrido</strong><small>Ver los seis dominios</small></span>
            </button>
            {TENANT_ENGAGEMENT_DOMAINS.map((item) => {
              const meta = DOMAIN_META[item];
              const Icon = meta.Icon;
              return (
                <button key={item} type="button" data-domain={item} aria-pressed={domain === item} onClick={() => selectDomain(item)}>
                  <span className={styles.domainIcon}><Icon size={18} /></span>
                  <span><strong>{meta.label}</strong><small>{meta.short}</small></span>
                  <b>{formatNumber(data.counts.byDomain[item])}</b>
                </button>
              );
            })}
          </div>

          <div className={styles.insightGrid}>
            <article className={styles.stagePanel}>
              <div className={styles.panelHeading}>
                <div><span>Recorrido observado</span><h3>Distribución por etapa</h3></div>
                <Clock3 size={21} />
              </div>
              <div className={styles.stageList}>
                {TENANT_ENGAGEMENT_STAGES.map((stage) => {
                  const count = data.counts.byStage[stage];
                  return (
                    <div key={stage}>
                      <div><strong>{STAGE_META[stage].label}</strong><span>{formatNumber(count)}</span></div>
                      <span className={styles.stageTrack}><i style={{ width: `${(count / stageMaximum) * 100}%` }} /></span>
                      <small>{STAGE_META[stage].explanation}</small>
                    </div>
                  );
                })}
              </div>
              <p className={styles.truthNote}>Esta distribución cuenta actividades devueltas; no es una tasa de conversión ni afirma que los tres pasos pertenezcan a la misma persona.</p>
            </article>

            <article className={styles.sourcePanel}>
              <div className={styles.panelHeading}>
                <div><span>Calidad de evidencia</span><h3>Fuentes sin mezclar</h3></div>
                <Database size={21} />
              </div>
              <div className={styles.sourceList}>
                {TENANT_ENGAGEMENT_SOURCES.map((item) => (
                  <button key={item} type="button" data-source={item} aria-pressed={source === item} onClick={() => selectSource(source === item ? "all" : item)}>
                    <span><i /> <strong>{SOURCE_META[item].label}</strong></span>
                    <b>{formatNumber(data.counts.bySource[item])}</b>
                    <small>{SOURCE_META[item].description}</small>
                  </button>
                ))}
              </div>
            </article>
          </div>

          <article className={styles.timelinePanel}>
            <div className={styles.panelHeading}>
              <div>
                <span>Actividad reciente</span>
                <h3>Qué ocurrió después del tap</h3>
                <p>Actividad vinculada a la unidad y evidencia operativa, sin transformar una etiqueta o un dispositivo en identidad.</p>
              </div>
              <Activity size={22} />
            </div>

            {data.activities.length ? (
              <ol className={styles.activityList}>
                {data.activities.slice(0, 12).map((activity) => <ActivityRow key={activity.id} activity={activity} />)}
              </ol>
            ) : (
              <div className={styles.emptyState} role="status">
                <CheckCircle2 size={24} />
                <div><strong>La consulta está disponible y no devolvió acciones post-tap</strong><p>Esto no significa que no haya lecturas NFC. Probá otro período, dominio o fuente; los taps se consultan por separado en Operación NFC.</p></div>
              </div>
            )}
            {data.activities.length > 12 ? <p className={styles.resultLimit}>Mostrando las 12 actividades más recientes de {formatNumber(data.returned)} filas devueltas.</p> : null}
          </article>

          <footer className={styles.boundaries}>
            <Fingerprint size={18} />
            <div>
              <strong>Lecturas de unidad ≠ acciones post-tap ≠ personas</strong>
              <p>{data.boundaries.actor || "Un UID, tag o tap no se trata como persona. El contacto requiere un vínculo de identidad y consentimiento explícito vigente."} Cero acciones en esta vista no significa cero taps.</p>
            </div>
          </footer>
        </div>
      ) : null}
    </section>
  );
}
