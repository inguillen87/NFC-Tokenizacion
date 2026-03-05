export type DashboardRole = "super-admin" | "tenant-admin" | "reseller" | "viewer";
export type DashboardLocale = "es-AR" | "pt-BR" | "en";

export type DashboardCopy = {
  appName: string;
  shell: { subtitle: string; search: string; role: string; logout: string; apiConnected: string; loading: string; empty: string };
  nav: { overview: string; tenants: string; batches: string; tags: string; analytics: string; events: string; resellers: string; subscriptions: string; apiKeys: string };
  pages: Record<"overview"|"tenants"|"batches"|"tags"|"analytics"|"events"|"resellers"|"subscriptions"|"apiKeys", { title: string; description: string }>;
  roles: Record<DashboardRole, string>;
  table: { search: string; all: string; refresh: string; columns: Record<string,string>; titles: Record<string,string> };
  kpis: {
    scans: string; validInvalid: string; duplicates: string; tamper: string; scansDelta: string; validInvalidDelta: string; duplicatesDelta: string; tamperDelta: string;
    activeBatches: string; activeBatchesDelta: string; activeTenants: string; activeTenantsDelta: string; resellerPerformance: string; resellerPerformanceDelta: string; geoDistribution: string; geoDistributionDelta: string;
    trendTitle: string; statusTitle: string;
  };
  forms: {
    roleHeading: string; roleLabel: string; roleHint: Record<DashboardRole,string>;
    createTenant: string; createBatch: string; importManifest: string; activateRevoke: string; apiStatus: string;
    fields: { tenantName: string; tenantSlug: string; tenantPlan: string; tenantId: string; batchId: string; sku: string; quantity: string; csv: string; count: string; reason: string };
    actions: { createTenant: string; createBatch: string; importManifest: string; activateTags: string; revokeBatch: string };
    ready: string;
  };
  auth: { loginTitle: string; loginBody: string; registerTitle: string; registerBody: string; forgotTitle: string; forgotBody: string; email: string; password: string; company: string; tenantSlug: string; sendLink: string };
  data: {
    overview: Array<Record<string,string>>;
    tenants: Array<Record<string,string>>;
    batches: Array<Record<string,string>>;
    tags: Array<Record<string,string>>;
    events: Array<Record<string,string>>;
    resellers: Array<Record<string,string>>;
    subscriptions: Array<Record<string,string>>;
    apiKeys: Array<Record<string,string>>;
    batchStatusChart: Array<{ name:string; value:number }>;
    trend: Array<{ day:string; scans:number; duplicates:number; tamper:number }>;
  };
};
