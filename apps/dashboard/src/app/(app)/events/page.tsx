import { Card, SectionHeading, StatusChip } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

type EventRow = {
  id: number;
  tenantSlug: string;
  bid: string;
  uidHex: string;
  result: string;
  reason: string;
  source: string;
  readCounter: number;
  createdAt: string;
  location: { city: string; country: string; lat: number | null; lng: number | null };
  device: { label: string; os: string; browser: string; deviceType: string; timezone: string; mobile: boolean };
};

async function getLiveEvents(params: URLSearchParams): Promise<EventRow[]> {
  if (!(process.env.ADMIN_API_KEY || "").trim()) return [];
  try {
    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`${API_BASE}/admin/events${query}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json().catch(() => ({ rows: [] }));
    return Array.isArray(data?.rows) ? (data.rows as EventRow[]) : [];
  } catch {
    return [];
  }
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const query = await searchParams;
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : String(query.tenant || "");
  const isTenantAdmin = session.role === "tenant-admin";
  const source = isTenantAdmin ? "real" : String(query.source || "all");
  const range = String(query.range || "30d");

  const params = new URLSearchParams();
  if (tenantScope) params.set("tenant", tenantScope);
  if (query.uid) params.set("uid", String(query.uid).toUpperCase());
  if (query.bid) params.set("bid", String(query.bid));
  if (query.result) params.set("result", String(query.result).toUpperCase());
  if (source !== "all") params.set("source", source);
  if (range) params.set("range", range);
  params.set("limit", "250");

  const copy = dashboardContent[locale];
  const liveRows = await getLiveEvents(params);
  const validCount = liveRows.filter((item) => item.result === "VALID").length;
  const riskCount = liveRows.filter((item) => item.result !== "VALID").length;

  const rows = liveRows.map((row) => ({
    tenant: row.tenantSlug || "-",
    uid: row.uidHex,
    bid: row.bid,
    result: row.result,
    status: row.result === "VALID" ? "active" : "risk",
    geo: `${row.location.city}, ${row.location.country}`,
    device: `${row.device.os} · ${row.device.browser}`,
    deviceType: row.device.deviceType,
    timezone: row.device.timezone,
    source: row.source,
    reason: row.reason || "-",
    time: new Date(row.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }),
  }));

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.events} title={copy.pages.events.title} description={copy.pages.events.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: isTenantAdmin ? "Vista ejecutiva del tenant con actividad real y alertas de autenticidad." : "Events muestran actividad real, alertas y evidencia de protección operacional.", decision: "Priorizás mitigación de riesgo con evidencia real por tap.", cta: "Úsalo como feed vivo para operación y auditoría." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Consola cruda para revisar autenticaciones, replay, tamper y contexto de dispositivo.", decision: "Investigás anomalías por UID/BID/resultado y contexto técnico.", cta: isTenantAdmin ? "Scope actual: solo tu tenant." : "Scope configurable multi-tenant." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Demuestra que la plataforma detecta señales reales en calle.", decision: "Validás nivel de control y trazabilidad operativa.", cta: "Cerrar conversación con evidencia verificable." }}
      />

      <Card className="p-5">
        <form className="grid gap-3 md:grid-cols-6">
          <input name="uid" defaultValue={query.uid || ""} placeholder="UID" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <input name="bid" defaultValue={query.bid || ""} placeholder="BID" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <input name="result" defaultValue={query.result || ""} placeholder="VALID / TAMPER..." className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <select name="range" defaultValue={range} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option></select>
          {!isTenantAdmin ? <input name="tenant" defaultValue={tenantScope} placeholder="tenant slug" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" /> : <input type="hidden" name="tenant" value={tenantScope} />}
          <button className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100" type="submit">Aplicar filtros</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
          <StatusChip label={`Events ${liveRows.length}`} tone="neutral" />
          <StatusChip label={`Valid ${validCount}`} tone="good" />
          <StatusChip label={`Risk ${riskCount}`} tone="risk" />
          <StatusChip label={`Scope ${tenantScope || "global"}`} tone="neutral" />
        </div>
      </Card>

      <DataTable
        title={copy.tables.events.title}
        columns={[
          ...(!isTenantAdmin ? [{ key: "tenant", label: copy.tables.events.tenant }] : []),
          { key: "uid", label: "UID" },
          { key: "bid", label: "BID" },
          { key: "result", label: copy.tables.events.result },
          { key: "status", label: copy.tables.events.status },
          { key: "geo", label: copy.tables.events.geo },
          { key: "device", label: "OS/Browser" },
          { key: "deviceType", label: "Device type" },
          { key: "timezone", label: "Timezone" },
          { key: "source", label: "Source" },
          { key: "reason", label: "Reason" },
          { key: "time", label: copy.tables.events.time },
        ]}
        rows={rows}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />
    </main>
  );
}
