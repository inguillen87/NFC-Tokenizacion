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
  role_interest?: string;
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

const DEFAULT_AI_QUERIES = [
  {
    id: "q-b1",
    contact: "juan.perez@cava.com",
    vertical: "wine",
    company: "Restaurante El Faro",
    query: "Tengo una cena con carne asada y quiero quedar bien. ¿Este blend de Mendoza va bien o me recomiendan el Cabernet Sauvignon de su bodega?",
    answer: "Sí, este Gran Blend 2026 marida de forma excepcional con carnes rojas a la brasa. Si querés una alternativa más estructurada, nuestro Cabernet Sauvignon Reserva es una excelente opción. Además, por convenio, podés adquirirlo con 15% off en el club.",
    tag: "Venta Directa",
    created_at: "2026-06-13",
    status: "RESPONDIDO"
  },
  {
    id: "q-b2",
    contact: "marta.gomez@vinos.cl",
    vertical: "wine",
    company: "Distribuidora Los Andes",
    query: "¿Tienen convenios o alianzas con otras bodegas como Catena Zapata o Rutini para visitas guiadas en Luján de Cuyo?",
    answer: "Sí, formamos parte de la Alianza de Cavas Premium de Mendoza. Al presentar tu ticket NFT de nexID, accedés a un 20% de descuento en el tour enológico de Bodega Catena Zapata.",
    tag: "Alianza B2B",
    created_at: "2026-06-13",
    status: "RESPONDIDO"
  },
  {
    id: "q-c1",
    contact: "sofia.beauty@gmail.com",
    vertical: "cosmetics",
    company: "Estética Integral",
    query: "¿Qué otros productos parecidos recomiendan si tengo piel extremadamente seca y sensible?",
    answer: "Para piel seca, recomendamos complementar Elysian Elixir con nuestra Crema Facial Hidratante Aura con ácido hialurónico. El escaneo de este frasco te otorga un cupón de 10% de descuento para esa compra.",
    tag: "Venta Cruzada",
    created_at: "2026-06-13",
    status: "RESPONDIDO"
  },
  {
    id: "q-c2",
    contact: "compras@juleriaque.com.ar",
    vertical: "cosmetics",
    company: "Perfumerías Juleriaque",
    query: "¿Tienen convenios de distribución o alianzas exclusivas con cadenas como Sephora o Juleriaque en Latam?",
    answer: "¡Exacto! Juleriaque es nuestro distribuidor oficial en Latam. Escaneando el chip en cualquier sucursal física, podés acumular el doble de puntos de fidelidad en tu pasaporte digital nexID.",
    tag: "Distribución",
    created_at: "2026-06-13",
    status: "RESPONDIDO"
  },
  {
    id: "q-a1",
    contact: "ing.agro@pergamino.com",
    vertical: "agro",
    company: "Establecimiento Don Luis",
    query: "Si llueve en unas dos horas, ¿el BioGuard Max 500 resiste el lavado o pierdo la aplicación en el cultivo?",
    answer: "BioGuard Max posee un agente adherente de rápida absorción que se fija en la cutícula foliar en solo 45 minutos. Si la lluvia es menor a 15mm transcurrida una hora, el activo mantiene un 92% de efectividad.",
    tag: "Soporte Técnico",
    created_at: "2026-06-13",
    status: "RESPONDIDO"
  },
  {
    id: "q-a2",
    contact: "cooperativa@pergamino.org",
    vertical: "agro",
    company: "Cooperativa Agrícola Pergamino",
    query: "¿Tienen convenios con cooperativas locales en Pergamino o Santa Fe para compras a granel de este lote?",
    answer: "Sí, tenemos convenios de distribución directa con la Cooperativa Agrícola de Pergamino y la AFA en Santa Fe. Podes transferir tu token de lote digital directamente a sus cuentas para retirar mercadería.",
    tag: "B2B Lead",
    created_at: "2026-06-13",
    status: "RESPONDIDO"
  }
];

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
  const [activeTab, setActiveTab] = useState<"opportunities" | "prospects" | "tickets" | "orders" | "ai_queries">("opportunities");
  const [searchTerm, setSearchTerm] = useState("");

  const leadTenant = (message: string, notes: string, tenant_slug: string) => {
    const text = `${message || ""} ${notes || ""}`;
    const pattern = /(?:\[|\b|\|\s*)tenant=([^\]\|\s]+)/i;
    const match = text.match(pattern);
    return (match?.[1] || tenant_slug || "").toLowerCase();
  };

  const parsedDbQueries = initialLeads
    .filter(l => {
      const isAiSource = l.source === "sales_chat_widget" || l.source === "assistant" || String(l.notes).includes("assistant");
      if (!isAiSource) return false;
      if (tenantScope) {
        const slug = leadTenant(l.message || "", l.notes || "", l.vertical || "");
        return slug === tenantScope;
      }
      return true;
    })
    .map((l, index) => {
      const cleanNotes = String(l.notes || "");
      const answer = cleanNotes.replace("assistant_mode=web_widget", "").trim() || "Respuesta automática procesada por nexID AI.";
      return {
        id: l.id || `q-db-${index}`,
        contact: l.contact || l.email || l.phone || "-",
        vertical: l.vertical || "other",
        company: l.company || "-",
        query: l.message || "Consulta general",
        answer: answer,
        tag: String(l.role_interest || "General").toUpperCase(),
        created_at: l.created_at.slice(0, 10),
        status: "RESPONDIDO"
      };
    });

  const allAiQueries = [
    ...DEFAULT_AI_QUERIES.filter(q => {
      if (tenantScope) {
        const matchesScope =
          (tenantScope === "bodegas" && q.vertical === "wine") ||
          (tenantScope === "cosmetica" && q.vertical === "cosmetics") ||
          (tenantScope === "agro" && q.vertical === "agro");
        return matchesScope;
      }
      return true;
    }),
    ...parsedDbQueries
  ];

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
          <button onClick={() => setActiveTab("ai_queries")} className={tabClass("ai_queries")}>
            {labels.aiQueries} ({allAiQueries.length})
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

        {activeTab === "ai_queries" && (
          <DataTable
            title={labels.aiQueriesTitle}
            columns={[
              { key: "created_at", label: "Fecha" },
              { key: "contact", label: "Contacto" },
              { key: "company", label: "Empresa" },
              { key: "query", label: "Consulta / Pregunta" },
              { key: "tag", label: "Categoría" },
              { key: "status", label: "Estado" }
            ]}
            rows={allAiQueries
              .filter(q => {
                const searchStr = `${q.contact || ""} ${q.company || ""} ${q.query || ""} ${q.tag || ""}`.toLowerCase();
                return searchStr.includes(searchTerm.toLowerCase());
              })
              .map((item) => ({
                created_at: item.created_at,
                contact: item.contact,
                company: item.company,
                query: `💬 ${item.query}\n\n🤖 ${labels.aiAnswerHeader}:\n${item.answer}`,
                tag: item.tag,
                status: item.status,
              }))}
            filterKey="status"
            loadingLabel={copy.shell.loading}
            emptyLabel="No hay consultas registradas"
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
