import Link from "next/link";
import { Card, SectionHeading, StatusChip } from "@product/ui";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { readDemoDataMetaFromResponse, type DemoDataMeta } from "../../../lib/demo-data-mode";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { getServerOrigin } from "../../../lib/server-origin";

type TagRow = {
  uidHex: string;
  bid: string;
  tenantSlug: string;
  product: { name: string; winery: string; region: string; vintage: string };
  status: { tag: string; lastResult: string };
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

async function getTags(origin: string, params: URLSearchParams): Promise<{ data: TagsResponse; meta: DemoDataMeta }> {
  const query = params.toString() ? `?${params.toString()}` : "";
  try {
    const response = await fetch(`${origin}/api/admin/tags${query}`, { cache: "no-store" });
    const meta = readDemoDataMetaFromResponse(response);
    if (!response.ok) return { data: { rows: [] }, meta };
    const data = await response.json() as TagsResponse;
    return { data: { rows: data.rows || [], totals: data.totals || {} }, meta };
  } catch {
    return { data: { rows: [] }, meta: { demoMode: false, dataSource: "production", demoSource: "production" } };
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
  const origin = await getServerOrigin();
  const query = await searchParams;
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : String(query.tenant || "");
  const source = session.role === "tenant-admin" ? "real" : (query.source || "all");
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

  const data = await getTags(origin, params);
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
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Registry real por UID: volumen, riesgo y tokenización por activo físico.", decision: "Priorizás SKU/canales con más actividad y riesgo.", cta: "Úsalo para decisiones de expansión y control." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Inventario operativo con metadata de producto, último estado y verificación real.", decision: "Podés investigar por UID/BID y saltar al passport completo.", cta: "Conecta esta vista con Events y Analytics." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Demuestra trazabilidad física con evidencia verificable por unidad.", decision: "Validás madurez operacional y gobernanza de activos.", cta: "Ideal para cierre técnico/comercial." }}
      />

      <Card className="p-5">
        <form className="grid gap-3 md:grid-cols-6">
          <input name="q" defaultValue={query.q || ""} placeholder="UID / BID / producto / status" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <select name="range" defaultValue={range} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option>
          </select>
          {session.role !== "tenant-admin" ? (
            <select name="source" defaultValue={source} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <option value="all">all</option>
              <option value="real">real</option>
              <option value="simulated">simulated</option>
            </select>
          ) : (
            <input type="hidden" name="source" value="real" />
          )}
          {session.role !== "tenant-admin" ? <input name="tenant" defaultValue={tenantScope} placeholder="tenant slug" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" /> : <input type="hidden" name="tenant" value={tenantScope} />}
          <input name="country" defaultValue={country} placeholder="country (AR, BR...)" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <input type="hidden" name="page" value="1" />
          <button className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100" type="submit">Aplicar filtros</button>
        </form>
        <p className="mt-3 text-xs text-slate-400">Scope: <b className="text-slate-200">{tenantScope || "global"}</b> · Source: <b className="text-slate-200">{source}</b> · Total: <b className="text-slate-200">{totalRows}</b> · Page: <b className="text-slate-200">{page}</b></p>
        {data.meta.demoMode ? (
          <p className="mt-2 inline-flex rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
            DEMO DATA · source={data.meta.demoSource}
          </p>
        ) : null}
        <a
          className="mt-3 inline-flex rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20"
          href={csvUrl}
          target="_blank"
          rel="noreferrer"
        >
          Export CSV (máx 1000 filas)
        </a>
      </Card>

      <Card className="p-5">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-200">Active tags<br /><b className="text-base text-emerald-300">{Number(totals.active_tags || 0)}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-200">Non-active tags<br /><b className="text-base text-amber-200">{Number(totals.non_active_tags || 0)}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-200">Minted<br /><b className="text-base text-cyan-200">{Number(totals.minted_tags || 0)}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-200">Pending tokenization<br /><b className="text-base text-slate-100">{Number(totals.pending_tokenization || 0)}</b></div>
        </div>
        {!rows.length ? (
          <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-400">No hay tags reales para este scope/filtro.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1180px] text-left text-xs">
              <thead className="border-b border-white/10 bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="px-3 py-2">UID</th><th className="px-3 py-2">BID</th><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Scans</th><th className="px-3 py-2">First seen</th><th className="px-3 py-2">Last verified</th><th className="px-3 py-2">Tokenization</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.bid}-${row.uidHex}`} className="border-b border-white/5 text-slate-200">
                    <td className="px-3 py-2"><Link href={`/tags/${encodeURIComponent(row.uidHex)}?tenant=${encodeURIComponent(row.tenantSlug)}&range=${encodeURIComponent(range)}&source=${encodeURIComponent(source)}`} className="text-cyan-200 hover:text-cyan-100">{row.uidHex}</Link></td>
                    <td className="px-3 py-2">{row.bid}</td>
                    <td className="px-3 py-2">{row.product.name}<br /><span className="text-slate-400">{row.product.winery} / {row.product.region} / {row.product.vintage}</span></td>
                    <td className="px-3 py-2"><StatusChip label={row.status.tag} tone={row.status.tag === "active" ? "good" : "warn"} /></td>
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
          {hasPrevious ? <Link className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/5" href={`/tags?${previousPage.toString()}`}>← Página anterior</Link> : <span />}
          {hasNext ? <Link className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/5" href={`/tags?${nextPage.toString()}`}>Página siguiente →</Link> : <span />}
        </div>
      </Card>
    </main>
  );
}
