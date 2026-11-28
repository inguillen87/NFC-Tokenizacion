import Link from "next/link";
import { Card, SectionHeading, StatusChip } from "@product/ui";
import { EnterpriseOpsState } from "../../../components/enterprise-ops-state";
import { dashboardContent } from "../../../lib/dashboard-content";
import { readDemoDataMetaFromResponse, type DemoDataMeta } from "../../../lib/demo-data-mode";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";

type TagRow = {
  uidHex: string;
  bid: string;
  tenantSlug: string;
  product: { name: string; winery: string; region: string; vintage: string };
  status: { tag: string; operational?: string; lifecycle?: string; lifecycleRevision?: number; lastResult: string };
  scans: { count: number; firstSeenAt: string | null; lastSeenAt: string | null };
  lastVerifiedLocation: { city: string; country: string };
  tokenization: { status: string; network: string; txHash: string | null; tokenId: string | null };
};

type TagsResponse = {
  rows: TagRow[];
  totals?: {
    total?: number;
    active_tags?: number;
    non_active_tags?: number;
    minted_tags?: number;
    pending_tokenization?: number;
  };
};

type TagsAvailability = "ready" | "upstream_error" | "invalid_payload" | "unreachable";

async function getTags(context: AdminPageContext, params: URLSearchParams): Promise<{ data: TagsResponse; meta: DemoDataMeta; availability: TagsAvailability }> {
  const query = params.toString() ? `?${params.toString()}` : "";
  try {
    const response = await fetchAdminPage(context, `tags${query}`);
    const meta = readDemoDataMetaFromResponse(response);
    if (!response.ok) return { data: { rows: [] }, meta, availability: "upstream_error" };
    const data = await response.json().catch(() => null) as TagsResponse | null;
    if (!data || !Array.isArray(data.rows)) return { data: { rows: [] }, meta, availability: "invalid_payload" };
    return { data: { rows: data.rows, totals: data.totals || {} }, meta, availability: "ready" };
  } catch {
    return { data: { rows: [] }, meta: { demoMode: false, dataSource: "production", demoSource: "production" }, availability: "unreachable" };
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function pageParams(query: Record<string, string | undefined>, nextPage: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (!value) continue;
    params.set(key, value);
  }
  params.set("page", String(nextPage));
  return params;
}

export default async function TagsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const query = await searchParams;
  const adminContext = await createAdminPageContext(session, query.tenant);
  const tenantScope = adminContext.tenantSlug;
  const source = adminContext.canSelectTenant ? (query.source || "all") : "real";
  const range = (query.range || "30d") as "24h" | "7d" | "30d";
  const country = query.country || "";
  const text = (query.q || "").toLowerCase().trim();
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = 100;
  const offset = (page - 1) * pageSize;

  const params = new URLSearchParams();
  if (tenantScope) params.set("tenant", tenantScope);
  if (source !== "all") params.set("source", source);
  if (range) params.set("range", range);
  if (country) params.set("country", country.toUpperCase());
  if (text) params.set("q", text);
  params.set("limit", String(pageSize));
  params.set("offset", String(offset));

  const data = await getTags(adminContext, params);
  const sourceReady = data.availability === "ready";
  const rows = data.data.rows;
  const totals = data.data.totals || {};
  const totalRows = Number(totals.total || 0);
  const hasPrevious = page > 1;
  const hasNext = offset + rows.length < totalRows;
  const previousPage = pageParams(query, Math.max(page - 1, 1));
  const nextPage = pageParams(query, page + 1);
  const csvParams = new URLSearchParams(params);
  csvParams.set("offset", "0");
  csvParams.set("limit", "1000");
  csvParams.set("format", "csv");
  const csvUrl = `/api/admin/tags?${csvParams.toString()}`;
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.tags} title={copy.pages.tags.title} description={copy.pages.tags.description} />
      <nav aria-label="Configurar tags en cuatro pasos" data-testid="tags-setup-guide" className="grid gap-3 md:grid-cols-4">
        {[
          { n: 1, title: "Pedir tags", hint: "NTAG 424 DNA a fábrica", href: "/batches/supplier?intent=new" },
          { n: 2, title: "Recibir el lote", hint: "Asignar producto y lote", href: "/batches" },
          { n: 3, title: "Probar un toque", hint: "Celular sobre la etiqueta", href: "/events" },
          { n: 4, title: "Medir lecturas", hint: "Países, alertas, tendencia", href: "/analytics" },
        ].map((step) => (
          <Link key={step.n} prefetch={false} href={step.href} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-3 transition hover:-translate-y-0.5 hover:border-cyan-300/40 motion-reduce:transform-none">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-sm font-black text-slate-950">{step.n}</span>
            <span className="min-w-0"><b className="block text-sm text-slate-200">{step.title}</b><span className="block text-xs text-slate-400">{step.hint}</span></span>
            <span aria-hidden className="ml-auto text-cyan-300 transition group-hover:translate-x-0.5">→</span>
          </Link>
        ))}
      </nav>

      {!sourceReady ? (
        <EnterpriseOpsState
          variant="error"
          title="El registro de tags no está disponible"
          description="La plataforma no reemplaza una falla de la API por inventario, tokenización o actividad igual a cero. Los filtros siguen disponibles para reintentar con el mismo scope."
          checklist={[`Estado de fuente: ${data.availability}`, "Métricas, exportación y paginación permanecen sin afirmar valores."]}
          action={<a href="/tags" className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-100">Reintentar registro</a>}
          testId="tags-source-unavailable"
        />
      ) : null}

      <Card className="p-5">
        <form className="grid gap-3 md:grid-cols-6">
          <input suppressHydrationWarning name="q" defaultValue={query.q || ""} placeholder="UID, lote o producto" aria-label="Buscar UID, lote o producto" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <select suppressHydrationWarning aria-label="Período" name="range" defaultValue={range} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <option value="24h">Últimas 24 h</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option>
          </select>
          {adminContext.canSelectTenant ? (
            <select suppressHydrationWarning name="source" defaultValue={source} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <option value="all">Todas las fuentes</option>
              <option value="real">Reales</option>
              <option value="simulated">Simuladas</option>
            </select>
          ) : (
            <input suppressHydrationWarning type="hidden" name="source" value="real" />
          )}
          {adminContext.canSelectTenant ? <input suppressHydrationWarning name="tenant" defaultValue={tenantScope} placeholder="Cliente (slug)" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" /> : <input suppressHydrationWarning type="hidden" name="tenant" value={tenantScope} />}
          <input suppressHydrationWarning name="country" defaultValue={country} placeholder="País (AR, BR…)" aria-label="País" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <input suppressHydrationWarning type="hidden" name="page" value="1" />
          <button suppressHydrationWarning className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100" type="submit">Aplicar filtros</button>
        </form>
        <p className="mt-3 text-xs text-slate-400">Cliente: <b className="text-slate-200">{tenantScope || "todos"}</b> · Fuente: <b className="text-slate-200">{source === "all" ? "todas" : source === "real" ? "reales" : "simuladas"}</b> · Tags: <b className="text-slate-200">{sourceReady ? totalRows : "no disponible"}</b> · Página <b className="text-slate-200">{page}</b></p>
        {data.meta.demoMode ? (
          <p className="mt-2 inline-flex rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
            Datos de demostración
          </p>
        ) : null}
        {sourceReady ? <a
          className="mt-3 inline-flex rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20"
          href={csvUrl}
          target="_blank"
          rel="noreferrer"
        >
          Exportar CSV · hasta 1000 filas
        </a> : null}
      </Card>

      <Card className="p-5">
        {(() => {
          const active = sourceReady ? Number(totals.active_tags || 0) : null;
          const idle = sourceReady ? Number(totals.non_active_tags || 0) : null;
          const minted = sourceReady ? Number(totals.minted_tags || 0) : null;
          const pending = sourceReady ? Number(totals.pending_tokenization || 0) : null;
          const pct = (part: number | null, other: number | null) => (part === null || other === null || part + other === 0 ? 0 : Math.round((part / (part + other)) * 100));
          const cards = [
            { label: "Activos", value: active, tone: "text-emerald-300", bar: "from-emerald-400 to-teal-400", share: pct(active, idle), note: "del inventario" },
            { label: "Sin activar", value: idle, tone: "text-amber-200", bar: "from-amber-300 to-orange-400", share: pct(idle, active), note: "esperan su primer toque" },
            { label: "Con registro digital", value: minted, tone: "text-cyan-200", bar: "from-cyan-400 to-sky-500", share: pct(minted, pending), note: "tokenizados" },
            { label: "Registro pendiente", value: pending, tone: "text-slate-200", bar: "from-slate-400 to-slate-500", share: pct(pending, minted), note: "en cola" },
          ];
          return (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="tags-kpis">
              {cards.map((card) => (
                <div key={card.label} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-xs font-semibold text-slate-400">{card.label}</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums ${card.tone}`}>{card.value === null ? "—" : card.value.toLocaleString("es-AR")}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700/40" aria-hidden>
                    <div className={`h-full rounded-full bg-gradient-to-r ${card.bar} transition-[width] duration-700`} style={{ width: `${card.share}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{card.value === null ? "Sin dato confirmado" : `${card.share}% ${card.note}`}</p>
                </div>
              ))}
            </div>
          );
        })()}
        <p className="mb-3 text-xs text-slate-400">Cada fila muestra trazabilidad digital de eventos por unidad; no prueba recorrido ni estado físico.</p>
        {!rows.length ? (
          <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-400">{sourceReady ? "La fuente no devolvió tags para este scope/filtro." : "La fuente no pudo cargarse; este estado no representa inventario cero."}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1180px] text-left text-xs">
              <thead className="border-b border-white/10 bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="px-3 py-2">UID</th><th className="px-3 py-2">Lote</th><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Eventos</th><th className="px-3 py-2">Primer evento</th><th className="px-3 py-2">Última ubicación reportada</th><th className="px-3 py-2">Tokenización digital</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.bid}-${row.uidHex}`} className="border-b border-white/5 text-slate-200">
                    <td className="px-3 py-2"><Link href={`/tags/${encodeURIComponent(row.uidHex)}?tenant=${encodeURIComponent(row.tenantSlug)}&range=${encodeURIComponent(range)}&source=${encodeURIComponent(source)}`} className="text-cyan-200 hover:text-cyan-100">{row.uidHex}</Link></td>
                    <td className="px-3 py-2">{row.bid}</td>
                    <td className="px-3 py-2">{row.product.name}<br /><span className="text-slate-400">{row.product.winery} / {row.product.region} / {row.product.vintage}</span></td>
                    <td className="px-3 py-2"><StatusChip label={row.status.lifecycle || row.status.tag} tone={(row.status.lifecycle || row.status.tag) === "active" ? "good" : "warn"} /><br /><span className="text-slate-500">operativo: {row.status.operational || row.status.tag} · rev. {row.status.lifecycleRevision || 0}</span></td>
                    <td className="px-3 py-2">{row.scans.count}</td>
                    <td className="px-3 py-2">{formatDate(row.scans.firstSeenAt)}</td>
                    <td className="px-3 py-2">{row.lastVerifiedLocation.city}, {row.lastVerifiedLocation.country}<br /><span className="text-slate-400">{formatDate(row.scans.lastSeenAt)}</span></td>
                    <td className="px-3 py-2"><StatusChip label={row.tokenization.status} tone={row.tokenization.status === "minted" ? "good" : "neutral"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
          {sourceReady && hasPrevious ? <Link className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/5" href={`/tags?${previousPage.toString()}`}>← Página anterior</Link> : <span />}
          {sourceReady && hasNext ? <Link className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/5" href={`/tags?${nextPage.toString()}`}>Página siguiente →</Link> : <span />}
        </div>
      </Card>
    </main>
  );
}
