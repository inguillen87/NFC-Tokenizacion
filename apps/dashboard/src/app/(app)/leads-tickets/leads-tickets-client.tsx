"use client";

import React, { useMemo, useState } from "react";
import { Badge, Card } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import {
  Inbox,
  TrendingUp,
  MessageSquare,
  Package,
  Calendar,
  Sparkles,
  Search,
  Compass,
  Bot,
  BrainCircuit,
  Radio,
  Network,
  Tags
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

type AiQuery = {
  id: string;
  contact: string;
  vertical: string;
  company: string;
  query: string;
  answer: string;
  tag: string;
  created_at: string;
  status: string;
};

const AI_QUERY_HIGHLIGHTS = [
  "Sephora",
  "Catena Zapata",
  "Juleriaque",
  "Rutini",
  "Pergamino",
  "Santa Fe",
  "Aura",
  "Sommelier",
  "nexID",
  "NFT",
  "B2B",
  "Latam"
];

const AI_QUERY_CATEGORY_FALLBACKS = [
  "Venta Directa/Cruzada",
  "Soporte Tecnico",
  "Convenios / Alianzas",
  "Uso de Producto"
];

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
    answer: "Sin un convenio cargado por contrato, nexID no afirma alianzas con terceros. La marca puede ofrecer beneficios propios o habilitar una red autorizada donde cada bodega aprueba descuento, cupo y vigencia antes de publicarlo.",
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
    answer: "Sin contrato cargado, nexID no presenta a ninguna cadena como distribuidor oficial. El tenant puede cargar retailers autorizados y beneficios por sucursal; el CRM valida stock, puntos y permisos antes de mostrarlos al consumidor.",
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
    answer: "La ficha tecnica cargada por el tenant puede mostrar ventana de secado, recomendaciones de etiqueta, lote y canal autorizado. nexID no calcula eficacia agronomica por clima en tiempo real; registra la consulta y deriva a la documentacion aprobada o al asesor tecnico.",
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
    answer: "Las compras a granel y convenios cooperativos se publican solo si el tenant los carga como canales autorizados. nexID valida lote, zona, stock y condiciones antes de mostrar la oferta al productor.",
    tag: "B2B Lead",
    created_at: "2026-06-13",
    status: "RESPONDIDO"
  }
];

function normalizeAiQueryCategory(tag: string, query: string, answer: string) {
  const text = `${tag} ${query} ${answer}`.toLowerCase();
  if (/venta|cruzada|compra|marida|cupon|descuento|stock|club/.test(text)) return "Venta Directa/Cruzada";
  if (/soporte|tecnico|dosis|lluvia|resiste|aplicacion|calidad|uso/.test(text)) return "Soporte Tecnico";
  if (/convenio|alianza|distribu|cadena|sephora|catena|rutini|cooperativa|partner/.test(text)) return "Convenios / Alianzas";
  if (/producto|piel|fragancia|lote|origen|autentic|recomend/.test(text)) return "Uso de Producto";
  return tag || "General";
}

function renderHighlightedText(text: string) {
  if (!text) return "-";
  const escapedTerms = AI_QUERY_HIGHLIGHTS.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escapedTerms.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) => {
    const match = AI_QUERY_HIGHLIGHTS.some((term) => term.toLowerCase() === part.toLowerCase());
    return match ? (
      <mark key={`${part}-${index}`} className="rounded-md bg-cyan-400/15 px-1 py-0.5 font-black text-cyan-100 ring-1 ring-cyan-300/20">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    );
  });
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
  const [activeTab, setActiveTab] = useState<"opportunities" | "prospects" | "tickets" | "orders" | "ai_queries">("opportunities");
  const [searchTerm, setSearchTerm] = useState("");

  const leadTenant = (message: string, notes: string, tenant_slug: string) => {
    const text = `${message || ""} ${notes || ""}`;
    const pattern = /(?:\[|\b|\|\s*)tenant=([^\]\|\s]+)/i;
    const match = text.match(pattern);
    return (match?.[1] || tenant_slug || "").toLowerCase();
  };

  const parsedDbQueries = useMemo<AiQuery[]>(() => initialLeads
    .filter(l => {
      const isAiSource = l.source === "sales_chat_widget" || l.source === "assistant" || String(l.notes).toLowerCase().includes("assistant");
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
    }), [initialLeads, tenantScope]);

  const allAiQueries = useMemo<AiQuery[]>(() => [
    ...DEFAULT_AI_QUERIES.filter(q => {
      if (tenantScope) {
        const matchesScope =
          (tenantScope === "bodegas" && q.vertical === "wine") ||
          (tenantScope === "cosmetica" && q.vertical === "cosmetics") ||
          (tenantScope === "agro" && q.vertical === "agro");
        return matchesScope;
      }
      return true;
    }).map((query) => ({ ...query, status: String(query.status || "RESPONDIDO") })),
    ...parsedDbQueries
  ], [parsedDbQueries, tenantScope]);

  const filteredAiQueries = useMemo(() => allAiQueries.filter(q => {
    const searchStr = `${q.contact || ""} ${q.company || ""} ${q.query || ""} ${q.answer || ""} ${q.tag || ""}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  }), [allAiQueries, searchTerm]);

  const aiCategoryStats = useMemo(() => {
    const counts = filteredAiQueries.reduce<Record<string, number>>((acc, item) => {
      const category = normalizeAiQueryCategory(item.tag, item.query, item.answer);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    AI_QUERY_CATEGORY_FALLBACKS.forEach((category) => {
      counts[category] = counts[category] || 0;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, count]) => ({
        category,
        count,
        pct: filteredAiQueries.length ? Math.round((count / filteredAiQueries.length) * 100) : 0
      }));
  }, [filteredAiQueries]);

  const aiLiveCount = filteredAiQueries.filter((query) => /respondido|procesando|live|nuevo/i.test(query.status)).length;

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
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="relative overflow-hidden border-cyan-300/20 bg-slate-950/85 p-5">
                <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.16),transparent_62%)]" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                      <Radio className="h-4 w-4 text-cyan-300" />
                      {labels.liveQueries}
                    </p>
                    <p className="mt-3 text-4xl font-black text-white">{aiLiveCount}</p>
                    <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                      Preguntas capturadas desde Sommelier, Aura, Inspector y asistentes web. La bandeja se alimenta de leads assistant, sales_chat_widget y notas de modo asistente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
                    </span>
                    {labels.liveBeacon}
                  </div>
                </div>
                <div className="relative mt-5 grid grid-cols-3 gap-2">
                  {[
                    { label: labels.queryRadar, value: filteredAiQueries.length, icon: BrainCircuit },
                    { label: "DB", value: parsedDbQueries.length, icon: Network },
                    { label: "Demo", value: Math.max(0, allAiQueries.length - parsedDbQueries.length), icon: Bot }
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                      <metric.icon className="mb-2 h-4 w-4 text-cyan-300" />
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                      <p className="mt-1 text-lg font-black text-white">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                    <Tags className="h-4 w-4 text-amber-300" />
                    {labels.intentDistribution}
                  </h2>
                  <Badge tone="cyan">{labels.aiQueries}</Badge>
                </div>
                <div className="space-y-3">
                  {aiCategoryStats.map((item) => (
                    <div key={item.category} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-bold text-slate-200">{item.category}</span>
                        <span className="font-mono text-slate-400">{item.count} / {item.pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full border border-white/5 bg-slate-900">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-amber-300 shadow-[0_0_18px_rgba(34,211,238,0.22)]"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/75 px-5 py-4">
                <div>
                  <h2 className="text-sm font-black text-white">{labels.aiQueriesTitle}</h2>
                  <p className="mt-1 text-xs text-slate-400">{labels.assistantLedger}</p>
                </div>
                <Badge tone="cyan">{filteredAiQueries.length} registros</Badge>
              </div>

              <div className="hidden grid-cols-[0.75fr_1.15fr_1.2fr_0.45fr] gap-4 border-b border-white/10 bg-slate-900/45 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 lg:grid">
                <span>Cliente</span>
                <span>Consulta</span>
                <span>{labels.generatedAnswer}</span>
                <span>Estado</span>
              </div>

              <div className="divide-y divide-white/10">
                {filteredAiQueries.length ? filteredAiQueries.map((item) => {
                  const category = normalizeAiQueryCategory(item.tag, item.query, item.answer);
                  return (
                    <article key={item.id} className="grid gap-4 px-5 py-4 transition-colors hover:bg-cyan-400/[0.035] lg:grid-cols-[0.75fr_1.15fr_1.2fr_0.45fr]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{item.company || "-"}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">{item.contact}</p>
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{item.created_at}</p>
                      </div>

                      <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">{labels.category}: {category}</p>
                        <p className="text-sm leading-relaxed text-slate-100">{item.query}</p>
                      </div>

                      <div className="rounded-xl border border-violet-300/15 bg-violet-400/5 p-3">
                        <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">
                          <Sparkles className="h-3.5 w-3.5" />
                          {labels.aiAnswerHeader}
                        </p>
                        <p className="text-sm leading-relaxed text-slate-100">{renderHighlightedText(item.answer)}</p>
                      </div>

                      <div className="flex flex-col items-start gap-2 lg:items-end">
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                          {item.status}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          {item.vertical}
                        </span>
                      </div>
                    </article>
                  );
                }) : (
                  <div className="px-5 py-12 text-center">
                    <Bot className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-3 text-sm font-bold text-slate-300">{labels.noQueries}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {false && activeTab === "ai_queries" && (
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
