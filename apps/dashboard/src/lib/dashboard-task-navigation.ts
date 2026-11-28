import type { DashboardDestinationKey } from "./dashboard-destination-policy";

export type TaskGroupKey = "operations" | "products" | "customers" | "integrations" | "administration" | "resources";
export type TaskNavigationItem = { destination: DashboardDestinationKey; href: string; label: string };
const ORDER: readonly TaskGroupKey[] = ["operations", "products", "customers", "integrations", "administration", "resources"];
const DESTINATIONS: Partial<Record<DashboardDestinationKey, TaskGroupKey>> = {
  recallTasks: "operations", overview: "operations", onboarding: "operations", events: "operations", logistics: "operations",
  map: "operations", analytics: "operations", serviceLevels: "operations", riskAnalytics: "operations", leadsTickets: "operations",
  editorialQueue: "products", batches: "products", supplierBatches: "products", tags: "products", proof: "products", tokenization: "products",
  loyaltyOverview: "customers", consumerOverview: "customers", rewards: "customers", experiences: "customers",
  campaigns: "customers", marketplace: "customers", offers: "customers", orderRequests: "customers",
  apiKeys: "integrations", sdkVision: "integrations",
  tenants: "administration", superadminNetwork: "administration", resellers: "administration",
  subscriptions: "administration", billing: "administration", users: "administration", mfa: "administration",
  demoLab: "resources", demoEncoder: "resources", investorSnapshot: "resources", salesPlaybook: "resources",
};
const COPY = {
  "es-AR": {
    groups: { operations: "Operación", products: "Productos y pasaportes", customers: "Clientes y campañas", integrations: "Integraciones", administration: "Administración", resources: "Demos y recursos" },
    navigation: "Navegación por tareas", frequent: "Más usados", frequentHint: "Según tu uso en este navegador", search: "Buscar una sección", open: "Abrir menú de navegación", close: "Cerrar menú de navegación",
    labels: { editorialQueue: "Bandeja editorial", recallTasks: "Mis tareas de retiro", onboarding: "Puesta en marcha", tokenization: "Derechos digitales", serviceLevels: "Uso y estado", riskAnalytics: "Riesgos e incidentes", sdkVision: "API y SDK", apiKeys: "Credenciales de API", users: "Equipo y permisos", mfa: "Seguridad de la cuenta", demoLab: "Laboratorio de demos", investorSnapshot: "Presentación para inversores", salesPlaybook: "Guía comercial", orderRequests: "Solicitudes de compra", offers: "Ofertas", rewards: "Beneficios", experiences: "Experiencias y eventos", consumerOverview: "Personas y consentimiento", superadminNetwork: "Red de empresas" },
  },
  en: {
    groups: { operations: "Operations", products: "Products and passports", customers: "Customers and campaigns", integrations: "Integrations", administration: "Administration", resources: "Demos and resources" },
    navigation: "Task navigation", frequent: "Most used", frequentHint: "Based on your use in this browser", search: "Find a section", open: "Open navigation menu", close: "Close navigation menu",
    labels: { editorialQueue: "Editorial inbox", recallTasks: "My recall tasks", onboarding: "Getting started", tokenization: "Digital rights", serviceLevels: "Usage and service health", riskAnalytics: "Risks and incidents", sdkVision: "API and SDK", apiKeys: "API credentials", users: "Team and permissions", mfa: "Account security", demoLab: "Demo lab", investorSnapshot: "Investor presentation", salesPlaybook: "Sales guide", orderRequests: "Purchase requests", offers: "Offers", rewards: "Benefits", experiences: "Experiences and events", consumerOverview: "People and consent", loyaltyOverview: "Post-tap activity", campaigns: "Signal-based campaigns", superadminNetwork: "Company network", marketplace: "Opt-in marketplace" },
  },
  "pt-BR": {
    groups: { operations: "Operação", products: "Produtos e passaportes", customers: "Clientes e campanhas", integrations: "Integrações", administration: "Administração", resources: "Demos e recursos" },
    navigation: "Navegação por tarefas", frequent: "Mais usados", frequentHint: "Conforme seu uso neste navegador", search: "Buscar uma seção", open: "Abrir menu de navegação", close: "Fechar menu de navegação",
    labels: { editorialQueue: "Fila editorial", recallTasks: "Minhas tarefas de retirada", onboarding: "Primeiros passos", tokenization: "Direitos digitais", serviceLevels: "Uso e estado", riskAnalytics: "Riscos e incidentes", sdkVision: "API e SDK", apiKeys: "Credenciais de API", users: "Equipe e permissões", mfa: "Segurança da conta", demoLab: "Laboratório de demos", investorSnapshot: "Apresentação para investidores", salesPlaybook: "Guia comercial", orderRequests: "Solicitações de compra", offers: "Ofertas", rewards: "Benefícios", experiences: "Experiências e eventos", consumerOverview: "Pessoas e consentimento", loyaltyOverview: "Atividade pós-tap", campaigns: "Campanhas por sinal", superadminNetwork: "Rede de empresas", marketplace: "Marketplace com adesão" },
  },
} as const;

export function dashboardTaskCopy(locale: string) {
  return COPY[locale === "en" || locale === "pt-BR" ? locale : "es-AR"];
}
export function taskDestinationLabel(item: TaskNavigationItem, locale: string): string {
  const labels: Partial<Record<DashboardDestinationKey, string>> = dashboardTaskCopy(locale).labels;
  return labels[item.destination] || item.label;
}
/** Only group the already-authorized candidates. This never grants access or invents destinations. */
export function groupTaskNavigation<T extends TaskNavigationItem>(authorizedItems: readonly T[], locale: string) {
  const copy = dashboardTaskCopy(locale);
  const seen = new Set<string>();
  const buckets = new Map<TaskGroupKey, T[]>();
  for (const item of authorizedItems) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    const key = DESTINATIONS[item.destination] || "administration";
    const list = buckets.get(key) || [];
    list.push({ ...item, label: taskDestinationLabel(item, locale) });
    buckets.set(key, list);
  }
  return ORDER.flatMap((id) => {
    const items = buckets.get(id);
    return items?.length ? [{ id, label: copy.groups[id], items }] : [];
  });
}

export const NAV_USAGE_STORAGE_KEY = "nexid-dashboard-nav-usage-v1";
const DEFAULT_FREQUENT: readonly DashboardDestinationKey[] = ["overview", "events", "batches", "analytics"];
type UsageEntry = { count: number; last: number };

/** Read per-browser visit counts. Storage may be unavailable; that only hides the history. */
export function readNavUsage(storage: Pick<Storage, "getItem"> | null | undefined): Record<string, UsageEntry> {
  try {
    const parsed = JSON.parse(storage?.getItem(NAV_USAGE_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, UsageEntry> : {};
  } catch {
    return {};
  }
}

export function recordNavUsage(storage: Pick<Storage, "getItem" | "setItem"> | null | undefined, href: string, now = Date.now()) {
  if (!storage || !href) return;
  try {
    const usage = readNavUsage(storage);
    const entry = usage[href] || { count: 0, last: 0 };
    usage[href] = { count: Math.min(entry.count + 1, 9999), last: now };
    storage.setItem(NAV_USAGE_STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Private browsing or a full quota: navigation keeps working without history.
  }
}

/**
 * Pick the most used destinations among those the person is already authorized
 * to open. With no history yet, fall back to a short default set. Never adds a
 * destination that is not in the authorized list.
 */
export function pickFrequentDestinations<T extends TaskNavigationItem>(authorizedItems: readonly T[], usage: Record<string, UsageEntry>, limit = 4): T[] {
  const unique = authorizedItems.filter((item, index) => authorizedItems.findIndex((other) => other.href === item.href) === index);
  const used = unique
    .filter((item) => (usage[item.href]?.count || 0) > 0)
    .sort((a, b) => (usage[b.href]!.count - usage[a.href]!.count) || (usage[b.href]!.last - usage[a.href]!.last))
    .slice(0, limit);
  if (used.length >= Math.min(2, limit)) return used;
  const defaults = DEFAULT_FREQUENT.map((key) => unique.find((item) => item.destination === key)).filter((item): item is T => Boolean(item));
  const merged = [...used, ...defaults.filter((item) => !used.some((other) => other.href === item.href))];
  return merged.slice(0, limit);
}
