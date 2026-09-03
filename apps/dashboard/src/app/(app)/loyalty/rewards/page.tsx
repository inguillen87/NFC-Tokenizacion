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

type RewardRecord = (typeof PRESETS)[number];
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

async function getRewards(
  context: AdminPageContext,
  path: string,
  allowDemoData: boolean,
): Promise<RewardsReadResult> {
  try {
    const response = await fetchAdminPage(context, path);
    const meta = readDemoDataMetaFromResponse(response);
    const payload = await response.json().catch(() => null);

    if (response.status === 403) {
      return unavailableRewards("forbidden", "rewards_read_forbidden");
    }
    if (!response.ok || (payload && typeof payload === "object" && (payload as { ok?: boolean }).ok === false)) {
      const reason = payload && typeof payload === "object"
        ? String((payload as { reason?: unknown; error?: unknown }).reason || (payload as { error?: unknown }).error || `upstream_${response.status}`)
        : `upstream_${response.status}`;
      return unavailableRewards("upstream_error", reason);
    }

    const rewards = payload && typeof payload === "object"
      ? (payload as { rewards?: unknown }).rewards
      : null;
    if (Array.isArray(rewards)) {
      return {
        availability: rewards.length ? "ready" : "ready_empty",
        items: rewards as RewardRecord[],
        dataSource: meta.demoMode ? "demo" : "production",
        reason: "",
      };
    }

    if (allowDemoData && meta.demoMode) {
      return {
        availability: "ready",
        items: PRESETS,
        dataSource: "demo",
        reason: "illustrative_presets",
      };
    }
    return unavailableRewards("upstream_error", "rewards_payload_invalid");
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
