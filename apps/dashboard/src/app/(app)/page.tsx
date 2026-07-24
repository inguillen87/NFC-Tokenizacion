import { sortRealtimeEvents, type TenantTapRealtimeEvent } from "../../lib/realtime-feed";
import { dashboardContent } from "../../lib/dashboard-content";
import { requireDashboardSession } from "../../lib/session";
import { getDashboardI18n } from "../../lib/locale";
import {
  aggregateDemoGeoPoints,
  demoRuntimeSummary,
  getDashboardDemoEvents,
  mergeDemoGeoPoints,
  mergeDemoTrend,
  toDemoAdminEventRow,
  toDemoFeedRow,
} from "../../lib/demo-runtime-state";
import { messages, productUrls } from "@product/config";
import { resolveEventLocalTime } from "@product/core";
import DashboardHomeClient from "../../components/dashboard-home-client";
import { type OpsCommandStep, type OpsCommandTenantRow } from "../../components/ops-command-center";
import { isClerkConfiguredForRuntime } from "../../lib/clerk-env";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../lib/admin-page-access";

const FALLBACK_KPIS = {
  scans: "Scans",
  validInvalid: "Valid / Invalid",
  duplicates: "Duplicados",
  tamper: "Tamper alerts",
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

function demoAnalyticsData() {
  const runtimeEvents = getDashboardDemoEvents(80);
  const runtimeSummary = demoRuntimeSummary(runtimeEvents);
  const runtimeGeoPoints = aggregateDemoGeoPoints(runtimeEvents);
  const now = Date.now();
  const trendBase = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(now - (6 - index) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const scans = 70 + index * 12;
    return { day, scans, duplicates: Math.max(1, Math.floor(scans * 0.05)), tamper: index % 3 === 0 ? 1 : 0 };
  });
  const trend = mergeDemoTrend(trendBase, runtimeEvents);
  const scans = trend.reduce((sum, row) => sum + row.scans, 0);
  const duplicates = trend.reduce((sum, row) => sum + row.duplicates, 0);
  const tamper = trend.reduce((sum, row) => sum + row.tamper, 0);
  const valid = Math.max(scans - duplicates - tamper, 0);
  return {
    kpis: {
      scans,
      validRate: Number(((valid / scans) * 100).toFixed(1)),
      invalidRate: Number((((duplicates + tamper) / scans) * 100).toFixed(1)),
      duplicates,
      tamper,
      activeBatches: 1,
      activeTenants: 1,
      geoRegions: 4,
      resellerPerformance: 88,
      riskScore: 7.4,
    },
    trend,
    batchStatus: [{ name: "active", value: 3 }, { name: "qa", value: 1 }, { name: "revoked", value: 0 }],
    geoPoints: mergeDemoGeoPoints([
      { city: "Mendoza", country: "AR", scans: 218, risk: 3.5, lat: -32.8895, lng: -68.8458 },
      { city: "San Martin", country: "AR", scans: 54, risk: 1.2, lat: -34.5744, lng: -58.5358 },
      { city: "Buenos Aires", country: "AR", scans: 133, risk: 5.6, lat: -34.6037, lng: -58.3816 },
      { city: "Cordoba", country: "AR", scans: 38, risk: 13.8, lat: -31.4201, lng: -64.1888 },
    ], runtimeGeoPoints),
    geography: {
      countries: [
        { country: "AR", scans: 493, risk: 6.4 },
      ],
      cities: [
        ...runtimeGeoPoints.map((point) => ({
          city: point.city,
          country: point.country,
          lat: point.lat,
          lng: point.lng,
          scans: point.scans,
          risk: point.risk,
          lastSeen: runtimeEvents.find((event) => event.city === point.city && event.country_code === point.country)?.created_at || new Date(now).toISOString(),
        })),
        { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458, scans: 218, risk: 3.5, lastSeen: new Date(now - 12 * 60 * 1000).toISOString() },
        { city: "San Martin", country: "AR", lat: -34.5744, lng: -58.5358, scans: 54, risk: 1.2, lastSeen: new Date(now - 8 * 60 * 1000).toISOString() },
        { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816, scans: 133, risk: 5.6, lastSeen: new Date(now - 18 * 60 * 1000).toISOString() },
        { city: "Cordoba", country: "AR", lat: -31.4201, lng: -64.1888, scans: 38, risk: 13.8, lastSeen: new Date(now - 25 * 60 * 1000).toISOString() },
      ],
    },
    devices: {
      os: [{ label: "iOS", count: 320 }, { label: "Android", count: 228 }],
      browser: [{ label: "Safari", count: 290 }, { label: "Chrome", count: 250 }],
      deviceType: [{ label: "mobile", count: 520 }, { label: "desktop", count: 28 }],
      timezones: [{ label: "America/Argentina/Mendoza", count: 310 }, { label: "America/Argentina/Buenos_Aires", count: 183 }],
      mobileShare: 94.9,
    },
    feed: [
      ...runtimeEvents.slice(0, 12).map((event) => ({ ...toDemoFeedRow(event), id: 100000 + event.sequence })),
      { id: 9012, uidHex: "0474856A0B1090", bid: "BALMEC-2026-02", result: "ok", city: "San Martin", country: "AR", device: "Android NFC", createdAt: new Date(now - 8 * 60 * 1000).toISOString() },
      { id: 9011, uidHex: "0487856A0B1090", bid: "BALMEC-2026-02", result: "replay", city: "Cordoba", country: "AR", device: "Android Pixel 9", createdAt: new Date(now - 25 * 60 * 1000).toISOString() },
    ],
    deviceSignals: [
      { device: "iPhone 15 Pro", scans: 114, countries: 3, validRate: 95.6, risk: 2.9 },
      { device: "Samsung Galaxy S24", scans: 90, countries: 3, validRate: 88.1, risk: 8.7 },
    ],
    products: [
      { uidHex: "0474856A0B1090", bid: "BALMEC-2026-02", productName: "Cabernet Franc Reserva 2022", winery: "Bodega Balmec", region: "Valle de Uco", vintage: "2022", scanCount: 54, firstSeenAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(), lastSeenAt: new Date(now - 8 * 60 * 1000).toISOString(), lastVerifiedCity: "San Martin", lastVerifiedCountry: "AR", tokenization: { status: "minted", network: "Polygon", txHash: "0xabc1234f7a9e", tokenId: "8841" } },
    ],
    tagJourney: [
      ...runtimeEvents.slice(0, 8).map((event) => ({
        uid: event.uid_hex,
        taps: Math.max(1, runtimeSummary.scans),
        firstSeenAt: event.created_at,
        lastSeenAt: event.created_at,
        origin: { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458 },
        current: { city: event.city, country: event.country_code, lat: event.lat, lng: event.lng },
        lastDevice: event.device,
      })),
      { uid: "0474856A0B1090", taps: 54, firstSeenAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(), lastSeenAt: new Date(now - 8 * 60 * 1000).toISOString(), origin: { city: "Valle de Uco", country: "AR", lat: -33.3667, lng: -69.15 }, current: { city: "San Martin", country: "AR", lat: -34.5744, lng: -58.5358 }, lastDevice: "Android NFC" },
    ],
  };
}

function emptyAnalyticsData(tenant = "unknown", reason = "Analytics upstream unavailable") {
  return {
    ok: false,
    reason,
    dataSource: "production",
    scope: { tenant, source: "unavailable", range: "30d", country: "all" },
    kpis: { scans: 0, validRate: 0, invalidRate: 0, duplicates: 0, tamper: 0, activeBatches: 0, activeTenants: tenant && tenant !== "unknown" ? 1 : 0, geoRegions: 0, resellerPerformance: 0, riskScore: 0 },
    trend: [],
    batchStatus: [],
    geoPoints: [],
    geography: { countries: [], cities: [] },
    devices: { os: [], browser: [], deviceType: [], timezones: [], mobileShare: 0 },
    feed: [],
    deviceSignals: [],
    products: [],
    tagJourney: [],
  };
}

async function getAnalyticsData(context: AdminPageContext) {
  const tenantScope = context.tenantSlug;
  try {
    const query = new URLSearchParams({ range: "30d" });
    if (tenantScope) {
      query.set("tenant", tenantScope);
      query.set("source", "real");
    }
    const response = await fetchAdminPage(context, `analytics?${query.toString()}`);
    if (!response.ok) return tenantScope ? emptyAnalyticsData(tenantScope, `Admin upstream error (${response.status})`) : demoAnalyticsData();
    const payload = await response.json().catch(() => null);
    return payload?.kpis ? payload : tenantScope ? emptyAnalyticsData(tenantScope, "Invalid analytics payload") : demoAnalyticsData();
  } catch {
    return tenantScope ? emptyAnalyticsData(tenantScope, "Admin upstream unreachable") : demoAnalyticsData();
  }
}

async function getOverviewRows(context: AdminPageContext) {
  const tenantScope = context.tenantSlug;
  try {
    const query = new URLSearchParams({ withStats: "1" });
    if (tenantScope) query.set("tenant", tenantScope);
    const response = await fetchAdminPage(context, `tenants?${query.toString()}`);
    if (!response.ok) return tenantScope ? [] : demoOverviewRows() as Array<Record<string, unknown>>;
    return response.json();
  } catch {
    return tenantScope ? [] : demoOverviewRows() as Array<Record<string, unknown>>;
  }
}

async function getLiveEvents(context: AdminPageContext) {
  const tenantScope = context.tenantSlug;
  try {
    const query = new URLSearchParams({ limit: "18" });
    if (tenantScope) {
      query.set("tenant", tenantScope);
      query.set("source", "real");
    }
    const response = await fetchAdminPage(context, `events?${query.toString()}`);
    if (!response.ok) return tenantScope ? [] : demoLiveEventRows() as Array<Record<string, unknown>>;
    const payload = await response.json().catch(() => null) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null;
    if (!payload) return tenantScope ? [] : demoLiveEventRows() as Array<Record<string, unknown>>;
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload.rows) ? payload.rows : tenantScope ? [] : demoLiveEventRows() as Array<Record<string, unknown>>;
  } catch {
    return tenantScope ? [] : demoLiveEventRows() as Array<Record<string, unknown>>;
  }
}

async function getTokenizationRows(context: AdminPageContext) {
  const tenantScope = context.tenantSlug;
  try {
    const query = new URLSearchParams({ limit: "30" });
    if (tenantScope) query.set("tenant", tenantScope);
    const response = await fetchAdminPage(context, `tokenization/requests?${query.toString()}`);
    if (!response.ok) return tenantScope ? [] : demoTokenizationRows() as Array<Record<string, unknown>>;
    const payload = await response.json().catch(() => ({})) as { rows?: Array<Record<string, unknown>> };
    return payload.rows || (tenantScope ? [] : demoTokenizationRows() as Array<Record<string, unknown>>);
  } catch {
    return tenantScope ? [] : demoTokenizationRows() as Array<Record<string, unknown>>;
  }
}

async function getBatchRows(context: AdminPageContext) {
  const tenantScope = context.tenantSlug;
  try {
    const response = await fetchAdminPage(context, "batches");
    if (!response.ok) return tenantScope ? [] : demoBatchRows() as Array<Record<string, unknown>>;
    const payload = await response.json().catch(() => []) as Array<Record<string, unknown>>;
    return Array.isArray(payload) ? payload : tenantScope ? [] : demoBatchRows() as Array<Record<string, unknown>>;
  } catch {
    return tenantScope ? [] : demoBatchRows() as Array<Record<string, unknown>>;
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
    source: String(row.source || "").toLowerCase().includes("demo") ? "demo" : "production",
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

  const [overviewRawResult, liveEventsResult, tokenizationRowsResult, batchRowsResult, analyticsDataResult] = await Promise.all([
    getOverviewRows(adminContext),
    getLiveEvents(adminContext),
    getTokenizationRows(adminContext),
    getBatchRows(adminContext),
    getAnalyticsData(adminContext),
  ]);

  const overviewRaw = overviewRawResult as Array<Record<string, unknown>>;
  const liveEvents = liveEventsResult as Array<Record<string, unknown>>;
  const tokenizationRows = tokenizationRowsResult as Array<Record<string, unknown>>;
  const batchRows = batchRowsResult as Array<Record<string, unknown>>;
  const analyticsData = analyticsDataResult as any;

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
      label: "Tap físico + riesgo",
      body: "QA operativo confirma taps reales, replay bajo, tamper coherente y mapa de confianza.",
      status: totalScans > 0 && totalDuplicates + totalTamper < Math.max(totalScans * 0.12, 3) ? "ready" : totalScans > 0 ? "working" : "blocked",
      owner: "Seguridad",
    },
    {
      label: "Ownership, NFT y experiencia",
      body: "Portal, wallet, tokenización y experiencias verificadas quedan como salida comercial del tap.",
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
      analyticsData={analyticsData}
      kpis={kpis}
      copy={copy}
      labels={labels}
      opsSteps={opsSteps}
      opsTenantRows={opsTenantRows}
      initialRealtimeEvents={initialRealtimeEvents}
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
