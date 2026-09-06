"use client";

import { useMemo } from "react";
import { Activity, ArrowUpRight, MapPin, Package, ScanLine } from "lucide-react";
import { buildCrmWindowActivity, type CrmWindowActivitySources } from "../lib/crm-window-activity";
import { EXECUTIVE_REALTIME_EVENT_LIMIT } from "../lib/executive-realtime-scope";
import type { RealtimeDataSource, TenantTapRealtimeEvent } from "../lib/realtime-feed";

type Props = {
  events: readonly TenantTapRealtimeEvent[];
  confirmed: boolean;
  source: RealtimeDataSource;
  sourceLabel: string;
  tenantLabel: string;
  timeRangeLabel: string;
  formatEventTime: (event: TenantTapRealtimeEvent) => string;
  onSelectEvent: (event: TenantTapRealtimeEvent, selection: TenantTapRealtimeEvent[]) => void;
  onOpenPhysicalTaps: () => void;
  onOpenAudit?: () => void;
  auditUnavailableReason: string;
};

function sourceSummary(sources: CrmWindowActivitySources) {
  const counts: Array<[string, number]> = [
    ["GPS reportado", sources.gps],
    ["Red/IP", sources.network],
    ["Mixta/sin precisar", sources.mixed],
    ["Otra fuente", sources.other],
    ["Sin ubicación", sources.unlocated],
  ];
  return counts.filter(([, count]) => count > 0).map(([label, count]) => `${label}: ${count}`).join(" · ") || "Sin ubicación informada";
}

export function CrmWindowActivityPanel({
  events,
  confirmed,
  source,
  sourceLabel,
  tenantLabel,
  timeRangeLabel,
  formatEventTime,
  onSelectEvent,
  onOpenPhysicalTaps,
  onOpenAudit,
  auditUnavailableReason,
}: Props) {
  const model = useMemo(() => buildCrmWindowActivity(events, { confirmed }), [events, confirmed]);
  const queueEvents = useMemo(() => model.queue.map((item) => item.event), [model]);
  const isDemo = source === "demo" || source === "seed";
  const multipleTenants = model.events.some((event) => event.tenantSlug !== model.events[0]?.tenantSlug || event.tenantId !== model.events[0]?.tenantId);

  return (
    <section id="window-activity-panel" className="nexid-crm-window-activity" aria-labelledby="window-activity-title" data-state={model.state} data-source={source}>
      <header className="nexid-crm-activity-header">
        <div>
          <h2 id="window-activity-title" tabIndex={-1}><Activity className="h-4 w-4" aria-hidden="true" /> Actividad de esta ventana</h2>
          <p className="nexid-crm-activity-muted">{tenantLabel} · {timeRangeLabel} · Hasta {EXECUTIVE_REALTIME_EVENT_LIMIT} eventos recientes, no histórico</p>
        </div>
        <span className="nexid-crm-activity-source" data-demo={isDemo}>
          {model.state === "pending" ? "Sin confirmar" : isDemo ? "Demo · datos ilustrativos" : sourceLabel}
        </span>
      </header>

      {model.state === "pending" ? (
        <p className="nexid-crm-activity-empty" role="status">Esperando confirmación de fuente, tenant y ventana. No se calculan resultados con datos sin confirmar.</p>
      ) : (
        <>
          <div className="nexid-crm-activity-summary">
            <p><strong>{model.total} eventos</strong><span className="nexid-crm-activity-muted"> · Actividad elegible, no audiencia: {model.eligibleActivity}</span></p>
            <button type="button" className="nexid-crm-activity-primary" title="Abrir la lectura más reciente; el detalle navega eventos del mismo tenant" disabled={model.total === 0} onClick={() => model.events[0] && onSelectEvent(model.events[0], model.events)}>
              Ver lecturas <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {multipleTenants ? <p className="nexid-crm-activity-muted">Vista global: cada detalle navega sólo su tenant. Elegí otro evento en la cola o filtrá el alcance.</p> : null}

          {model.total === 0 ? (
            <p className="nexid-crm-activity-empty">No hay eventos confirmados en el alcance y la ventana seleccionados.</p>
          ) : (
            <div className="nexid-crm-activity-columns">
              <section className="nexid-crm-activity-column" aria-labelledby="activity-zones-title">
                <h3 id="activity-zones-title"><MapPin className="h-4 w-4" aria-hidden="true" /> Zonas con actividad</h3>
                <p className="nexid-crm-activity-muted">{sourceSummary(model.sources)}</p>
                <div className="nexid-crm-activity-list" tabIndex={0} role="region" aria-label="Todas las zonas de esta ventana">
                  <ol>
                    {model.zones.map((zone) => (
                      <li key={zone.key}>
                        <button type="button" className="nexid-crm-activity-row" onClick={() => onSelectEvent(zone.events[0], zone.events)} title={`Abrir lecturas del tenant de este evento: ${zone.events[0].tenantSlug || "no informado"}`} aria-label={`${zone.label}. Abrir lecturas del tenant de este evento: ${zone.events[0].tenantSlug || "no informado"}`}>
                          <span><strong>{zone.label}</strong><small>{sourceSummary(zone)}</small></span>
                          <b className="nexid-crm-activity-count">{zone.total}</b>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>

              <section className="nexid-crm-activity-column" aria-labelledby="activity-products-title">
                <h3 id="activity-products-title"><Package className="h-4 w-4" aria-hidden="true" /> Productos con actividad</h3>
                <p className="nexid-crm-activity-muted">Eventos por nombre informado; no unidades únicas.</p>
                <div className="nexid-crm-activity-list" tabIndex={0} role="region" aria-label="Todos los productos de esta ventana">
                  <ol>
                    {model.products.map((product) => (
                      <li key={product.key}>
                        <button type="button" className="nexid-crm-activity-row" onClick={() => onSelectEvent(product.events[0], product.events)} title={`Abrir lecturas del tenant de este evento: ${product.events[0].tenantSlug || "no informado"}`} aria-label={`${product.label}. Abrir lecturas del tenant de este evento: ${product.events[0].tenantSlug || "no informado"}`}>
                          <span><strong>{product.label}</strong><small>Ver eventos asociados</small></span>
                          <b className="nexid-crm-activity-count">{product.total}</b>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>

              <section className="nexid-crm-activity-column" aria-labelledby="activity-review-title">
                <h3 id="activity-review-title"><ScanLine className="h-4 w-4" aria-hidden="true" /> Revisar eventos</h3>
                <p className="nexid-crm-activity-muted">{model.risk} con riesgo explícito · {model.opened} con apertura reportada</p>
                <div className="nexid-crm-activity-list" tabIndex={0} role="region" aria-label="Cola de eventos: riesgos, aperturas y demás actividad">
                  <ol>
                    {model.queue.map(({ event, signal, opened }, index) => (
                      <li key={`${event.tenantSlug}:${event.eventId}:${index}`}>
                        <button type="button" className="nexid-crm-activity-row" data-signal={signal} onClick={() => onSelectEvent(event, queueEvents)}>
                          <span>
                            <strong>{signal === "risk" ? "Riesgo explícito" : opened ? "Apertura reportada" : "Actividad registrada"}{signal === "risk" && opened ? " · apertura reportada" : ""}</strong>
                            <small>{event.productName?.trim() || "Producto no informado"} · {formatEventTime(event)}{multipleTenants ? ` · ${event.tenantSlug || "Tenant no informado"}` : ""}</small>
                          </span>
                          <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      <footer className="nexid-crm-activity-footer">
        <details className="nexid-crm-activity-method">
          <summary>Cómo se cuentan estos datos</summary>
          <p>Se cuenta cada evento visible de esta ventana, incluidos los que no informan producto o ubicación. Las zonas se agrupan por ciudad y país reportados; GPS, red/IP y fuentes mixtas no prueban la ubicación física del producto. Los nombres no identifican unidades ni personas.</p>
          <p>La cola muestra primero riesgo explícito, luego apertura y después otra actividad, conservando el orden reciente dentro de cada grupo. Apertura no equivale a riesgo; ambas señales pueden coexistir. Actividad elegible exige producto reconocido, actor asociado, tipo admitido y consentimiento por canal. Un UID no identifica a una persona ni genera destinatarios.</p>
        </details>
        <div className="nexid-crm-activity-actions">
          <button type="button" onClick={onOpenPhysicalTaps}>TAP físicos</button>
          {onOpenAudit ? (
            <button type="button" onClick={onOpenAudit}>Abrir auditoría</button>
          ) : (
            <span className="nexid-crm-activity-muted" aria-disabled="true" title={auditUnavailableReason} data-testid="activity-audit-unavailable">Auditoría no habilitada</span>
          )}
        </div>
      </footer>
    </section>
  );
}
