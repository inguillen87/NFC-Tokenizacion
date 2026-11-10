import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";
import { readDemoDataMetaFromResponse } from "../../../../lib/demo-data-mode";
import { dashboardPermissionDenied, dashboardPermissionMatches } from "../../../../lib/permission-policy";
import RewardsClient from "./rewards-client";

type RewardsAvailability = "ready" | "ready_empty" | "forbidden" | "upstream_error";

const PRESETS = [
  {
    code: "DEG-2X1",
    title: "Degustación Premium 2x1",
    points: 300,
    status: "active",
    description: "Visitá la bodega y disfrutá un upgrade en tu degustación de la línea Reserva.",
    type: "TASTING",
    image_url: "/images/wine_tasting.png",
    stock_total: 100,
    stock_remaining: 92,
    requires_age_gate: false,
    network_visible: true
  },
  {
    code: "MIX-6B",
    title: "Caja Mix 6 Botellas Edición Limitada",
    points: 1200,
    status: "active",
    description: "Selección especial del enólogo. Envío incluido a nivel nacional.",
    type: "WINE_BOX",
    image_url: "/images/wine_crate.png",
    stock_total: 50,
    stock_remaining: 44,
    requires_age_gate: true,
    network_visible: true
  },
  {
    code: "MAG-15L",
    title: "Botella Magnum 1.5L",
    points: 2500,
    status: "paused",
    description: "Formato especial ideal para guarda. Solo para nivel Embajador.",
    type: "WINE_BOTTLE",
    image_url: "/images/premium_magnum.png",
    stock_total: 20,
    stock_remaining: 18,
    requires_age_gate: true,
    network_visible: true
  }
];

type RewardRecord = Parameters<typeof RewardsClient>[0]["initialRewards"][number];
type RewardsReadResult = {
  availability: RewardsAvailability;
  items: RewardRecord[];
  dataSource: "production" | "demo" | "unavailable";
  reason: string;
};

function unavailableRewards(
  availability: "forbidden" | "upstream_error",
  reason: string,
): RewardsReadResult {
  return { availability, items: [], dataSource: "unavailable", reason };
}

const rewardId = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const readText = (value: unknown) => typeof value === "string" || value === null ? value : undefined;
const readStock = (value: unknown) => typeof value === "number" || value === null ? value : undefined;
const readFlag = (value: unknown) => typeof value === "boolean" ? value : undefined;

function readRewardCatalog(body: Record<string, unknown>, tenant: string): RewardRecord[] | null {
  if (body.tenant !== (tenant || null) || body.scope !== (tenant ? "tenant" : "global") || !Array.isArray(body.rewards)) return null;
  const items: RewardRecord[] = [];
  const ids = new Set<string>();
  for (const item of body.rewards) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !rewardId.test(row.id)
      || typeof row.program_id !== "string" || !rewardId.test(row.program_id)
      || typeof row.tenant_slug !== "string" || !row.tenant_slug.trim()
      || (tenant && row.tenant_slug !== tenant)) return null;
    const id = row.id.toLowerCase();
    if (ids.has(id)) return null;
    ids.add(id);
    items.push({
      id: row.id,
      program_id: row.program_id,
      tenant_slug: row.tenant_slug,
      code: readText(row.code) ?? "",
      title: readText(row.title) ?? "",
      status: readText(row.status) ?? "",
      points: typeof row.points === "number" && Number.isSafeInteger(row.points)
        && row.points >= 0 && row.points <= 2_147_483_647 ? row.points : null,
      description: readText(row.description),
      type: readText(row.type),
      image_url: readText(row.image_url),
      stock_total: readStock(row.stock_total),
      stock_remaining: readStock(row.stock_remaining),
      requires_age_gate: readFlag(row.requires_age_gate),
      network_visible: readFlag(row.network_visible),
      reservation_requirements: row.reservation_requirements,
    });
  }
  return items;
}

async function getRewards(
  context: AdminPageContext,
  path: string,
  allowDemoData: boolean,
): Promise<RewardsReadResult> {
  try {
    const response = await fetchAdminPage(context, path);
    const meta = readDemoDataMetaFromResponse(response);
    const payload: unknown = await response.json().catch(() => null);
    const body = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown> : null;

    if (response.status === 403 || response.status === 401) {
      return unavailableRewards("forbidden", "rewards_read_forbidden");
    }
    if (!response.ok || body?.ok === false) {
      return unavailableRewards("upstream_error", String(body?.reason || body?.error || `upstream_${response.status}`));
    }
    if (!body || body.ok !== true || response.headers.get("x-nexid-data-mode")?.trim().toLowerCase() !== meta.dataSource
      || (Object.hasOwn(body, "dataSource") && body.dataSource !== meta.dataSource)
      || (Object.hasOwn(body, "demoMode") && body.demoMode !== meta.demoMode)
      || (Object.hasOwn(body, "demo") && body.demo !== meta.demoMode)) {
      return unavailableRewards("upstream_error", "rewards_payload_invalid");
    }

    if (allowDemoData && meta.demoMode) {
      return {
        availability: "ready",
        items: PRESETS,
        dataSource: "demo",
        reason: "illustrative_presets",
      };
    }
    if (meta.demoMode) return unavailableRewards("upstream_error", "rewards_demo_source_unexpected");
    const items = readRewardCatalog(body, context.tenantSlug);
    return items === null ? unavailableRewards("upstream_error", "rewards_payload_invalid") : {
      availability: items.length ? "ready" : "ready_empty",
      items,
      dataSource: "production",
      reason: "",
    };
  } catch {
    return unavailableRewards("upstream_error", "admin_bff_unreachable");
  }
}

export default async function RewardsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession("rewards:read");
  const adminContext = await createAdminPageContext(session, query.tenant);
  const tenantScope = adminContext.tenantSlug;
  const rewardsPath = tenantScope ? "loyalty/rewards" : "loyalty/rewards?scope=global";
  const rewardsResult = await getRewards(adminContext, rewardsPath, Boolean(session.isDemo));
  const canWrite = Boolean(tenantScope) && !session.isDemo && (
    session.role === "super-admin"
      ? !dashboardPermissionDenied(session.deniedPermissions, "rewards:write")
      : dashboardPermissionMatches(session.permissions, "rewards:write", session.deniedPermissions)
  );

  return (
    <RewardsClient
      initialRewards={rewardsResult.items}
      tenantScope={tenantScope}
      isDemo={Boolean(session.isDemo)}
      canWrite={canWrite}
      dataSource={rewardsResult.dataSource}
      availability={rewardsResult.availability}
      sourceReason={rewardsResult.reason}
    />
  );
}
