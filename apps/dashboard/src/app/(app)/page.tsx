import { classifyRealtimeEventSource, sortRealtimeEvents, type TenantTapRealtimeEvent } from "../../lib/realtime-feed";
import { dashboardContent } from "../../lib/dashboard-content";
import { requireDashboardSession } from "../../lib/session";
import { getDashboardI18n } from "../../lib/locale";
import {
  getDashboardDemoEvents,
  toDemoAdminEventRow,
} from "../../lib/demo-runtime-state";
import { messages, productUrls } from "@product/config";
import { resolveEventLocalTime } from "@product/core";
import DashboardHomeClient from "../../components/dashboard-home-client";
import { type OpsCommandStep, type OpsCommandTenantRow } from "../../components/ops-command-center";
import { isClerkConfiguredForRuntime } from "../../lib/clerk-env";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../lib/admin-page-access";
import { readDemoDataMetaFromResponse } from "../../lib/demo-data-mode";

const FALLBACK_KPIS = {
  scans: "Scans",
  validInvalid: "Valid / Invalid",
  duplicates: "Duplicados",
  tamper: "Tamper alerts",
};

type HomeRealtimeSource = "production" | "demo" | "seed" | "mixed" | "unavailable";
type HomeRealtimeAvailability = "ready" | "fallback" | "upstream_error" | "invalid_payload" | "unreachable";

type HomeRealtimeResult = {
  rows: Array<Record<string, unknown>>;
  source: HomeRealtimeSource;
  availability: HomeRealtimeAvailability;
  detail: string;
};

function demoOverviewRows() {
  return [
    { id: "balmec-tenant-001", slug: "demobodega", name: "Bodega Balmec", scans: 61, duplicates: 1, tamper: 0, created_at: new Date().toISOString() },
  ];
}

function demoLiveEventRows() {
  return [
    ...getDashboardDemoEvents(18).map(toDemoAdminEventRow),
    { id: "home-balmec-001", result: "VALID", reason: "sun_ok", uid_hex: "0474856A0B1090", created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), city: "San Martin", country_code: "AR", lat: -34.5744, lng: -58.5358, bid: "BALMEC-2026-02", tenant_slug: "demobodega", product_name: "Cabernet Franc Reserva 2022", source: "seed" },
    { id: "home-balmec-002", result: "CLAIMED", reason: "ownership_claimed", uid_hex: "04A1B2C3D5", created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(), city: "Buenos Aires", country_code: "AR", lat: -34.6037, lng: -58.3816, bid: "BALMEC-2026-02", tenant_slug: "demobodega", product_name: "Gran Reserva Malbec", source: "seed" },
    { id: "home-balmec-003", result: "REPLAY_SUSPECT", reason: "replay_detected", uid_hex: "0487856A0B1090", created_at: new Date(Date.now() - 32 * 60 * 1000).toISOString(), city: "Cordoba", country_code: "AR", lat: -31.4201, lng: -64.1888, bid: "BALMEC-2026-02", tenant_slug: "demobodega", product_name: "Reserva Malbec 2022", source: "seed" },
  ];
}

function demoTokenizationRows() {
  return [
    { id: "tok-balmec-001", tenant_slug: "demobodega", bid: "BALMEC-2026-02", uid_hex: "04A1B2C3D4", status: "anchored", network: "polygon-amoy", tx_hash: "0xabc1234f7a9e", token_id: "8841", requested_at: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
    { id: "tok-balmec-002", tenant_slug: "demobodega", bid: "BALMEC-2026-02", uid_hex: "04FFEEDDCC", status: "pending", network: "polygon-amoy", tx_hash: null, token_id: null, requested_at: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
  ];
}

function demoBatchRows() {
  return [
    { bid: "BALMEC-2026-02", tenant_slug: "demobodega", tenant_id: "demobodega", status: "active", qty: 10, requested_quantity: 10, imported_tags: 10, active_tags: 10, type: "NTAG 424 DNA TT" },
  ];
}

function fallbackHomeRows(
  availability: Exclude<HomeRealtimeAvailability, "ready">,
  detail: string,
  allowDemoFallback: boolean,
  demoRows: () => Array<Record<string, unknown>>,
): HomeRealtimeResult {
  return {
    rows: allowDemoFallback ? demoRows() : [],
    source: allowDemoFallback ? "demo" : "unavailable",
    availability: allowDemoFallback ? "fallback" : availability,
    detail,
  };
}

async function getOverviewRows(context: AdminPageContext, allowDemoFallback: boolean): Promise<HomeRealtimeResult> {
  const tenantScope = context.tenantSlug;
  try {
    const query = new URLSearchParams({ withStats: "1" });
    if (tenantScope) query.set("tenant", tenantScope);
    const response = await fetchAdminPage(context, `tenants?${query.toString()}`);
    if (!response.ok) return fallbackHomeRows("upstream_error", `Tenant overview upstream error (${response.status})`, allowDemoFallback, demoOverviewRows);
    const meta = readDemoDataMetaFromResponse(response);
    const payload = await response.json().catch(() => null);
    if (!Array.isArray(payload) || (meta.demoMode && !allowDemoFallback)) {
      return fallbackHomeRows("invalid_payload", "Tenant overview returned an invalid or unauthorized demo payload", allowDemoFallback, demoOverviewRows);
    }
    return { rows: payload, source: meta.demoMode ? "demo" : "production", availability: "ready", detail: meta.demoMode ? "Explicit demo tenant overview" : "Production tenant overview confirmed" };
  } catch {
    return fallbackHomeRows("unreachable", "Tenant overview upstream unreachable", allowDemoFallback, demoOverviewRows);
  }
}

function resolveHomeRealtimeSource(
  rows: Array<Record<string, unknown>>,
  requestedSource: "production" | "demo",
): HomeRealtimeSource {
  if (!rows.length) return requestedSource;
  const sources = new Set(rows.map((row) => classifyRealtimeEventSource(row.source).eventSource));
  if (sources.has("seed")) return "seed";
  const hasDemo = [...sources].some((source) => source === "demo" || source === "demo_simulation");
  const hasProduction = [...sources].some((source) => source === "real" || source === "imported" || source === "production");
  if (hasDemo && hasProduction) return "mixed";
  if (hasDemo) return "demo";
  if (hasProduction) return "production";
  return "unavailable";
}

function fallbackLiveEvents(
  availability: Exclude<HomeRealtimeAvailability, "ready">,
  detail: string,
  includeSeedRows: boolean,
): HomeRealtimeResult {
  return {
    rows: includeSeedRows ? demoLiveEventRows() as Array<Record<string, unknown>> : [],
    source: includeSeedRows ? "seed" : "unavailable",
    availability: includeSeedRows ? "fallback" : availability,
    detail,
  };
}

async function getLiveEvents(
  context: AdminPageContext,
  requestedSource: "production" | "demo",
  includeSeedFallback: boolean,
): Promise<HomeRealtimeResult> {
  const tenantScope = context.tenantSlug;
  try {
    const query = new URLSearchParams({
      limit: "18",
      source: requestedSource === "production" ? "real" : "demo",
    });
    if (tenantScope) {
      query.set("tenant", tenantScope);
    }
    const response = await fetchAdminPage(context, `events?${query.toString()}`);
    if (!response.ok) {
      return fallbackLiveEvents("upstream_error", `Admin events upstream error (${response.status})`, includeSeedFallback);
    }
    const payload = await response.json().catch(() => null) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null;
    if (!payload) return fallbackLiveEvents("invalid_payload", "Admin events returned an invalid payload", includeSeedFallback);
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload.rows) ? payload.rows : null;
    if (!rows) return fallbackLiveEvents("invalid_payload", "Admin events returned an invalid payload", includeSeedFallback);
    const resolvedSource = resolveHomeRealtimeSource(rows, requestedSource);
    if (requestedSource === "production" && resolvedSource !== "production") {
      return fallbackLiveEvents("invalid_payload", "Production events returned demo, seed, mixed or unclassified provenance", includeSeedFallback);
    }
    return {
      rows,
      source: resolvedSource,
      availability: "ready",
      detail: requestedSource === "demo" ? "Demo events confirmed by nexID Core" : "Production events confirmed by nexID Core",
    };
  } catch {
    return fallbackLiveEvents("unreachable", "Admin events upstream unreachable", includeSeedFallback);
  }
}

async function getTokenizationRows(context: AdminPageContext, allowDemoFallback: boolean): Promise<HomeRealtimeResult> {
  const tenantScope = context.tenantSlug;
  try {
    const query = new URLSearchParams({ limit: "30" });
    if (tenantScope) query.set("tenant", tenantScope);
    const response = await fetchAdminPage(context, `tokenization/requests?${query.toString()}`);
    if (!response.ok) return fallbackHomeRows("upstream_error", `Tokenization upstream error (${response.status})`, allowDemoFallback, demoTokenizationRows);
    const meta = readDemoDataMetaFromResponse(response);
    const payload = await response.json().catch(() => null) as { ok?: boolean; rows?: Array<Record<string, unknown>> } | null;
    if (payload?.ok === false || !Array.isArray(payload?.rows) || (meta.demoMode && !allowDemoFallback)) {
      return fallbackHomeRows("invalid_payload", "Tokenization returned an invalid or unauthorized demo payload", allowDemoFallback, demoTokenizationRows);
    }
    return { rows: payload.rows, source: meta.demoMode ? "demo" : "production", availability: "ready", detail: meta.demoMode ? "Explicit demo tokenization data" : "Production tokenization data confirmed" };
  } catch {
    return fallbackHomeRows("unreachable", "Tokenization upstream unreachable", allowDemoFallback, demoTokenizationRows);
  }
}

async function getBatchRows(context: AdminPageContext, allowDemoFallback: boolean): Promise<HomeRealtimeResult> {
  try {
    const response = await fetchAdminPage(context, "batches");
    if (!response.ok) return fallbackHomeRows("upstream_error", `Batches upstream error (${response.status})`, allowDemoFallback, demoBatchRows);
    const meta = readDemoDataMetaFromResponse(response);
    const payload = await response.json().catch(() => null) as Array<Record<string, unknown>> | null;
    if (!Array.isArray(payload) || (meta.demoMode && !allowDemoFallback)) {
      return fallbackHomeRows("invalid_payload", "Batches returned an invalid or unauthorized demo payload", allowDemoFallback, demoBatchRows);
    }
    return { rows: payload, source: meta.demoMode ? "demo" : "production", availability: "ready", detail: meta.demoMode ? "Explicit demo batch data" : "Production batch data confirmed" };
  } catch {
    return fallbackHomeRows("unreachable", "Batches upstream unreachable", allowDemoFallback, demoBatchRows);
  }
}

function resolveTenantStatus(scans: number, duplicates: number, tamper: number) {
  if (scans === 0) return "pending";
  if (scans < 25) return "pending";
  const riskSignals = duplicates + tamper * 1.8;
  const riskRatio = scans > 0 ? riskSignals / scans : 0;
  if (tamper >= 3 || riskRatio > 0.16) return "risk";
  if (riskRatio > 0.08) return "healthy";
  return "active";
}

function buildTenantRiskScore(scans: number, duplicates: number, tamper: number) {
  if (scans <= 0) return 0;
  const duplicateRatio = duplicates / scans;
  const tamperRatio = tamper / scans;
  const weighted = duplicateRatio * 45 + tamperRatio * 55;
  return Math.max(0, Math.min(100, Math.round(weighted * 100)));
}

function toRealtimeEvent(row: Record<string, unknown>): TenantTapRealtimeEvent {
  const uid = String(row.uid_hex || row.uidHex || "").toUpperCase();
  const uidMasked = uid ? `${uid.slice(0, 4)}****${uid.slice(-2)}` : "N/A";
  const time = resolveEventLocalTime(row);
  const location = row.location && typeof row.location === "object" ? row.location as Record<string, unknown> : {};
  const accuracy = Number(row.location_accuracy_m ?? row.locationAccuracyM ?? location.accuracyM);
  return {
    eventId: String(row.id || row.eventId || row.created_at || Date.now()),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    tenantSlug: row.tenant_slug ? String(row.tenant_slug) : null,
    batchId: row.batch_id ? String(row.batch_id) : (row.bid ? String(row.bid) : null),
    tagId: row.tag_id ? String(row.tag_id) : null,
    uidMasked,
    occurredAt: time.occurredAtUtc,
    occurredAtUtc: time.occurredAtUtc,
    occurredAtLocal: time.occurredAtLocal,
    timezone: time.timezone,
    timezoneLabel: time.timezoneLabel,
    timezoneOffset: time.timezoneOffset,
    verdict: String(row.verdict || row.result || "invalid").toLowerCase(),
    riskLevel: String(row.risk_level || "medium").toLowerCase(),
    city: row.city ? String(row.city) : (location.city ? String(location.city) : null),
    country: row.country_code ? String(row.country_code) : (location.country ? String(location.country) : null),
    lat: typeof row.lat === "number" ? row.lat : (typeof location.lat === "number" ? Number(location.lat) : null),
    lng: typeof row.lng === "number" ? row.lng : (typeof location.lng === "number" ? Number(location.lng) : null),
    locationSource: row.location_source ? String(row.location_source) : (location.source ? String(location.source) : null),
    locationAccuracyM: Number.isFinite(accuracy) ? accuracy : null,
    productName: row.product_name ? String(row.product_name) : null,
    ...classifyRealtimeEventSource(row.source),
  };
}

export default async function DashboardHome() {
  const { locale } = await getDashboardI18n();
  const fallbackLocale = "es-AR" as const;
  const t = messages[locale] || messages[fallbackLocale];
  const kpis = t?.dashboard?.kpis || FALLBACK_KPIS;
  const dashboardText = t?.dashboard || messages[fallbackLocale].dashboard;
  const copy = dashboardContent[locale] || dashboardContent[fallbackLocale];
  const publicMobileBase = `${productUrls.web}/demo-lab/mobile`;
  const session = await requireDashboardSession();
  const adminContext = await createAdminPageContext(session);
  const tenantScope = adminContext.tenantSlug;
  const isTenantAdmin = !adminContext.canSelectTenant;
  const realtimeStreamSource = session.isDemo ? "demo" : "production";
  const allowDemoFallback = Boolean(session.isDemo);

  const [overviewRawResult, liveEventsResult, tokenizationRowsResult, batchRowsResult] = await Promise.all([
    getOverviewRows(adminContext, allowDemoFallback),
    getLiveEvents(adminContext, realtimeStreamSource, allowDemoFallback),
    getTokenizationRows(adminContext, allowDemoFallback),
    getBatchRows(adminContext, allowDemoFallback),
  ]);

  const overviewRaw = overviewRawResult.rows;
  const liveEvents = liveEventsResult.rows;
  const tokenizationRows = tokenizationRowsResult.rows;
  const batchRows = batchRowsResult.rows;

  const labels = locale === "en"
    ? {
        liveFeed: "Live operations feed",
        mission: "Mission control",
        mapTitle: "Live scan map",
        mapSubtitle: isTenantAdmin ? "Geolocated scans for your tenant operations." : "Geolocated scans from tenants, commercial showcases and partner operations.",
        roleNote: isTenantAdmin ? "Tenant-level operations scope with no cross-tenant noise." : "Contextual permissions visible across tenants, CRM and commercial orchestration.",
      }
    : locale === "pt-BR"
    ? {
        liveFeed: "Feed de operações ao vivo",
        mission: "Mission control",
        mapTitle: "Mapa de scans ao vivo",
        mapSubtitle: isTenantAdmin ? "Scans geolocalizados das operações do seu tenant." : "Scans geolocalizados de tenants, vitrines comerciais e operações parceiras",
        roleNote: isTenantAdmin ? "Escopo operacional por tenant, sem ruído cross-tenant." : "Permissões contextuais visíveis em tenants, CRM e orquestração comercial.",
      }
    : {
        liveFeed: "Feed operativo en vivo",
        mission: "Mission control",
        mapTitle: "Mapa de escaneos en vivo",
        mapSubtitle: isTenantAdmin ? "Escaneos geolocalizados de la operación de tu tenant." : "Escaneos geolocalizados de tenants, showrooms comerciales y operaciones partner",
        roleNote: isTenantAdmin ? "Alcance operativo por tenant, sin ruido cross-tenant." : "Permisos contextuales visibles en tenants, CRM y orquestación comercial.",
      };

  const scopedOverviewRaw = tenantScope
    ? overviewRaw.filter((row: Record<string, unknown>) => String(row.slug || "").toLowerCase() === tenantScope)
    : overviewRaw;

  const tenantFromRow = (row: Record<string, unknown>) =>
    String(row.tenant_slug || row.tenantSlug || row.tenant_id || row.tenantId || "").toLowerCase();

  const scopedLiveEvents = tenantScope
    ? liveEvents.filter((row: Record<string, unknown>) => tenantFromRow(row) === tenantScope)
    : liveEvents;

  const initialRealtimeEvents = sortRealtimeEvents(scopedLiveEvents.map(toRealtimeEvent), 40);

  const scopedTokenizationRows = tenantScope
    ? tokenizationRows.filter((row: Record<string, unknown>) => String(row.tenant_slug || "").toLowerCase() === tenantScope)
    : tokenizationRows;

  const scopedBatchRows = tenantScope
    ? batchRows.filter((row: Record<string, unknown>) => String(row.tenant_slug || row.tenant_id || "").toLowerCase() === tenantScope)
    : batchRows;

  const overviewRows = scopedOverviewRaw.map((row: Record<string, unknown>) => {
    const scans = Number(row.scans || 0);
    const duplicates = Number(row.duplicates || 0);
    const tamper = Number(row.tamper || 0);
    const riskScore = buildTenantRiskScore(scans, duplicates, tamper);
    return {
      tenant: String(row.name || row.slug || "-"),
      status: resolveTenantStatus(scans, duplicates, tamper),
      riskScore: `${riskScore}%`,
      scans: scans.toLocaleString(),
      duplicates: duplicates.toLocaleString(),
      tamper: tamper.toLocaleString(),
    };
  });

  const successfulTaps = scopedLiveEvents.filter((event) => String(event.result || "").toUpperCase() === "VALID").length;
  const failedTaps = scopedLiveEvents.length - successfulTaps;
  const tokenizationByStatus: Record<string, number> = {};
  for (const row of scopedTokenizationRows) {
    const status = String(row.status || "unknown").toLowerCase();
    tokenizationByStatus[status] = Number(tokenizationByStatus[status] || 0) + 1;
  }

  const totalScans = scopedOverviewRaw.reduce((sum, row) => sum + Number(row.scans || 0), 0);
  const totalDuplicates = scopedOverviewRaw.reduce((sum, row) => sum + Number(row.duplicates || 0), 0);
  const totalTamper = scopedOverviewRaw.reduce((sum, row) => sum + Number(row.tamper || 0), 0);
  const plannedTags = scopedBatchRows.reduce((sum, row) => sum + Number(row.requested_quantity || row.qty || row.quantity || 0), 0);
  const importedTags = scopedBatchRows.reduce((sum, row) => sum + Number(row.imported_tags || row.quantity || row.qty || 0), 0);
  const activeTags = scopedBatchRows.reduce((sum, row) => sum + Number(row.active_tags || 0), 0);
  const mintedTokens = Number(tokenizationByStatus.anchored || 0) + Number(tokenizationByStatus.minted || 0);

  const tenantBatchCounts = new Map<string, { batches: number; tags: number }>();
  for (const row of scopedBatchRows) {
    const slug = String(row.tenant_slug || row.tenant_id || "tenant").toLowerCase();
    const current = tenantBatchCounts.get(slug) || { batches: 0, tags: 0 };
    current.batches += 1;
    current.tags += Number(row.active_tags || row.quantity || row.qty || row.requested_quantity || 0);
    tenantBatchCounts.set(slug, current);
  }

  const opsTenantRows: OpsCommandTenantRow[] = scopedOverviewRaw.map((row) => {
    const slug = String(row.slug || row.tenant_slug || row.tenant_id || "tenant").toLowerCase();
    const scans = Number(row.scans || 0);
    const duplicates = Number(row.duplicates || 0);
    const tamper = Number(row.tamper || 0);
    const batchInfo = tenantBatchCounts.get(slug) || { batches: 0, tags: 0 };
    return {
      name: String(row.name || row.slug || slug),
      slug,
      scans,
      riskScore: buildTenantRiskScore(scans, duplicates, tamper),
      batches: batchInfo.batches,
      tags: batchInfo.tags,
      status: resolveTenantStatus(scans, duplicates, tamper),
    };
  });

  const opsSteps: OpsCommandStep[] = [
    {
      label: "Tenant y reglas comerciales",
      body: tenantScope ? "El tenant está acotado a una marca. Revisar ownership, portal y marketplace antes de publicar." : "Superadmin ve todos los tenants y detecta quién está listo para rollout.",
      status: scopedOverviewRaw.length ? "ready" : "blocked",
      owner: "Super Admin",
    },
    {
      label: "Batch supplier cargado",
      body: "El lote debe traer carrier, BID, SKU, llaves cuando aplique y manifest auditable.",
      status: scopedBatchRows.length ? "ready" : "working",
      owner: "Operaciones",
    },
    {
      label: "Tags importados y activos",
      body: "Una persona no técnica necesita ver cantidad planeada, importada, activa y pendiente sin consola.",
      status: activeTags > 0 ? "ready" : importedTags > 0 ? "working" : "blocked",
      owner: "Owner",
    },
    {
      label: "Mensaje NFC + riesgo",
      body: "QA operativo revisa eventos NFC reportados, replay, señales TT/tamper y ubicación declarada; no certifica el producto físico.",
      status: totalScans > 0 && totalDuplicates + totalTamper < Math.max(totalScans * 0.12, 3) ? "ready" : totalScans > 0 ? "working" : "blocked",
      owner: "Seguridad",
    },
    {
      label: "Ownership, NFT y experiencia",
      body: "Portal, wallet, titularidad digital, tokenización y experiencias con evidencia quedan como salida comercial del tap.",
      status: mintedTokens > 0 ? "ready" : "working",
      owner: "Growth",
    },
  ];

  const demoPacks = [
    { key: "wine-secure", label: "Bodega Balmec", tenant: "demobodega", itemId: "demo-item-001" },
  ];

  return (
    <DashboardHomeClient
      session={session}
      tenantScope={tenantScope}
      isTenantAdmin={isTenantAdmin}
      kpis={kpis}
      copy={copy}
      labels={labels}
      opsSteps={opsSteps}
      opsTenantRows={opsTenantRows}
      initialRealtimeEvents={initialRealtimeEvents}
      realtimeStreamSource={realtimeStreamSource}
      realtimeDataSource={liveEventsResult.source}
      realtimeAvailability={liveEventsResult.availability}
      realtimeAvailabilityDetail={liveEventsResult.detail}
      overviewDataSource={overviewRawResult.source}
      overviewAvailability={overviewRawResult.availability}
      overviewAvailabilityDetail={overviewRawResult.detail}
      batchDataSource={batchRowsResult.source}
      batchAvailability={batchRowsResult.availability}
      batchAvailabilityDetail={batchRowsResult.detail}
      tokenizationDataSource={tokenizationRowsResult.source}
      tokenizationAvailability={tokenizationRowsResult.availability}
      tokenizationAvailabilityDetail={tokenizationRowsResult.detail}
      successfulTaps={successfulTaps}
      failedTaps={failedTaps}
      tokenizationByStatus={tokenizationByStatus}
      scopedTokenizationRows={scopedTokenizationRows}
      demoPacks={demoPacks}
      publicMobileBase={publicMobileBase}
      overviewRows={overviewRows}
      dashboardText={dashboardText}
      scopedBatchRows={scopedBatchRows}
      importedTags={importedTags}
      activeTags={activeTags}
      plannedTags={plannedTags}
      mintedTokens={mintedTokens}
      clerkEnabled={isClerkConfiguredForRuntime()}
    />
  );
}
