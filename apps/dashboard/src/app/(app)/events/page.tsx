import { Card, SectionHeading, StatusChip } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { EnterpriseOpsState } from "../../../components/enterprise-ops-state";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { dashboardHighImpactPermissionMatches } from "../../../lib/permission-policy";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";
import { isRealtimeRisk } from "../../../lib/realtime-feed";
import { normalizeTenantTapRealtimeEvent } from "@product/core";

type EventRow = {
  id: number;
  tenantSlug: string;
  bid: string;
  uidHex: string;
  tenantId?: string | null;
  batchId?: string | null;
  tagId?: string | null;
  result: string;
  verdict?: string | null;
  riskLevel?: string | null;
  eventType?: string | null;
  cmacOk?: boolean | null;
  allowlisted?: boolean | null;
  reason: string;
  source: string;
  readCounter: number;
  createdAt: string;
  location: { city: string; country: string; lat: number | null; lng: number | null };
  device: { label: string; os: string; browser: string; deviceType: string; timezone: string; mobile: boolean };
};

type EventsResult = {
  availability: "ready" | "upstream_error" | "invalid_payload" | "unreachable";
  rows: EventRow[];
};

async function getLiveEvents(context: AdminPageContext, params: URLSearchParams): Promise<EventsResult> {
  try {
    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await fetchAdminPage(context, `events${query}`);
    if (!response.ok) return { availability: "upstream_error", rows: [] };
    const data = await response.json().catch(() => null) as { rows?: unknown } | null;
    if (!data || !Array.isArray(data.rows)) return { availability: "invalid_payload", rows: [] };
    return { availability: "ready", rows: data.rows as EventRow[] };
  } catch {
    return { availability: "unreachable", rows: [] };
  }
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const copy = dashboardContent[locale];
  const canReadSensitiveEvents = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "events.read_sensitive",
    session.deniedPermissions,
  );
  if (!canReadSensitiveEvents) {
    return (
      <main className="space-y-8">
        <SectionHeading eyebrow={copy.nav.events} title={copy.pages.events.title} description={copy.pages.events.description} />
        <EnterpriseOpsState
          variant="warning"
          title="Acceso restringido al feed sensible"
          description="Esta sesión no tiene la capacidad events.read_sensitive. El servidor no consultó eventos, ubicaciones, dispositivos ni metadata NFC."
          checklist={[
            "Solicitá la capacidad al administrador del tenant.",
            "Las denegaciones explícitas prevalecen sobre cualquier permiso concedido.",
          ]}
          testId="events-access-denied"
        />
      </main>
    );
  }
  const query = await searchParams;
  const adminContext = await createAdminPageContext(session, query.tenant);
  const tenantScope = adminContext.tenantSlug;
  const isTenantBound = !adminContext.canSelectTenant;
  const isTenantAdmin = isTenantBound;
  const source = isTenantBound ? "real" : String(query.source || "all");
  const range = String(query.range || "30d");

  const params = new URLSearchParams();
  if (tenantScope) params.set("tenant", tenantScope);
  if (query.uid) params.set("uid", String(query.uid).toUpperCase());
  if (query.bid) params.set("bid", String(query.bid));
  if (query.result) params.set("result", String(query.result).toUpperCase());
  if (source !== "all") params.set("source", source);
  if (range) params.set("range", range);
  params.set("limit", "250");

  const eventsResult = await getLiveEvents(adminContext, params);
  const liveRows = eventsResult.rows;
  const classifiedRows = liveRows.map((row) => ({
    raw: row,
    event: normalizeTenantTapRealtimeEvent(row as unknown as Record<string, unknown>),
  }));
  const productRecognizedCount = classifiedRows.filter(({ event }) => event.productIdentityRecognized).length;
  const authenticationVerifiedCount = classifiedRows.filter(({ event }) => event.authenticationVerified).length;
  const riskCount = classifiedRows.filter(({ event }) => isRealtimeRisk(event.verdict, event.reason)).length;

  const rows = classifiedRows.map(({ raw: row, event }) => ({
    tenant: row.tenantSlug || "-",
    uid: row.uidHex,
    bid: row.bid,
    result: row.result,
    status: event.authenticationVerified
      ? "Autenticación verificada"
      : isRealtimeRisk(event.verdict, event.reason)
        ? "Riesgo explícito"
        : event.productIdentityRecognized
          ? "Producto reconocido"
          : "Actividad",
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
        ceo={{ eyebrow: "CEO / Investor read", summary: isTenantAdmin ? "Vista ejecutiva del tenant con eventos reportados y alertas derivadas de la validación NFC." : "Events muestra la actividad devuelta por la fuente seleccionada y sus alertas operativas.", decision: "Priorizás mitigación de riesgo con evidencia técnica por evento.", cta: "Úsalo como feed operativo con fuente y alcance visibles." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Consola cruda para revisar mensajes NFC, replay, tamper reportado y contexto de dispositivo.", decision: "Investigás anomalías por UID/BID/resultado y contexto técnico.", cta: isTenantAdmin ? "Scope actual: solo tu tenant." : "Scope configurable multi-tenant." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Demuestra qué señales NFC y de dispositivo reporta la plataforma.", decision: "Validás nivel de control y trazabilidad digital de eventos.", cta: "Cerrá la conversación con evidencia verificable y sus límites." }}
      />

      {eventsResult.availability !== "ready" ? (
        <EnterpriseOpsState
          variant="error"
          title="El feed de eventos no está disponible"
          description="No convertimos una falla del backend, una respuesta inválida o una fuente inaccesible en cero actividad. Reintentá antes de tomar decisiones operativas."
          checklist={[
            `Estado de fuente: ${eventsResult.availability}`,
            "Los contadores y la tabla permanecen sin afirmar valores.",
          ]}
          action={<a href="/events" className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-100">Reintentar feed</a>}
          testId="events-source-unavailable"
        />
      ) : null}

      <Card className="p-5">
        <form className="grid gap-3 md:grid-cols-6">
          <input suppressHydrationWarning name="uid" defaultValue={query.uid || ""} placeholder="UID" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <input suppressHydrationWarning name="bid" defaultValue={query.bid || ""} placeholder="BID" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <input suppressHydrationWarning name="result" defaultValue={query.result || ""} placeholder="VALID / TAMPER..." className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
          <select suppressHydrationWarning name="range" defaultValue={range} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option></select>
          {!isTenantAdmin ? <input suppressHydrationWarning name="tenant" defaultValue={tenantScope} placeholder="tenant slug" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200" /> : <input suppressHydrationWarning type="hidden" name="tenant" value={tenantScope} />}
          <button suppressHydrationWarning className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100" type="submit">Aplicar filtros</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
          <StatusChip label={eventsResult.availability === "ready" ? `Events ${liveRows.length}` : "Events no disponibles"} tone="neutral" />
          {eventsResult.availability === "ready" ? <StatusChip label={`Producto reconocido ${productRecognizedCount}`} tone="neutral" /> : null}
          {eventsResult.availability === "ready" ? <StatusChip label={`Autenticación verificada ${authenticationVerifiedCount}`} tone="good" /> : null}
          {eventsResult.availability === "ready" ? <StatusChip label={`Riesgo explícito ${riskCount}`} tone="risk" /> : null}
          <StatusChip label={`Scope ${tenantScope || "global"}`} tone="neutral" />
        </div>
      </Card>

      <DataTable
        title={copy.tables.events.title}
        columns={[
          ...(!isTenantAdmin ? [{ key: "tenant", label: copy.tables.events.tenant }] : []),
          { key: "uid", label: "UID producto" },
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
        emptyLabel={eventsResult.availability === "ready" ? copy.shell.empty : "El feed no pudo cargarse; no es un cero operativo."}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />
    </main>
  );
}
