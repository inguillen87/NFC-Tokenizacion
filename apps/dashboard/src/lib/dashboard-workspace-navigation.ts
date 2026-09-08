export type DashboardWorkspaceTab = "summary" | "infra" | "loyalty" | "demo" | "tenants";

const sections: Record<DashboardWorkspaceTab, string> = {
  summary: "", infra: "operations", loyalty: "engagement", demo: "showroom", tenants: "tenants",
};

/** URL state is presentation only. Server session and destination guards retain access control. */
export function dashboardWorkspaceTab(section: string | null, tenantBound: boolean): DashboardWorkspaceTab {
  const tab = (Object.entries(sections).find(([, value]) => value === section)?.[0] || "summary") as DashboardWorkspaceTab;
  return tenantBound && (tab === "demo" || tab === "tenants") ? "summary" : tab;
}

export function dashboardWorkspaceHref(currentSearch: string, tab: DashboardWorkspaceTab): string {
  const params = new URLSearchParams(currentSearch);
  params.delete("view");
  if (sections[tab]) params.set("section", sections[tab]);
  else params.delete("section");
  const query = params.toString();
  return query ? `/?${query}` : "/";
}
