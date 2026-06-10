"use client";

import React, { useState } from "react";
import { Badge, Card, StatusChip } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import {
  Inbox,
  TrendingUp,
  MessageSquare,
  Package,
  Calendar,
  Sparkles,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Compass
} from "lucide-react";

interface Lead {
  id: string;
  name?: string;
  contact?: string;
  company?: string;
  vertical?: string;
  status?: string;
  source?: string;
  estimated_volume?: string;
  volume?: number;
  message?: string;
  notes?: string;
  created_at: string;
  email?: string;
  phone?: string;
}

interface Ticket {
  id: string;
  title: string;
  detail?: string;
  status: string;
  contact: string;
  source?: string;
  created_at: string;
}

interface Order {
  id: string;
  contact: string;
  company?: string;
  tag_type?: string;
  volume?: number;
  notes?: string;
  status: string;
  created_at: string;
}

interface LeadsTicketsClientProps {
  initialLeads: Lead[];
  initialTickets: Ticket[];
  initialOrders: Order[];
  filteredOpportunities: any[];
  tenantScope: string;
  sessionFilter: string;
  tenantFilter: string;
  copy: any;
  labels: any;
}

export default function LeadsTicketsClient({
  initialLeads,
  initialTickets,
  initialOrders,
  filteredOpportunities,
  tenantScope,
  sessionFilter,
  tenantFilter,
  copy,
  labels
}: LeadsTicketsClientProps) {
  const [activeTab, setActiveTab] = useState<"opportunities" | "prospects" | "tickets" | "orders">("opportunities");
  const [searchTerm, setSearchTerm] = useState("");

  // Pipeline count computations
  const pipelineStages = [
    { label: "Nuevo", count: initialLeads.filter((l) => l.status === "new").length + initialOrders.filter((o) => o.status === "new").length, color: "text-blue-400" },
    { label: "Calificado", count: initialLeads.filter((l) => l.status === "contacted").length, color: "text-amber-400" },
    { label: "Demo Lab", count: initialLeads.filter((l) => l.status === "demo_lab" || l.source === "demo_lab").length, color: "text-cyan-400" },
    { label: "Enviado / Pruebas", count: initialOrders.filter((o) => o.status === "processing" || o.status === "shipped").length, color: "text-indigo-400" },
    { label: "Cerrado / Ganado", count: initialLeads.filter((l) => l.status === "converted" || l.status === "closed").length + initialOrders.filter((o) => o.status === "completed").length, color: "text-emerald-400" }
  ];

  // Source distribution
  const allSources = [...initialLeads, ...initialTickets].reduce<Record<string, number>>((acc, curr) => {
    const src = curr.source || "web_bot";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});

  const totalSourcesCount = Object.values(allSources).reduce((a, b) => a + b, 0);

  const sourceColors: Record<string, string> = {
    assistant: "bg-cyan-500",
    demo_lab: "bg-purple-500",
    sales: "bg-emerald-500",
    web_bot: "bg-indigo-500"
  };

  const tabClass = (tab: typeof activeTab) =>
    `flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border ${
      activeTab === tab
        ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shadow-[0_4px_15px_rgba(6,182,212,0.1)]"
        : "bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10"
    }`;

  return (
    <div className="space-y-6">
      {/* Top HUD Cards */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {[
          { label: labels.leads, value: initialLeads.length, icon: Inbox, color: "text-blue-400" },
          { label: labels.tickets, value: initialTickets.length, icon: MessageSquare, color: "text-amber-400" },
          { label: "Reuniones", value: [...initialLeads, ...initialTickets].filter(item => /meeting|reunion|private|call|llamada/.test(('notes' in item ? item.notes : '') || ('message' in item ? item.message : '') || ('detail' in item ? item.detail : '') || "")).length, icon: Calendar, color: "text-purple-400" },
          { label: labels.orders, value: initialOrders.length, icon: Package, color: "text-indigo-400" },
          { label: labels.hot, value: filteredOpportunities.length, icon: TrendingUp, color: "text-emerald-400", highlight: true }
        ].map((stat, i) => (
          <div
            key={i}
            className={`rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 ${
              stat.highlight
                ? "bg-cyan-500/10 border-cyan-400/25 shadow-[0_4px_20px_rgba(6,182,212,0.05)]"
                : "bg-slate-950/40 border-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{stat.label}</p>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="mt-2 text-2xl font-black text-white">{stat.value}</p>
          </div>
        ))}
      </section>

      {/* CRM Pipeline Visual Funnel */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400 animate-pulse" />
            CRM Pipeline & Funnel Comercial nexID
          </h2>
          <Badge tone="cyan">Operaciones Consolidadas</Badge>
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {pipelineStages.map((stage, idx) => (
            <div key={idx} className="relative rounded-xl border border-white/5 bg-slate-900/30 p-3 flex flex-col justify-between min-h-24 hover:bg-slate-900/50 transition-colors">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Etapa {idx + 1}</span>
                <p className="text-xs font-black text-white mt-1">{stage.label}</p>
              </div>
              <p className={`text-xl font-black mt-2 text-right ${stage.color}`}>{stage.count}</p>
              
              {/* Connector line for large screens */}
              {idx < 4 && (
                <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 w-4 h-px bg-white/10 z-10" />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Grid: Sources Performance & Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-5 md:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 mb-3 flex items-center gap-2">
            <Compass className="h-4 w-4 text-purple-400" />
            Distribución de Canales de Adquisición
          </h2>
          <div className="space-y-4">
            {Object.entries(allSources).map(([source, count]) => {
              const pct = totalSourcesCount ? Math.round((count / totalSourcesCount) * 100) : 0;
              const barColor = sourceColors[source] || "bg-slate-500";
              return (
                <div key={source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white capitalize">{source.replace("_", " ")}</span>
                    <span className="text-slate-400">{count} leads ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-white/5">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {!Object.keys(allSources).length && (
              <p className="text-xs text-slate-500 text-center py-4">No hay datos de distribución todavía.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Control Comercial Lite
          </h2>
          <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
            <p>
              • <b>Leads / Prospectos:</b> Registran la demanda por industria, volumen estimado e interés en tags seguros o básicos.
            </p>
            <p>
              • <b>Tickets de Soporte:</b> Canal directo para cotizaciones, solicitudes de demo o reuniones de integración privada.
            </p>
            <p>
              • <b>Pedidos de Muestras:</b> Estado de importación física de tags de prueba y kits de onboarding comercial.
            </p>
          </div>
        </Card>
      </div>

      {/* Tab Navigation and Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 rounded-2xl bg-slate-950/70 border border-white/5">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setActiveTab("opportunities")} className={tabClass("opportunities")}>
            Oportunidades ({filteredOpportunities.length})
          </button>
          <button onClick={() => setActiveTab("prospects")} className={tabClass("prospects")}>
            Bandeja de Prospectos ({initialLeads.length})
          </button>
          <button onClick={() => setActiveTab("tickets")} className={tabClass("tickets")}>
            Tickets de Soporte ({initialTickets.length})
          </button>
          <button onClick={() => setActiveTab("orders")} className={tabClass("orders")}>
            Órdenes / Muestras ({initialOrders.length})
          </button>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar contacto, empresa o notas..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/60 text-xs text-white outline-none focus:border-cyan-500/40"
          />
        </div>
      </div>

      {/* Tab Contents */}
      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
        {activeTab === "opportunities" && (
          <DataTable
            title="Oportunidades Comerciales Activas"
            columns={[
              { key: "created_at", label: "Fecha" },
              { key: "tenant", label: "Tenant" },
              { key: "session", label: "Sesión Demo" },
              { key: "interest", label: "Interés" },
              { key: "source", label: "Fuente" },
              { key: "status", label: "Estado" },
            ]}
            rows={filteredOpportunities
              .filter(item => {
                const searchStr = `${item.tenant || ""} ${item.session || ""} ${item.interest || ""} ${item.source || ""}`.toLowerCase();
                return searchStr.includes(searchTerm.toLowerCase());
              })
              .map((item) => ({
                created_at: item.lead.created_at.slice(0, 10),
                tenant: item.tenant || "-",
                session: item.session || "-",
                interest: item.interest || "-",
                source: item.source,
                status: String(item.lead.status || "new").toUpperCase(),
              }))}
            filterKey="status"
            loadingLabel={copy.shell.loading}
            emptyLabel="No hay oportunidades comerciales con los filtros aplicados"
            searchPlaceholder="Filtrar por columna..."
            allFilterLabel={copy.shell.all}
            refreshLabel={copy.shell.refresh}
            statusMap={copy.statuses}
          />
        )}

        {activeTab === "prospects" && (
          <DataTable
            title="Bandeja General de Prospectos (CRM)"
            columns={[
              { key: "name", label: "Nombre" },
              { key: "contact", label: "Contacto" },
              { key: "company", label: "Empresa" },
              { key: "vertical", label: "Vertical" },
              { key: "status", label: "Estado" },
              { key: "source", label: "Fuente" },
              { key: "estimated", label: "Vol. Estimado" }
            ]}
            rows={initialLeads
              .filter(l => {
                const searchStr = `${l.name || ""} ${l.contact || ""} ${l.company || ""} ${l.vertical || ""} ${l.notes || ""}`.toLowerCase();
                return searchStr.includes(searchTerm.toLowerCase());
              })
              .map((item) => ({
                name: item.name || "-",
                contact: item.contact || item.email || item.phone || "-",
                company: item.company || "-",
                vertical: item.vertical || "-",
                status: String(item.status || "new").toUpperCase(),
                source: item.source || "assistant",
                estimated: item.estimated_volume || "-",
              }))}
            filterKey="status"
            loadingLabel={copy.shell.loading}
            emptyLabel="No hay prospectos registrados"
            searchPlaceholder="Filtrar..."
            allFilterLabel={copy.shell.all}
            refreshLabel={copy.shell.refresh}
            statusMap={copy.statuses}
          />
        )}

        {activeTab === "tickets" && (
          <DataTable
            title="Bandeja de Tickets y Consultas Técnicas"
            columns={[
              { key: "created_at", label: "Creado" },
              { key: "title", label: "Título" },
              { key: "detail", label: "Detalle" },
              { key: "contact", label: "Contacto" },
              { key: "status", label: "Estado" }
            ]}
            rows={initialTickets
              .filter(t => {
                const searchStr = `${t.title || ""} ${t.detail || ""} ${t.contact || ""}`.toLowerCase();
                return searchStr.includes(searchTerm.toLowerCase());
              })
              .map((item) => ({
                created_at: item.created_at.slice(0, 10),
                title: item.title,
                detail: item.detail || "-",
                contact: item.contact,
                status: String(item.status || "open").toUpperCase(),
              }))}
            filterKey="status"
            loadingLabel={copy.shell.loading}
            emptyLabel="No hay tickets de soporte activos"
            searchPlaceholder="Filtrar..."
            allFilterLabel={copy.shell.all}
            refreshLabel={copy.shell.refresh}
            statusMap={copy.statuses}
          />
        )}

        {activeTab === "orders" && (
          <DataTable
            title="Pedidos de Kits de Muestras B2B"
            columns={[
              { key: "created_at", label: "Fecha" },
              { key: "contact", label: "Contacto" },
              { key: "company", label: "Empresa" },
              { key: "tag_type", label: "Tipo Tag" },
              { key: "volume", label: "Cantidad" },
              { key: "status", label: "Estado" }
            ]}
            rows={initialOrders
              .filter(o => {
                const searchStr = `${o.contact || ""} ${o.company || ""} ${o.tag_type || ""} ${o.notes || ""}`.toLowerCase();
                return searchStr.includes(searchTerm.toLowerCase());
              })
              .map((item) => ({
                created_at: item.created_at.slice(0, 10),
                contact: item.contact,
                company: item.company || "-",
                tag_type: item.tag_type || "-",
                volume: String(item.volume || 0),
                status: String(item.status || "new").toUpperCase(),
              }))}
            filterKey="status"
            loadingLabel={copy.shell.loading}
            emptyLabel="No hay pedidos de muestras registrados"
            searchPlaceholder="Filtrar..."
            allFilterLabel={copy.shell.all}
            refreshLabel={copy.shell.refresh}
            statusMap={copy.statuses}
          />
        )}
      </div>
    </div>
  );
}
