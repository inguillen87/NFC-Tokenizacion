"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bot, ClipboardCheck, Download, Mail, MapPin, MessageCircle, MousePointerClick, Route, Send, ShieldCheck, Sparkles, Sprout, Users } from "lucide-react";
import { strictCoordinatePair } from "../lib/geo-coordinates";
import { classifyLocationProvenance } from "../lib/location-provenance";
import { isRealtimeRisk, type TenantTapRealtimeEvent } from "../lib/realtime-feed";
import styles from "./customer-growth-command-center.module.css";

type CustomerGrowthCommandCenterProps = {
  events: TenantTapRealtimeEvent[];
  tenantScope?: string;
  activityTotal: number;
  authenticatedInteractions: number;
  riskInteractions: number;
};

function cityKey(event: TenantTapRealtimeEvent) {
  return [event.city || "Ciudad sin GPS fino", event.country || ""].filter(Boolean).join(", ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function tenantDisplayName(scope?: string) {
  if (!scope) return "todos los tenants";
  const normalized = scope.toLowerCase();
  if (normalized === "demobodega") return "Bodega Balmec";
  return scope
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  const keys = Object.keys(rows[0] || { senal: "", actividad: "", accion: "" });
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function CustomerGrowthCommandCenter({ events, tenantScope, activityTotal, authenticatedInteractions, riskInteractions }: CustomerGrowthCommandCenterProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const activeTenantLabel = tenantDisplayName(tenantScope);

  const insights = useMemo(() => {
    const authenticatedEvents = events.filter((event) => event.authenticationVerified === true);
    const gpsEvents = events.filter((event) => classifyLocationProvenance(event.locationSource) === "consented_gps"
      && strictCoordinatePair(event.lat, event.lng) != null);
    const authenticatedGpsEvents = authenticatedEvents.filter((event) => strictCoordinatePair(event.lat, event.lng) != null);
    const riskEvents = events.filter((event) => isRealtimeRisk(event.verdict, event.reason));
    const productRecognized = events.filter((event) => event.productIdentityRecognized === true).length;
    const knownActorInteractions = events.filter((event) => event.knownActor === true).length;
    const consentedInteractions = events.filter((event) => event.knownActor === true && event.commercialConsentGranted === true).length;
    const cityCounts = new Map<string, number>();
    for (const event of events) {
      const key = cityKey(event);
      cityCounts.set(key, (cityCounts.get(key) || 0) + 1);
    }
    const topCity = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0] || ["Sin ciudad dominante", 0];
    const authenticationRate = events.length ? Math.round((authenticatedEvents.length / events.length) * 100) : 0;
    const gpsRate = events.length ? Math.round((gpsEvents.length / events.length) * 100) : 0;
    return {
      total: events.length,
      authenticated: authenticatedEvents.length,
      productRecognized,
      knownActorInteractions,
      consentedInteractions,
      gps: gpsEvents.length,
      authenticatedGps: authenticatedGpsEvents.length,
      missingGps: Math.max(events.length - gpsEvents.length, 0),
      risk: riskEvents.length,
      topCityName: topCity[0],
      topCityCount: topCity[1],
      authenticationRate,
      gpsRate,
    };
  }, [events]);

  const segments = [
    {
      title: `Actividad en ${insights.topCityName}`,
      activity: insights.topCityCount,
      detail: "Zona con mayor cantidad de interacciones en la ventana visible; no es una audiencia ni una lista de contactos.",
      action: "Abrir campañas",
      href: "/loyalty/campaigns",
      tone: "cyan" as const,
      icon: MapPin,
    },
    {
      title: "Productos reconocidos",
      activity: insights.productRecognized,
      detail: "Interacciones ligadas a producto, lote o unidad persistidos. Un UID identifica producto; nunca una persona.",
      action: "Revisar eventos",
      href: "/events",
      tone: "green" as const,
      icon: Users,
    },
    {
      title: "Sin ubicación del teléfono",
      activity: insights.missingGps,
      detail: "Sin zona compartida por el navegador con consentimiento; pueden conservar una estimación de red. Compartirla es opcional.",
      action: "Revisar eventos",
      href: "/events",
      tone: insights.missingGps ? "amber" as const : "green" as const,
      icon: ShieldCheck,
    },
    {
      title: "Riesgo o soporte",
      activity: insights.risk,
      detail: "Lecturas que conviene revisar antes de entregar beneficio o abrir reclamo.",
      action: "Ver soporte",
      href: "/leads-tickets",
      tone: insights.risk ? "rose" as const : "green" as const,
      icon: Bot,
    },
  ];

  const exportSegments = () => {
    downloadCsv("nexid-growth-activity-signals.csv", segments.map((segment) => ({
      senal: segment.title,
      actividad: segment.activity,
      accion: segment.action,
      detalle: segment.detail,
    })));
    setNotice("Señales de actividad exportadas. El archivo no contiene contactos, audiencia ni destinatarios.");
    window.setTimeout(() => setNotice(null), 4000);
  };

  const operationalMetrics = [
    { label: "Actividad persistida", value: activityTotal, rate: null, detail: "total confirmado por la fuente operativa", icon: MousePointerClick },
    { label: "Producto reconocido", value: insights.productRecognized, rate: insights.total ? Math.round((insights.productRecognized / insights.total) * 100) : 0, detail: "cobertura sobre los eventos visibles", icon: ShieldCheck },
    { label: "Autenticación verificada", value: authenticatedInteractions, rate: null, detail: "total confirmado por el contrato criptográfico", icon: ShieldCheck },
    { label: "Actividad con actor", value: insights.knownActorInteractions, rate: insights.total ? Math.round((insights.knownActorInteractions / insights.total) * 100) : 0, detail: "interacciones con actor pseudónimo; no es un conteo de personas", icon: Users },
    { label: "Actividad con consentimiento", value: insights.consentedInteractions, rate: insights.total ? Math.round((insights.consentedInteractions / insights.total) * 100) : 0, detail: "interacciones con grant vigente; la audiencia se resuelve aparte", icon: Route },
  ];

  const enterpriseGrowthPlays = [
    {
      icon: Sprout,
      title: "Campañas de soporte técnico",
      body: "Abrí el módulo de campañas para revisar su configuración. Este acceso no activa una campaña ni acredita soporte prestado.",
      metric: `${formatNumber(insights.authenticated)} autenticaciones verificadas`,
      href: "/loyalty/campaigns",
      action: "Abrir campañas",
    },
    {
      icon: Route,
      title: "Revisión de eventos",
      body: "Consultá el listado de eventos y su evidencia disponible. El contexto geográfico por sí solo no prueba desvíos de distribución.",
      metric: `${formatNumber(insights.risk)} alertas`,
      href: "/events",
      action: "Revisar eventos",
    },
    {
      icon: ClipboardCheck,
      title: "Campañas y consentimiento",
      body: "El seguimiento personal exige actor conocido, membresía activa y consentimiento vigente para el canal. Abrir el módulo no habilita destinatarios ni envíos.",
      metric: `${formatNumber(insights.productRecognized)} interacciones con producto`,
      href: "/loyalty/campaigns",
      action: "Abrir campañas",
    },
  ];

  return (
    <section className={styles.root} aria-labelledby="growth-title" data-testid="customer-growth-command-center">
      {notice ? (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      ) : null}
      <div className={`${styles.header} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={styles.eyebrow}>Actividad y campañas</p>
            <h2 id="growth-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Taps, actividad y consentimiento</h2>
            <p className={`${styles.muted} mt-2 max-w-3xl text-sm leading-6`}>
              Consultá las interacciones disponibles y su contexto. Un tap es actividad de una unidad, no una persona. Contactar a alguien exige identidad vinculada y consentimiento vigente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={styles.badge}>Actividad, no audiencia</span>
            <span className={styles.badge}>Consentimiento requerido</span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Producto reconocido</p>
            <p className="mt-2 text-3xl font-bold">{formatNumber(insights.productRecognized)}</p>
            <p className={`${styles.muted} mt-1 text-xs`}>Identidad de producto, nunca identidad personal</p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Autenticación verificada</p>
            <p className="mt-2 text-3xl font-bold">{insights.authenticationRate}%</p>
            <p className={`${styles.muted} mt-1 text-xs`}>{formatNumber(insights.authenticated)} mensajes NFC con evidencia criptográfica. No autentica el producto físico.</p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Ubicación consentida</p>
            <p className="mt-2 text-3xl font-bold">{insights.gpsRate}%</p>
            <p className={`${styles.muted} mt-1 text-xs`}>Cobertura consentida y reportada; no identifica una persona</p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Empresas en la vista</p>
            <p className="mt-2 text-3xl font-bold">{tenantScope ? "1" : "multi"}</p>
            <p className={`${styles.muted} mt-1 text-xs`}>{activeTenantLabel}</p>
          </div>
        </div>

        <div className={`${styles.tools} mt-5 p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Herramientas relacionadas</h3>
              <p className={`${styles.muted} mt-1 text-xs leading-5`}>
                Estos accesos abren módulos existentes. No activan campañas ni envían mensajes.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {enterpriseGrowthPlays.map((play) => {
              const Icon = play.icon;
              return (
                <Link key={play.title} href={play.href} className={`${styles.toolLink} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <Icon className={`${styles.accent} h-5 w-5 shrink-0`} aria-hidden="true" />
                    <span className={styles.badge}>{play.metric}</span>
                  </div>
                  <h4 className="mt-3 text-sm font-bold">{play.title}</h4>
                  <p className={`${styles.muted} mt-2 text-xs leading-5`}>{play.body}</p>
                  <span className={`${styles.linkLabel} mt-3`}>
                    <Send className="h-3.5 w-3.5" aria-hidden="true" /> {play.action}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className={styles.eyebrow}>Señales operativas</h3>
              <p className={`${styles.muted} mt-1 text-xs`}>Son agregados de actividad, no contactos, audiencia ni destinatarios.</p>
            </div>
            <button type="button" onClick={exportSegments} className={styles.action}>
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {segments.map((segment) => {
              const Icon = segment.icon;
              return (
                <article key={segment.title} className={`${styles.segment} p-4`} data-tone={segment.tone}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Icon className={`${styles.accent} h-5 w-5`} aria-hidden="true" />
                      <h4 className="mt-3 text-lg font-bold">{segment.title}</h4>
                    </div>
                    <span className={styles.badge}>{formatNumber(segment.activity)} interacciones</span>
                  </div>
                  <p className={`${styles.muted} mt-3 text-sm leading-6`}>{segment.detail}</p>
                  <Link href={segment.href} className={`${styles.action} mt-4`}>
                    <Send className="h-4 w-4" /> {segment.action}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className={`${styles.panel} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className={styles.eyebrow}>Cobertura operativa</h3>
                <p className={`${styles.muted} mt-1 text-xs leading-5`}>Indicadores independientes: cada porcentaje compara actividades de la misma base.</p>
              </div>
              <span className={styles.badge}>Actividad</span>
            </div>
            <div className="mt-4 space-y-3">
              {operationalMetrics.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className={`${styles.coverageRow} p-3`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-bold"><Icon className={`${styles.accent} h-4 w-4 shrink-0`} /> {step.label}</span>
                      <span className={`${styles.value} font-mono text-sm font-bold`}>{formatNumber(step.value)} {step.rate == null ? null : <span className={`${styles.muted} text-xs`}>({step.rate}%)</span>}</span>
                    </div>
                    <p className={`${styles.muted} mt-1 text-xs leading-5`}>{step.detail}</p>
                    {step.rate == null ? null : (
                      <div className={`${styles.track} mt-2`}>
                        <div style={{ width: `${Math.max(4, Math.min(100, step.rate))}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${styles.panel} p-4`}>
            <h3 className={`${styles.eyebrow} flex items-center gap-2`}><Sparkles className="h-4 w-4" aria-hidden="true" /> Antes de contactar</h3>
            <div className={`${styles.muted} mt-3 space-y-2 text-xs leading-5`}>
              <p>La audiencia real debe resolverse en servidor por actor pseudónimo, tenant, scope, consentimiento vigente y permisos de campañas/PII.</p>
              <p>Los eventos y UIDs no son destinatarios. Abrir campañas o beneficios no habilita contacto ni realiza envíos.</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href="/loyalty/campaigns" className={styles.action}><MessageCircle className="h-4 w-4" /> Abrir campañas</Link>
              <Link href="/loyalty/rewards" className={styles.action}><Mail className="h-4 w-4" /> Ver beneficios</Link>
            </div>
          </div>

          {riskInteractions ? (
            <div className={`${styles.warning} p-4 text-xs leading-5`}>
              <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Eventos para revisar</p>
              <p className="mt-2">Hay {formatNumber(riskInteractions)} eventos con señal explícita de riesgo. Los eventos neutrales o de ciclo de vida no se cuentan como fallos.</p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
