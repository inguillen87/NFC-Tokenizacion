import type { TenantTapRealtimeEvent } from "../../lib/realtime-feed";
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
import DashboardHomeClient from "../../components/dashboard-home-client";
import { type OpsCommandStep, type OpsCommandTenantRow } from "../../components/ops-command-center";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
const FALLBACK_KPIS = {
  scans: "Scans",
  validInvalid: "Valid / Invalid",
  duplicates: "Duplicados",
  tamper: "Tamper alerts",
};

function demoOverviewRows() {
  return [
    { id: "demo-tenant-001", slug: "demobodega", name: "Demo Bodega", scans: 512, duplicates: 8, tamper: 2, created_at: new Date().toISOString() },
    { id: "demo-tenant-002", slug: "demoevents", name: "Demo Events", scans: 148, duplicates: 2, tamper: 0, created_at: new Date().toISOString() },
    { id: "demo-tenant-003", slug: "democosmetics", name: "Demo Cosmetics", scans: 96, duplicates: 1, tamper: 1, created_at: new Date().toISOString() },
  ];
}

function demoLiveEventRows() {
  return [
    ...getDashboardDemoEvents(18).map(toDemoAdminEventRow),
    { id: "home-demo-001", result: "VALID", reason: "sun_ok", uid_hex: "04A1B2C3D4", created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), city: "Zurich", country_code: "CH", lat: 47.3769, lng: 8.5417, bid: "DEMO-2026-02", tenant_slug: "demobodega", product_name: "Gran Reserva Malbec", source: "demo" },
    { id: "home-demo-002", result: "CLAIMED", reason: "ownership_claimed", uid_hex: "04A1B2C3D5", created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(), city: "Buenos Aires", country_code: "AR", lat: -34.6037, lng: -58.3816, bid: "DEMO-2026-02", tenant_slug: "demobodega", product_name: "Gran Reserva Malbec", source: "demo" },
    { id: "home-demo-003", result: "REPLAY_SUSPECT", reason: "replay_detected", uid_hex: "04F1E2D3C4", created_at: new Date(Date.now() - 32 * 60 * 1000).toISOString(), city: "Sao Paulo", country_code: "BR", lat: -23.5505, lng: -46.6333, bid: "EVENT-2026-01", tenant_slug: "demoevents", product_name: "Brazalete VIP evento", source: "demo" },
  ];
}

function demoTokenizationRows() {
  return [
    { id: "tok-demo-001", tenant_slug: "demobodega", bid: "DEMO-2026-02", uid_hex: "04A1B2C3D4", status: "anchored", network: "polygon-amoy", tx_hash: "0xabc123demo", token_id: "8841", requested_at: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
    { id: "tok-demo-002", tenant_slug: "demobodega", bid: "DEMO-2026-02", uid_hex: "04FFEEDDCC", status: "pending", network: "polygon-amoy", tx_hash: null, token_id: null, requested_at: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
  ];
}

function demoBatchRows() {
  return [
    { bid: "DEMO-2026-02", tenant_slug: "demobodega", tenant_id: "demobodega", status: "active", qty: 120, requested_quantity: 120, imported_tags: 118, active_tags: 110, type: "NTAG 424 DNA TT" },
    { bid: "EVENTS-2026-01", tenant_slug: "demoevents", tenant_id: "demoevents", status: "active", qty: 80, requested_quantity: 80, imported_tags: 76, active_tags: 72, type: "NTAG215" },
    { bid: "COS-2026-01", tenant_slug: "democosmetics", tenant_id: "democosmetics", status: "qa", qty: 60, requested_quantity: 60, imported_tags: 54, active_tags: 48, type: "NTAG 424 DNA" },
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
      activeBatches: 3,
      activeTenants: 3,
      geoRegions: 5,
      resellerPerformance: 88,
      riskScore: 7.4,
    },
    trend,
    batchStatus: [{ name: "active", value: 3 }, { name: "qa", value: 1 }, { name: "revoked", value: 0 }],
    geoPoints: mergeDemoGeoPoints([
      { city: "Mendoza", country: "AR", scans: 218, risk: 3.5, lat: -32.8895, lng: -68.8458 },
      { city: "Zurich", country: "CH", scans: 54, risk: 1.2, lat: 47.3769, lng: 8.5417 },
      { city: "Buenos Aires", country: "AR", scans: 133, risk: 5.6, lat: -34.6037, lng: -58.3816 },
      { city: "Sao Paulo", country: "BR", scans: 38, risk: 13.8, lat: -23.5505, lng: -46.6333 },
    ], runtimeGeoPoints),
    geography: {
      countries: [
        { country: "AR", scans: 401, risk: 6.1 },
        { country: "CH", scans: 54, risk: 1.2 },
        { country: "BR", scans: 38, risk: 13.8 },
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
        { city: "Zurich", country: "CH", lat: 47.3769, lng: 8.5417, scans: 54, risk: 1.2, lastSeen: new Date(now - 8 * 60 * 1000).toISOString() },
        { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816, scans: 133, risk: 5.6, lastSeen: new Date(now - 18 * 60 * 1000).toISOString() },
        { city: "Sao Paulo", country: "BR", lat: -23.5505, lng: -46.6333, scans: 38, risk: 13.8, lastSeen: new Date(now - 25 * 60 * 1000).toISOString() },
      ],
    },
    devices: {
      os: [{ label: "iOS", count: 320 }, { label: "Android", count: 228 }],
      browser: [{ label: "Safari", count: 290 }, { label: "Chrome", count: 250 }],
      deviceType: [{ label: "mobile", count: 520 }, { label: "desktop", count: 28 }],
      timezones: [{ label: "America/Argentina/Mendoza", count: 310 }, { label: "Europe/Zurich", count: 54 }],
      mobileShare: 94.9,
    },
    feed: [
      ...runtimeEvents.slice(0, 12).map((event) => ({ ...toDemoFeedRow(event), id: 100000 + event.sequence })),
      { id: 9012, uidHex: "04A1B2C3D4", bid: "DEMO-2026-02", result: "ok", city: "Zurich", country: "CH", device: "iPhone 15 Pro", createdAt: new Date(now - 8 * 60 * 1000).toISOString() },
      { id: 9011, uidHex: "04F1E2D3C4", bid: "EVENTS-2026-01", result: "replay", city: "Sao Paulo", country: "BR", device: "Android Pixel 9", createdAt: new Date(now - 25 * 60 * 1000).toISOString() },
    ],
    deviceSignals: [
      { device: "iPhone 15 Pro", scans: 114, countries: 3, validRate: 95.6, risk: 2.9 },
      { device: "Samsung Galaxy S24", scans: 90, countries: 3, validRate: 88.1, risk: 8.7 },
    ],
    products: [
      { uidHex: "04A1B2C3D4", bid: "DEMO-2026-02", productName: "Gran Reserva Malbec", winery: "Demo Bodega", region: "Valle de Uco", vintage: "2022", scanCount: 54, firstSeenAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(), lastSeenAt: new Date(now - 8 * 60 * 1000).toISOString(), lastVerifiedCity: "Zurich", lastVerifiedCountry: "CH", tokenization: { status: "minted", network: "Polygon", txHash: "0xabc123demo", tokenId: "8841" } },
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
      { uid: "04A1B2C3D4", taps: 54, firstSeenAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(), lastSeenAt: new Date(now - 8 * 60 * 1000).toISOString(), origin: { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458 }, current: { city: "Zurich", country: "CH", lat: 47.3769, lng: 8.5417 }, lastDevice: "iPhone 15 Pro" },
    ],
  };
}

async function getAnalyticsData() {
  try {
    const response = await fetch(`${API_BASE}/admin/analytics?range=30d`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return demoAnalyticsData();
    const payload = await response.json().catch(() => null);
    return payload?.kpis ? payload : demoAnalyticsData();
  } catch {
    return demoAnalyticsData();
  }
}

async function getOverviewRows() {
  try {
    const response = await fetch(`${API_BASE}/admin/tenants?withStats=1`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return demoOverviewRows() as Array<Record<string, unknown>>;
    return response.json();
  } catch {
    return demoOverviewRows() as Array<Record<string, unknown>>;
  }
}

async function getLiveEvents() {
  try {
    const response = await fetch(`${API_BASE}/admin/events?limit=18`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return demoLiveEventRows() as Array<Record<string, unknown>>;
    const payload = await response.json().catch(() => null) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null;
    if (!payload) return demoLiveEventRows() as Array<Record<string, unknown>>;
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload.rows) ? payload.rows : demoLiveEventRows() as Array<Record<string, unknown>>;
  } catch {
    return demoLiveEventRows() as Array<Record<string, unknown>>;
  }
}

async function getTokenizationRows() {
  try {
    const response = await fetch(`${API_BASE}/admin/tokenization/requests?limit=30`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return demoTokenizationRows() as Array<Record<string, unknown>>;
    const payload = await response.json().catch(() => ({})) as { rows?: Array<Record<string, unknown>> };
    return payload.rows || demoTokenizationRows() as Array<Record<string, unknown>>;
  } catch {
    return demoTokenizationRows() as Array<Record<string, unknown>>;
  }
}

async function getBatchRows(tenantScope = "") {
  try {
    const query = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";
    const response = await fetch(`${API_BASE}/admin/batches${query}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return demoBatchRows() as Array<Record<string, unknown>>;
    const payload = await response.json().catch(() => []) as Array<Record<string, unknown>>;
    return Array.isArray(payload) ? payload : demoBatchRows() as Array<Record<string, unknown>>;
  } catch {
    return demoBatchRows() as Array<Record<string, unknown>>;
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
  return {
    eventId: String(row.id || row.eventId || row.created_at || Date.now()),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    tenantSlug: row.tenant_slug ? String(row.tenant_slug) : null,
    batchId: row.batch_id ? String(row.batch_id) : (row.bid ? String(row.bid) : null),
    tagId: row.tag_id ? String(row.tag_id) : null,
    uidMasked,
    occurredAt: String(row.created_at || row.createdAt || new Date().toISOString()),
    verdict: String(row.verdict || row.result || "invalid").toLowerCase(),
    riskLevel: String(row.risk_level || "medium").toLowerCase(),
    city: row.city ? String(row.city) : null,
    country: row.country_code ? String(row.country_code) : null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
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
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";
  const isTenantAdmin = session.role === "tenant-admin";

  const [overviewRawResult, liveEventsResult, tokenizationRowsResult, batchRowsResult, analyticsDataResult] = await Promise.all([
    getOverviewRows(),
    getLiveEvents(),
    getTokenizationRows(),
    getBatchRows(tenantScope),
    getAnalyticsData(),
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
        mapSubtitle: isTenantAdmin ? "Geolocated scans for your tenant operations." : "Geolocated scans from tenants, demo packs and reseller simulations",
        roleNote: isTenantAdmin ? "Tenant-level operations scope with no cross-tenant demo noise." : "Contextual permissions visible across tenants, CRM and demo orchestration.",
      }
    : locale === "pt-BR"
    ? {
        liveFeed: "Feed de operações ao vivo",
        mission: "Mission control",
        mapTitle: "Mapa de scans ao vivo",
        mapSubtitle: isTenantAdmin ? "Scans geolocalizados das operações do seu tenant." : "Scans geolocalizados de tenants, packs demo e simulações reseller",
        roleNote: isTenantAdmin ? "Escopo operacional por tenant, sem ruído de demos cross-tenant." : "Permissões contextuais visíveis em tenants, CRM e orquestração demo.",
      }
    : {
        liveFeed: "Feed operativo en vivo",
        mission: "Mission control",
        mapTitle: "Mapa de escaneos en vivo",
        mapSubtitle: isTenantAdmin ? "Escaneos geolocalizados de la operación de tu tenant." : "Escaneos geolocalizados de tenants, packs demo y simulaciones reseller",
        roleNote: isTenantAdmin ? "Alcance operativo por tenant, sin ruido de demos cross-tenant." : "Permisos contextuales visibles en tenants, CRM y orquestación demo.",
      };

  const scopedOverviewRaw = tenantScope
    ? overviewRaw.filter((row: Record<string, unknown>) => String(row.slug || "").toLowerCase() === tenantScope)
    : overviewRaw;

  const tenantFromRow = (row: Record<string, unknown>) =>
    String(row.tenant_slug || row.tenantSlug || row.tenant_id || row.tenantId || "").toLowerCase();

  const scopedLiveEvents = tenantScope
    ? liveEvents.filter((row: Record<string, unknown>) => tenantFromRow(row) === tenantScope)
    : liveEvents;

  const initialRealtimeEvents = scopedLiveEvents.map(toRealtimeEvent);

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
      owner: "Superadmin",
    },
    {
      label: "Batch supplier cargado",
      body: "El lote debe traer carrier, BID, SKU, llaves cuando aplique y manifest auditable.",
      status: scopedBatchRows.length ? "ready" : "working",
      owner: "Reseller",
    },
    {
      label: "Tags importados y activos",
      body: "Una persona no técnica necesita ver cantidad planeada, importada, activa y pendiente sin consola.",
      status: activeTags > 0 ? "ready" : importedTags > 0 ? "working" : "blocked",
      owner: "Tenant",
    },
    {
      label: "Tap físico + riesgo",
      body: "Auditoría confirma taps reales, replay bajo, tamper coherente y mapa de confianza.",
      status: totalScans > 0 && totalDuplicates + totalTamper < Math.max(totalScans * 0.12, 3) ? "ready" : totalScans > 0 ? "working" : "blocked",
      owner: "Auditor",
    },
    {
      label: "Ownership, NFT y experiencia",
      body: "Portal, wallet, tokenización y experiencias verificadas quedan como salida comercial del tap.",
      status: mintedTokens > 0 ? "ready" : "working",
      owner: "Tenant",
    },
  ];

  const demoPacks = [
    { key: "wine-secure", label: "Wine Secure 🍷", tenant: "demobodega", itemId: "demo-item-001" },
    { key: "events-basic", label: "Events Basic 🎟️", tenant: "demoevents", itemId: "demo-item-001" },
    { key: "cosmetics-secure", label: "Cosmetics Secure 🧴", tenant: "democosmetics", itemId: "demo-item-001" },
    { key: "agro-secure", label: "Agro Secure 🌾", tenant: "demoagro", itemId: "demo-item-001" },
    { key: "pharma-secure", label: "Pharma Secure 💊", tenant: "demopharma", itemId: "demo-item-001" },
    { key: "luxury-basic", label: "Luxury Basic 💎", tenant: "demoluxury", itemId: "demo-item-001" },
    { key: "docs-presence", label: "Docs & Presence 📄", tenant: "demodocs", itemId: "demo-item-001" },
    { key: "reseller-flow", label: "Reseller Flow 🤝", tenant: "demoreseller", itemId: "demo-item-001" },
    { key: "government-proof", label: "Government Proof 🏛️", tenant: "demogov", itemId: "demo-item-001" },
    { key: "operator-qa", label: "Operator QA 🔍", tenant: "demoops", itemId: "demo-item-001" },
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
    />
  );
}
