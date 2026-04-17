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

async function getLiveEvents() {
  try {
    const response = await fetch(`${API_BASE}/admin/events?limit=120`, {
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
  await requireDashboardSession();
  const copy = dashboardContent[locale];
  const liveRows = await getLiveEvents();
  const rows = toUiRows(liveRows);

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.events} title={copy.pages.events.title} description={copy.pages.events.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Events muestran actividad real, alertas y evidencia de que la plataforma protege operaciones activas.", decision: "Decidís qué cuentas o verticales tienen mayor tracción o mayor riesgo operacional.", cta: "Usalo como feed vivo para probar que el sistema ya está operando y generando valor." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Events es la consola para revisar autenticaciones, replay, tamper y comportamiento en tiempo casi real.", decision: "Decidís dónde investigar anomalías, ajustar reglas y priorizar incident response.", cta: "Conectalo mentalmente con Analytics, Ops Map y API Keys." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Events demuestra que el sistema no solo promete: detecta riesgos y confirma autenticidad en escenarios reales.", decision: "Decidís si esta visibilidad mejora confianza y control en tu operación o canal.", cta: "Mostralo después del mobile preview para cerrar con evidencia operacional." }}
      />
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
          { key: "tenant", label: copy.tables.events.tenant },
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
