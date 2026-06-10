import { requireDashboardSession } from "../../../../lib/session";
import { getServerOrigin } from "../../../../lib/server-origin";
import { headers } from "next/headers";
import RewardsClient from "./rewards-client";

async function getRewards(origin: string, tenantScope: string, cookie?: string) {
  try {
    const query = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";
    const response = await fetch(`${origin}/api/admin/loyalty/rewards${query}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.rewards || [];
  } catch {
    return [];
  }
}

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

export default async function RewardsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const requestedTenant = typeof query.tenant === "string" ? query.tenant : "";
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : requestedTenant;
  const origin = await getServerOrigin();
  const cookie = (await headers()).get("cookie") || "";

  const fetchedRewards = await getRewards(origin, tenantScope, cookie);
  const rewards = fetchedRewards.length ? fetchedRewards : PRESETS;

  return (
    <RewardsClient initialRewards={rewards} tenantScope={tenantScope} />
  );
}
