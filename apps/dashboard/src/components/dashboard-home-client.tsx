"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, StatusChip } from "@product/ui";
import { AdminActionForms } from "./admin-action-forms";
import { AnalyticsPanels } from "./analytics-panels";
import { DataTable } from "./data-table";
import { ModuleGrid } from "./module-grid";
import { MultirubroOpsPanel } from "./multirubro-ops-panel";
import { OpsCommandCenter, type OpsCommandStep, type OpsCommandTenantRow } from "./ops-command-center";
import { RealtimeOpsMonitor } from "./realtime-ops-monitor";
import { VerifiedExperiencesPanel } from "./verified-experiences-panel";
import {
  LayoutDashboard,
  Cpu,
  Trophy,
  Terminal,
  Building2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  MapPin,
  Maximize2
} from "lucide-react";

interface DashboardHomeClientProps {
  session: any;
  tenantScope: string;
  isTenantAdmin: boolean;
  analyticsData: any;
  kpis: any;
  copy: any;
  labels: any;
  opsSteps: OpsCommandStep[];
  opsTenantRows: OpsCommandTenantRow[];
  initialRealtimeEvents: any[];
  successfulTaps: number;
  failedTaps: number;
  tokenizationByStatus: Record<string, number>;
  scopedTokenizationRows: any[];
  demoPacks: any[];
  publicMobileBase: string;
  overviewRows: any[];
  dashboardText: any;
  scopedBatchRows: any[];
  importedTags: number;
  activeTags: number;
  plannedTags: number;
  mintedTokens: number;
}

export default function DashboardHomeClient({
  session,
  tenantScope,
  isTenantAdmin,
  analyticsData,
  kpis,
  copy,
  labels,
  opsSteps,
  opsTenantRows,
  initialRealtimeEvents,
  successfulTaps,
  failedTaps,
  tokenizationByStatus,
  scopedTokenizationRows,
  demoPacks,
  publicMobileBase,
  overviewRows,
  dashboardText,
  scopedBatchRows,
  importedTags,
  activeTags,
  plannedTags,
  mintedTokens
}: DashboardHomeClientProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "infra" | "loyalty" | "demo" | "tenants">("summary");
  const [controlCenterOpenRequest, setControlCenterOpenRequest] = useState(0);

  const tabClass = (tab: typeof activeTab) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all select-none border ${
      activeTab === tab
        ? "bg-gradient-to-r from-cyan-600/20 to-cyan-500/10 border-cyan-500 text-cyan-300 shadow-[0_4px_20px_rgba(6,182,212,0.1)]"
        : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-900/60 hover:text-white hover:border-white/10"
    }`;

  function openControlCenter() {
    setActiveTab("summary");
    setControlCenterOpenRequest((value) => value + 1);
  }

  useEffect(() => {
    if (activeTab !== "summary" || controlCenterOpenRequest === 0) return;
    window.dispatchEvent(new Event("nexid:open-control-center"));
  }, [activeTab, controlCenterOpenRequest]);

  return (
    <div className="space-y-6">
      {/* Dynamic Tab Navigation */}
      <nav className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-white/5 backdrop-blur-xl sticky top-[72px] z-40">
        <button onClick={() => setActiveTab("summary")} className={tabClass("summary")}>
          <LayoutDashboard className="h-4 w-4" />
          {isTenantAdmin ? "Analitica CRM" : "Resumen Ejecutivo"}
        </button>
        <button
          type="button"
          onClick={openControlCenter}
          className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition-all hover:border-cyan-300/50 hover:bg-cyan-400/20"
        >
          <Maximize2 className="h-4 w-4" />
          Centro de Control
        </button>
        <button onClick={() => setActiveTab("infra")} className={tabClass("infra")}>
          <Cpu className="h-4 w-4" />
          Infraestructura NFC
        </button>
        <button onClick={() => setActiveTab("loyalty")} className={tabClass("loyalty")}>
          <Trophy className="h-4 w-4" />
          {isTenantAdmin ? "Clientes & Loyalty" : "Marketing & Loyalty"}
        </button>
        {!isTenantAdmin && (
          <button onClick={() => setActiveTab("demo")} className={tabClass("demo")}>
            <Terminal className="h-4 w-4" />
            Simulador / Demos
          </button>
        )}
        {!isTenantAdmin && (
          <button onClick={() => setActiveTab("tenants")} className={tabClass("tenants")}>
            <Building2 className="h-4 w-4" />
            Marcas & Tenants
          </button>
        )}
      </nav>

      {/* Tab Contents */}
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* SUMMARY TAB */}
        {activeTab === "summary" && (
          <div className="space-y-8">
            {/* Direct KPIs & Interactive Map */}
            <AnalyticsPanels kpis={kpis} extra={copy.analytics} data={analyticsData} mapMode={isTenantAdmin ? "tenant" : "global"} />
            
            {/* Realtime Scan Feed */}
            <RealtimeOpsMonitor
              initialEvents={initialRealtimeEvents}
              tenantScope={tenantScope}
              mode={isTenantAdmin ? "tenant" : "global"}
              labels={labels}
            />
          </div>
        )}

        {/* INFRASTRUCTURE TAB */}
        {activeTab === "infra" && (
          <div className="space-y-8">
            {/* Operations center and batch status */}
            <OpsCommandCenter
              mode={isTenantAdmin ? "tenant" : "global"}
              metrics={[
                { label: "Tenants", value: String(opsTenantRows.length), detail: tenantScope ? "Scope tenant activo" : "Marcas registradas", tone: opsTenantRows.length ? "good" : "warn" },
                { label: "Batches", value: String(scopedBatchRows.length), detail: `${importedTags.toLocaleString("es-AR")} importados`, tone: scopedBatchRows.length ? "good" : "warn" },
                { label: "Tags activos", value: activeTags.toLocaleString("es-AR"), detail: `${plannedTags.toLocaleString("es-AR")} planeados`, tone: activeTags > 0 ? "good" : "warn" },
                { label: "Riesgo", value: `${(failedTaps).toLocaleString("es-AR")}`, detail: "Alertas / Fallidos", tone: failedTaps > 5 ? "risk" : failedTaps > 0 ? "warn" : "good" },
              ]}
              steps={opsSteps}
              tenants={opsTenantRows}
              funnel={[
                { stage: "Tenants", value: opsTenantRows.length },
                { stage: "Batches", value: scopedBatchRows.length },
                { stage: "Tags", value: activeTags },
                { stage: "Taps", value: successfulTaps + failedTaps },
                { stage: "NFT", value: mintedTokens },
              ]}
              readiness={[
                { label: "Manifest", ready: importedTags, pending: Math.max(plannedTags - importedTags, 0) },
                { label: "Activación", ready: activeTags, pending: Math.max(importedTags - activeTags, 0) },
                { label: "Riesgo", ready: successfulTaps, pending: failedTaps },
                { label: "Token", ready: mintedTokens, pending: Math.max(scopedTokenizationRows.length - mintedTokens, 0) },
              ]}
            />

            {/* Polygon / tokenization details card */}
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Minter de Blockchain & Estado de Seguridad
                </h2>
                <Badge tone="cyan">Simulación Polygon Amoy</Badge>
              </div>
              <p className="mt-2 text-xs text-slate-400">Estado en tiempo real de transacciones de anclaje de autenticidad en Polygon.</p>
              
              <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4">
                <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-xs text-slate-300">
                  Taps exitosos<br /><b className="text-sm font-black text-emerald-300">{successfulTaps}</b>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-xs text-slate-300">
                  Taps fallidos<br /><b className="text-sm font-black text-rose-300">{failedTaps}</b>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-xs text-slate-300">
                  Minted / Anchored<br /><b className="text-sm font-black text-cyan-200">{Number(tokenizationByStatus.anchored || 0) + Number(tokenizationByStatus.minted || 0)}</b>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-xs text-slate-300">
                  Pendientes / Cola<br /><b className="text-sm font-black text-amber-200">{Number(tokenizationByStatus.pending || 0)}</b>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {scopedTokenizationRows.slice(0, 5).map((row: any) => {
                  const status = String(row.status || "unknown").toLowerCase();
                  const tone = status === "anchored" || status === "minted" ? "good" : status === "failed" ? "risk" : "warn";
                  return (
                    <div key={String(row.id)} className="rounded-xl border border-white/5 bg-slate-900/30 px-3 py-2 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusChip label={status} tone={tone} />
                        <span className="font-mono">{row.bid} · {row.uid_hex}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 break-all">{row.tx_hash || "Sin Tx Hash (Simulado)"}</span>
                    </div>
                  );
                })}
                {!scopedTokenizationRows.length && (
                  <p className="rounded-xl border border-dashed border-white/10 bg-slate-900/20 p-3 text-center text-xs text-slate-400">
                    No hay solicitudes de tokenización registradas en este lote.
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* MARKETING & LOYALTY TAB */}
        {activeTab === "loyalty" && (
          <div className="space-y-8">
            {!isTenantAdmin ? <MultirubroOpsPanel /> : null}
            <VerifiedExperiencesPanel />
            
            {/* Quick access grid for marketing features */}
            <ModuleGrid
              actionLabel={copy.shell.openModule}
              modules={isTenantAdmin
                ? [
                    { title: "Catálogo de Beneficios", description: "Configurá premios y descuentos para tus usuarios.", href: "/loyalty/rewards", status: "activo", tone: "green" as const },
                    { title: "Loyalty Studio", description: "Diseñá las reglas comerciales de acumulación de puntos.", href: "/loyalty", status: "activo", tone: "green" as const },
                    { title: "Onboarding Setup", description: "Configuración guiada para nuevos tenants.", href: "/onboarding", status: "activo", tone: "green" as const },
                  ]
                : [
                    { title: "Catálogo de Beneficios", description: "Configurá premios y descuentos para tus usuarios.", href: "/loyalty/rewards", status: "activo", tone: "green" as const },
                    { title: "Loyalty Studio", description: "Diseñá las reglas comerciales de acumulación de puntos.", href: "/loyalty", status: "activo", tone: "green" as const },
                    { title: "Configuración Multirubros", description: "Alternar entre bodegas, cosmética, farma y eventos.", href: "/onboarding", status: "activo", tone: "green" as const },
                  ]}
            />
          </div>
        )}

        {/* DEMO / SIMULATION TAB (SUPER/RESELLER ADMIN ONLY) */}
        {activeTab === "demo" && !isTenantAdmin && (
          <div className="space-y-8">
            {/* Demo Orchestrator */}
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  10 Escenarios Demo Pack Listos
                </h2>
                <Link href="/demo-lab" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20">
                  Consola Demo Lab
                </Link>
              </div>
              <p className="mt-2 text-xs text-slate-400">Packs de prueba configurados para auditoría B2B, pitch comercial y simulaciones rápidas.</p>
              
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {demoPacks.map((pack) => (
                  <div key={pack.key} className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 flex flex-col justify-between group hover:border-cyan-500/30 transition-all">
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">{pack.label}</p>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono">Tenant: {pack.tenant}</p>
                    </div>
                    <div className="mt-4 space-y-2">
                      <a
                        href={`${publicMobileBase}/${pack.tenant}/${pack.itemId}?pack=${encodeURIComponent(pack.key)}&demoMode=consumer_tap`}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full text-center rounded-xl border border-white/10 bg-white/5 py-2 text-xs text-slate-200 hover:bg-white/10 transition-colors"
                      >
                        Vista Celular (Público)
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Guía de Simulación del Ciclo de Vida</h2>
                <span className="text-xs text-slate-400">Simulación interactiva paso a paso</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-xs text-slate-300">
                  <p className="font-bold text-white mb-1">1) Elegí el vertical</p>
                  <p className="leading-relaxed">Selecciona el pack de demostración de bodega, eventos o farma en Marketing & Loyalty.</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-xs text-slate-300">
                  <p className="font-bold text-white mb-1">2) Importá y activá</p>
                  <p className="leading-relaxed">Ve a la pestaña de Infraestructura NFC y simula el import de lotes y activación de llaves NTAG.</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-xs text-slate-300">
                  <p className="font-bold text-white mb-1">3) Hacé el Tap</p>
                  <p className="leading-relaxed">Escanea simulado en la vista móvil y mira en vivo cómo impacta la geolocalización en el mapa.</p>
                </div>
              </div>
            </Card>

            {/* Admin Action Forms */}
            <AdminActionForms copy={dashboardText.forms} roles={copy.roles} readyLabel={copy.shell.ready} currentRole={session.role} />
          </div>
        )}

        {/* BRANDS & TENANTS TAB */}
        {activeTab === "tenants" && !isTenantAdmin && (
          <div className="space-y-8">
            <DataTable
              title={copy.tables.tenants.title}
              columns={[
                { key: "tenant", label: copy.tables.tenants.tenant },
                { key: "status", label: copy.tables.tenants.status },
                { key: "riskScore", label: "Score de Riesgo" },
                { key: "scans", label: kpis.scans },
                { key: "duplicates", label: kpis.duplicates },
                { key: "tamper", label: kpis.tamper },
              ]}
              rows={overviewRows}
              filterKey="status"
              loadingLabel={copy.shell.loading}
              emptyLabel={copy.shell.empty}
              searchPlaceholder={copy.shell.search}
              allFilterLabel={copy.shell.all}
              refreshLabel={copy.shell.refresh}
              statusMap={copy.statuses}
            />
          </div>
        )}
      </div>
    </div>
  );
}
