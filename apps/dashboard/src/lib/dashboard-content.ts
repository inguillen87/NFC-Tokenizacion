import type { AppLocale } from "@product/config";

export type UserRole = "super-admin" | "tenant-admin" | "reseller" | "viewer";

type DashboardContent = {
  shell: { subtitle: string; search: string; role: string; logout: string; apiConnected: string; loading: string; empty: string };
  nav: { overview: string; tenants: string; batches: string; tags: string; analytics: string; events: string; resellers: string; subscriptions: string; apiKeys: string };
  pages: {
    overview: { title: string; description: string };
    tenants: { title: string; description: string };
    batches: { title: string; description: string };
    tags: { title: string; description: string };
    analytics: { title: string; description: string };
    events: { title: string; description: string };
    resellers: { title: string; description: string };
    subscriptions: { title: string; description: string };
    apiKeys: { title: string; description: string };
  };
  roles: Record<UserRole, string>;
  statuses: Record<string, string>;
};

export const roleAccess: Record<UserRole, Array<keyof DashboardContent["nav"]>> = {
  "super-admin": ["overview", "tenants", "batches", "tags", "analytics", "events", "resellers", "subscriptions", "apiKeys"],
  "tenant-admin": ["overview", "batches", "tags", "analytics", "events", "subscriptions", "apiKeys"],
  reseller: ["overview", "batches", "analytics", "events", "resellers", "subscriptions"],
  viewer: ["overview", "analytics", "events"],
};

export const dashboardContent: Record<AppLocale, DashboardContent> = {
  "es-AR": {
    shell: { subtitle: "Control multi-tenant enterprise", search: "Buscar...", role: "Rol", logout: "Salir", apiConnected: "API conectada", loading: "Cargando...", empty: "Sin resultados" },
    nav: { overview: "Resumen", tenants: "Tenants", batches: "Lotes", tags: "Tags", analytics: "Analítica", events: "Eventos", resellers: "Resellers", subscriptions: "Suscripciones", apiKeys: "API Keys" },
    pages: {
      overview: { title: "Overview operativo", description: "KPIs críticos de autenticación, fraude y operación de lotes." },
      tenants: { title: "Gestión de tenants", description: "Clientes, planes y estado operativo por tenant." },
      batches: { title: "Gestión de lotes", description: "Crear, importar manifest, activar y revocar lotes." },
      tags: { title: "Gestión de tags", description: "Activación, perfil secure/basic y control de inventario." },
      analytics: { title: "Analítica antifraude", description: "Total scans, valid/invalid, duplicates, tamper y geo placeholder." },
      events: { title: "Eventos", description: "Tabla de eventos con búsqueda, filtros y estados." },
      resellers: { title: "Canal reseller", description: "Rendimiento por partner, pipeline y subclientes." },
      subscriptions: { title: "Suscripciones", description: "Planes activos, renovación y expansión de ingresos." },
      apiKeys: { title: "Developer settings", description: "Gestión de API keys y políticas de rotación." },
    },
    roles: { "super-admin": "Super Admin", "tenant-admin": "Tenant Admin", reseller: "Reseller", viewer: "Viewer" },
    statuses: { active: "Activo", pending: "Pendiente", revoked: "Revocado", healthy: "Sano", risk: "Riesgo", draft: "Borrador" },
  },
  "pt-BR": {
    shell: { subtitle: "Controle multi-tenant enterprise", search: "Buscar...", role: "Papel", logout: "Sair", apiConnected: "API conectada", loading: "Carregando...", empty: "Sem resultados" },
    nav: { overview: "Visão geral", tenants: "Tenants", batches: "Lotes", tags: "Tags", analytics: "Analytics", events: "Eventos", resellers: "Revendedores", subscriptions: "Assinaturas", apiKeys: "API Keys" },
    pages: {
      overview: { title: "Overview operacional", description: "KPIs críticos de autenticação, fraude e lotes." },
      tenants: { title: "Gestão de tenants", description: "Clientes, planos e estado operacional por tenant." },
      batches: { title: "Gestão de lotes", description: "Criar, importar manifest, ativar e revogar lotes." },
      tags: { title: "Gestão de tags", description: "Ativação, perfil secure/basic e inventário." },
      analytics: { title: "Analytics antifraude", description: "Total scans, valid/invalid, duplicates, tamper e geo placeholder." },
      events: { title: "Eventos", description: "Tabela com busca, filtros e estados." },
      resellers: { title: "Canal revendedor", description: "Performance de parceiros e subclientes." },
      subscriptions: { title: "Assinaturas", description: "Planos ativos, renovação e expansão." },
      apiKeys: { title: "Developer settings", description: "Gestão de API keys e rotação." },
    },
    roles: { "super-admin": "Super Admin", "tenant-admin": "Tenant Admin", reseller: "Reseller", viewer: "Viewer" },
    statuses: { active: "Ativo", pending: "Pendente", revoked: "Revogado", healthy: "Saudável", risk: "Risco", draft: "Rascunho" },
  },
  en: {
    shell: { subtitle: "Enterprise multi-tenant control", search: "Search...", role: "Role", logout: "Logout", apiConnected: "API connected", loading: "Loading...", empty: "No results" },
    nav: { overview: "Overview", tenants: "Tenants", batches: "Batches", tags: "Tags", analytics: "Analytics", events: "Events", resellers: "Resellers", subscriptions: "Subscriptions", apiKeys: "API Keys" },
    pages: {
      overview: { title: "Operational overview", description: "Critical authentication, fraud and batch KPIs." },
      tenants: { title: "Tenant management", description: "Customers, plans and operating health by tenant." },
      batches: { title: "Batch management", description: "Create, import manifest, activate and revoke batches." },
      tags: { title: "Tag management", description: "Activation, secure/basic profile mix and inventory control." },
      analytics: { title: "Anti-fraud analytics", description: "Total scans, valid/invalid, duplicates, tamper and geo placeholder." },
      events: { title: "Events", description: "Searchable event table with filters and status badges." },
      resellers: { title: "Reseller channel", description: "Partner performance, pipeline and sub-clients." },
      subscriptions: { title: "Subscriptions", description: "Active plans, renewal and revenue expansion." },
      apiKeys: { title: "Developer settings", description: "API key management and rotation policies." },
    },
    roles: { "super-admin": "Super Admin", "tenant-admin": "Tenant Admin", reseller: "Reseller", viewer: "Viewer" },
    statuses: { active: "Active", pending: "Pending", revoked: "Revoked", healthy: "Healthy", risk: "Risk", draft: "Draft" },
  },
};
