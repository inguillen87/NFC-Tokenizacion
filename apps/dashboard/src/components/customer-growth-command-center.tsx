"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Card, StatusChip } from "@product/ui";
import { AlertTriangle, Bot, ClipboardCheck, Download, Mail, MapPin, MessageCircle, MousePointerClick, Route, Send, ShieldCheck, Sparkles, Sprout, Users } from "lucide-react";
import { strictCoordinatePair } from "../lib/geo-coordinates";
import { classifyLocationProvenance } from "../lib/location-provenance";
import { isRealtimeRisk, type TenantTapRealtimeEvent } from "../lib/realtime-feed";

type SegmentTone = "cyan" | "green" | "amber" | "rose" | "violet";

type CustomerGrowthCommandCenterProps = {
  events: TenantTapRealtimeEvent[];
  tenantScope?: string;
  activityTotal: number;
  authenticatedInteractions: number;
  riskInteractions: number;
};

const toneClass: Record<SegmentTone, string> = {
  cyan: "border-cyan-300/25 bg-cyan-500/10 text-cyan-100",
  green: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-300/25 bg-amber-500/10 text-amber-100",
  rose: "border-rose-300/25 bg-rose-500/10 text-rose-100",
  violet: "border-violet-300/25 bg-violet-500/10 text-violet-100",
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
      action: "Evaluar oportunidad",
      href: `/loyalty/campaigns?city=${encodeURIComponent(insights.topCityName)}&offer=${encodeURIComponent("voucher_cercania")}`,
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
      title: "Ubicación incompleta",
      activity: insights.missingGps,
      detail: "Interacciones sin coordenada utilizable. Cualquier ubicación posterior exige opt-in explícito en la experiencia.",
      action: "Diseñar opt-in",
      href: "/loyalty/campaigns?channel=portal_whatsapp&offer=gps_opt_in",
      tone: insights.missingGps ? "amber" as const : "green" as const,
      icon: ShieldCheck,
    },
    {
      title: "Riesgo o soporte",
      activity: insights.risk,
      detail: "Lecturas que conviene revisar antes de entregar beneficio o abrir reclamo.",
      action: "Abrir tickets",
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
      title: "Soporte técnico desde evento NFC",
      body: "Después de un mensaje NFC válido según policy se abre ficha técnica, EPP, dosificación, soporte y confirmación. No autentica el producto físico ni reemplaza sistemas agro.",
      metric: `${formatNumber(insights.authenticated)} autenticaciones verificadas`,
      href: "/loyalty/campaigns?template=agro_soporte",
    },
    {
      icon: Route,
      title: "Canal gris y distribución",
      body: "Cruza ciudad, lote y repetición de UID para detectar producto fuera de zona, vendedor no previsto o concentración sospechosa de lecturas.",
      metric: `${formatNumber(insights.risk)} alertas`,
      href: "/events?view=channel-risk",
    },
    {
      icon: ClipboardCheck,
      title: "Trivia técnica y first-party data",
      body: "Encuestas cortas post-tap miden respuestas como actividad. El seguimiento personal exige actor conocido, membresía activa y consentimiento vigente para el canal.",
      metric: `${formatNumber(insights.productRecognized)} interacciones con producto`,
      href: "/loyalty/campaigns?template=agro_trivia",
    },
  ];

  return (
    <Card className="relative overflow-hidden p-0">
      {notice ? (
        <div className="absolute right-4 top-4 z-30 rounded-xl border border-cyan-300/30 bg-slate-950/95 px-4 py-3 text-xs font-bold text-cyan-100 shadow-xl">
          {notice}
        </div>
      ) : null}
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_12%_10%,rgba(168,85,247,.2),transparent_28%),radial-gradient(circle_at_86%_20%,rgba(34,211,238,.18),transparent_30%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,6,23,.98))] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Actividad & campañas</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Convertir actividad trazable en decisiones comerciales verificables.</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              Esta vista resume interacciones, producto, autenticación y contexto geográfico. La audiencia real debe resolverse en servidor por actor pseudónimo, tenant, scope, consentimiento vigente y permisos de campañas/PII.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="cyan">Preparación CRM</Badge>
            <Badge tone="green">Opt-in primero</Badge>
            <Badge>UID ≠ persona</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Producto reconocido</p>
            <p className="mt-2 text-3xl font-black text-white">{formatNumber(insights.productRecognized)}</p>
            <p className="mt-1 text-xs text-cyan-100/80">Identidad de producto, nunca identidad personal</p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">Autenticación verificada</p>
            <p className="mt-2 text-3xl font-black text-white">{insights.authenticationRate}%</p>
            <p className="mt-1 text-xs text-emerald-100/80">{formatNumber(insights.authenticated)} mensajes NFC con evidencia criptográfica</p>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">GPS útil</p>
            <p className="mt-2 text-3xl font-black text-white">{insights.gpsRate}%</p>
            <p className="mt-1 text-xs text-amber-100/80">Cobertura consentida y reportada; no identifica una persona</p>
          </div>
          <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">Tenant activo</p>
            <p className="mt-2 text-3xl font-black text-white">{tenantScope ? "1" : "multi"}</p>
            <p className="mt-1 text-xs text-violet-100/80">{activeTenantLabel}</p>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-emerald-300/15 bg-slate-950/45 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Modo enterprise por vertical</p>
              <h3 className="mt-1 text-lg font-black text-white">De evidencia NFC registrada a una decisión útil para canal y equipo técnico.</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Esta capa evita vender un CRM genérico: convierte señales físicas en acciones comerciales, soporte y aprendizaje de mercado.
              </p>
            </div>
            <Badge tone="green">Verticalizable</Badge>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {enterpriseGrowthPlays.map((play) => {
              const Icon = play.icon;
              return (
                <Link key={play.title} href={play.href} className="group rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(6,78,59,.16),rgba(15,23,42,.72))] p-4 transition hover:-translate-y-0.5 hover:border-emerald-300/35">
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="h-5 w-5 text-emerald-200" aria-hidden="true" />
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-100">{play.metric}</span>
                  </div>
                  <h4 className="mt-3 text-sm font-black text-white">{play.title}</h4>
                  <p className="mt-2 min-h-[72px] text-xs leading-5 text-slate-400">{play.body}</p>
                  <span className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-300/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-100 group-hover:bg-emerald-300 group-hover:text-slate-950">
                    <Send className="h-3.5 w-3.5" /> Activar play
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
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Señales operativas</p>
              <p className="mt-1 text-xs text-slate-400">Son agregados de actividad, no contactos, audiencia ni destinatarios.</p>
            </div>
            <button type="button" onClick={exportSegments} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/20">
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {segments.map((segment) => {
              const Icon = segment.icon;
              return (
                <article key={segment.title} className={`rounded-2xl border p-4 ${toneClass[segment.tone]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      <h3 className="mt-3 text-lg font-black text-white">{segment.title}</h3>
                    </div>
                    <StatusChip label={`${formatNumber(segment.activity)} interacciones`} tone={segment.tone === "rose" ? "risk" : segment.tone === "amber" ? "warn" : "good"} />
                  </div>
                  <p className="mt-3 min-h-[42px] text-sm leading-6 opacity-85">{segment.detail}</p>
                  <Link href={segment.href} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-current/25 bg-slate-950/30 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] hover:bg-white/10">
                    <Send className="h-4 w-4" /> {segment.action}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Cobertura operativa</p>
                <p className="mt-1 text-[11px] text-slate-500">Indicadores independientes: sólo hay porcentaje cuando numerador y denominador comparten el mismo grano.</p>
              </div>
              <StatusChip label="post-tap" tone="good" />
            </div>
            <div className="mt-4 space-y-3">
              {operationalMetrics.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-bold text-white"><Icon className="h-4 w-4 text-cyan-200" /> {step.label}</span>
                      <span className="font-mono text-sm font-black text-cyan-100">{formatNumber(step.value)} {step.rate == null ? null : <span className="text-xs text-slate-500">({step.rate}%)</span>}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{step.detail}</p>
                    {step.rate == null ? null : (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${Math.max(4, Math.min(100, step.rate))}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-violet-100"><Sparkles className="h-4 w-4" /> Playbook recomendado</p>
            <div className="mt-3 space-y-2 text-xs leading-5 text-violet-50/90">
              <p className="rounded-xl border border-white/10 bg-slate-950/45 p-3">1. Validar la oportunidad por zona sin convertir eventos o UIDs en destinatarios.</p>
              <p className="rounded-xl border border-white/10 bg-slate-950/45 p-3">2. Resolver audiencia actor-level en servidor con tenant, scope, consentimiento y permisos.</p>
              <p className="rounded-xl border border-white/10 bg-slate-950/45 p-3">3. Recién entonces activar un beneficio o encuesta por un canal expresamente consentido.</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href="/loyalty/campaigns" className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/20"><MessageCircle className="h-4 w-4" /> Campañas</Link>
              <Link href="/loyalty/rewards" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/20"><Mail className="h-4 w-4" /> Beneficios</Link>
            </div>
          </div>

          {riskInteractions ? (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100">
              <p className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" /> Antes de escalar pauta</p>
              <p className="mt-2">Hay {formatNumber(riskInteractions)} eventos con señal explícita de riesgo. Los eventos neutrales o de ciclo de vida no se cuentan como fallos.</p>
            </div>
          ) : null}
        </aside>
      </div>
    </Card>
  );
}
