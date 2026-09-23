import {traceRequestScopeAllowed} from "../../../../lib/batch-traceability-access";
import {pilotRequestScopeAllowed} from "../../../../lib/pilot-report-access";
import { forwardSupplierRequest } from "../../../../lib/supplier-request-proxy";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";
import { aggregateTenantMetrics } from "@product/core";
import {
  type DashboardSessionCredential,
  getDashboardSessionCredential,
  isDashboardSessionUpstreamUnavailable,
} from "../../../../lib/session";
import {
  canDemoSandboxAccess,
  isAdminUpstreamAuthorizationOutcome,
  resolveAdminProxyPolicy,
} from "../../../../lib/admin-proxy-policy";
import {
  dashboardCanReadSensitiveAlerts,
  dashboardCanReadSensitiveRiskAnalytics,
  dashboardHighImpactPermissionMatches,
  dashboardPermissionDenied,
  dashboardPermissionMatches,
  isSupplierManifestQuantityOverrideRequest,
  isDashboardHighImpactCapability,
  requiredPermissionForAdminResource,
  requiresMfaForAdminResource,
  requiresSuperAdminForAdminResource,
} from "../../../../lib/permission-policy";
import {
  DashboardTenantScopeError,
  resolveDashboardTenantScope,
} from "../../../../lib/dashboard-tenant-scope-policy";
import { dashboardRoleToScope } from "../../../../lib/enterprise-runtime-rbac";
import { demoConsumerNetworkResource } from "../../../../lib/demo-consumer-network";
import { demoIncidentResource } from "../../../../lib/demo-incidents";
import {
  aggregateDemoGeoPoints,
  demoRuntimeSummary,
  filterDashboardDemoEvents,
  getDashboardDemoEvents,
  getDashboardDemoStreamEvents,
  mergeDemoGeoPoints,
  mergeDemoTrend,
  toDemoAdminEventRow,
  toDemoFeedRow,
} from "../../../../lib/demo-runtime-state";

const API_BASE = productUrls.api;
const MAX_ADMIN_PROXY_BODY_BYTES = 512 * 1024;
const DEFAULT_DEMO_TENANT = { slug: "demo-sandbox", name: "Demo Sandbox" };
const DEMO_TENANT_NAMES: Record<string, string> = {
  "demo-sandbox": "Demo Sandbox",
  demobodega: "Bodega Balmec",
  demoevents: "Demo Events",
};
const DEMO_BATCH = {
  bid: "DEMO-2026-02",
  tenant_id: DEFAULT_DEMO_TENANT.slug,
  tenant_slug: DEFAULT_DEMO_TENANT.slug,
  sku: "GRM-2022-DEMO",
  product_name: "Gran Reserva Malbec",
  winery: "Bodega Balmec",
  region: "Valle de Uco",
  grape_varietal: "Malbec",
  vintage: "2022",
  qty: 10,
  quantity: 10,
  requested_quantity: 10,
  active_tags: 10,
  inactive_tags: 0,
  unit_metadata_rows: 10,
  iot_metadata_rows: 1,
  unit_product_overrides: 0,
  type: "NTAG 424 DNA TT",
  carrier_profile_code: "ntag424_dna_tt",
  carrier_label: "NTAG424 DNA TT",
  carrier_security_level: 5,
  status: "active",
};

function tenantNameFromSlug(slug: string) {
  if (DEMO_TENANT_NAMES[slug]) return DEMO_TENANT_NAMES[slug];
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || DEFAULT_DEMO_TENANT.name;
}

function resolveDemoTenant(input?: unknown) {
  const slug = String(input || "").trim().toLowerCase() || DEFAULT_DEMO_TENANT.slug;
  return { slug, name: tenantNameFromSlug(slug) };
}

function demoBatchFor(tenantSlug: string) {
  return { ...DEMO_BATCH, tenant_id: tenantSlug, tenant_slug: tenantSlug };
}

function isDemoSession(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  return cookie.includes("nexid_dashboard_session=demo.");
}

function markDemoData(res: NextResponse) {
  res.headers.set("x-nexid-demo-data", "DEMO DATA");
  res.headers.set("x-nexid-data-mode", "demo");
  res.headers.set("x-nexid-demo-source", "fallback");
  return res;
}

function dashboardSessionUnavailableResponse() {
  return NextResponse.json(
    { ok: false, reason: "dashboard_session_upstream_unavailable" },
    {
      status: 503,
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "retry-after": "5",
        "x-nexid-auth-outcome": "session-resolver-unavailable",
      },
    },
  );
}

function annotatePayload<T extends Record<string, unknown>>(payload: T, source: "demo" | "production") {
  return {
    ...payload,
    demoMode: source === "demo",
    dataSource: source,
  };
}

function safeParseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readBoundedAdminProxyBody(req: Request, maximumBytes = MAX_ADMIN_PROXY_BODY_BYTES) {
  if (req.method === "GET" || req.method === "HEAD") {
    return { ok: true as const, body: undefined };
  }

  const declared = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > maximumBytes) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, reason: "admin_proxy_request_too_large" },
        { status: 413, headers: { "cache-control": "no-store" } },
      ),
    };
  }

  const reader = req.body?.getReader();
  if (!reader) return { ok: true as const, body: undefined };

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("admin_proxy_request_too_large").catch(() => undefined);
        return {
          ok: false as const,
          response: NextResponse.json(
            { ok: false, reason: "admin_proxy_request_too_large" },
            { status: 413, headers: { "cache-control": "no-store" } },
          ),
        };
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, reason: "admin_proxy_body_read_failed" },
        { status: 400, headers: { "cache-control": "no-store" } },
      ),
    };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true as const, body: total ? new TextDecoder().decode(bytes) : undefined };
}

function demoAdminResponse(method: string, path: string[], body: string, reqUrl?: string) {
  const normalized = path.join("/");
  const url = new URL(reqUrl || `${API_BASE}/admin/${normalized}`);
  const payload = safeParseJson(body);
  const tenantFilter = (url.searchParams.get("tenant") || "").trim().toLowerCase();
  const demoTenant = resolveDemoTenant(tenantFilter);
  const demoBatch = demoBatchFor(demoTenant.slug);
  const consumerNetwork = demoConsumerNetworkResource(method, normalized, demoTenant.slug);
  if (consumerNetwork) {
    return NextResponse.json(consumerNetwork.body, {
      status: consumerNetwork.status,
      headers: {
        "cache-control": "private, no-store, max-age=0",
        ...(consumerNetwork.status === 405 ? { Allow: "GET" } : {}),
      },
    });
  }
  const demoProofHashes = [
    `sha256:${"1".repeat(64)}`,
    `sha256:${"2".repeat(64)}`,
    `sha256:${"3".repeat(64)}`,
  ];
  const parseUidRows = (raw: unknown) => {
    const text = String(raw || "").replace(/^\uFEFF/, "").trim();
    if (!text) return [] as string[];
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [] as string[];
    const header = lines[0].toLowerCase();
    if (header.includes(",")) {
      const columns = lines[0].split(",").map((item) => item.trim().toLowerCase());
      const uidIndex = columns.findIndex((item) => ["uid_hex", "uid", "uidhex"].includes(item));
      if (uidIndex < 0) return [];
      return lines
        .slice(1)
        .map((line) => line.split(",")[uidIndex] || "")
        .map((uid) => uid.trim().toUpperCase())
        .filter((uid) => /^[0-9A-F]{8,20}$/.test(uid));
    }
    return lines
      .map((line) => line.replace(/[,;\s]+/g, "").toUpperCase())
      .filter((line) => line !== "UID_HEX")
      .filter((uid) => /^[0-9A-F]{8,20}$/.test(uid));
  };

  if (method === "GET" && normalized === "batches") {
    return NextResponse.json([demoBatch]);
  }
  if (method === "GET" && normalized.startsWith("batches/") && normalized.endsWith("/summary")) {
    const bid = normalized.split("/")[1] || demoBatch.bid;
    return NextResponse.json({
      ok: true,
      batch: {
        ...demoBatch,
        bid,
        imported_tags: demoBatch.quantity,
        has_meta_key: true,
        has_file_key: true,
        product_identity: {
          source: "batch",
          product_name: demoBatch.product_name,
          sku: demoBatch.sku,
          winery: demoBatch.winery,
          region: demoBatch.region,
          grape_varietal: demoBatch.grape_varietal,
          vintage: demoBatch.vintage,
          harvest_year: "2022",
          barrel_months: "14",
          temperature_storage: "14C",
          target_market: "AR",
          image_url: null,
        },
        unit_metadata: {
          tag_profile_rows: 10,
          unit_metadata_rows: 10,
          iot_metadata_rows: 1,
          unit_product_overrides: 0,
          samples: [
            {
              uid_hex: "04A1B2C3D41090",
              status: "active",
              carrier_profile_code: "ntag424_dna_tt",
              product_override: false,
              product_name: null,
              sku: null,
              lot: "MZA-2026-0424",
              serial: "DEMO-001",
              unit_metadata: { bottle_number: "0001", case_id: "CASE-01" },
              iot: { deviceId: "logger-demo-7", temperatureC: 12.4, humidityPct: 67 },
            },
          ],
        },
        manifests: [
          {
            manifest_type: "csv",
            row_count: 10,
            inserted_count: 10,
            reactivated_count: 0,
            duplicate_count: 0,
            rejected_count: 0,
            import_status: "imported",
            created_at: new Date().toISOString(),
          },
        ],
      },
      demoMode: true,
      dataSource: "demo",
    });
  }
  if (method === "GET" && normalized === "tenants") {
    const demobodegaMetrics = aggregateTenantMetrics({
      counts: { scans: 240, valid: 230, invalid: 10, duplicates: 5, tamper: 1, revoked: 0 },
      geoAnomalyRate: 0.02,
      deviceAnomalyRate: 0.01,
    });
    const demoeventsMetrics = aggregateTenantMetrics({
      counts: { scans: 92, valid: 86, invalid: 6, duplicates: 2, tamper: 0, revoked: 0 },
      geoAnomalyRate: 0.01,
      deviceAnomalyRate: 0.01,
    });
    const rows = [
      { id: "demo-tenant-000", slug: DEFAULT_DEMO_TENANT.slug, name: DEFAULT_DEMO_TENANT.name, created_at: new Date().toISOString(), scans: 0, duplicates: 0, tamper: 0, risk_score: 0 },
      { id: "demo-tenant-001", slug: "demobodega", name: "Bodega Balmec", created_at: new Date().toISOString(), scans: 240, duplicates: 5, tamper: 1, risk_score: demobodegaMetrics.riskScore },
      { id: "demo-tenant-002", slug: "demoevents", name: "Demo Events", created_at: new Date().toISOString(), scans: 92, duplicates: 2, tamper: 0, risk_score: demoeventsMetrics.riskScore },
    ];
    return NextResponse.json(rows);
  }
  if (normalized === "incidents" || normalized.startsWith("incidents/")) {
    const incidents = demoIncidentResource(method, normalized, demoTenant.slug, url.searchParams, getDashboardDemoStreamEvents(160));
    if (incidents) return NextResponse.json(incidents.body, {
      status: incidents.status,
      headers: { "cache-control": "private, no-store", ...(incidents.status === 405 ? { Allow: "GET" } : {}) },
    });
  }
  if (method === "GET" && normalized === "events") {
    const filtered = filterDashboardDemoEvents(getDashboardDemoStreamEvents(160), url.searchParams);
    return NextResponse.json({
      scope: filtered.scope,
      rows: filtered.events.map(toDemoAdminEventRow),
      source: "demo",
      availability: "ready",
    });
  }
  if (method === "GET" && normalized === "analytics") {
    const now = Date.now();
    const trend = Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(now - (6 - index) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const scans = 40 + index * 6;
      return { day, scans, duplicates: Math.max(1, Math.floor(scans * 0.08)), tamper: Math.max(0, Math.floor(scans * 0.03)) };
    });
    const runtimeEvents = getDashboardDemoEvents(80);
    const runtimeGeoPoints = aggregateDemoGeoPoints(runtimeEvents);
    const runtimeSummary = demoRuntimeSummary(runtimeEvents);
    const mergedTrend = mergeDemoTrend(trend, runtimeEvents);
    const latestRuntimeEvent = runtimeEvents[0] || null;
    const scans = mergedTrend.reduce((acc, row) => acc + row.scans, 0);
    const duplicates = mergedTrend.reduce((acc, row) => acc + row.duplicates, 0);
    const tamper = mergedTrend.reduce((acc, row) => acc + row.tamper, 0);
    const invalid = 0;
    const valid = Math.max(scans - invalid, 0);
    const metrics = aggregateTenantMetrics({
      counts: { scans, valid, invalid, duplicates, tamper, revoked: 0 },
      geoAnomalyRate: 0.02,
      deviceAnomalyRate: 0.01,
    });
    const baseCities = [
      { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458, scans: 218, risk: 3.5, lastSeen: new Date(now - 12 * 60 * 1000).toISOString() },
      { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816, scans: 133, risk: 5.6, lastSeen: new Date(now - 42 * 60 * 1000).toISOString() },
      { city: "Córdoba", country: "AR", lat: -31.4167, lng: -64.1833, scans: 50, risk: 4.1, lastSeen: new Date(now - 5 * 60 * 60 * 1000).toISOString() },
      { city: "Santiago", country: "CL", lat: -33.4489, lng: -70.6693, scans: 52, risk: 2.2, lastSeen: new Date(now - 9 * 60 * 1000).toISOString() },
      { city: "San Martin", country: "AR", lat: -34.5744, lng: -58.5358, scans: 38, risk: 2.8, lastSeen: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
      { city: "Montevideo", country: "UY", lat: -34.9011, lng: -56.1645, scans: 31, risk: 3.1, lastSeen: new Date(now - 7 * 60 * 60 * 1000).toISOString() },
    ];
    const mergedCities = mergeDemoGeoPoints(baseCities, runtimeGeoPoints).map((point) => ({
      ...point,
      lastSeen: point.lastSeen || new Date(now).toISOString(),
    }));
    const baseGeoPoints = [
      { city: "Mendoza", country: "AR", scans: 218, risk: 3.5, lat: -32.8895, lng: -68.8458 },
      { city: "Buenos Aires", country: "AR", scans: 133, risk: 5.6, lat: -34.6037, lng: -58.3816 },
      { city: "Santiago", country: "CL", scans: 52, risk: 2.2, lat: -33.4489, lng: -70.6693 },
      { city: "San Martin", country: "AR", scans: 38, risk: 2.8, lat: -34.5744, lng: -58.5358 },
    ];
    const mergedGeoPoints = mergeDemoGeoPoints(baseGeoPoints, runtimeGeoPoints);

    return NextResponse.json(annotatePayload({
      scope: { tenant: demoTenant.slug, source: "demo", range: "30d", country: "all" },
      kpis: {
        scans,
        validRate: scans ? Number(((valid / scans) * 100).toFixed(1)) : 0,
        invalidRate: scans ? Number(((invalid / scans) * 100).toFixed(1)) : 0,
        duplicates,
        tamper,
        activeBatches: 4,
        activeTenants: 1,
        geoRegions: mergedGeoPoints.length,
        resellerPerformance: null,
        riskScore: Number(metrics.riskScore.toFixed(1)),
      },
      billing: { resellerMrrAmount: null, currency: "USD", source: null, period: null },
      geography: {
        countries: [
          { country: "AR", scans: 463, risk: 4.9 },
          { country: "CL", scans: 52, risk: 2.2 },
          { country: "UY", scans: 49, risk: 4.9 },
        ],
        cities: mergedCities,
      },
      devices: {
        os: [{ label: "iOS", count: 262 }, { label: "Android", count: 218 }, { label: "Desktop", count: 32 }],
        browser: [{ label: "Safari", count: 238 }, { label: "Chrome", count: 201 }, { label: "Samsung Internet", count: 48 }, { label: "Edge", count: 25 }],
        deviceType: [{ label: "mobile", count: 465 }, { label: "desktop", count: 32 }, { label: "tablet", count: 15 }],
        timezones: [{ label: "America/Argentina/Mendoza", count: 290 }, { label: "America/Santiago", count: 52 }, { label: "America/Argentina/Buenos_Aires", count: 121 }, { label: "America/Montevideo", count: 68 }],
        mobileShare: 90.8,
      },
      feed: [
        ...runtimeEvents.slice(0, 12).map(toDemoFeedRow),
        { id: 9012, uidHex: "04A1B2C3D4", bid: "DEMO-2026-02", result: "ok", city: "Buenos Aires", country: "AR", device: "iPhone 15 Pro - wine club tap", createdAt: new Date(now - 8 * 60 * 1000).toISOString() },
        { id: 9011, uidHex: "04F1E2D3C4", bid: "DEMO-2026-02", result: "replay", city: "San Martin", country: "AR", device: "Android Pixel 9", createdAt: new Date(now - 25 * 60 * 1000).toISOString() },
      ],
      trend: mergedTrend,
      batchStatus: [{ name: "active", value: 4 }, { name: "paused", value: 1 }, { name: "revoked", value: 0 }],
      geoPoints: mergedGeoPoints,
      deviceSignals: [
        { device: "iPhone 15 Pro", scans: 114, countries: 3, validRate: 95.6, risk: 2.9 },
        { device: "Samsung Galaxy S24", scans: 90, countries: 3, validRate: 88.1, risk: 8.7 },
      ],
      tagJourney: [
        {
          uid: "04A1B2C3D4",
          taps: 41 + runtimeSummary.scans,
          firstSeenAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
          lastSeenAt: latestRuntimeEvent?.created_at || new Date(now - 9 * 60 * 1000).toISOString(),
          originSource: "product_passport_declared",
          origin: { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458 },
          current: latestRuntimeEvent
            ? { city: latestRuntimeEvent.city, country: latestRuntimeEvent.country_code, lat: latestRuntimeEvent.lat, lng: latestRuntimeEvent.lng }
            : { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 },
          lastDevice: latestRuntimeEvent?.device || "iPhone 15 Pro",
        },
      ],
      products: [
        {
          uidHex: "04A1B2C3D4",
          bid: "DEMO-2026-02",
          productName: "Gran Reserva Malbec",
          winery: "Bodega Balmec",
          region: "Valle de Uco",
          vintage: "2022",
          scanCount: 41 + runtimeSummary.scans,
          firstSeenAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
          lastSeenAt: latestRuntimeEvent?.created_at || new Date(now - 9 * 60 * 1000).toISOString(),
          lastVerifiedCity: latestRuntimeEvent?.city || "Buenos Aires",
          lastVerifiedCountry: latestRuntimeEvent?.country_code || "AR",
          tokenization: { status: "minted", network: "Polygon", txHash: "0xabc123demo", tokenId: "8841" },
        },
      ],
    }, "demo"));
  }
  if (method === "GET" && normalized === "notifications") {
    return NextResponse.json({
      ok: true,
      unreadCount: 1,
      counts: { new_leads: 1, open_tickets: 0, new_orders: 0 },
      latest: [
        {
          type: "lead",
          id: "demo-lead-001",
          contact: "demo@nexid.lat",
          title: "Bodega Balmec",
          status: "new",
          created_at: new Date().toISOString(),
        },
      ],
      generatedAt: new Date().toISOString(),
      demoMode: true,
    });
  }
  if (method === "GET" && normalized === "sdk/api-keys") {
    return NextResponse.json({
      ok: true,
      tenant: { slug: demoTenant.slug, name: demoTenant.name },
      usage: { monthRequests: 61, avgLatencyMs: 118 },
      rows: [
        {
          id: "sdk-key-demo-pos",
          tenant_slug: demoTenant.slug,
          name: `${demoTenant.name} POS + SDK`,
          key_prefix: "nxid_live_de",
          scopes: ["sdk:verify", "sdk:claim", "sdk:products", "sdk:events", "sdk:pos"],
          status: "active",
          last_used_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      demoMode: true,
      dataSource: "demo",
    });
  }
  if (method === "POST" && normalized === "sdk/api-keys") {
    return NextResponse.json({
      ok: true,
      tenant: resolveDemoTenant(payload?.tenant || tenantFilter),
      key: {
        id: "sdk-key-demo-new",
        name: String(payload?.name || "SDK demo key"),
        key_prefix: "nxid_live_de",
        scopes: ["sdk:verify", "sdk:claim", "sdk:products", "sdk:events", "sdk:pos"],
        status: "active",
        created_at: new Date().toISOString(),
      },
      secret: "nxid_live_demo_only_not_for_production",
      warning: "Demo fallback secret. Use a real API response for production integrations.",
      demoMode: true,
      dataSource: "demo",
    }, { status: 201 });
  }
  if (method === "POST" && normalized === "sdk/claim-policy") {
    return NextResponse.json({
      ok: true,
      tenant: resolveDemoTenant(payload?.tenant || tenantFilter).slug,
      bid: String(payload?.bid || "DEMO-2026-02"),
      policy: {
        activeForClaim: Boolean(payload?.activeForClaim ?? true),
        claimPinRequired: Boolean(payload?.claimPinRequired),
        claimRequiresPos: Boolean(payload?.claimRequiresPos ?? true),
        autoClaimEnabled: Boolean(payload?.autoClaimEnabled ?? true),
        pinUpdated: Boolean(payload?.pin),
      },
      demoMode: true,
      dataSource: "demo",
    });
  }
  if (method === "GET" && normalized === "webhooks") {
    return NextResponse.json([
      {
        id: "webhook-demo-erp",
        tenant_slug: demoTenant.slug,
        name: "ERP / CRM demo webhook",
        url: "https://cliente.example/api/nexid",
        enabled: true,
        events: ["sdk.verify", "sdk.claim.created", "sdk.pos.activated"],
        has_signing_secret: true,
        updated_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      },
    ]);
  }
  if (method === "POST" && normalized === "webhooks") {
    return NextResponse.json({
      ok: true,
      tenant: resolveDemoTenant(payload?.tenant || tenantFilter),
      endpoint: {
        id: "webhook-demo-new",
        name: String(payload?.name || "SDK enterprise webhook"),
        url: String(payload?.url || "https://cliente.example/api/nexid"),
        enabled: Boolean(payload?.enabled ?? true),
        events: Array.isArray(payload?.events) ? payload.events : ["sdk.verify", "sdk.claim.created"],
        has_signing_secret: Boolean(payload?.signingSecret || payload?.signing_secret),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      demoMode: true,
      dataSource: "demo",
    }, { status: 201 });
  }
  if (method === "GET" && normalized === "logistics/shipments") {
    const shipments = [
      {
        id: "demo-secure-delivery-001",
        tenant_id: demoTenant.slug,
        tenant_slug: demoTenant.slug,
        shipment_code: "SDL-DEMO-BALMEC-001",
        status: "IN_TRANSIT",
        tracking_number: "VIP-WINE-7421",
        origin_address: "Valle de Uco warehouse",
        destination_address: "Zurich collector delivery",
        sender_name: "Bodega Balmec",
        recipient_name: "Premium buyer",
        courier_id: "private-courier",
        carrier_name: "Private Courier",
        item_count: 1,
        item_quantity: 1,
        seal_count: 1,
        custody_event_count: 3,
        verification_count: 0,
        claim_count: 0,
        created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      },
    ];
    return NextResponse.json(annotatePayload({
      ok: true,
      shipments,
      stats: { total: 1, in_transit: 1, delivered: 0, alerts: 0 },
    }, "demo"));
  }
  if (method === "GET" && normalized.startsWith("logistics/shipments/")) {
    const shipmentId = normalized.split("/")[2] || "demo-secure-delivery-001";
    const shipment = {
      id: shipmentId,
      tenant_id: demoTenant.slug,
      tenant_slug: demoTenant.slug,
      tenant_name: demoTenant.name,
      shipment_code: shipmentId === "demo-secure-delivery-001" ? "SDL-DEMO-BALMEC-001" : shipmentId,
      status: "IN_TRANSIT",
      tracking_number: "VIP-WINE-7421",
      origin_address: "Valle de Uco warehouse",
      destination_address: "Zurich collector delivery",
      sender_name: "Bodega Balmec",
      recipient_name: "Premium buyer",
      courier_id: "private-courier",
      carrier_name: "Private Courier",
      item_count: 1,
      item_quantity: 1,
      seal_count: 1,
      custody_event_count: 3,
      verification_count: 1,
      claim_count: 0,
      created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      last_custody_event_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    };
    return NextResponse.json(annotatePayload({
      ok: true,
      shipment,
      items: [
        { id: "demo-item-001", product_name: "Gran Reserva Malbec sealed case", quantity: 1, created_at: shipment.created_at },
      ],
      seals: [
        {
          id: "demo-package-seal-001",
          seal_id: "demo-seal-inventory-001",
          uid_hex: "04AABBCCDD1090",
          status: "IN_TRANSIT",
          inventory_status: "IN_TRANSIT",
          applied_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
        },
      ],
      custodyEvents: [
        { id: "demo-custody-001", event_type: "SEALED", location: "Valle de Uco packing bench", scanned_by: "ops@nexid.lat", notes: "Seal applied to premium package.", created_at: new Date(Date.now() - 70 * 60 * 1000).toISOString() },
        { id: "demo-custody-002", event_type: "IN_TRANSIT", location: "Private courier hub", scanned_by: "courier@nexid.lat", notes: "Courier handoff with TTSTATUS closed.", created_at: new Date(Date.now() - 42 * 60 * 1000).toISOString() },
        { id: "demo-custody-003", event_type: "VERIFY_PENDING", location: "Zurich route", scanned_by: "system", notes: "Awaiting recipient verification.", created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
      ],
      verifications: [
        { id: "demo-verification-001", recipient_name: "Premium buyer", verification_method: "NFC_TAP", status: "pending", verified_at: null, created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString() },
      ],
      claims: [],
    }, "demo"));
  }
  if (method === "POST" && normalized === "logistics/shipments") {
    const now = Date.now();
    const shipment = {
      id: `demo-secure-delivery-${now}`,
      tenantId: resolveDemoTenant(payload?.tenant_slug || payload?.tenant || tenantFilter).slug,
      shipmentCode: String(payload?.shipment_code || `SDL-DEMO-${String(now).slice(-6)}`),
      status: "draft",
      trackingNumber: String(payload?.tracking_number || payload?.trackingNumber || "DEMO-TRACKING"),
      itemCount: Array.isArray(payload?.items) ? payload.items.length : 1,
    };
    return NextResponse.json(annotatePayload({ ok: true, shipment }, "demo"), { status: 201 });
  }
  if (method === "POST" && normalized.startsWith("logistics/shipments/") && normalized.endsWith("/claims")) {
    return NextResponse.json(annotatePayload({
      ok: true,
      claim: {
        id: `demo-claim-${Date.now()}`,
        issue_type: String(payload?.issue_type || "tamper_report"),
        description: String(payload?.description || "Demo claim opened"),
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }, "demo"), { status: 201 });
  }
  if (method === "POST" && normalized === "logistics/scan") {
    const context = String(payload?.context || "APPLY").toUpperCase();
    const ttRaw = String(payload?.tt_raw || payload?.ttRaw || "4343").toUpperCase();
    const tamperState = ttRaw === "4343" ? "closed" : ttRaw ? "opened" : "unknown";
    const newStatus = tamperState !== "closed"
      ? context === "VERIFY" && tamperState === "opened" ? "DELIVERED_OPENED" : "QUARANTINED"
      : context === "APPLY" ? "SEALED" : context === "HANDOFF" ? "IN_TRANSIT" : "DELIVERED_CLOSED";
    return NextResponse.json(annotatePayload({
      ok: true,
      tenant: resolveDemoTenant(payload?.tenant_slug || payload?.tenant || tenantFilter),
      context,
      data: {
        sealId: "demo-seal-inventory-001",
        previousStatus: context === "APPLY" ? "UNASSIGNED" : "SEALED",
        newStatus,
        shipmentId: String(payload?.shipment_id || payload?.shipmentId || "demo-secure-delivery-001"),
        tamperState,
      },
    }, "demo"));
  }
  if (method === "GET" && normalized === "webhook-deliveries") {
    return NextResponse.json([
      {
        id: "delivery-demo-001",
        tenant_slug: demoTenant.slug,
        url: "https://cliente.example/api/nexid",
        event_name: "sdk.pos.activated",
        status_code: 200,
        ok: true,
        attempt_count: 1,
        last_error: null,
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        delivered_at: new Date(Date.now() - 10 * 60 * 1000 + 1200).toISOString(),
      },
    ]);
  }
  if (method === "GET" && normalized === "tags") {
    return NextResponse.json(annotatePayload({
      scope: { tenant: demoTenant.slug, source: "demo", range: "30d", country: "all", query: "", offset: 0, limit: 100 },
      totals: { total: 3, active_tags: 3, non_active_tags: 0, minted_tags: 1, pending_tokenization: 2 },
      rows: [
        {
          uidHex: "04A1B2C3D4",
          bid: "DEMO-2026-02",
          tenantSlug: demoTenant.slug,
          product: { name: "Gran Reserva Malbec", winery: "Bodega Balmec", region: "Valle de Uco", vintage: "2022" },
          status: { tag: "active", lastResult: "ok" },
          scans: { count: 41, firstSeenAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), lastSeenAt: new Date(Date.now() - 9 * 60 * 1000).toISOString() },
          lastVerifiedLocation: { city: "Buenos Aires", country: "AR" },
          tokenization: { status: "minted", network: "Polygon", txHash: "0xabc123demo", tokenId: "8841" },
        },
      ],
    }, "demo"));
  }
  if (method === "GET" && normalized === "product-assets") {
    return NextResponse.json({
      ok: true,
      count: 1,
      items: [
        {
          tenantSlug: demoTenant.slug,
          bid: "DEMO-2026-02",
          uidHex: "04A1B2C3D4",
          uidMasked: "04A1****C3D4",
          tagStatus: "active",
          unitMetadata: { lot: "MZA-2026-0424", serial: "DEMO-001", unitMetadata: { bottle_number: "0001", case_id: "CASE-01" } },
          iot: { deviceId: "logger-demo-7", temperatureC: 12.4, humidityPct: 67 },
          assetReadiness: "0 reales / 4 demo / 1 pendientes",
          profile: {
            productName: "Gran Reserva Malbec",
            brandName: "Bodega Balmec",
            verticalLabel: "Vinos y bebidas premium",
            primaryImageUrl: null,
            labelImageUrl: null,
            modelUrl: null,
            galleryUrls: [],
            assetScore: 64,
            uploadChecklist: ["Foto producto", "Etiqueta frontal", "Foto tag aplicado", "Ficha comercial", "Reglas claim/NFT", "Modelo GLB opcional"],
            slots: [],
          },
        },
      ],
      demoMode: true,
      dataSource: "demo",
    });
  }
  if (method === "POST" && normalized === "product-assets") {
    return NextResponse.json({
      ok: true,
      item: {
        tenantSlug: resolveDemoTenant(payload?.tenantSlug || tenantFilter).slug,
        bid: String(payload?.bid || "DEMO-2026-02"),
        uidHex: payload?.uidHex ? String(payload.uidHex) : null,
        productName: String(payload?.productName || "Gran Reserva Malbec"),
        brandName: String(payload?.brandName || "Bodega Balmec"),
        imageUrl: payload?.imageUrl ? String(payload.imageUrl) : null,
        labelImageUrl: payload?.labelImageUrl ? String(payload.labelImageUrl) : null,
        modelUrl: payload?.modelUrl ? String(payload.modelUrl) : null,
        galleryUrls: Array.isArray(payload?.galleryUrls) ? payload.galleryUrls : [],
        assetScore: payload?.imageUrl ? 80 : 64,
      },
      demoMode: true,
      dataSource: "demo",
    });
  }
  if (method === "GET" && normalized === "proof/events") {
    return NextResponse.json({
      ok: true,
      events: [
        { id: "demo-proof-event-001", resource_type: "wine_batch", resource_id: demoBatch.bid, event_type: "origin_attested", payload_hash: demoProofHashes[0], created_at: new Date(Date.now() - 55 * 60 * 1000).toISOString() },
        { id: "demo-proof-event-002", resource_type: "wine_batch", resource_id: demoBatch.bid, event_type: "qa_release", payload_hash: demoProofHashes[1], created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString() },
        { id: "demo-proof-event-003", resource_type: "wine_batch", resource_id: demoBatch.bid, event_type: "first_valid_tap", payload_hash: demoProofHashes[2], created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString() },
      ],
      demoMode: true,
      dataSource: "demo",
    });
  }
  if (method === "GET" && normalized === "proof/anchors") {
    return NextResponse.json({
      ok: true,
      anchors: [
        {
          id: "demo-anchor-local-001",
          provider: "none",
          network: "local",
          anchor_type: "merkle_root",
          resource_type: "wine_batch",
          resource_id: demoBatch.bid,
          merkle_root: `sha256:${"a".repeat(64)}`,
          event_hashes_json: demoProofHashes,
          tx_hash: null,
          explorer_url: null,
          status: "local",
          anchored_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
          event_count: demoProofHashes.length,
        },
      ],
      demoMode: true,
      dataSource: "demo",
    });
  }
  if (method === "GET" && normalized === "proof/providers") {
    return NextResponse.json({
      ok: true,
      providers: [
        { id: "none", name: "Local proof", network: "local", capability: "tenant_evidence", policy_enabled: true, runtime_status: "ready", write_enabled: true, configured: { rpc: false, contract: false, signer: false }, mode: "local_registry" },
        { id: "iota", name: "IOTA EVM Testnet", network: "testnet", capability: "hash_only_integrity", policy_enabled: false, runtime_status: "policy_disabled", write_enabled: false, configured: { rpc: false, contract: false, signer: false }, mode: "public_testnet_reference" },
        { id: "polygon", name: "Polygon Amoy", network: "amoy", capability: "ownership", policy_enabled: false, runtime_status: "policy_disabled", write_enabled: false, configured: { rpc: false, contract: false, signer: false }, mode: "public_testnet_reference" },
      ],
      demoMode: true,
      dataSource: "demo",
    });
  }
  if (method === "GET" && normalized === "tokenization/requests") {
    return NextResponse.json({
      ok: true,
      rows: [
        {
          id: "tok-demo-001",
          tenant_slug: demoTenant.slug,
          bid: "DEMO-2026-02",
          uid_hex: "04A1B2C3D4",
          status: "simulated",
          network: "simulation",
          tx_hash: null,
          token_id: null,
          external_ref: "simulation:demo-asset-001",
          requested_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        },
        {
          id: "tok-demo-002",
          tenant_slug: demoTenant.slug,
          bid: "DEMO-2026-02",
          uid_hex: "04FFEEDDCC",
          status: "pending",
          network: "polygon-amoy",
          tx_hash: null,
          token_id: null,
          requested_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        },
      ],
    });
  }
  if (method === "POST" && normalized === "tokenization/requests") {
    return NextResponse.json({
      ok: true,
      status: "simulated",
      simulated: true,
      request_id: "tok-demo-002",
      simulation_ref: "simulation:demo-asset-002",
      tx_hash: null,
      token_id: null,
      network: "simulation",
    });
  }
  if (method === "GET" && normalized === "security-alerts") {
    return NextResponse.json({
      ok: true,
      scope: { tenant: demoTenant.slug, hours: 24 },
      summary: { repeatedInvalidUid: 1, geoVelocityAlerts: 1 },
      repeatedInvalidUid: [
        { uidHex: "04F1E2D3C4", count: 3, lastSeen: new Date(Date.now() - 15 * 60 * 1000).toISOString(), severity: "high" },
      ],
      geoVelocityAlerts: [
        {
          uidHex: "04A1B2C3D4",
          fromCountry: "AR",
          toCountry: "CL",
          fromAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
          toAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          severity: "critical",
        },
      ],
    });
  }
  if (method === "GET" && normalized === "alerts") {
    return NextResponse.json({
      ok: true,
      items: [
        { id: "alert-demo-001", type: "replay_spike", severity: "high", status: "open", tenant_slug: demoTenant.slug, created_at: new Date().toISOString(), title: "Replay spike detected" },
      ],
    });
  }
  if (method === "GET" && normalized === "alert-rules") {
    return NextResponse.json({
      ok: true,
      items: [
        { id: "rule-demo-001", tenant_slug: demoTenant.slug, type: "replay_spike", severity: "high", threshold: 2, window_minutes: 60, enabled: true },
      ],
    });
  }
  if (method === "GET" && normalized === "polygon/wallet") {
    return NextResponse.json({
      ok: true,
      ready: true,
      chainReady: false,
      network: "polygon-amoy",
      chainId: null,
      wallet: null,
      balancePol: 0,
      mode: "simulated",
      autoTokenize: false,
      useLocalMinter: false,
      rpc: { configured: false, url: null },
      executor: { configured: false, url: null, secretConfigured: false },
      contract: { address: null, deployed: false },
      minter: {
        address: null,
        configuredAddress: null,
        configured: false,
        balancePol: null,
      },
      recipient: { address: null, balancePol: null },
      metadataPrefix: "nexid-metadata",
      checks: [
        { key: "mode", label: "TOKENIZATION_MODE", status: "pass", detail: "simulated" },
        { key: "simulation", label: "Simulation boundary", status: "pass", detail: "No tx hash or token ID is created." },
        { key: "contract_code", label: "Contract bytecode", status: "warn", detail: "Not checked in demo fallback." },
        { key: "minter_gas", label: "Minter gas", status: "warn", detail: "Not used in simulation." },
      ],
    });
  }
  if (method === "GET" && normalized.startsWith("tags/") && normalized.endsWith("/passport")) {
    const uid = normalized.split("/")[1] || "04A1B2C3D4";
    return NextResponse.json({
      ok: true,
      scope: { tenant: demoTenant.slug, source: "demo", range: "30d", country: "all" },
      passport: {
        identity: { uidHex: uid, bid: "DEMO-2026-02", tenantSlug: demoTenant.slug, tagStatus: "active", readCounter: 58, scanCount: 41 },
        product: { productName: "Gran Reserva Malbec", winery: "Bodega Balmec", region: "Valle de Uco", vintage: "2022", varietal: "Malbec" },
        provenance: {
          origin: { harvestYear: "2022", barrelMonths: 12, temperatureStorage: 16 },
          firstVerified: { at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), city: "Mendoza", country: "AR" },
          lastVerified: { at: new Date(Date.now() - 9 * 60 * 1000).toISOString(), result: "ok", city: "Buenos Aires", country: "AR", deviceLabel: "iPhone 15 Pro" },
        },
        tokenization: { status: "simulated", network: "simulation", txHash: null, tokenId: null },
      },
      timeline: [
        {
          id: 9012,
          createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
          result: "ok",
          reason: "sun_ok",
          source: "demo",
          location: { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 },
          device: { label: "iPhone 15 Pro", os: "iOS", browser: "Safari", deviceType: "mobile", timezone: "America/Argentina/Buenos_Aires" },
        },
      ],
    });
  }
  if (method === "POST" && normalized === "tenants") {
    return NextResponse.json({
      id: "demo-tenant-001",
      slug: String(payload?.slug || demoTenant.slug),
      name: String(payload?.name || demoTenant.name),
      created_at: new Date().toISOString(),
    }, { status: 201 });
  }
  if (method === "POST" && normalized === "batches") {
    return NextResponse.json({
      ok: false,
      reason: "manual_key_registration_blocked",
      message: "Supplier batches must be created from Supplier Order so keys are generated server-side and exported as encrypted one-time packs.",
      next: "/batches/supplier#supplier-order-console",
    }, { status: 409 });
  }
  if (method === "POST" && normalized === "batches/register") {
    return NextResponse.json({
      ok: false,
      reason: "manual_key_registration_blocked",
      message: "Legacy batch registration with plaintext keys is disabled. Use Supplier Order and Tenant Vault.",
      next: "/batches/supplier#supplier-order-console",
    }, { status: 409 });
  }
  if (method === "POST" && normalized.endsWith("/import-uids")) {
    const uids = Array.isArray(payload?.uids) ? payload?.uids : [];
    return NextResponse.json({
      ok: true,
      batch: normalized.split("/")[1] || demoBatch.bid,
      imported: uids.length,
      ignored: 0,
    });
  }
  if (method === "POST" && normalized.endsWith("/activate-all")) {
    return NextResponse.json({
      ok: true,
      batch: normalized.split("/")[1] || demoBatch.bid,
      activated: Number(payload?.limit || 10),
    });
  }
  if (method === "POST" && normalized.endsWith("/import-manifest")) {
    const importedRows = parseUidRows(payload?.csv).length;
    return NextResponse.json({
      ok: true,
      batch: demoBatch.bid,
      importedRows,
      activated: payload?.activateImported ? importedRows : 0,
      ignored: 0,
      manifestBatchIds: [demoBatch.bid],
    });
  }
  if (method === "POST" && normalized === "tags/activate") {
    return NextResponse.json({
      ok: true,
      batch: String(payload?.bid || demoBatch.bid),
      activated: Number(payload?.count || 1),
      requested: Number(payload?.count || 1),
    });
  }
  if (method === "POST" && normalized.endsWith("/revoke")) {
    return NextResponse.json({
      ok: true,
      batch: normalized.split("/")[1] || demoBatch.bid,
      reason: String(payload?.reason || "manual revoke"),
      status: "revoked",
    });
  }
  if (method === "POST" && normalized === "sun/validate") {
    const reason = String(payload?.url || payload?.sampleUrl || "").trim() ? "Demo validator executed" : "missing sun params";
    const valid = reason !== "missing sun params";
    return NextResponse.json(
      {
        ok: valid,
        result: valid ? "VALID" : "INVALID",
        human_status: valid ? "VALID" : "INVALID",
        reason,
        status_hint: valid ? "VALID" : "INVALID",
        parsed: {
          bid: "DEMO-2026-02",
          uid_hex: "0487856A0B1090",
          picc_data: "DEMO",
        },
        next_step: valid ? "Batch and tag are ready to scan." : "Paste a full /sun URL with bid, picc_data, enc and cmac.",
      },
      { status: valid ? 200 : 400 },
    );
  }
  if (method === "POST" && normalized === "leads") {
    return NextResponse.json(
      {
        ok: true,
        lead: {
          id: "demo-lead-001",
          source: String(payload?.source || "dashboard_demo"),
          interest: String(payload?.interest || "request_demo"),
          email: String(payload?.email || "demo@nexid.lat"),
          created_at: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  }
  if (method === "POST" && normalized === "users") {
    return NextResponse.json({ ok: true, userId: "demo-user-001" });
  }
  return NextResponse.json(annotatePayload({ ok: true, demo: true, path: normalized }, "demo"));
}

async function forward(req: Request, path: string[]) {
  const normalizedPath = path.join("/");
  if (normalizedPath === "supplier-requests" || normalizedPath.startsWith("supplier-requests/")) return forwardSupplierRequest(req, path.slice(1));
  const ticketPatch = req.method === "PATCH" && /^tickets\/[^/]+$/.test(normalizedPath);
  const criticalGet = req.method === "GET" && (normalizedPath === "analytics" || normalizedPath === "sun/physical-taps" || normalizedPath === "security-alerts" || normalizedPath === "alerts" || normalizedPath === "alert-rules" || normalizedPath === "tokenization/requests" || normalizedPath === "polygon/wallet");
  const reqUrl = new URL(req.url);
  const forceSandbox = ["1", "true", "sandbox"].includes(String(reqUrl.searchParams.get("sandbox") || reqUrl.searchParams.get("demoFallback") || "").toLowerCase());
  reqUrl.searchParams.delete("sandbox");
  reqUrl.searchParams.delete("demoFallback");
  const requireScopedAdminAuth = String(process.env.REQUIRE_SCOPED_ADMIN_AUTH || "").toLowerCase() === "true";
  const allowDemoFallback = String(process.env.DEMO_FALLBACK_ALLOWED || process.env.DASHBOARD_ALLOW_DEMO_FALLBACK || "").toLowerCase() === "true";
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const demoModeExplicit = String(process.env.DEMO_MODE || process.env.DASHBOARD_DEMO_MODE || process.env.NEXT_PUBLIC_DEMO_MODE || "").toLowerCase() === "true";
  const policy = resolveAdminProxyPolicy({
    isProduction,
    demoMode: demoModeExplicit,
    demoFallbackAllowed: allowDemoFallback,
    requireScopedAdminAuth,
  });
  let credential: DashboardSessionCredential | null;
  try {
    credential = await getDashboardSessionCredential({ persistRotation: true });
  } catch (error) {
    if (isDashboardSessionUpstreamUnavailable(error)) {
      return dashboardSessionUnavailableResponse();
    }
    throw error;
  }
  const dashboardSession = credential?.session || null;
  const demoSession = Boolean(dashboardSession?.isDemo) || isDemoSession(req);
  const scopedRole = demoSession ? "readonly_demo" : dashboardSession?.role ? dashboardRoleToScope(dashboardSession.role) : null;
  const allowDemoFallbackForRequest = policy.allowDemoFallback || (demoSession && !isProduction);

  if ((req.method === "GET" && /^tickets\/[^/]+(?:\/history)?$/.test(normalizedPath)) || ticketPatch) {
    if (ticketPatch && (req.headers.get("origin") !== reqUrl.origin || (req.headers.has("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin"))) {
      return NextResponse.json({ ok: false, reason: "ticket_transition_origin_forbidden" }, { status: 403 });
    }
    if (ticketPatch && !/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")) {
      return NextResponse.json({ ok: false, reason: "ticket_transition_json_required" }, { status: 415 });
    }
    if (demoSession || forceSandbox) return NextResponse.json({ ok: false, reason: "ticket_lookup_demo_unavailable" }, { status: 403 });
    if (reqUrl.searchParams.getAll("tenant").length > 1) return NextResponse.json({ ok: false, reason: "ticket_tenant_invalid" }, { status: 400 });
    const requested = (reqUrl.searchParams.get("tenant") || "").trim().toLowerCase();
    if (dashboardSession && dashboardSession.role !== "super-admin" && requested && requested !== String(dashboardSession.tenantSlug || "").trim().toLowerCase()) {
      return NextResponse.json({ ok: false, reason: "ticket_not_found" }, { status: 404, headers: { "x-nexid-data-mode": "production" } });
    }
  }

  if (dashboardSession && !scopedRole) {
    console.info("[admin_proxy_access_denied]", JSON.stringify({ reason: "unsupported_dashboard_role", method: req.method, path: normalizedPath }));
    return NextResponse.json({ ok: false, reason: "unsupported_dashboard_role" }, { status: 403 });
  }

  if (dashboardSession && /^batches\/[^/]+\/traceability(?:\/page)?$/.test(normalizedPath) && (reqUrl.searchParams.getAll("tenant").length>1 || !traceRequestScopeAllowed(dashboardSession,reqUrl.searchParams.get("tenant")))) {
    return NextResponse.json({ok:false,reason:"trace_tenant_forbidden"},{status:403,headers:{"cache-control":"private, no-store"}});
  }
  if (dashboardSession && /^batches\/[^/]+\/passport-library$/.test(normalizedPath) && (reqUrl.searchParams.getAll('tenant').length>1 || !traceRequestScopeAllowed(dashboardSession,reqUrl.searchParams.get('tenant')))) return NextResponse.json({ok:false,reason:'library_tenant_forbidden'},{status:403,headers:{'cache-control':'private, no-store'}});
  if (dashboardSession && normalizedPath === "passport-editorial/queue" && (reqUrl.searchParams.getAll("tenant").length>1 || !traceRequestScopeAllowed(dashboardSession,reqUrl.searchParams.get("tenant")))) return NextResponse.json({ok:false,reason:"editorial_queue_tenant_forbidden"},{status:403,headers:{"cache-control":"private, no-store"}});
  if (dashboardSession && (normalizedPath === "pilot-report" || normalizedPath === "pilot-report/options") && !pilotRequestScopeAllowed(dashboardSession,reqUrl.searchParams.get("tenant"))) {
    return NextResponse.json({ok:false,reason:"pilot_tenant_forbidden"},{status:403,headers:{"cache-control":"private, no-store"}});
  }

  if (dashboardSession) {
    try {
      const tenantScope = resolveDashboardTenantScope(dashboardSession, reqUrl.searchParams.get("tenant"));
      if (tenantScope.tenantSlug) reqUrl.searchParams.set("tenant", tenantScope.tenantSlug);
      else reqUrl.searchParams.delete("tenant");
    } catch (error) {
      if (error instanceof DashboardTenantScopeError) {
        console.info("[admin_proxy_access_denied]", JSON.stringify({ reason: error.code, method: req.method, path: normalizedPath }));
        return NextResponse.json({ ok: false, reason: error.code }, { status: 403 });
      }
      throw error;
    }
  }

  const superadminUpstream = normalizedPath.startsWith("superadmin/");
  if (superadminUpstream && dashboardSession?.role !== "super-admin") {
    return NextResponse.json({ ok: false, reason: "super_admin_required" }, { status: 403 });
  }
  if (requiresSuperAdminForAdminResource(req.method, normalizedPath) && dashboardSession?.role !== "super-admin") {
    return NextResponse.json({ ok: false, reason: "super_admin_required" }, { status: 403 });
  }
  const target = superadminUpstream
    ? `${API_BASE}/${path.join("/")}${reqUrl.search}`
    : `${API_BASE}/admin/${path.join("/")}${reqUrl.search}`;

  if (isProduction && !scopedRole) {
    return NextResponse.json(
      { ok: false, reason: "Dashboard session required for admin proxy access." },
      { status: 401 },
    );
  }

  const requiredPermission = requiredPermissionForAdminResource(req.method, normalizedPath);
  const hasRequiredPermission = requiredPermission && dashboardSession
    ? isDashboardHighImpactCapability(requiredPermission)
      ? dashboardHighImpactPermissionMatches(
          dashboardSession.role,
          dashboardSession.permissions,
          requiredPermission,
          dashboardSession.deniedPermissions,
        )
      : dashboardSession.role === "super-admin"
        ? !dashboardPermissionDenied(dashboardSession.deniedPermissions, requiredPermission)
        : dashboardPermissionMatches(
            dashboardSession.permissions,
            requiredPermission,
            dashboardSession.deniedPermissions,
          )
    : true;
  if (
    requiredPermission
    && dashboardSession
    && !hasRequiredPermission
  ) {
    console.info("[admin_proxy_access_denied]", JSON.stringify({ reason: "permission_required", requiredPermission, method: req.method, path: normalizedPath }));
    return NextResponse.json(
      { ok: false, reason: `${requiredPermission} permission required.` },
      { status: 403 },
    );
  }
  if (
    dashboardSession
    && req.method === "GET"
    && normalizedPath === "risk-analytics"
    && !dashboardCanReadSensitiveRiskAnalytics(
      dashboardSession.role,
      dashboardSession.permissions,
      dashboardSession.deniedPermissions,
    )
  ) {
    console.info("[admin_proxy_access_denied]", JSON.stringify({
      reason: "sensitive_risk_analytics_permissions_required",
      requiredPermissions: ["reports.export", "events.read_sensitive"],
      method: req.method,
      path: normalizedPath,
    }));
    return NextResponse.json(
      { ok: false, reason: "reports.export and events.read_sensitive permissions required." },
      { status: 403 },
    );
  }
  if (
    dashboardSession
    && req.method === "GET"
    && (normalizedPath === "alerts" || normalizedPath === "security-alerts")
    && !dashboardCanReadSensitiveAlerts(
      dashboardSession.role,
      dashboardSession.permissions,
      dashboardSession.deniedPermissions,
    )
  ) {
    console.info("[admin_proxy_access_denied]", JSON.stringify({
      reason: "sensitive_alert_permissions_required",
      requiredPermissions: ["audit.read", "events.read_sensitive"],
      method: req.method,
      path: normalizedPath,
    }));
    return NextResponse.json(
      { ok: false, reason: "audit.read and events.read_sensitive permissions required." },
      { status: 403 },
    );
  }
  if (
    dashboardSession
    && requiresMfaForAdminResource(req.method, normalizedPath)
    && dashboardSession.mfaVerified !== true
  ) {
    console.info("[admin_proxy_access_denied]", JSON.stringify({ reason: "mfa_required", method: req.method, path: normalizedPath }));
    return NextResponse.json(
      { ok: false, reason: "mfa_required" },
      { status: 403 },
    );
  }

  if (demoSession && scopedRole === "readonly_demo" && !canDemoSandboxAccess(req.method, normalizedPath)) {
    console.info("[admin_proxy_access_denied]", JSON.stringify({ reason: "readonly_demo_mutation_blocked", method: req.method, path: normalizedPath }));
    return NextResponse.json(
      { ok: false, reason: "readonly_demo scope only allows demo-safe reads and explicit non-persistent simulations." },
      { status: 403 },
    );
  }

  const bodyResult = await readBoundedAdminProxyBody(req, ticketPatch ? 16 * 1024 : MAX_ADMIN_PROXY_BODY_BYTES);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;
  if (ticketPatch) {
    const parsed = safeParseJson(body || "");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ ok: false, reason: "ticket_transition_invalid" }, { status: 400 });
  }

  if (
    isSupplierManifestQuantityOverrideRequest(req.method, normalizedPath, body || "")
    && dashboardSession?.role !== "super-admin"
  ) {
    return NextResponse.json({ ok: false, reason: "supplier_manifest_quantity_override_forbidden" }, { status: 403 });
  }

  if (demoSession && scopedRole === "readonly_demo") {
    console.info("[admin_proxy_demo_sandbox]", JSON.stringify({ method: req.method, path: normalizedPath }));
    return markDemoData(demoAdminResponse(req.method, path, body || "", req.url));
  }

  if (!isProduction && forceSandbox && normalizedPath.startsWith("logistics/")) {
    console.info("[admin_proxy_local_logistics_demo]", JSON.stringify({ method: req.method, path: normalizedPath, scopedRole: scopedRole || "none" }));
    return markDemoData(demoAdminResponse(req.method, path, body || "", req.url));
  }

  const unavailable = (reason: string) => {
    if (req.method === "GET" && normalizedPath === "analytics") {
      return NextResponse.json(annotatePayload({
        ok: false,
        reason,
        scope: { source: "unavailable", tenant: "unknown", range: "24h", country: "all" },
        kpis: { scans: 0, validRate: 0, invalidRate: 0, duplicates: 0, tamper: 0, activeBatches: 0, activeTenants: 0, geoRegions: 0, resellerPerformance: null },
        billing: { resellerMrrAmount: null, currency: "USD", source: null, period: null },
        geography: { countries: [], cities: [] },
        devices: { os: [], browser: [], deviceType: [], timezones: [], mobileShare: 0 },
        feed: [],
        trend: [],
        batchStatus: [],
        geoPoints: [],
        deviceSignals: [],
        tagJourney: [],
        products: [],
      }, "production"));
    }
    if (req.method === "GET" && normalizedPath === "security-alerts") {
      return NextResponse.json(annotatePayload({
        ok: false,
        reason,
        scope: { source: "unavailable", hours: 24 },
        summary: { repeatedInvalidUid: 0, geoVelocityAlerts: 0 },
        repeatedInvalidUid: [],
        geoVelocityAlerts: [],
      }, "production"));
    }
    if (req.method === "GET" && normalizedPath === "alerts") {
      return NextResponse.json(annotatePayload({ ok: false, reason, items: [] }, "production"));
    }
    if (req.method === "GET" && normalizedPath === "alert-rules") {
      return NextResponse.json(annotatePayload({ ok: false, reason, items: [] }, "production"));
    }
    if (req.method === "GET" && normalizedPath === "tokenization/requests") {
      return NextResponse.json(annotatePayload({ ok: false, reason, rows: [] }, "production"));
    }
    if (req.method === "GET" && normalizedPath === "polygon/wallet") {
      return NextResponse.json(annotatePayload({
        ok: false,
        reason,
        ready: false,
        mode: "unknown",
        network: "polygon-amoy",
        chainId: null,
        autoTokenize: false,
        useLocalMinter: false,
        balancePol: 0,
        wallet: null,
        rpc: { configured: false, url: null },
        executor: { configured: false, url: null, secretConfigured: false },
        contract: { address: null, deployed: false },
        minter: { address: null, configuredAddress: null, configured: false, balancePol: null },
        recipient: { address: null, balancePol: null },
        metadataPrefix: null,
        checks: [{ key: "admin_proxy", label: "Admin proxy", status: "fail", detail: reason }],
      }, "production"));
    }
    return NextResponse.json(annotatePayload({ ok: false, reason }, "production"), { status: 502 });
  };

  if (!credential?.bearerToken && (!demoSession || !allowDemoFallbackForRequest)) {
    return unavailable("A validated dashboard session is required. Real tenant data is disabled.");
  }

  if (requireScopedAdminAuth && !scopedRole) {
    return NextResponse.json(
      { ok: false, reason: "Scoped admin auth required. Login with an authorized dashboard role." },
      { status: 401 },
    );
  }

  const allowForcedSandbox = forceSandbox && (scopedRole !== "tenant_admin" || normalizedPath.startsWith("logistics/"));

  if (allowDemoFallbackForRequest && allowForcedSandbox) {
    console.info("[admin_proxy_demo_fallback]", JSON.stringify({ method: req.method, path: normalizedPath, scopedRole: scopedRole || "none" }));
    return markDemoData(demoAdminResponse(req.method, path, body || "", req.url));
  }

  let response: Response;
  try {
    const forwardedHeaders = new Headers({
      "Content-Type": "application/json",
      Authorization: `Bearer ${credential?.bearerToken || ""}`,
    });
    for (const header of ["idempotency-key", "x-nexid-trace-id", "if-match"]) {
      const value = req.headers.get(header);
      if (value) forwardedHeaders.set(header, value);
    }
    response = await fetch(target, {
      method: req.method,
      headers: forwardedHeaders,
      body,
      cache: "no-store",
    });
  } catch {
    return unavailable("Admin upstream unreachable.");
  }

  if (
    response.status === 503
    && response.headers.get("x-nexid-auth-outcome") === "session-resolver-unavailable"
  ) {
    return dashboardSessionUnavailableResponse();
  }

  const upstreamAuthorizationOutcome = isAdminUpstreamAuthorizationOutcome(response.status);

  if (response.status >= 500 && criticalGet) {
    return unavailable(`Admin upstream error (${response.status}).`);
  }

  if (!upstreamAuthorizationOutcome && !response.ok && allowDemoFallbackForRequest && allowForcedSandbox) {
    return markDemoData(demoAdminResponse(req.method, path, body || "", req.url));
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const binaryResponse = contentType.includes("application/pdf")
    || contentType.includes("application/octet-stream")
    || contentType.includes("text/csv");
  const responseBody = binaryResponse ? await response.arrayBuffer() : await response.text();
  if (!upstreamAuthorizationOutcome && criticalGet && (binaryResponse || !contentType.includes("application/json") || !safeParseJson(responseBody as string))) {
    return unavailable("Admin upstream returned invalid payload.");
  }
  const headers = new Headers({ "Content-Type": response.headers.get("content-type") || "application/json" });
  headers.set("Cache-Control", response.headers.get("cache-control") || "no-store");
  for (const header of [
    "content-disposition",
    "x-nexid-artifact-sha256",
    "x-nexid-audit-receipt",
    "x-nexid-download-count",
    "x-nexid-idempotent-replay",
  ]) {
    const value = response.headers.get(header);
    if (value) headers.set(header, value);
  }
  headers.set("x-nexid-data-mode", "production");
  return new NextResponse(responseBody, { status: response.status, headers });
}

async function forwardPrivateTicketRequest(req: Request, path: string[]) {
  let response: Response;
  try { response = await forward(req, path); }
  catch { response = NextResponse.json({ ok: false, reason: "ticket_lookup_unavailable" }, { status: 503 }); }
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("referrer-policy", "no-referrer");
  return new NextResponse(response.body, { status: response.status, headers });
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  const path = p.path || [];
  return /^tickets\/[^/]+(?:\/history)?$/.test(path.join("/")) ? forwardPrivateTicketRequest(req, path) : forward(req, path);
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  return forward(req, p.path || []);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  const path = p.path || [];
  return /^tickets\/[^/]+(?:\/history)?$/.test(path.join("/")) ? forwardPrivateTicketRequest(req, path) : forward(req, path);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  return forward(req, p.path || []);
}
