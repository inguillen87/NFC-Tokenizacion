"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, Boxes, ClipboardCheck, Database, MapPin, PackageCheck, QrCode, Radar, Send, ShieldCheck, ShoppingBag, Sprout, Store, UserCog } from "lucide-react";
import styles from "./ops-command-center.module.css";
import { DASHBOARD_DESTINATIONS } from "../lib/dashboard-destination-policy";
import type { OpsDestinationAccess, OpsDestinationKey } from "../lib/ops-destination-access";

export type OpsCommandMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "good" | "warn" | "risk" | "neutral";
};

export type OpsCommandStep = {
  label: string;
  body: string;
  status: "ready" | "working" | "blocked";
  owner: "Super Admin" | "Owner" | "Operaciones" | "Growth" | "Seguridad";
};

export type OpsCommandTenantRow = {
  name: string;
  slug: string;
  scans: number;
  riskScore: number;
  batches: number;
  tags: number;
  status: "active" | "healthy" | "pending" | "risk";
};

export type OpsCommandCenterProps = {
  title?: string;
  subtitle?: string;
  metrics: OpsCommandMetric[];
  steps: OpsCommandStep[];
  tenants?: OpsCommandTenantRow[];
  funnel: Array<{ stage: string; value: number }>;
  readiness: Array<{ label: string; ready: number; pending: number }>;
  mode?: "global" | "tenant" | "auditor";
  allowedDestinations: OpsDestinationAccess;
};

const roles = {
  global: {
    label: "Super Admin",
    icon: UserCog,
    headline: "Revisá empresas, lotes y actividad NFC desde una sola consola.",
    action: "Consultá los datos disponibles y abrí cada empresa para revisar sus lotes, tags y eventos dentro de tu alcance autorizado.",
  },
  tenant: {
    label: "Admin tenant",
    icon: Store,
    headline: "Controlá los lotes, tags y lecturas de tu empresa.",
    action: "Revisá qué se importó, qué tags están activos y qué eventos necesitan atención. Cada acceso conserva los permisos de tu cuenta.",
  },
  auditor: {
    label: "Equipo operativo",
    icon: ShieldCheck,
    headline: "Revisá lotes, tags y evidencia NFC dentro de tu alcance.",
    action: "Los registros ayudan a preparar la revisión operativa; no reemplazan el QA de campo ni autorizan una publicación.",
  },
} as const;

const toneClasses: Record<NonNullable<OpsCommandMetric["tone"]>, string> = {
  good: "border-[var(--ops-success-border)] bg-[var(--ops-success-bg)] text-[var(--ops-success)]",
  warn: "border-[var(--ops-warning-border)] bg-[var(--ops-warning-bg)] text-[var(--ops-warning)]",
  risk: "border-[var(--ops-danger-border)] bg-[var(--ops-danger-bg)] text-[var(--ops-danger)]",
  neutral: "border-[var(--ops-border)] bg-[var(--ops-surface)] text-[var(--ops-text)]",
};

function StatusChip({ label, tone = "neutral" }: { label: string; tone?: "good" | "warn" | "risk" | "neutral" }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{label}</span>;
}

const statusTone: Record<OpsCommandStep["status"], "good" | "warn" | "risk"> = {
  ready: "good",
  working: "warn",
  blocked: "risk",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function tenantSlugLabel(slug: string) {
  if (slug.toLowerCase() === "demobodega") return "bodega-balmec";
  return slug;
}

function riskTone(value: number): "good" | "warn" | "risk" | "neutral" {
  if (value >= 65) return "risk";
  if (value >= 30) return "warn";
  if (value > 0) return "good";
  return "neutral";
}

function ownerDisplayLabel(owner: OpsCommandStep["owner"]) {
  if (owner === "Owner") return "Admin tenant";
  return owner;
}

function MiniIconRail() {
  const items = [
    { icon: Boxes, label: "Lote" },
    { icon: PackageCheck, label: "Encoding" },
    { icon: ClipboardCheck, label: "QA campo" },
    { icon: BadgeCheck, label: "Anclaje" },
    { icon: Radar, label: "Beneficios" },
  ];
  return (
    <div className={`${styles.iconRail} grid gap-2`}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface)] p-3 text-center">
            <Icon className="mx-auto h-5 w-5 text-[var(--ops-accent)]" aria-hidden="true" />
            <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--ops-muted)]">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export function OpsCommandCenter({
  title = "Centro de mando operativo",
  subtitle = "Revisá los lotes, tags y eventos disponibles. Los módulos de anclaje, beneficios e integración son opcionales y conservan sus propios permisos.",
  metrics,
  steps,
  tenants = [],
  funnel,
  readiness,
  mode = "global",
  allowedDestinations,
}: OpsCommandCenterProps) {
  const canOpen = (destination: OpsDestinationKey) => allowedDestinations?.[destination] === true;
  const role = roles[mode];
  const RoleIcon = role.icon;
  const normalizedMetrics = metrics.length ? metrics : [
    { label: "Batches", value: "0", detail: "Sin lotes en el scope actual", tone: "neutral" as const },
    { label: "Tags activos", value: "0", detail: "Importar manifest para activar", tone: "warn" as const },
    { label: "Passport", value: "setup", detail: "Completar tenant y assets", tone: "warn" as const },
  ];
  const normalizedFunnel = funnel.length ? funnel : [
    { stage: "Tenant", value: 0 },
    { stage: "Batch", value: 0 },
    { stage: "Tags", value: 0 },
    { stage: "Tap", value: 0 },
    { stage: "NFT", value: 0 },
  ];
  const normalizedReadiness = readiness.length ? readiness : [
    { label: "Manifest", ready: 0, pending: 1 },
    { label: "Assets", ready: 0, pending: 1 },
    { label: "SUN", ready: 0, pending: 1 },
  ];
  const readySteps = useMemo(() => steps.filter((step) => step.status === "ready").length, [steps]);
  const stepCompletion = steps.length ? Math.round((readySteps / steps.length) * 100) : 0;
  const runbook = [
    {
      icon: Boxes,
      title: "1. Lotes de proveedor",
      body: "Consultá lotes, proveedor, SKU y manifest. La carga o edición requiere los permisos correspondientes.",
      destination: "supplierBatches" as const,
      href: DASHBOARD_DESTINATIONS.supplierBatches.href,
      cta: "Ver lotes",
    },
    {
      icon: QrCode,
      title: "2. Registro de tags",
      body: "Ver UIDs, estado reportado, ficha asociada y tags pendientes o sospechosos.",
      destination: "tags" as const,
      href: DASHBOARD_DESTINATIONS.tags.href,
      cta: "Ver tags",
    },
    {
      icon: ShieldCheck,
      title: "3. Eventos y QA",
      body: "Revisar taps reportados, replay, TT/tamper, ubicación declarada y dispositivo por UID.",
      destination: "events" as const,
      href: DASHBOARD_DESTINATIONS.events.href,
      cta: "Auditar eventos",
    },
    {
      icon: BadgeCheck,
      title: "4. Anclaje opcional",
      body: "Consultá solicitudes de tokenización cuando tu cuenta tenga acceso. Abrir este módulo no emite tokens ni publica un pasaporte.",
      destination: "tokenization" as const,
      href: DASHBOARD_DESTINATIONS.tokenization.href,
      cta: "Revisar anclaje",
    },
    {
      icon: ShoppingBag,
      title: "5. Beneficios",
      body: "Revisá el catálogo y los canjes disponibles para tu empresa. Este acceso no activa ventas ni envía promociones.",
      destination: "rewards" as const,
      href: DASHBOARD_DESTINATIONS.rewards.href,
      cta: "Ver beneficios",
    },
  ];

  const enterpriseLanes = [
    {
      icon: Sprout,
      title: "Agro / producto crítico",
      body: "Referencias para configurar productos, lotes y soportes NFC/QR según las necesidades del proyecto.",
      metric: "Referencia técnica",
      destination: "sdkVision" as const,
      href: `${DASHBOARD_DESTINATIONS.sdkVision.href}?vertical=agro`,
      cta: "Consultar documentación",
    },
    {
      icon: MapPin,
      title: "Canal y territorio",
      body: "Revisá la ubicación reportada y su precisión cuando estén disponibles. Un mapa de lecturas no confirma un desvío de distribución.",
      metric: "Ubicación reportada",
      destination: "events" as const,
      href: DASHBOARD_DESTINATIONS.events.href,
      cta: "Auditar eventos",
    },
    {
      icon: Database,
      title: "Dato para sistemas externos",
      body: "Consultá la configuración de API y webhooks autorizada para tu cuenta. La conexión con sistemas externos requiere configuración y validación independientes.",
      metric: "Según configuración",
      destination: "apiKeys" as const,
      href: DASHBOARD_DESTINATIONS.apiKeys.href,
      cta: "Consultar integración",
    },
    {
      icon: Send,
      title: "Uso responsable post-tap",
      body: "Consultá campañas disponibles según tu cuenta. El contacto y cualquier envío requieren la configuración, los permisos y el consentimiento aplicables.",
      metric: "contenido + opt-in",
      destination: "campaigns" as const,
      href: DASHBOARD_DESTINATIONS.campaigns.href,
      cta: "Ver campañas",
    },
  ];

  const tenantActions = [
    { destination: "batches" as const, label: "Lotes" },
    { destination: "tags" as const, label: "Tags" },
    { destination: "events" as const, label: "Eventos" },
  ];
  const unavailableTenantActions = tenantActions.filter((item) => !canOpen(item.destination));

  return (
    <section data-testid="ops-command-center" className={`${styles.workspace} relative overflow-hidden rounded-3xl border p-0`}>
      <div className={`${styles.hero} border-b border-[var(--ops-border)] p-5 sm:p-6`}>
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span data-testid="operations-session-role" className="rounded-full border border-[var(--ops-accent-border)] bg-[var(--ops-accent-bg)] px-3 py-1.5 text-xs font-black text-[var(--ops-accent)]">
                {role.label} · Alcance de la sesión
              </span>
            </div>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--ops-accent-border)] bg-[var(--ops-accent-bg)] text-[var(--ops-accent)]">
                <RoleIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--ops-accent)]">{title}</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ops-text)] sm:text-3xl">{role.headline}</h2>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--ops-muted)]">{subtitle}</p>
                <p className="mt-3 rounded-2xl border border-[var(--ops-success-border)] bg-[var(--ops-success-bg)] px-4 py-3 text-sm leading-6 text-[var(--ops-success)]">{role.action}</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--ops-border)] bg-[var(--ops-surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ops-muted)]">Estado orientativo de etapas</p>
              <span className="rounded-full border border-[var(--ops-accent-border)] bg-[var(--ops-accent-bg)] px-3 py-1 text-sm font-black text-[var(--ops-accent)]">{stepCompletion}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--ops-track)]">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-violet-300" style={{ width: `${stepCompletion}%` }} />
            </div>
            <div className="mt-4">
              <MiniIconRail />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {normalizedMetrics.map((metric) => (
            <article key={metric.label} className={`rounded-2xl border p-4 ${toneClasses[metric.tone || "neutral"]}`}>
              <p className="text-xs font-black uppercase tracking-[0.16em]">{metric.label}</p>
              <p className="mt-2 text-2xl font-black text-[var(--ops-text)]">{metric.value}</p>
              <p className="mt-2 text-xs leading-5">{metric.detail}</p>
            </article>
          ))}
        </div>

        <div className="mt-5 rounded-3xl border border-[var(--ops-accent-border)] bg-[var(--ops-surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ops-accent)]">Accesos operativos</p>
              <p className="mt-1 text-xs text-[var(--ops-muted)]">Cada enlace abre una consulta. Las funciones disponibles dependen de los permisos y la configuración del módulo. Los módulos sin acceso se muestran sin enlace; solicitá su habilitación al administrador de tu empresa.</p>
            </div>
            <StatusChip label="Acceso según permisos" tone="neutral" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
            {runbook.map((item) => {
              const Icon = item.icon;
              const allowed = canOpen(item.destination);
              const content = (
                <>
                  <Icon className="h-5 w-5 text-[var(--ops-accent)]" aria-hidden="true" />
                  <p className="mt-3 text-sm font-black text-[var(--ops-text)]">{item.title}</p>
                  <p className="mt-2 min-h-[54px] text-xs leading-5 text-[var(--ops-muted)]">{item.body}</p>
                  {allowed ? <span className="mt-3 inline-flex rounded-lg border border-[var(--ops-accent-border)] px-2 py-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--ops-accent)] group-hover:bg-[var(--ops-accent)] group-hover:text-[var(--ops-on-accent)]">{item.cta}</span> : <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ops-muted)]">No habilitado para tu cuenta.</p>}
                </>
              );
              return allowed ? (
                <Link key={item.title} href={item.href} className="group rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface)] p-3 transition hover:-translate-y-0.5 hover:border-[var(--ops-accent-border)] hover:bg-[var(--ops-accent-bg)]">
                  {content}
                </Link>
              ) : (
                <article key={item.title} data-unavailable-destination={item.destination} className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] p-3">
                  {content}
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--ops-border)] bg-[var(--ops-surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ops-success)]">Contexto e integraciones</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-[var(--ops-text)]">Recursos para revisar el uso de los datos de tu producto.</h3>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--ops-muted)]">
              Estos accesos reúnen documentación, eventos e integración. No acreditan una conexión activa con plataformas externas ni ejecutan acciones al abrirlos. Los eventos aportan evidencia digital; no certifican el producto físico.
            </p>
          </div>
          <StatusChip label="Configuración por proyecto" tone="neutral" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {enterpriseLanes.map((lane) => {
            const Icon = lane.icon;
            const allowed = canOpen(lane.destination);
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--ops-success-border)] bg-[var(--ops-success-bg)] text-[var(--ops-success)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full border border-[var(--ops-accent-border)] bg-[var(--ops-accent-bg)] px-2.5 py-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--ops-accent)]">{lane.metric}</span>
                </div>
                <h4 className="mt-4 text-base font-black text-[var(--ops-text)]">{lane.title}</h4>
                <p className="mt-2 min-h-[72px] text-xs leading-5 text-[var(--ops-muted)]">{lane.body}</p>
                {allowed ? <span className="mt-3 inline-flex rounded-lg border border-[var(--ops-success-border)] px-2.5 py-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--ops-success)] group-hover:bg-[var(--ops-success)] group-hover:text-[var(--ops-on-accent)]">{lane.cta}</span> : <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ops-muted)]">No habilitado para tu cuenta.</p>}
              </>
            );
            return allowed ? (
              <Link key={lane.title} href={lane.href} className="group rounded-2xl border border-[var(--ops-success-border)] bg-[var(--ops-surface)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--ops-success-border)]">
                {content}
              </Link>
            ) : (
              <article key={lane.title} data-unavailable-destination={lane.destination} className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] p-4">
                {content}
              </article>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-[var(--ops-border)] bg-[var(--ops-surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--ops-accent)]">Camino guiado</h3>
              <p className="mt-1 text-xs text-[var(--ops-muted)]">Estados orientativos de los registros consultados; no constituyen una aprobación de QA o producción.</p>
            </div>
            <StatusChip label={`${readySteps}/${steps.length || 0} listo`} tone={stepCompletion >= 80 ? "good" : stepCompletion >= 40 ? "warn" : "risk"} />
          </div>
          <div className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <div key={`${step.label}-${index}`} className="grid gap-3 rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface)] p-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ops-accent-border)] bg-[var(--ops-accent-bg)] text-xs font-black text-[var(--ops-accent)]">{index + 1}</span>
                <div>
                  <p className="font-black text-[var(--ops-text)]">{step.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--ops-muted)]">{step.body}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <StatusChip label={step.status} tone={statusTone[step.status]} />
                  <span className="rounded-full border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-2.5 py-1 text-xs font-medium text-[var(--ops-muted)]">{ownerDisplayLabel(step.owner)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-[var(--ops-border)] bg-[var(--ops-surface)] p-4">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--ops-accent)]">Volúmenes por etapa</h3>
              <p className="mt-1 text-xs text-[var(--ops-muted)]">Conteos distintos de empresas, lotes, tags y actividad; el anclaje se incluye sólo cuando hay datos disponibles.</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={normalizedFunnel} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="opsTrustGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--ops-accent)" stopOpacity={0.75} />
                        <stop offset="100%" stopColor="var(--ops-accent)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
                    <XAxis dataKey="stage" stroke="var(--ops-muted)" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis stroke="var(--ops-muted)" tickLine={false} axisLine={false} fontSize={12} width={34} />
                    <Tooltip contentStyle={{ background: "var(--dashboard-chart-tooltip-bg)", border: "1px solid var(--dashboard-chart-tooltip-border)", borderRadius: 12, color: "var(--dashboard-chart-tooltip-text)" }} />
                    <Area type="monotone" dataKey="value" stroke="var(--ops-accent)" fill="url(#opsTrustGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-3xl border border-[var(--ops-border)] bg-[var(--ops-surface)] p-4">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--ops-accent)]">Disponibilidad por etapa</h3>
              <p className="mt-1 text-xs text-[var(--ops-muted)]">Valores listos y pendientes según los datos consultados para cada etapa.</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={normalizedReadiness} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
                    <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--ops-muted)" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis stroke="var(--ops-muted)" tickLine={false} axisLine={false} fontSize={12} width={34} />
                    <Tooltip contentStyle={{ background: "var(--dashboard-chart-tooltip-bg)", border: "1px solid var(--dashboard-chart-tooltip-border)", borderRadius: 12, color: "var(--dashboard-chart-tooltip-text)" }} />
                    <Bar dataKey="ready" stackId="a" fill="var(--ops-success)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="pending" stackId="a" fill="var(--ops-warning)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--ops-border)] bg-[var(--ops-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--ops-accent)]">Tenants / lotes bajo control</h3>
                <p className="mt-1 text-xs text-[var(--ops-muted)]">Vista operativa para decidir qué activar, investigar o escalar.</p>
              </div>
              <span className="rounded-full border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3 py-1 text-xs font-black text-[var(--ops-text)]">{tenants.length} registros</span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-[var(--ops-border)] text-[var(--ops-muted)]">
                  <tr>
                    <th className="py-2 pr-3">Tenant / lote</th>
                    <th className="px-3 py-2">Scans</th>
                    <th className="px-3 py-2">Batches</th>
                    <th className="px-3 py-2">Tags</th>
                    <th className="px-3 py-2">Riesgo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Acciones operativas</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.length ? tenants.map((tenant) => (
                    <tr key={`${tenant.slug}-${tenant.name}`} className="border-b border-[var(--ops-border)] text-[var(--ops-text)]">
                      <td className="py-3 pr-3">
                        <b className="text-[var(--ops-text)]">{tenant.name}</b>
                        <span className="mt-1 block text-[var(--ops-muted)]">{tenantSlugLabel(tenant.slug)}</span>
                      </td>
                      <td className="px-3 py-3">{formatNumber(tenant.scans)}</td>
                      <td className="px-3 py-3">{formatNumber(tenant.batches)}</td>
                      <td className="px-3 py-3">{formatNumber(tenant.tags)}</td>
                      <td className="px-3 py-3"><StatusChip label={tenant.scans > 0 ? `${tenant.riskScore}/100` : "sin base"} tone={tenant.scans > 0 ? riskTone(tenant.riskScore) : "warn"} /></td>
                      <td className="px-3 py-3"><StatusChip label={tenant.status} tone={tenant.status === "risk" ? "risk" : tenant.status === "pending" ? "warn" : "good"} /></td>
                      <td className="px-3 py-3 text-right">
                        {mode === "global" ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            {canOpen("overview") ? <Link
                              href={`/?tenant=${encodeURIComponent(tenant.slug)}`}
                              className="rounded-xl border border-[var(--ops-accent-border)] bg-[var(--ops-accent-bg)] px-2.5 py-1 text-xs font-black uppercase tracking-wider text-[var(--ops-accent)] transition hover:bg-[var(--ops-accent-bg)]"
                            >
                              Abrir tenant
                            </Link> : <p className="text-xs text-[var(--ops-muted)]">Vista no habilitada para tu cuenta.</p>}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {tenantActions.filter((item) => canOpen(item.destination)).map((item) => (
                                <Link key={item.destination} href={DASHBOARD_DESTINATIONS[item.destination].href} className="rounded-xl border border-[var(--ops-accent-border)] bg-[var(--ops-accent-bg)] px-2.5 py-1 text-xs font-black uppercase tracking-wider text-[var(--ops-accent)] transition hover:bg-[var(--ops-accent-bg)]">{item.label}</Link>
                              ))}
                            </div>
                            {unavailableTenantActions.length ? <p className="text-xs leading-5 text-[var(--ops-muted)]">Sin acceso a: {unavailableTenantActions.map((item) => item.label).join(", ")}.</p> : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[var(--ops-muted)]">La fuente consultada no contiene empresas para el alcance actual.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
