import { SectionHeading } from "@product/ui";
import { headers } from "next/headers";
import { OnboardingSetupWizard } from "../../../components/onboarding-setup-wizard";
import { PilotLaunchpad, type PilotSnapshot } from "../../../components/pilot-launchpad";
import { SupplierLegacyIntakeBlocked } from "../../../components/supplier-legacy-intake-blocked";
import { requireDashboardSession } from "../../../lib/session";

type FetchResult<T> = {
  ok: boolean;
  value: T;
  source: "production" | "demo" | "unavailable";
};

type ProductAssetItem = {
  profile?: {
    assetScore?: number | null;
    primaryImageUrl?: string | null;
    labelImageUrl?: string | null;
  } | null;
};

type SupplierOrder = {
  planned_quantity?: number | null;
  manifests_imported?: number | null;
  qa_passed?: number | null;
};

type ProofAnchor = {
  status?: string | null;
  provider?: string | null;
};

type TokenizationRequest = {
  status?: string | null;
  network?: string | null;
  tx_hash?: string | null;
  token_id?: string | null;
};

type DashboardRequestContext = {
  origin: string;
  cookie: string;
};

async function getDashboardRequestContext(): Promise<DashboardRequestContext> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "app.nexid.lat";
  const forwardedProto = requestHeaders.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  return {
    origin: `${forwardedProto}://${forwardedHost}`,
    cookie: requestHeaders.get("cookie") || "",
  };
}

function withTenant(origin: string, path: string, tenantScope: string, extra: Record<string, string> = {}) {
  const url = new URL(`/api/admin${path}`, origin);
  if (tenantScope) url.searchParams.set("tenant", tenantScope);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return url.toString();
}

async function fetchJson<T>(url: string, fallback: T, context: DashboardRequestContext): Promise<FetchResult<T>> {
  try {
    const response = await fetch(url, {
      headers: context.cookie ? { cookie: context.cookie } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, value: fallback, source: "unavailable" };
    const value = await response.json() as T & { ok?: boolean; demoMode?: boolean; dataSource?: string };
    if (value && typeof value === "object" && !Array.isArray(value) && value.ok === false) {
      return { ok: false, value: fallback, source: "unavailable" };
    }
    const source = response.headers.get("x-nexid-data-mode") === "demo" || value?.demoMode || value?.dataSource === "demo"
      ? "demo"
      : "production";
    return { ok: true, value, source };
  } catch {
    return { ok: false, value: fallback, source: "unavailable" };
  }
}

function numberFrom(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function getPilotSnapshot(
  tenantScope: string,
  setupCompleted: boolean | undefined,
  context: DashboardRequestContext,
): Promise<PilotSnapshot> {
  const [batchesResult, assetsResult, ordersResult, anchorsResult, tokenizationResult] = await Promise.all([
    fetchJson<Array<Record<string, unknown>>>(withTenant(context.origin, "/batches", tenantScope), [], context),
    fetchJson<{ items?: ProductAssetItem[] }>(withTenant(context.origin, "/product-assets", tenantScope, { limit: "80" }), { items: [] }, context),
    fetchJson<{ orders?: SupplierOrder[] }>(withTenant(context.origin, "/supplier-orders", tenantScope), { orders: [] }, context),
    fetchJson<{ anchors?: ProofAnchor[] }>(withTenant(context.origin, "/proof/anchors", tenantScope), { anchors: [] }, context),
    fetchJson<{ rows?: TokenizationRequest[] }>(withTenant(context.origin, "/tokenization/requests", tenantScope, { limit: "80" }), { rows: [] }, context),
  ]);

  const batches = Array.isArray(batchesResult.value) ? batchesResult.value : [];
  const assets = Array.isArray(assetsResult.value.items) ? assetsResult.value.items : [];
  const orders = Array.isArray(ordersResult.value.orders) ? ordersResult.value.orders : [];
  const anchors = Array.isArray(anchorsResult.value.anchors) ? anchorsResult.value.anchors : [];
  const tokenization = Array.isArray(tokenizationResult.value.rows) ? tokenizationResult.value.rows : [];

  const plannedTags = batches.reduce((sum, row) => sum + numberFrom(row.requested_quantity || row.expected_quantity || row.quantity || row.qty), 0);
  const importedTags = batches.reduce((sum, row) => sum + numberFrom(row.imported_tags || row.quantity || row.qty), 0);
  const activeTags = batches.reduce((sum, row) => sum + numberFrom(row.active_tags), 0);
  const secureBatches = batches.filter((row) => normalizedStatus(row.carrier_profile_code || row.carrier_label).includes("424")).length;
  const assetScores = assets.map((item) => numberFrom(item.profile?.assetScore)).filter((score) => score > 0);
  const readyAssets = assets.filter((item) => {
    const score = numberFrom(item.profile?.assetScore);
    return score >= 80 || Boolean(item.profile?.primaryImageUrl && item.profile?.labelImageUrl);
  }).length;
  const confirmedAnchors = anchors.filter((anchor) => normalizedStatus(anchor.status) === "confirmed").length;
  const tokenizedAssets = tokenization.filter((request) => {
    const status = normalizedStatus(request.status);
    return Boolean(request.tx_hash || request.token_id) || ["confirmed", "minted", "anchored", "completed", "succeeded"].includes(status);
  }).length;
  const availableSources = [batchesResult, assetsResult, ordersResult, anchorsResult, tokenizationResult].filter((result) => result.ok).length;
  const hasDemoSource = [batchesResult, assetsResult, ordersResult, anchorsResult, tokenizationResult].some((result) => result.source === "demo");

  return {
    tenantScope,
    setupComplete: setupCompleted === true,
    dataState: hasDemoSource ? "demo" : availableSources === 5 ? "live" : availableSources > 0 ? "partial" : "unavailable",
    availableSources,
    batchesAvailable: batchesResult.ok,
    assetsAvailable: assetsResult.ok,
    ordersAvailable: ordersResult.ok,
    anchorsAvailable: anchorsResult.ok,
    tokenizationAvailable: tokenizationResult.ok,
    batchCount: batches.length,
    secureBatches,
    supplierManagedBatches: batches.filter((row) => Boolean(row.supplier_order_id || row.has_meta_key || row.has_file_key)).length,
    supplierOrderCount: orders.length,
    supplierPlannedUnits: orders.reduce((sum, order) => sum + numberFrom(order.planned_quantity), 0),
    importedManifests: orders.reduce((sum, order) => sum + numberFrom(order.manifests_imported), 0),
    qaPassed: orders.reduce((sum, order) => sum + numberFrom(order.qa_passed), 0),
    plannedTags,
    importedTags,
    activeTags,
    assetProfiles: assets.length,
    readyAssets,
    averageAssetScore: assetScores.length
      ? Math.round(assetScores.reduce((sum, score) => sum + score, 0) / assetScores.length)
      : 0,
    proofAnchorCount: anchors.length,
    confirmedAnchors,
    tokenizationRequestCount: tokenization.length,
    tokenizedAssets,
  };
}

export default async function OnboardingPage() {
  const session = await requireDashboardSession();
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";
  const requestContext = await getDashboardRequestContext();
  const snapshot = await getPilotSnapshot(tenantScope, session.setupCompleted, requestContext);
  const isTenantAdmin = session.role === "tenant-admin";

  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Pilot launchpad"
        title={isTenantAdmin ? "Puesta en marcha del tenant" : "Puesta en marcha multi-tenant"}
        description="Un recorrido operativo con evidencia real: configura el workspace, prepara el lote, carga identidad visual, valida un tap y abre la salida verificable."
      />
      {isTenantAdmin && session.setupCompleted === false ? <OnboardingSetupWizard session={session} /> : null}
      <PilotLaunchpad snapshot={snapshot} role={session.role} />
      <SupplierLegacyIntakeBlocked context="onboarding" />
    </main>
  );
}
