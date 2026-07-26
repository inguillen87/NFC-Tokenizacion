export type TenantDirectoryItem = {
  tenant: string;
  slug: string;
  plan: "basic" | "secure" | "enterprise";
  status: "active" | "risk" | "pending";
  region: string;
  vertical: string;
  health: string;
  source: "demo" | "illustrative";
};

// Until this directory is replaced by a tenant API, every record is a product
// fixture. Consumers must render the source and must not aggregate these rows as
// customers, revenue, renewals or production health.
export const TENANT_DIRECTORY_SOURCE = "illustrative" as const;

export const TENANT_DIRECTORY: TenantDirectoryItem[] = [
  { tenant: "Demo Bodega Balmec", slug: "demobodega", plan: "enterprise", status: "active", region: "AR", vertical: "Wine", health: "Escenario demo; no es health productivo", source: "demo" },
  { tenant: "Bodega ejemplo Andes", slug: "bodega-andes", plan: "secure", status: "active", region: "AR", vertical: "Wine", health: "Escenario ilustrativo; sin fuente operativa", source: "illustrative" },
  { tenant: "Cosmetica ejemplo Norte", slug: "cosmetica-norte", plan: "enterprise", status: "active", region: "BR", vertical: "Beauty", health: "Escenario ilustrativo; sin fuente operativa", source: "illustrative" },
  { tenant: "Pharma ejemplo Delta", slug: "pharma-delta", plan: "secure", status: "risk", region: "CL", vertical: "Pharma", health: "Escenario ilustrativo; sin fuente operativa", source: "illustrative" },
  { tenant: "Evento ejemplo AR", slug: "event-ops-ar", plan: "basic", status: "pending", region: "AR", vertical: "Events", health: "Escenario ilustrativo; sin fuente operativa", source: "illustrative" },
];
