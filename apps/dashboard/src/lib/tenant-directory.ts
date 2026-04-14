export type TenantDirectoryItem = {
  tenant: string;
  slug: string;
  plan: "basic" | "secure" | "enterprise";
  status: "active" | "risk" | "pending";
  region: string;
  vertical: string;
  health: string;
};

export const TENANT_DIRECTORY: TenantDirectoryItem[] = [
  { tenant: "Bodega Andes", slug: "bodega-andes", plan: "secure", status: "active", region: "AR", vertical: "Wine", health: "Stable rollout" },
  { tenant: "Cosmetica Norte", slug: "cosmetica-norte", plan: "enterprise", status: "active", region: "BR", vertical: "Beauty", health: "Growing channels" },
  { tenant: "Pharma Delta", slug: "pharma-delta", plan: "secure", status: "risk", region: "CL", vertical: "Pharma", health: "Compliance follow-up" },
  { tenant: "Event Ops AR", slug: "event-ops-ar", plan: "basic", status: "pending", region: "AR", vertical: "Events", health: "Pilot onboarding" },
];
