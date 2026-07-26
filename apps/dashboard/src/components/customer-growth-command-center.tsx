"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Card, StatusChip } from "@product/ui";
import { AlertTriangle, Bot, ClipboardCheck, Download, Mail, MapPin, MessageCircle, MousePointerClick, Route, Send, ShieldCheck, Sparkles, Sprout, Users } from "lucide-react";
import { strictCoordinatePair } from "../lib/geo-coordinates";
import type { TenantTapRealtimeEvent } from "../lib/realtime-feed";

type SegmentTone = "cyan" | "green" | "amber" | "rose" | "violet";

type CustomerGrowthCommandCenterProps = {
  events: TenantTapRealtimeEvent[];
  tenantScope?: string;
  successfulTaps: number;
  failedTaps: number;
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
  const keys = Object.keys(rows[0] || { segmento: "", audiencia: "", accion: "" });
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

export function CustomerGrowthCommandCenter({ events, tenantScope, successfulTaps, failedTaps }: CustomerGrowthCommandCenterProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const activeTenantLabel = tenantDisplayName(tenantScope);

  const insights = useMemo(() => {
    const validEvents = events.filter((event) => String(event.verdict || "").toUpperCase() === "VALID");
    const gpsEvents = events.filter((event) => strictCoordinatePair(event.lat, event.lng) != null);
    const validGpsEvents = validEvents.filter((event) => strictCoordinatePair(event.lat, event.lng) != null);
    const riskEvents = events.filter((event) => String(event.riskLevel || "").toLowerCase() !== "low" && String(event.riskLevel || "").trim());
    const uniqueUids = new Set(events.map((event) => event.uidMasked).filter(Boolean));
    const cityCounts = new Map<string, number>();
    for (const event of events) {
      const key = cityKey(event);
      cityCounts.set(key, (cityCounts.get(key) || 0) + 1);
    }
    const topCity = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0] || ["Sin ciudad dominante", 0];
    const conversionRate = events.length ? Math.round((validEvents.length / events.length) * 100) : 0;
    const gpsRate = events.length ? Math.round((gpsEvents.length / events.length) * 100) : 0;
    return {
      total: events.length,
      valid: validEvents.length,
      gps: gpsEvents.length,
      validGps: validGpsEvents.length,
      missingGps: Math.max(events.length - gpsEvents.length, 0),
      risk: riskEvents.length || failedTaps,
      unique: uniqueUids.size,
      topCityName: topCity[0],
      topCityCount: topCity[1],
      conversionRate,
      gpsRate,
    };
  }, [events, failedTaps]);

  const segments = [
    {
      title: `${insights.topCityName} prioritaria`,
      audience: insights.topCityCount,
      detail: "Zona con mayor cantidad de lecturas en la ventana visible.",
      action: "Crear campaña local",
      href: `/loyalty/campaigns?city=${encodeURIComponent(insights.topCityName)}&offer=${encodeURIComponent("voucher_cercania")}`,
      tone: "cyan" as const,
      icon: MapPin,
    },
    {
      title: "UIDs con eventos reportados",
      audience: insights.unique,
      detail: "UIDs únicos con eventos NFC; usalos como segmento para evaluar club, puntos o garantía según policy.",
      action: "Abrir portal de usuarios",
      href: "/consumer-network/overview",
      tone: "green" as const,
      icon: Users,
    },
    {
      title: "GPS incompleto",
      audience: insights.missingGps,
      detail: "Usuarios a quienes conviene pedir ubicación voluntaria con beneficio.",
      action: "Pedir opt-in por campaña",
      href: "/loyalty/campaigns?channel=portal_whatsapp&offer=gps_opt_in",
      tone: insights.missingGps ? "amber" as const : "green" as const,
      icon: ShieldCheck,
    },
    {
      title: "Riesgo o soporte",
      audience: insights.risk,
      detail: "Lecturas que conviene revisar antes de entregar beneficio o abrir reclamo.",
      action: "Abrir tickets",
      href: "/leads-tickets",
      tone: insights.risk ? "rose" as const : "green" as const,
      icon: Bot,
    },
  ];

  const exportSegments = () => {
    downloadCsv("nexid-growth-segmentos.csv", segments.map((segment) => ({
      segmento: segment.title,
      audiencia: segment.audience,
      accion: segment.action,
      detalle: segment.detail,
    })));
    setNotice("Segmentos exportados para pauta, WhatsApp, email o CRM externo.");
    window.setTimeout(() => setNotice(null), 4000);
  };

  const funnel = [
    { label: "Lectura", value: insights.total, pct: insights.total ? 100 : 0, detail: "evento NFC/QR recibido", icon: MousePointerClick },
    { label: "Válida", value: successfulTaps || insights.valid, pct: insights.conversionRate, detail: "apta para beneficio", icon: ShieldCheck },
    { label: "Ubicación", value: insights.validGps, pct: insights.total ? Math.round((insights.validGps / insights.total) * 100) : 0, detail: "válida con GPS útil", icon: MapPin },
    { label: "Audiencia", value: insights.unique, pct: insights.total ? Math.round((insights.unique / insights.total) * 100) : 0, detail: "UIDs únicos visibles", icon: Users },
    { label: "Zona", value: insights.topCityCount, pct: insights.total ? Math.round((insights.topCityCount / insights.total) * 100) : 0, detail: "segmento local sugerido", icon: Route },
  ];

  const enterpriseGrowthPlays = [
    {
      icon: Sprout,
      title: "Soporte técnico desde evento NFC",
      body: "Después de un mensaje NFC válido según policy se abre ficha técnica, EPP, dosificación, soporte y confirmación. No autentica el producto físico ni reemplaza sistemas agro.",
      metric: `${formatNumber(insights.valid)} mensajes NFC válidos`,
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
      body: "Encuestas cortas post-tap miden conocimiento real del productor y activan beneficios sin pedir datos antes de entregar valor.",
      metric: `${formatNumber(Math.max(insights.unique, successfulTaps))} perfiles`,
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
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Clientes & campañas</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Convertir mensajes NFC válidos en segmentos, beneficios y recompra.</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              Esta solapa sirve para decidir qué segmento activar, con qué beneficio, por qué canal y desde qué ciudad. WhatsApp/email siguen siendo alta liviana; wallet y NFT aparecen solo cuando el usuario lo pide.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="cyan">Listo para CRM</Badge>
            <Badge tone="green">Opt-in primero</Badge>
            <Badge>Scope tenant</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Audiencia visible</p>
            <p className="mt-2 text-3xl font-black text-white">{formatNumber(insights.unique)}</p>
            <p className="mt-1 text-xs text-cyan-100/80">UIDs únicos, no contactos confirmados</p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">Tasa válida</p>
            <p className="mt-2 text-3xl font-black text-white">{insights.conversionRate}%</p>
            <p className="mt-1 text-xs text-emerald-100/80">{formatNumber(insights.valid)} mensajes NFC válidos</p>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">GPS útil</p>
            <p className="mt-2 text-3xl font-black text-white">{insights.gpsRate}%</p>
            <p className="mt-1 text-xs text-amber-100/80">Base para cercanía comercial y pauta</p>
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
              <h3 className="mt-1 text-lg font-black text-white">De evidencia NFC validada a campaña útil para cliente, canal y equipo técnico.</h3>
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
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Segmentos accionables</p>
              <p className="mt-1 text-xs text-slate-400">No es una lista infinita: son decisiones comerciales con segmento, canal y destino claro.</p>
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
                    <StatusChip label={`${formatNumber(segment.audience)} audiencia`} tone={segment.tone === "rose" ? "risk" : segment.tone === "amber" ? "warn" : "good"} />
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
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Funnel de activación comercial</p>
                <p className="mt-1 text-[11px] text-slate-500">Etapas calculadas desde eventos visibles; no son ventas confirmadas.</p>
              </div>
              <StatusChip label="post-tap" tone="good" />
            </div>
            <div className="mt-4 space-y-3">
              {funnel.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-bold text-white"><Icon className="h-4 w-4 text-cyan-200" /> {step.label}</span>
                      <span className="font-mono text-sm font-black text-cyan-100">{formatNumber(step.value)} <span className="text-xs text-slate-500">({step.pct}%)</span></span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{step.detail}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${Math.max(4, Math.min(100, step.pct))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-violet-100"><Sparkles className="h-4 w-4" /> Playbook recomendado</p>
            <div className="mt-3 space-y-2 text-xs leading-5 text-violet-50/90">
              <p className="rounded-xl border border-white/10 bg-slate-950/45 p-3">1. Enviar beneficio corto a la ciudad prioritaria, con vencimiento y QR de canje.</p>
              <p className="rounded-xl border border-white/10 bg-slate-950/45 p-3">2. Pedir opt-in de ubicación solo después del beneficio, no antes del registro.</p>
              <p className="rounded-xl border border-white/10 bg-slate-950/45 p-3">3. Activar trivia o encuesta post-tap para medir conocimiento del producto.</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href="/loyalty/campaigns" className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/20"><MessageCircle className="h-4 w-4" /> Campañas</Link>
              <Link href="/loyalty/rewards" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/20"><Mail className="h-4 w-4" /> Beneficios</Link>
            </div>
          </div>

          {failedTaps ? (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100">
              <p className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" /> Antes de escalar pauta</p>
              <p className="mt-2">Hay {formatNumber(failedTaps)} eventos fallidos o riesgosos. Conviene revisar origen y dispositivo antes de premiar masivamente.</p>
            </div>
          ) : null}
        </aside>
      </div>
    </Card>
  );
}
