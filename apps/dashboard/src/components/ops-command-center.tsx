"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, Boxes, ClipboardCheck, PackageCheck, Radar, ShieldCheck, Store, UserCog } from "lucide-react";
import { Card, StatusChip } from "@product/ui";

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
  owner: "Superadmin" | "Tenant" | "Reseller" | "Auditor";
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
};

const roles = {
  global: {
    label: "Superadmin",
    icon: UserCog,
    headline: "Gobernar tenants, resellers, riesgo y monetizacion desde una sola consola.",
    action: "Detecta que tenant esta listo para escalar, cual necesita auditoria y donde hay oportunidad comercial.",
  },
  tenant: {
    label: "Bodega Balmec / marca",
    icon: Store,
    headline: "Pasar de lote recibido a producto pegado, probado, publicado y vendiendo.",
    action: "La persona no tecnica ve que completar, que esta bloqueado y cual es el proximo paso.",
  },
  auditor: {
    label: "Auditor",
    icon: ShieldCheck,
    headline: "Validar evidencia por lote, carrier, UID, SUN, tap fisico, ownership y tokenizacion.",
    action: "Nada se publica como premium sin preflight, trazabilidad y prueba de campo.",
  },
} as const;

const toneClasses: Record<NonNullable<OpsCommandMetric["tone"]>, string> = {
  good: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
  warn: "border-amber-300/25 bg-amber-500/10 text-amber-100",
  risk: "border-rose-300/25 bg-rose-500/10 text-rose-100",
  neutral: "border-white/10 bg-slate-950/55 text-slate-100",
};

const statusTone: Record<OpsCommandStep["status"], "good" | "warn" | "risk"> = {
  ready: "good",
  working: "warn",
  blocked: "risk",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function riskTone(value: number): "good" | "warn" | "risk" | "neutral" {
  if (value >= 65) return "risk";
  if (value >= 30) return "warn";
  if (value > 0) return "good";
  return "neutral";
}

function MiniIconRail() {
  const items = [
    { icon: Boxes, label: "Batch" },
    { icon: PackageCheck, label: "Tags" },
    { icon: ClipboardCheck, label: "Preflight" },
    { icon: BadgeCheck, label: "Passport" },
    { icon: Radar, label: "Auditoria" },
  ];
  return (
    <div className="grid grid-cols-5 gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-center">
            <Icon className="mx-auto h-5 w-5 text-cyan-200" aria-hidden="true" />
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export function OpsCommandCenter({
  title = "Centro de mando operativo",
  subtitle = "Una consola para que superadmin, reseller, marca y auditor entiendan que esta listo, que falta y que bloquea el rollout.",
  metrics,
  steps,
  tenants = [],
  funnel,
  readiness,
  mode = "global",
}: OpsCommandCenterProps) {
  const [selectedMode, setSelectedMode] = useState<keyof typeof roles>(mode);
  const [pausedTenants, setPausedTenants] = useState<Set<string>>(new Set());
  const [networkModes, setNetworkModes] = useState<Record<string, "Simulated" | "Polygon">>(
    tenants.reduce((acc, t) => ({ ...acc, [t.slug]: "Simulated" }), {})
  );
  const [actionAlert, setActionAlert] = useState<string | null>(null);

  const handleTogglePause = (slug: string) => {
    setPausedTenants((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
        setActionAlert(`Tenant ${slug} activado exitosamente.`);
      } else {
        next.add(slug);
        setActionAlert(`Tenant ${slug} pausado preventivamente. Se bloquearon temporalmente sus validaciones.`);
      }
      return next;
    });
    setTimeout(() => setActionAlert(null), 4000);
  };

  const handleToggleMode = (slug: string) => {
    setNetworkModes((prev) => {
      const current = prev[slug] || "Simulated";
      const nextMode = current === "Simulated" ? "Polygon" : "Simulated";
      setActionAlert(`Tenant ${slug}: Red cambiada a modo ${nextMode === "Polygon" ? "Polygon Blockchain" : "Simulado local"}.`);
      return { ...prev, [slug]: nextMode };
    });
    setTimeout(() => setActionAlert(null), 4000);
  };

  const role = roles[selectedMode];
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

  return (
    <Card className="relative overflow-hidden p-0">
      {actionAlert && (
        <div className="absolute left-4 right-4 top-4 z-50 flex items-center justify-between rounded-xl border border-cyan-400/30 bg-slate-950/95 px-4 py-3 text-xs font-bold text-cyan-200 shadow-xl shadow-black/45">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            {actionAlert}
          </span>
          <button suppressHydrationWarning onClick={() => setActionAlert(null)} className="text-cyan-400 hover:text-white ml-2 text-sm font-black">✕</button>
        </div>
      )}
      <div className="dashboard-hero-panel dashboard-hero-panel--cyan border-b border-white/10 bg-[radial-gradient(circle_at_8%_10%,rgba(45,212,191,0.2),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(59,130,246,0.16),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(roles) as Array<keyof typeof roles>).map((key) => (
                <button
                  suppressHydrationWarning
                  key={key}
                  type="button"
                  onClick={() => setSelectedMode(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${selectedMode === key ? "border-cyan-300/55 bg-cyan-400/15 text-cyan-50" : "border-white/10 bg-slate-950/45 text-slate-300 hover:border-cyan-300/30"}`}
                >
                  {roles[key].label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-500/10 text-cyan-100">
                <RoleIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">{title}</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{role.headline}</h2>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{subtitle}</p>
                <p className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">{role.action}</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Preparacion del rollout</p>
              <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-sm font-black text-cyan-100">{stepCompletion}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
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
              <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-75">{metric.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{metric.value}</p>
              <p className="mt-2 text-xs leading-5 opacity-85">{metric.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Camino guiado</h3>
              <p className="mt-1 text-xs text-slate-400">Lo que ve un operador que no sabe de llaves, SUN ni blockchain.</p>
            </div>
            <StatusChip label={`${readySteps}/${steps.length || 0} listo`} tone={stepCompletion >= 80 ? "good" : stepCompletion >= 40 ? "warn" : "risk"} />
          </div>
          <div className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <div key={`${step.label}-${index}`} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/55 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-500/10 text-xs font-black text-cyan-100">{index + 1}</span>
                <div>
                  <p className="font-black text-white">{step.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{step.body}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <StatusChip label={step.status} tone={statusTone[step.status]} />
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">{step.owner}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Embudo de confianza</h3>
              <p className="mt-1 text-xs text-slate-400">De lote cargado a tap real, ownership y tokenizacion.</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={normalizedFunnel} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="opsTrustGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.75} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="stage" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={10} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={10} width={34} />
                    <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#e2e8f0" }} />
                    <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="url(#opsTrustGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Readiness por etapa</h3>
              <p className="mt-1 text-xs text-slate-400">Lo listo vs pendiente en manifest, tags, assets y salida comercial.</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={normalizedReadiness} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={10} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={10} width={34} />
                    <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#e2e8f0" }} />
                    <Bar dataKey="ready" stackId="a" fill="#34d399" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="pending" stackId="a" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Tenants / lotes bajo control</h3>
                <p className="mt-1 text-xs text-slate-400">Vista de auditoria para no perderse entre marcas, lotes y estados.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-200">{tenants.length} registros</span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-white/10 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Tenant / lote</th>
                    <th className="px-3 py-2">Scans</th>
                    <th className="px-3 py-2">Batches</th>
                    <th className="px-3 py-2">Tags</th>
                    <th className="px-3 py-2">Riesgo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Acciones (Superadmin)</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.length ? tenants.map((tenant) => (
                    <tr key={`${tenant.slug}-${tenant.name}`} className="border-b border-white/5 text-slate-200">
                      <td className="py-3 pr-3">
                        <b className="text-white">{tenant.name}</b>
                        <span className="mt-1 block text-slate-500">{tenant.slug}</span>
                      </td>
                      <td className="px-3 py-3">{formatNumber(tenant.scans)}</td>
                      <td className="px-3 py-3">{formatNumber(tenant.batches)}</td>
                      <td className="px-3 py-3">{formatNumber(tenant.tags)}</td>
                      <td className="px-3 py-3"><StatusChip label={`${tenant.riskScore}/100`} tone={riskTone(tenant.riskScore)} /></td>
                      <td className="px-3 py-3"><StatusChip label={pausedTenants.has(tenant.slug) ? "pausado" : tenant.status} tone={pausedTenants.has(tenant.slug) ? "risk" : tenant.status === "risk" ? "risk" : tenant.status === "pending" ? "warn" : "good"} /></td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button suppressHydrationWarning
                            type="button"
                            onClick={() => handleTogglePause(tenant.slug)}
                            className={`rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition ${
                              pausedTenants.has(tenant.slug)
                                ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                                : "border-rose-300/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                            }`}
                          >
                            {pausedTenants.has(tenant.slug) ? "Activar" : "Pausar"}
                          </button>
                          <Link
                            href={`/?tenant=${encodeURIComponent(tenant.slug)}`}
                            className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-500/20"
                          >
                            Impersonar
                          </Link>
                          <button suppressHydrationWarning
                            type="button"
                            onClick={() => handleToggleMode(tenant.slug)}
                            className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-violet-100 transition hover:bg-violet-500/20"
                          >
                            {networkModes[tenant.slug] || "Simulated"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">Sin datos reales en este scope. Crea tenant, registra batch e importa manifest para poblar la consola.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
}
