import type { AppLocale } from "@product/config";

export type UserRole = "super-admin" | "tenant-admin" | "reseller" | "viewer";

type DashboardContent = {
  shell: {
    subtitle: string;
    search: string;
    role: string;
    logout: string;
    apiConnected: string;
    loading: string;
    empty: string;
    all: string;
    refresh: string;
    openModule: string;
    ready: string;
  };
  nav: {
    overview: string;
    tenants: string;
    batches: string;
    tags: string;
    analytics: string;
    events: string;
    resellers: string;
    leadsTickets: string;
    subscriptions: string;
    apiKeys: string;
  };
  pages: {
    overview: { title: string; description: string };
    tenants: { title: string; description: string };
    batches: { title: string; description: string };
    tags: { title: string; description: string };
    analytics: { title: string; description: string };
    events: { title: string; description: string };
    resellers: { title: string; description: string };
    leadsTickets: { title: string; description: string };
    subscriptions: { title: string; description: string };
    apiKeys: { title: string; description: string };
  };
  auth: {
    roleLabel: string;
    loginAction: string;
    forgotAction: string;
    resetTitle: string;
    resetBody: string;
    resetAction: string;
    inviteTitle: string;
    inviteBody: string;
    inviteAction: string;
    inviteRoleLabel: string;
    inviteTenantLabel: string;
  };
  tables: {
    events: { title: string; tenant: string; result: string; status: string; geo: string; time: string };
    tags: { title: string; profile: string; status: string; inventory: string; activation: string };
    resellers: { title: string; reseller: string; status: string; clients: string; revenue: string };
    subscriptions: { title: string; tenant: string; plan: string; status: string; renewal: string };
    apiKeys: { title: string; keyName: string; status: string; scope: string; lastUsed: string };
    batches: { title: string; batch: string; type: string; status: string; quantity: string };
    tenants: { title: string; tenant: string; plan: string; status: string; region: string };
  };
  analytics: {
    activeBatches: string;
    activeBatchesDelta: string;
    activeTenants: string;
    activeTenantsDelta: string;
    resellerPerformance: string;
    resellerPerformanceDelta: string;
    geoDistribution: string;
    geoDistributionDelta: string;
  };
  roles: Record<UserRole, string>;
  statuses: Record<string, string>;
};

export const roleAccess: Record<UserRole, Array<keyof DashboardContent["nav"]>> = {
  "super-admin": ["overview", "tenants", "batches", "tags", "analytics", "events", "resellers", "leadsTickets", "subscriptions", "apiKeys"],
  "tenant-admin": ["overview", "batches", "tags", "analytics", "events", "leadsTickets", "subscriptions", "apiKeys"],
  reseller: ["overview", "batches", "analytics", "events", "resellers", "subscriptions"],
  viewer: ["overview", "analytics", "events"],
};

export const dashboardContent: Record<AppLocale, DashboardContent> = {
  "es-AR": {
    shell: { subtitle: "Control multi-tenant enterprise", search: "Buscar...", role: "Rol", logout: "Salir", apiConnected: "API conectada", loading: "Cargando...", empty: "Sin resultados", all: "Todos", refresh: "Actualizar", openModule: "Abrir módulo", ready: "Listo." },
    nav: { overview: "Resumen", tenants: "Tenants", batches: "Lotes", tags: "Tags", analytics: "Analítica", events: "Eventos", resellers: "Resellers", leadsTickets: "Leads & Tickets", subscriptions: "Suscripciones", apiKeys: "API Keys" },
    pages: {
      overview: { title: "Overview operativo", description: "KPIs críticos de autenticación, fraude y operación de lotes." },
      tenants: { title: "Gestión de tenants", description: "Clientes, planes y estado operativo por tenant." },
      batches: { title: "Gestión de lotes", description: "Crear, importar manifest, activar y revocar lotes." },
      tags: { title: "Gestión de tags", description: "Activación, perfil secure/basic y control de inventario." },
      analytics: { title: "Analítica antifraude", description: "Total scans, valid/invalid, duplicates, tamper y mapa global en tiempo real por tenant." },
      events: { title: "Eventos", description: "Tabla de eventos con búsqueda, filtros y estados." },
      resellers: { title: "Canal reseller", description: "Rendimiento por partner, pipeline y subclientes." },
      leadsTickets: { title: "Leads & Tickets", description: "Inbox comercial y soporte capturado desde asistente + formularios." },
      subscriptions: { title: "Suscripciones", description: "Planes activos, renovación y expansión de ingresos." },
      apiKeys: { title: "Developer settings", description: "Gestión de API keys y políticas de rotación." },
    },
    auth: {
      roleLabel: "Rol operativo",
      loginAction: "Ingresar al panel",
      forgotAction: "Enviar link",
      resetTitle: "Restablecer contraseña",
      resetBody: "Definí una nueva credencial para recuperar el acceso del tenant o partner.",
      resetAction: "Actualizar contraseña",
      inviteTitle: "Invitar usuario",
      inviteBody: "Invitaciones con control de rol para super admin, tenant admin, reseller y viewer.",
      inviteAction: "Enviar invitación",
      inviteRoleLabel: "Rol a asignar",
      inviteTenantLabel: "Tenant destino",
    },
    tables: {
      events: { title: "Flujo de eventos", tenant: "Tenant", result: "Resultado", status: "Estado", geo: "Geo", time: "Hora" },
      tags: { title: "Perfiles de tags", profile: "Perfil", status: "Estado", inventory: "Inventario", activation: "Activación" },
      resellers: { title: "Performance reseller", reseller: "Reseller", status: "Estado", clients: "Clientes", revenue: "Revenue" },
      subscriptions: { title: "Suscripciones", tenant: "Tenant", plan: "Plan", status: "Estado", renewal: "Renovación" },
      apiKeys: { title: "API keys", keyName: "Clave", status: "Estado", scope: "Scope", lastUsed: "Último uso" },
      batches: { title: "Lotes", batch: "Lote", type: "Tipo", status: "Estado", quantity: "Cantidad" },
      tenants: { title: "Tenants", tenant: "Tenant", plan: "Plan", status: "Estado", region: "Región" },
    },
    analytics: {
      activeBatches: "Lotes activos",
      activeBatchesDelta: "+4 esta semana",
      activeTenants: "Tenants activos",
      activeTenantsDelta: "+2 onboarding",
      resellerPerformance: "Performance reseller",
      resellerPerformanceDelta: "MRR canal",
      geoDistribution: "Distribución geo",
      geoDistributionDelta: "heatmap placeholder",
    },
    roles: { "super-admin": "Super Admin", "tenant-admin": "Tenant Admin", reseller: "Reseller", viewer: "Viewer" },
    statuses: { active: "Activo", pending: "Pendiente", revoked: "Revocado", healthy: "Sano", risk: "Riesgo", draft: "Borrador", valid: "Válido", duplicate: "Duplicado", tamper: "Tamper", INVALID: "Inválido", NOT_REGISTERED: "No registrado", NOT_ACTIVE: "No activo", REPLAY_SUSPECT: "Replay sospechoso", VALID: "Válido" },
  },
  "pt-BR": {
    shell: { subtitle: "Controle multi-tenant enterprise", search: "Buscar...", role: "Papel", logout: "Sair", apiConnected: "API conectada", loading: "Carregando...", empty: "Sem resultados", all: "Todos", refresh: "Atualizar", openModule: "Abrir módulo", ready: "Pronto." },
    nav: { overview: "Visão geral", tenants: "Tenants", batches: "Lotes", tags: "Tags", analytics: "Analytics", events: "Eventos", resellers: "Revendedores", leadsTickets: "Leads & Tickets", subscriptions: "Assinaturas", apiKeys: "API Keys" },
    pages: {
      overview: { title: "Overview operacional", description: "KPIs críticos de autenticação, fraude e lotes." },
      tenants: { title: "Gestão de tenants", description: "Clientes, planos e estado operacional por tenant." },
      batches: { title: "Gestão de lotes", description: "Criar, importar manifest, ativar e revogar lotes." },
      tags: { title: "Gestão de tags", description: "Ativação, perfil secure/basic e inventário." },
      analytics: { title: "Analytics antifraude", description: "Total scans, valid/invalid, duplicates, tamper e geo placeholder." },
      events: { title: "Eventos", description: "Tabela com busca, filtros e estados." },
      resellers: { title: "Canal revendedor", description: "Performance de parceiros e subclientes." },
      leadsTickets: { title: "Leads & Tickets", description: "Inbox comercial e suporte vindo do assistente e formulários." },
      subscriptions: { title: "Assinaturas", description: "Planos ativos, renovação e expansão." },
      apiKeys: { title: "Developer settings", description: "Gestão de API keys e rotação." },
    },
    auth: {
      roleLabel: "Papel operacional",
      loginAction: "Entrar no painel",
      forgotAction: "Enviar link",
      resetTitle: "Redefinir senha",
      resetBody: "Defina uma nova credencial para recuperar acesso do tenant ou parceiro.",
      resetAction: "Atualizar senha",
      inviteTitle: "Convidar usuário",
      inviteBody: "Convites com controle de papel para super admin, tenant admin, reseller e viewer.",
      inviteAction: "Enviar convite",
      inviteRoleLabel: "Papel a atribuir",
      inviteTenantLabel: "Tenant destino",
    },
    tables: {
      events: { title: "Fluxo de eventos", tenant: "Tenant", result: "Resultado", status: "Status", geo: "Geo", time: "Hora" },
      tags: { title: "Perfis de tags", profile: "Perfil", status: "Status", inventory: "Inventário", activation: "Ativação" },
      resellers: { title: "Performance revendedor", reseller: "Revendedor", status: "Status", clients: "Clientes", revenue: "Receita" },
      subscriptions: { title: "Assinaturas", tenant: "Tenant", plan: "Plano", status: "Status", renewal: "Renovação" },
      apiKeys: { title: "API keys", keyName: "Chave", status: "Status", scope: "Escopo", lastUsed: "Último uso" },
      batches: { title: "Lotes", batch: "Lote", type: "Tipo", status: "Status", quantity: "Quantidade" },
      tenants: { title: "Tenants", tenant: "Tenant", plan: "Plano", status: "Status", region: "Região" },
    },
    analytics: {
      activeBatches: "Lotes ativos",
      activeBatchesDelta: "+4 nesta semana",
      activeTenants: "Tenants ativos",
      activeTenantsDelta: "+2 onboarding",
      resellerPerformance: "Performance revendedor",
      resellerPerformanceDelta: "MRR canal",
      geoDistribution: "Distribuição geo",
      geoDistributionDelta: "heatmap placeholder",
    },
    roles: { "super-admin": "Super Admin", "tenant-admin": "Tenant Admin", reseller: "Reseller", viewer: "Viewer" },
    statuses: { active: "Ativo", pending: "Pendente", revoked: "Revogado", healthy: "Saudável", risk: "Risco", draft: "Rascunho", valid: "Válido", duplicate: "Duplicado", tamper: "Tamper", INVALID: "Inválido", NOT_REGISTERED: "Não registrado", NOT_ACTIVE: "Não ativo", REPLAY_SUSPECT: "Replay suspeito", VALID: "Válido" },
  },
  en: {
    shell: { subtitle: "Enterprise multi-tenant control", search: "Search...", role: "Role", logout: "Logout", apiConnected: "API connected", loading: "Loading...", empty: "No results", all: "All", refresh: "Refresh", openModule: "Open module", ready: "Ready." },
    nav: { overview: "Overview", tenants: "Tenants", batches: "Batches", tags: "Tags", analytics: "Analytics", events: "Events", resellers: "Resellers", leadsTickets: "Leads & Tickets", subscriptions: "Subscriptions", apiKeys: "API Keys" },
    pages: {
      overview: { title: "Operational overview", description: "Critical authentication, fraud and batch KPIs." },
      tenants: { title: "Tenant management", description: "Customers, plans and operating health by tenant." },
      batches: { title: "Batch management", description: "Create, import manifest, activate and revoke batches." },
      tags: { title: "Tag management", description: "Activation, secure/basic profile mix and inventory control." },
      analytics: { title: "Anti-fraud analytics", description: "Total scans, valid/invalid, duplicates, tamper and live global map by tenant." },
      events: { title: "Events", description: "Searchable event table with filters and status badges." },
      resellers: { title: "Reseller channel", description: "Partner performance, pipeline and sub-clients." },
      leadsTickets: { title: "Leads & Tickets", description: "Commercial + support inbox captured from assistant and forms." },
      subscriptions: { title: "Subscriptions", description: "Active plans, renewal and revenue expansion." },
      apiKeys: { title: "Developer settings", description: "API key management and rotation policies." },
    },
    auth: {
      roleLabel: "Operating role",
      loginAction: "Access dashboard",
      forgotAction: "Send reset link",
      resetTitle: "Reset password",
      resetBody: "Set a new credential to restore tenant or partner access.",
      resetAction: "Update password",
      inviteTitle: "Invite user",
      inviteBody: "Role-aware invitations for super admin, tenant admin, reseller and viewer.",
      inviteAction: "Send invite",
      inviteRoleLabel: "Role to assign",
      inviteTenantLabel: "Target tenant",
    },
    tables: {
      events: { title: "Event stream", tenant: "Tenant", result: "Result", status: "Status", geo: "Geo", time: "Time" },
      tags: { title: "Tag profiles", profile: "Profile", status: "Status", inventory: "Inventory", activation: "Activation" },
      resellers: { title: "Reseller performance", reseller: "Reseller", status: "Status", clients: "Clients", revenue: "Revenue" },
      subscriptions: { title: "Subscriptions", tenant: "Tenant", plan: "Plan", status: "Status", renewal: "Renewal" },
      apiKeys: { title: "API keys", keyName: "Key", status: "Status", scope: "Scope", lastUsed: "Last used" },
      batches: { title: "Batches", batch: "Batch", type: "Type", status: "Status", quantity: "Quantity" },
      tenants: { title: "Tenants", tenant: "Tenant", plan: "Plan", status: "Status", region: "Region" },
    },
    analytics: {
      activeBatches: "Active batches",
      activeBatchesDelta: "+4 this week",
      activeTenants: "Active tenants",
      activeTenantsDelta: "+2 onboarding",
      resellerPerformance: "Reseller performance",
      resellerPerformanceDelta: "Channel MRR",
      geoDistribution: "Geo distribution",
      geoDistributionDelta: "placeholder heatmap",
    },
    roles: { "super-admin": "Super Admin", "tenant-admin": "Tenant Admin", reseller: "Reseller", viewer: "Viewer" },
    statuses: { active: "Active", pending: "Pending", revoked: "Revoked", healthy: "Healthy", risk: "Risk", draft: "Draft", valid: "Valid", duplicate: "Duplicate", tamper: "Tamper", INVALID: "Invalid", NOT_REGISTERED: "Not registered", NOT_ACTIVE: "Not active", REPLAY_SUSPECT: "Replay suspect", VALID: "Valid" },
  },
};
