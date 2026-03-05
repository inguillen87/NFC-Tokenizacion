import type { DashboardCopy } from "../types";
import { esAR } from "./es-AR";

export const en: DashboardCopy = {
  ...esAR,
  shell: { subtitle: "Enterprise multi-tenant control", search: "Search modules...", role: "Role", logout: "Logout", apiConnected: "API connected", loading: "Loading data...", empty: "No matching records" },
  nav: { overview: "Overview", tenants: "Tenants", batches: "Batches", tags: "Tags", analytics: "Analytics", events: "Events", resellers: "Resellers", subscriptions: "Subscriptions", apiKeys: "API Keys" },
  pages: {
    overview: { title: "Operational overview", description: "Critical KPIs for authentication, fraud and operations." },
    tenants: { title: "Tenant management", description: "Customers, plans and operating health by tenant." },
    batches: { title: "Batch management", description: "Create batches, import manifests, activate tags and revoke risk lots." },
    tags: { title: "Tag management", description: "Inventory, secure/basic profile mix and activation coverage." },
    analytics: { title: "Anti-fraud analytics", description: "Total scans, valid/invalid, duplicates, tamper and geo placeholder." },
    events: { title: "Events", description: "Searchable event table with filters and status badges." },
    resellers: { title: "Reseller channel", description: "Partner performance, sub-clients and channel revenue." },
    subscriptions: { title: "Subscriptions", description: "Active plans, renewals and revenue expansion." },
    apiKeys: { title: "Developer settings", description: "API credential scope and rotation policy." },
  },
  table: {
    ...esAR.table,
    search: "Search",
    all: "All",
    refresh: "Refresh",
    columns: { ...esAR.table.columns, status: "Status", country: "Country", qty: "Quantity", time: "Time", renewal: "Renewal", lastUsed: "Last used" },
    titles: { overview: "Tenant health snapshot", tenants: "Tenants", batches: "Batches", tags: "Tag profiles", events: "Event stream", resellers: "Reseller performance", subscriptions: "Subscriptions", apiKeys: "API keys" },
  },
  kpis: { ...esAR.kpis, scansDelta: "+12.4% (7d)", duplicatesDelta: "-8.3%", tamperDelta: "+4 incidents", activeBatchesDelta: "+4 this week", activeTenantsDelta: "+2 onboarding", resellerPerformanceDelta: "Channel MRR", geoDistributionDelta: "heatmap placeholder", trendTitle: "Security trend", statusTitle: "Batch status" },
  forms: {
    ...esAR.forms,
    roleHeading: "Role-based operations",
    roleLabel: "Active role",
    roleHint: { "super-admin": "Global access to tenants, batches and partners.", "tenant-admin": "Tenant-level operations and controls.", reseller: "Sub-client and white-label channel operations.", viewer: "Read-only mode for analytics and events." },
    createTenant: "Create tenant",
    createBatch: "Create batch",
    importManifest: "Import manifest CSV",
    activateRevoke: "Activate tags / Revoke batch",
    apiStatus: "API status",
    fields: { ...esAR.forms.fields, tenantName: "Tenant name", tenantPlan: "Plan", quantity: "Quantity", count: "Activation count", reason: "Reason" },
    actions: { createTenant: "Create tenant", createBatch: "Create batch", importManifest: "Import manifest", activateTags: "Activate tags", revokeBatch: "Revoke batch" },
    ready: "Ready.",
  },
  auth: { loginTitle: "Sign in", loginBody: "Secure portal for super admin, tenant admin, reseller and viewer.", registerTitle: "Create organization", registerBody: "Create a workspace for enterprise NFC operations.", forgotTitle: "Forgot password", forgotBody: "We will send you a secure reset link.", email: "Work email", password: "Password", company: "Company", tenantSlug: "Tenant slug", sendLink: "Send link" },
};
