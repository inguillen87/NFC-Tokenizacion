import { Card, SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

type EventRow = {
  id: string | number;
  tenant_slug?: string;
  bid?: string;
  result?: string;
  reason?: string;
  uid_hex?: string;
  country_code?: string;
  city?: string;
  created_at?: string;
  source?: string;
  device_label?: string;
  meta?: Record<string, unknown>;
};

async function getLiveEvents(tenantScope = "") {
  if (!(process.env.ADMIN_API_KEY || "").trim()) {
    const demoRows: EventRow[] = [
      { id: "evt-local-001", tenant_slug: "demobodega", bid: "WINE-2026-PILOT-10", result: "VALID", reason: "sun_ok", uid_hex: "04A1B2C3D4", country_code: "AR", city: "Mendoza", created_at: new Date().toISOString(), source: "live", device_label: "Android NFC" },
      { id: "evt-local-002", tenant_slug: "demobodega", bid: "WINE-2026-PILOT-10", result: "REPLAY_SUSPECT", reason: "replay_suspect", uid_hex: "04A1B2C3D4", country_code: "AR", city: "Buenos Aires", created_at: new Date().toISOString(), source: "live", device_label: "iOS Safari" },
      { id: "evt-local-003", tenant_slug: "demoevents", bid: "EVENT-2026-01", result: "VALID", reason: "sun_ok", uid_hex: "0411223344", country_code: "BR", city: "São Paulo", created_at: new Date().toISOString(), source: "live", device_label: "Android NFC" },
    ];
    return tenantScope ? demoRows.filter((row) => row.tenant_slug === tenantScope) : demoRows;
  }
  try {
    const query = tenantScope ? `?limit=120&tenant=${encodeURIComponent(tenantScope)}` : "?limit=120";
    const response = await fetch(`${API_BASE}/admin/events${query}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [] as EventRow[];
    const data = await response.json().catch(() => []);
    return Array.isArray(data) ? (data as EventRow[]) : [];
  } catch {
    return [] as EventRow[];
  }
}

function inferTenantScope(session: { role: string; email: string }) {
  if (session.role !== "tenant-admin") return "";
  const email = session.email.toLowerCase();
  const explicit = email.match(/(?:admin|ops|tenant)[._-]([a-z0-9-]+)/)?.[1];
  if (explicit) return explicit;
  if (email.includes("demobodega")) return "demobodega";
  return "";
}

function toUiRows(rows: EventRow[]) {
  return rows.map((row) => {
    const created = row.created_at ? new Date(row.created_at) : null;
    const sunContext = row.meta && typeof row.meta === "object" ? (row.meta as { sun_context?: Record<string, unknown> }).sun_context : null;
    const timezone = sunContext && typeof sunContext === "object"
      ? String((sunContext.client as { timezone?: unknown } | undefined)?.timezone || "")
      : "";
    const mobileFlag = sunContext && typeof sunContext === "object"
      ? Boolean((sunContext.client as { mobile?: unknown } | undefined)?.mobile)
      : false;

    return {
      tenant: String(row.tenant_slug || "-"),
      result: String(row.result || "-"),
      status: String(row.result || "").toUpperCase() === "VALID" ? "active" : "risk",
      geo: [row.country_code || "", row.city || ""].filter(Boolean).join(" · ") || "--",
      time: created ? created.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "--:--",
      source: String(row.source || "real"),
      device: [row.device_label || "", timezone, mobileFlag ? "mobile" : ""].filter(Boolean).join(" · ") || "n/a",
    };
  });
}

export default async function EventsPage() {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const tenantScope = inferTenantScope(session);
  const isTenantAdmin = session.role === "tenant-admin";
  const copy = dashboardContent[locale];
  const liveRows = await getLiveEvents(tenantScope);
  const rows = toUiRows(liveRows);
  const validCount = rows.filter((item) => item.status === "active").length;
  const riskCount = rows.filter((item) => item.status === "risk").length;

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.events} title={copy.pages.events.title} description={copy.pages.events.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: isTenantAdmin ? "Vista ejecutiva del tenant con actividad real y alertas de autenticidad." : "Events muestran actividad real, alertas y evidencia de que la plataforma protege operaciones activas.", decision: isTenantAdmin ? "Decidís dónde reforzar operación del tenant y priorizar mitigación de riesgo." : "Decidís qué cuentas o verticales tienen mayor tracción o mayor riesgo operacional.", cta: "Usalo como feed vivo para probar que el sistema ya está operando y generando valor." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Events es la consola para revisar autenticaciones, replay, tamper y comportamiento en tiempo casi real.", decision: "Decidís dónde investigar anomalías, ajustar reglas y priorizar incident response.", cta: isTenantAdmin ? "Scope actual: solo tu tenant operativo." : "Conectalo mentalmente con Analytics, Ops Map y API Keys." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Events demuestra que el sistema no solo promete: detecta riesgos y confirma autenticidad en escenarios reales.", decision: "Decidís si esta visibilidad mejora confianza y control en tu operación o canal.", cta: "Mostralo después del mobile preview para cerrar con evidencia operacional." }}
      />
      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{isTenantAdmin ? "Estado operativo del tenant" : "Estado operativo global"}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">Eventos visibles<br /><b className="text-xl text-white">{rows.length}</b></div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">Valid<br /><b className="text-xl text-emerald-300">{validCount}</b></div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">Riesgo<br /><b className="text-xl text-rose-300">{riskCount}</b></div>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Cómo leer este feed</h2>
        <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><b className="text-white">valid</b><br />Autenticidad y flujo esperado.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><b className="text-white">replay_suspect</b><br />URL copiada o posible clonación/replay.</div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><b className="text-white">invalid/tamper</b><br />Apertura o manipulación sospechosa.</div>
        </div>
      </Card>
      <DataTable
        title={copy.tables.events.title}
        columns={[
          ...(!isTenantAdmin ? [{ key: "tenant", label: copy.tables.events.tenant }] : []),
          { key: "result", label: copy.tables.events.result },
          { key: "status", label: copy.tables.events.status },
          { key: "geo", label: copy.tables.events.geo },
          { key: "time", label: copy.tables.events.time },
          { key: "source", label: "Source" },
          { key: "device", label: "Device context" },
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
