import type {
  DashboardEnterpriseRole,
  DashboardHighImpactCapability,
} from "./enterprise-runtime-rbac";
import { normalizeDashboardEnterpriseRole } from "./enterprise-runtime-rbac";
import {
  dashboardHighImpactPermissionMatches,
  dashboardPermissionMatches,
} from "./permission-policy";

type DashboardDestinationPolicy = {
  href: string;
  roles?: readonly DashboardEnterpriseRole[];
  requiredPermissions?: readonly string[];
  highImpactCapability?: DashboardHighImpactCapability;
  demoOnly?: boolean;
};

export const DASHBOARD_DESTINATIONS = Object.freeze({
  overview: { href: "/" },
  onboarding: { href: "/onboarding" },
  logistics: { href: "/logistics", requiredPermissions: ["logistics:read"] },
  demoLab: { href: "/demo-lab", requiredPermissions: ["demo:read"] },
  demoEncoder: { href: "/demo-lab/encode", requiredPermissions: ["demo:run"], demoOnly: true },
  proof: { href: "/proof", highImpactCapability: "proofs.read" },
  batches: { href: "/batches", requiredPermissions: ["batches:read"] },
  supplierBatches: { href: "/batches/supplier", requiredPermissions: ["batches:*"] },
  tags: { href: "/tags", requiredPermissions: ["tags:read"] },
  events: { href: "/events", highImpactCapability: "events.read_sensitive" },
  tokenization: { href: "/tokenization", requiredPermissions: ["tokenization:read"] },
  analytics: { href: "/analytics", requiredPermissions: ["analytics:read"] },
  serviceLevels: { href: "/service-levels", requiredPermissions: ["analytics:read"] },
  riskAnalytics: {
    href: "/risk-analytics",
    requiredPermissions: ["reports.export"],
    highImpactCapability: "events.read_sensitive",
  },
  leadsTickets: { href: "/leads-tickets", highImpactCapability: "leads.manage" },
  apiKeys: { href: "/api-keys", highImpactCapability: "api_keys.read" },
  sdkVision: { href: "/sdk-vision" },
  tenants: { href: "/tenants", roles: ["super-admin"] },
  superadminNetwork: { href: "/superadmin-network", roles: ["super-admin"] },
  resellers: { href: "/resellers", roles: ["super-admin"] },
  subscriptions: { href: "/subscriptions", roles: ["super-admin"] },
  loyaltyOverview: { href: "/loyalty/overview", requiredPermissions: ["rewards:read"] },
  consumerOverview: { href: "/consumer-network/overview", highImpactCapability: "consumers.read_pii" },
  rewards: { href: "/loyalty/rewards", requiredPermissions: ["rewards:read"] },
  experiences: { href: "/loyalty/experiences", highImpactCapability: "consumer_experiences.read_pii" },
  campaigns: { href: "/loyalty/campaigns", requiredPermissions: ["campaigns:read"] },
  investorSnapshot: { href: "/investor-snapshot", roles: ["tenant-owner", "tenant-admin", "marketing-manager", "super-admin"] },
  salesPlaybook: { href: "/sales-playbook", roles: ["tenant-owner", "tenant-admin", "marketing-manager", "super-admin"] },
  marketplace: { href: "/consumer-network/marketplace", requiredPermissions: ["marketplace:read"] },
  offers: { href: "/consumer-network/offers", requiredPermissions: ["marketplace:read"] },
  orderRequests: {
    href: "/consumer-network/order-requests",
    requiredPermissions: ["marketplace:read"],
    highImpactCapability: "consumers.read_pii",
  },
  users: { href: "/users", requiredPermissions: ["users:manage"] },
  mfa: { href: "/mfa" },
  settings: { href: "/settings" },
  billing: { href: "/billing" },
} as const satisfies Record<string, DashboardDestinationPolicy>);

export type DashboardDestinationKey = keyof typeof DASHBOARD_DESTINATIONS;

export type DashboardDestinationAccess = {
  role: unknown;
  permissions?: readonly string[];
  deniedPermissions?: readonly string[];
  isDemo?: boolean;
};

export function dashboardCanOpenDestination(
  destination: DashboardDestinationKey,
  access: DashboardDestinationAccess,
) {
  const policy = DASHBOARD_DESTINATIONS[destination] as DashboardDestinationPolicy;
  const role = normalizeDashboardEnterpriseRole(access.role);
  const permissions = access.permissions || [];
  const deniedPermissions = access.deniedPermissions || [];

  if (!role) return false;
  if (policy.roles && !policy.roles.includes(role)) return false;
  if (policy.demoOnly && access.isDemo !== true) return false;
  if (policy.highImpactCapability && !dashboardHighImpactPermissionMatches(
    role,
    permissions,
    policy.highImpactCapability,
    deniedPermissions,
  )) return false;

  return (policy.requiredPermissions || []).every((permission) => (
    dashboardPermissionMatches(permissions, permission, deniedPermissions)
  ));
}
