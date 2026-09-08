import Link from "next/link";
import { ArrowLeft, ArrowRight, ListFilter, ScanLine } from "lucide-react";
import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { EnterpriseOpsState } from "../../../components/enterprise-ops-state";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { dashboardHighImpactPermissionMatches } from "../../../lib/permission-policy";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";
import { isRealtimeRisk } from "../../../lib/realtime-feed";
import { normalizeTenantTapRealtimeEvent } from "@product/core";
import { eventsFilterHref, filterEventsActivitySample, normalizeEventsActivityFilter } from "../../../lib/events-activity-filter";
import styles from "./events.module.css";

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
  const source = session.isDemo ? "demo" : isTenantBound ? "real" : String(query.source || "all");
  const range = String(query.range || "30d");
  const activityFilter = normalizeEventsActivityFilter(query.filter);

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
  const visibleRows = filterEventsActivitySample(classifiedRows, activityFilter);
  const productRecognizedCount = visibleRows.filter(({ event }) => event.productIdentityRecognized).length;
  const authenticationVerifiedCount = visibleRows.filter(({ event }) => event.authenticationVerified).length;
  const riskCount = visibleRows.filter(({ event }) => isRealtimeRisk(event.verdict, event.reason)).length;
  const retryHref = eventsFilterHref(params, activityFilter);
  const resetParams = new URLSearchParams({ source, range });
  if (tenantScope) resetParams.set("tenant", tenantScope);
  const resetHref = eventsFilterHref(resetParams, "all");
  const workspaceParams = new URLSearchParams();
  if (tenantScope) workspaceParams.set("tenant", tenantScope);
  const crmHref = workspaceParams.size ? `/?${workspaceParams.toString()}` : "/";
  workspaceParams.set("view", "physical-taps");
  const physicalTapsHref = `/?${workspaceParams.toString()}`;
  const sourceLabel = session.isDemo ? "Demo · datos ilustrativos" : source === "real" || source === "production" ? "Producción" : source === "all" ? "Todas las fuentes" : source;

  const rows = visibleRows.map(({ raw: row, event }) => ({
    tenant: row.tenantSlug || "-",
    uid: row.uidHex,
    bid: row.bid,
    result: row.result,
    status: isRealtimeRisk(event.verdict, event.reason)
      ? "Riesgo explícito"
      : event.authenticationVerified
        ? "Autenticación verificada"
        : event.productIdentityRecognized
          ? "Producto reconocido"
          : "Actividad",
    authentication: event.authenticationVerified ? "Verificada" : "No confirmada",
    geo: [row.location?.city, row.location?.country].filter(Boolean).join(", ") || "Sin zona informada",
    device: [row.device?.os, row.device?.browser].filter(Boolean).join(" · ") || "No informado",
    deviceType: row.device?.deviceType || "No informado",
    timezone: row.device?.timezone || "No informada",
    source: row.source,
    reason: row.reason || "-",
    time: Number.isFinite(Date.parse(row.createdAt)) ? new Date(row.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }) : "No informada",
  }));

  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Trazabilidad · revisión operativa</p>
          <h1>Eventos y evidencia</h1>
          <p>Encontrá una lectura por producto o lote, revisá su resultado y consultá las señales de riesgo.</p>
        </div>
        <nav aria-label="Volver al centro de control" className={styles.navigation}>
          <Link href={crmHref} className={styles.secondaryAction}><ArrowLeft aria-hidden="true" /> CRM en vivo</Link>
          <Link href={physicalTapsHref} className={styles.secondaryAction}><ScanLine aria-hidden="true" /> TAP físicos</Link>
        </nav>
      </header>

      {eventsResult.availability !== "ready" ? (
        <EnterpriseOpsState
          variant="error"
          title="El feed de eventos no está disponible"
          description="No convertimos una falla del backend, una respuesta inválida o una fuente inaccesible en cero actividad. Reintentá antes de tomar decisiones operativas."
          checklist={[
            `Estado de fuente: ${eventsResult.availability}`,
            "Los contadores y la tabla permanecen sin afirmar valores.",
          ]}
          action={<Link href={retryHref} className={styles.secondaryAction}>Reintentar con estos filtros <ArrowRight aria-hidden="true" /></Link>}
          testId="events-source-unavailable"
        />
      ) : null}

      <section className={styles.filters} aria-label="Filtros del historial de eventos">
        <div className={styles.filterHeading}>
          <h2><ListFilter aria-hidden="true" /> Buscar eventos</h2>
          <span className={styles.sourceBadge}>{sourceLabel} · {tenantScope || "Alcance global"}</span>
        </div>
        <form action="/events" method="get" className={styles.filterGrid}>
          <label>Tipo de actividad<select suppressHydrationWarning name="filter" defaultValue={activityFilter}><option value="all">Todas</option><option value="risk">Riesgo explícito</option></select></label>
          <label>Período<select suppressHydrationWarning name="range" defaultValue={range}><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option>{!["24h", "7d", "30d"].includes(range) ? <option value={range}>{range}</option> : null}</select></label>
          <label>Identificador del tag<input suppressHydrationWarning name="uid" defaultValue={query.uid || ""} placeholder="UID completo" autoComplete="off" /></label>
          <label>Lote<input suppressHydrationWarning name="bid" defaultValue={query.bid || ""} placeholder="Identificador del lote" autoComplete="off" /></label>
          <label>Resultado técnico<input suppressHydrationWarning name="result" defaultValue={query.result || ""} placeholder="Ej.: VALID, TAMPER" autoComplete="off" /></label>
          {!isTenantAdmin ? <label>Empresa<input suppressHydrationWarning name="tenant" defaultValue={tenantScope} placeholder="Identificador de empresa" autoComplete="off" /></label> : <input suppressHydrationWarning type="hidden" name="tenant" value={tenantScope} />}
          <input suppressHydrationWarning type="hidden" name="source" value={source} />
          <div className={styles.filterActions}>
            <button suppressHydrationWarning className={styles.primaryAction} type="submit">Aplicar filtros <ArrowRight aria-hidden="true" /></button>
            <Link href={resetHref} className={styles.secondaryAction}>Limpiar filtros</Link>
          </div>
        </form>
      </section>

      {eventsResult.availability === "ready" ? <>
      <section className={styles.sampleSummary} aria-label="Resumen de la muestra recibida" data-testid="events-sample-summary">
        <div className={styles.sampleScope}>
          <h2>{activityFilter === "risk" ? "Riesgo explícito" : "Actividad recibida"}</h2>
          <p>{rows.length} de {liveRows.length} eventos de la muestra{activityFilter === "risk" ? " coinciden con riesgo explícito" : " visibles"}.</p>
          <p>Se consultan hasta 250 eventos del período. El filtro de actividad se aplica a esa muestra, no al historial completo.</p>
        </div>
        <dl className={styles.sampleMetrics}>
          <div><dt>Producto reconocido</dt><dd>{productRecognizedCount}</dd></div>
          <div><dt>Autenticación verificada</dt><dd>{authenticationVerifiedCount}</dd></div>
          <div><dt>Riesgo explícito</dt><dd>{riskCount}</dd></div>
        </dl>
      </section>

      <DataTable
        title="Eventos de la muestra · hora de Argentina (UTC−03:00)"
        columns={[
          ...(!isTenantAdmin ? [{ key: "tenant", label: copy.tables.events.tenant }] : []),
          { key: "uid", label: "UID producto" },
          { key: "bid", label: "Lote" },
          { key: "result", label: copy.tables.events.result },
          { key: "status", label: copy.tables.events.status },
          { key: "authentication", label: "Autenticación del mensaje" },
          { key: "geo", label: copy.tables.events.geo },
          { key: "device", label: "Sistema / navegador" },
          { key: "deviceType", label: "Dispositivo" },
          { key: "timezone", label: "Zona horaria reportada" },
          { key: "source", label: "Fuente" },
          { key: "reason", label: "Motivo" },
          { key: "time", label: copy.tables.events.time },
        ]}
        rows={rows}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={activityFilter === "risk" ? "No hay señales de riesgo explícito en esta muestra. Podés ampliar el período o consultar todas las actividades." : "No se recibieron eventos con estos filtros. Probá otro período, tag o lote."}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />
      </> : null}
    </main>
  );
}
