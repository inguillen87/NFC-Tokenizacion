import Link from "next/link";
import { Card, SectionHeading, StatusChip } from "@product/ui";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

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

async function getTags(params: URLSearchParams): Promise<TagRow[]> {
  if (!(process.env.ADMIN_API_KEY || "").trim()) return [];
  const query = params.toString() ? `?${params.toString()}` : "";
  try {
    const response = await fetch(`${API_BASE}/admin/tags${query}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json() as { rows?: TagRow[] };
    return data.rows || [];
  } catch {
    return [];
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

export default async function TagsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const query = await searchParams;
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : String(query.tenant || "");
  const source = session.role === "tenant-admin" ? "real" : (query.source || "all");
  const range = (query.range || "30d") as "24h" | "7d" | "30d";
  const country = query.country || "";
  const text = (query.q || "").toLowerCase().trim();

  const params = new URLSearchParams();
  if (tenantScope) params.set("tenant", tenantScope);
  if (source !== "all") params.set("source", source);
  if (range) params.set("range", range);
  if (country) params.set("country", country.toUpperCase());
  params.set("limit", "500");

  const rows = await getTags(params);
  const filtered = rows.filter((row) => {
    if (!text) return true;
    const haystack = [row.uidHex, row.bid, row.product.name, row.product.winery, row.product.region, row.status.tag, row.tokenization.status, row.lastVerifiedLocation.city, row.lastVerifiedLocation.country].join(" ").toLowerCase();
    return haystack.includes(text);
  });
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
        <form className="grid gap-3 md:grid-cols-5">
          <input name="q" defaultValue={query.q || ""} placeholder="UID / BID / producto / status" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <select name="range" defaultValue={range} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
            <option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option>
          </select>
          {session.role !== "tenant-admin" ? <input name="tenant" defaultValue={tenantScope} placeholder="tenant slug" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" /> : <input type="hidden" name="tenant" value={tenantScope} />}
          <input name="country" defaultValue={country} placeholder="country (AR, BR...)" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <button className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100" type="submit">Aplicar filtros</button>
        </form>
        <p className="mt-3 text-xs text-slate-400">Scope: <b className="text-slate-200">{tenantScope || "global"}</b> · Source: <b className="text-slate-200">{source}</b> · Rows: <b className="text-slate-200">{filtered.length}</b></p>
      </Card>

      <Card className="p-5">
        {!filtered.length ? (
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
                {filtered.map((row) => (
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
      </Card>
    </main>
  );
}
