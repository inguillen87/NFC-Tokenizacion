import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

type TagRow = {
  uid_hex: string;
  bid: string;
  tenant_slug: string;
  product_name: string | null;
  winery: string | null;
  region: string | null;
  vintage: string | null;
  tag_status: string;
  scan_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_result: string | null;
  last_city: string | null;
  last_country: string | null;
  tokenization_status: string | null;
};

async function getTags(tenant = "", source: "real" | "demo" | "imported" | "all" = "all", range: "24h" | "7d" | "30d" = "30d"): Promise<TagRow[]> {
  if (!(process.env.ADMIN_API_KEY || "").trim()) return [];
  const queryParams = new URLSearchParams();
  if (tenant) queryParams.set("tenant", tenant);
  if (source !== "all") queryParams.set("source", source);
  queryParams.set("range", range);
  queryParams.set("limit", "400");
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
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
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

export default async function TagsPage() {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const tenantScope = session.role === "tenant-admin" ? (session.tenantSlug || "") : "";
  const source = session.role === "tenant-admin" ? "real" as const : "all" as const;
  const rows = await getTags(tenantScope, source, "30d");
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.tags} title={copy.pages.tags.title} description={copy.pages.tags.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Tags muestran el activo base del negocio: inventario, activación y capacidad de protección por perfil tecnológico.", decision: "Decidís qué tecnología empuja margen, seguridad y escalabilidad por vertical o cliente.", cta: "Usalo para explicar la profundidad tecnológica detrás del producto." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Tags es la vista donde comparás perfiles, stock disponible y activación efectiva en operación.", decision: "Decidís qué perfil desplegar, dónde falta activación y qué capacidad queda para nuevas emisiones.", cta: "Leelo como catálogo operativo de hardware/identity substrate." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Tags traduce tecnología compleja a algo simple: qué tan protegido está tu producto y cuán listo está para desplegarse.", decision: "Decidís si necesitás algo básico, secure o tamper-evident según tu riesgo y experiencia deseada.", cta: "Mostralo si el cliente pregunta qué hay detrás de la experiencia mobile o de autenticidad." }}
      />
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Por qué importa</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Inventario disponible para campañas y producción.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Nivel de seguridad por perfil físico/digital.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">Activación real sobre unidades ya emitidas.</div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Registro físico real por UID</h3>
          <p className="text-xs text-slate-400">
            Scope: <b className="text-slate-200">{tenantScope || "global"}</b> · Source: <b className="text-slate-200">{source}</b> · Range: <b className="text-slate-200">30d</b>
          </p>
        </div>
        {!rows.length ? (
          <p className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-400">
            No hay tags reales para este scope todavía.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1080px] text-left text-xs">
              <thead className="border-b border-white/10 bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="px-3 py-2">UID</th>
                  <th className="px-3 py-2">BID</th>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Bodega / Región</th>
                  <th className="px-3 py-2">Status tag</th>
                  <th className="px-3 py-2">Scans</th>
                  <th className="px-3 py-2">Primera verificación</th>
                  <th className="px-3 py-2">Última ubicación verificada</th>
                  <th className="px-3 py-2">Último resultado</th>
                  <th className="px-3 py-2">Tokenización</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.bid}-${row.uid_hex}`} className="border-b border-white/5 text-slate-200">
                    <td className="px-3 py-2">
                      <Link href={`/tags/${encodeURIComponent(row.uid_hex)}?tenant=${encodeURIComponent(row.tenant_slug)}`} className="text-cyan-200 hover:text-cyan-100">
                        {row.uid_hex}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.bid}</td>
                    <td className="px-3 py-2">{row.product_name || "-"}</td>
                    <td className="px-3 py-2">{row.winery || "-"} / {row.region || "-"}</td>
                    <td className="px-3 py-2">{row.tag_status}</td>
                    <td className="px-3 py-2">{row.scan_count}</td>
                    <td className="px-3 py-2">{formatDate(row.first_seen_at)}</td>
                    <td className="px-3 py-2">{row.last_city || "-"}, {row.last_country || "-"}</td>
                    <td className="px-3 py-2">{row.last_result || "-"}</td>
                    <td className="px-3 py-2">{row.tokenization_status || "none"}</td>
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
