import type { AppLocale } from "@product/config";
import type { DashboardEnterpriseRole } from "./enterprise-runtime-rbac";

export type UserRole = DashboardEnterpriseRole;

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
    loyalty: string;
    experiences: string;
    campaigns: string;
    subscriptions: string;
    apiKeys: string;
    sdkVision: string;
    logistics: string;
    proof: string;
    supplierBatches: string;
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
    loyalty: { title: string; description: string };
    experiences: { title: string; description: string };
    campaigns: { title: string; description: string };
    subscriptions: { title: string; description: string };
    apiKeys: { title: string; description: string };
    sdkVision: { title: string; description: string };
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
  crmAi: {
    aiQueries: string;
    aiQueriesTitle: string;
    liveBeacon: string;
    aiAnswerHeader: string;
    queryRadar: string;
    liveQueries: string;
    intentDistribution: string;
    assistantLedger: string;
    generatedAnswer: string;
    category: string;
    noQueries: string;
  };
  roles: Record<UserRole, string>;
  statuses: Record<string, string>;
};

export const roleAccess: Record<UserRole, Array<keyof DashboardContent["nav"]>> = {
  "super-admin": ["overview", "tenants", "batches", "tags", "analytics", "events", "resellers", "leadsTickets", "loyalty", "experiences", "subscriptions", "apiKeys", "sdkVision"],
  "tenant-owner": ["overview", "batches", "tags", "analytics", "events", "leadsTickets", "loyalty", "experiences", "campaigns", "subscriptions", "apiKeys", "sdkVision"],
  "tenant-admin": ["overview", "batches", "tags", "analytics", "events", "leadsTickets", "loyalty", "experiences", "campaigns", "subscriptions", "apiKeys", "sdkVision"],
  "security-analyst": ["overview", "analytics", "events", "sdkVision"],
  "operations-manager": ["overview", "batches", "tags", "analytics", "events", "sdkVision"],
  "packaging-operator": ["overview", "batches", "tags", "analytics", "sdkVision"],
  "marketing-manager": ["overview", "analytics", "leadsTickets", "loyalty", "experiences", "campaigns", "sdkVision"],
  "reseller-admin": ["overview", "batches", "analytics", "leadsTickets", "loyalty", "subscriptions", "sdkVision"],
  "api-integration": [],
  "security-operator": ["overview", "tags", "analytics", "events", "sdkVision"],
  reseller: ["overview", "batches", "analytics", "loyalty", "subscriptions", "sdkVision"],
  viewer: ["overview", "analytics", "sdkVision"],
};

export const dashboardContent: Record<AppLocale, DashboardContent> = {
  "es-AR": {
    shell: { subtitle: "Control multi-tenant enterprise", search: "Buscar...", role: "Rol", logout: "Salir", apiConnected: "Estado de datos: ver cada módulo", loading: "Cargando...", empty: "Sin resultados", all: "Todos", refresh: "Actualizar", openModule: "Abrir módulo", ready: "Listo." },
    nav: { overview: "Resumen", tenants: "Tenants", batches: "Lotes", tags: "Tags", analytics: "Analítica", events: "Eventos", resellers: "Resellers", leadsTickets: "Leads & Tickets", loyalty: "Fidelización", experiences: "Experiencias", campaigns: "Campañas", subscriptions: "Suscripciones", apiKeys: "API Keys", sdkVision: "Ecosistema SDK", logistics: "Logistics Hub", proof: "Trust Layers", supplierBatches: "Pedidos proveedor" },
    pages: {
      overview: { title: "Overview operativo", description: "KPIs críticos de validación de mensajes NFC, señales de fraude y operación de lotes." },
      tenants: { title: "Gestión de tenants", description: "Clientes, planes y estado operativo por tenant." },
      batches: { title: "Gestión de lotes", description: "Crear, importar manifest, activar y revocar lotes." },
      tags: { title: "Gestión de tags", description: "Activación, perfil secure/basic y control de inventario." },
      analytics: { title: "Analítica antifraude", description: "Scans, señales de riesgo y mapa geográfico por tenant, con fuente y recencia visibles." },
      events: { title: "Eventos", description: "Tabla de eventos con búsqueda, filtros y estados." },
      resellers: { title: "Canal reseller", description: "Rendimiento por partner, pipeline y subclientes." },
      leadsTickets: { title: "Leads & Tickets", description: "Inbox comercial y soporte capturado desde asistente + formularios." },
      loyalty: { title: "Loyalty Studio", description: "Configuración del programa de puntos, beneficios y reglas anti-fraude." },
      experiences: { title: "Experiencias", description: "Agenda de visitas, catas y eventos vinculados al programa." },
      campaigns: { title: "Campañas BotIA", description: "Segmentos de crecimiento impulsados por IA para miembros activos." },
      subscriptions: { title: "Suscripciones", description: "Planes activos, renovación y expansión de ingresos." },
      apiKeys: { title: "Developer settings", description: "Gestión de API keys y políticas de rotación." },
      sdkVision: { title: "Portal SDK & Ecosistema Developer", description: "Cómo nexID estandariza evidencia digital de eventos NFC para integraciones globales." },
    },
    auth: {
      roleLabel: "Rol operativo",
      loginAction: "Ingresar al panel",
      forgotAction: "Solicitar recuperacion",
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
      events: { title: "Flujo de eventos", tenant: "Tenant", result: "Resultado", status: "Estado", geo: "Ubicación reportada", time: "Hora" },
      tags: { title: "Perfiles de tags", profile: "Perfil", status: "Estado", inventory: "Inventario", activation: "Activación" },
      resellers: { title: "Performance reseller", reseller: "Reseller", status: "Estado", clients: "Clientes", revenue: "Revenue" },
      subscriptions: { title: "Suscripciones", tenant: "Tenant", plan: "Plan", status: "Estado", renewal: "Renovación" },
      apiKeys: { title: "API keys", keyName: "Clave", status: "Estado", scope: "Scope", lastUsed: "Último uso" },
      batches: { title: "Lotes", batch: "Lote", type: "Tipo", status: "Estado", quantity: "Cantidad" },
      tenants: { title: "Tenants", tenant: "Tenant", plan: "Plan", status: "Estado", region: "Región" },
    },
    analytics: {
      activeBatches: "Lotes activos",
      activeBatchesDelta: "Comparativo N/D",
      activeTenants: "Tenants activos",
      activeTenantsDelta: "Comparativo N/D",
      resellerPerformance: "MRR reseller",
      resellerPerformanceDelta: "N/D · requiere fuente billing",
      geoDistribution: "Distribución geo",
      geoDistributionDelta: "heatmap del scope",
    },
    crmAi: {
      aiQueries: "Consultas IA",
      aiQueriesTitle: "Consultas de clientes registradas",
      liveBeacon: "Fuente visible",
      aiAnswerHeader: "Respuesta y procedencia",
      queryRadar: "Radar de consultas",
      liveQueries: "Consultas registradas",
      intentDistribution: "Distribucion por intencion",
      assistantLedger: "Ledger de asistentes",
      generatedAnswer: "Respuesta generada",
      category: "Categoria",
      noQueries: "No hay consultas registradas",
    },
    roles: { "tenant-owner": "Propietario del tenant", "tenant-admin": "Admin del tenant", "security-analyst": "Analista de seguridad", "operations-manager": "Responsable de operaciones", "packaging-operator": "Operador de packaging", "marketing-manager": "Responsable de marketing", viewer: "Viewer", "reseller-admin": "Admin reseller", "api-integration": "Integración API", "super-admin": "Super Admin", "security-operator": "Operador de seguridad", reseller: "Reseller" },
    statuses: { active: "Activo", pending: "Pendiente", revoked: "Revocado", healthy: "Sano", risk: "Riesgo", draft: "Borrador", valid: "Válido", duplicate: "Duplicado", tamper: "Tamper", INVALID: "Inválido", NOT_REGISTERED: "No registrado", NOT_ACTIVE: "No activo", REPLAY_SUSPECT: "Replay sospechoso", VALID: "Válido" },
  },
  "pt-BR": {
    shell: { subtitle: "Controle multi-tenant enterprise", search: "Buscar...", role: "Papel", logout: "Sair", apiConnected: "Estado dos dados: ver cada módulo", loading: "Carregando...", empty: "Sem resultados", all: "Todos", refresh: "Atualizar", openModule: "Abrir módulo", ready: "Pronto." },
    nav: { overview: "Visão geral", tenants: "Tenants", batches: "Lotes", tags: "Tags", analytics: "Analytics", events: "Eventos", resellers: "Revendedores", leadsTickets: "Leads & Tickets", loyalty: "Fidelidade", experiences: "Experiências", campaigns: "Campanhas", subscriptions: "Assinaturas", apiKeys: "API Keys", sdkVision: "Ecossistema SDK", logistics: "Logistics Hub", proof: "Trust Layers", supplierBatches: "Pedidos fornecedor" },
    pages: {
      overview: { title: "Overview operacional", description: "KPIs críticos de autenticação, fraude e lotes." },
      tenants: { title: "Gestão de tenants", description: "Clientes, planos e estado operacional por tenant." },
      batches: { title: "Gestão de lotes", description: "Criar, importar manifest, ativar e revogar lotes." },
      tags: { title: "Gestão de tags", description: "Ativação, perfil secure/basic e inventário." },
      analytics: { title: "Analytics antifraude", description: "Scans, sinais de risco e mapa geográfico por tenant, com fonte e recência visíveis." },
      events: { title: "Eventos", description: "Tabela com busca, filtros e estados." },
      resellers: { title: "Canal revendedor", description: "Performance de parceiros e subclientes." },
      leadsTickets: { title: "Leads & Tickets", description: "Inbox comercial e suporte vindo do assistente e formulários." },
      loyalty: { title: "Loyalty Studio", description: "Configuração do programa de pontos, benefícios e regras." },
      experiences: { title: "Experiências", description: "Agenda de visitas, eventos e catas." },
      campaigns: { title: "Campanhas BotIA", description: "Segmentos de crescimento impulsionados por IA." },
      subscriptions: { title: "Assinaturas", description: "Planos ativos, renovação e expansão." },
      apiKeys: { title: "Developer settings", description: "Gestão de API keys e rotação." },
      sdkVision: { title: "Portal SDK & Ecossistema Developer", description: "Como a nexID padroniza evidência digital de eventos NFC para integrações globais." },
    },
    auth: {
      roleLabel: "Papel operacional",
      loginAction: "Entrar no painel",
      forgotAction: "Solicitar recuperacao",
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
      events: { title: "Fluxo de eventos", tenant: "Tenant", result: "Resultado", status: "Status", geo: "Localização reportada", time: "Hora" },
      tags: { title: "Perfis de tags", profile: "Perfil", status: "Status", inventory: "Inventário", activation: "Ativação" },
      resellers: { title: "Performance revendedor", reseller: "Revendedor", status: "Status", clients: "Clientes", revenue: "Receita" },
      subscriptions: { title: "Assinaturas", tenant: "Tenant", plan: "Plano", status: "Status", renewal: "Renovação" },
      apiKeys: { title: "API keys", keyName: "Chave", status: "Status", scope: "Escopo", lastUsed: "Último uso" },
      batches: { title: "Lotes", batch: "Lote", type: "Tipo", status: "Status", quantity: "Quantidade" },
      tenants: { title: "Tenants", tenant: "Tenant", plan: "Plano", status: "Status", region: "Região" },
    },
    analytics: {
      activeBatches: "Lotes ativos",
      activeBatchesDelta: "Comparativo N/D",
      activeTenants: "Tenants ativos",
      activeTenantsDelta: "Comparativo N/D",
      resellerPerformance: "MRR revendedor",
      resellerPerformanceDelta: "N/D · requer fonte de billing",
      geoDistribution: "Distribuição geo",
      geoDistributionDelta: "heatmap do escopo",
    },
    crmAi: {
      aiQueries: "Consultas IA",
      aiQueriesTitle: "Consultas de clientes registradas",
      liveBeacon: "Origem visível",
      aiAnswerHeader: "Resposta e procedência",
      queryRadar: "Radar de consultas",
      liveQueries: "Consultas registradas",
      intentDistribution: "Distribuicao por intencao",
      assistantLedger: "Ledger de assistentes",
      generatedAnswer: "Resposta generada",
      category: "Categoria",
      noQueries: "Nao ha consultas registradas",
    },
    roles: { "tenant-owner": "Proprietário do tenant", "tenant-admin": "Admin do tenant", "security-analyst": "Analista de segurança", "operations-manager": "Gerente de operações", "packaging-operator": "Operador de embalagem", "marketing-manager": "Gerente de marketing", viewer: "Viewer", "reseller-admin": "Admin revendedor", "api-integration": "Integração API", "super-admin": "Super Admin", "security-operator": "Operador de segurança", reseller: "Revendedor" },
    statuses: { active: "Ativo", pending: "Pendente", revoked: "Revogado", healthy: "Saudável", risk: "Risco", draft: "Rascunho", valid: "Válido", duplicate: "Duplicado", tamper: "Tamper", INVALID: "Inválido", NOT_REGISTERED: "Não registrado", NOT_ACTIVE: "Não ativo", REPLAY_SUSPECT: "Replay suspeito", VALID: "Válido" },
  },
  en: {
    shell: { subtitle: "Enterprise multi-tenant control", search: "Search...", role: "Role", logout: "Logout", apiConnected: "Data status: check each module", loading: "Loading...", empty: "No results", all: "All", refresh: "Refresh", openModule: "Open module", ready: "Ready." },
    nav: { overview: "Overview", tenants: "Tenants", batches: "Batches", tags: "Tags", analytics: "Analytics", events: "Events", resellers: "Resellers", leadsTickets: "Leads & Tickets", loyalty: "Loyalty Studio", experiences: "Experiences", campaigns: "Campaigns", subscriptions: "Subscriptions", apiKeys: "API Keys", sdkVision: "SDK Developer Hub", logistics: "Logistics Hub", proof: "Trust Layers", supplierBatches: "Supplier Orders" },
    pages: {
      overview: { title: "Operational overview", description: "Critical NFC-message validation, fraud-signal and batch KPIs." },
      tenants: { title: "Tenant management", description: "Customers, plans and operating health by tenant." },
      batches: { title: "Batch management", description: "Create, import manifest, activate and revoke batches." },
      tags: { title: "Tag management", description: "Activation, secure/basic profile mix and inventory control." },
      analytics: { title: "Anti-fraud analytics", description: "Scans, risk signals and tenant-scoped geography with visible source and recency." },
      events: { title: "Events", description: "Searchable event table with filters and status badges." },
      resellers: { title: "Reseller channel", description: "Partner performance, pipeline and sub-clients." },
      leadsTickets: { title: "Leads & Tickets", description: "Commercial + support inbox captured from assistant and forms." },
      loyalty: { title: "Loyalty Studio", description: "Points program setup, benefits and anti-fraud rules." },
      experiences: { title: "Experiences", description: "Agenda for visits, tastings and program events." },
      campaigns: { title: "BotIA Campaigns", description: "AI-driven growth segments for active members." },
      subscriptions: { title: "Subscriptions", description: "Active plans, renewal and revenue expansion." },
      apiKeys: { title: "API key management", description: "API key management and rotation policies." },
      sdkVision: { title: "SDK & Developer Hub", description: "How nexID standardizes digital evidence for NFC events across global integrations." },
    },
    auth: {
      roleLabel: "Operating role",
      loginAction: "Access dashboard",
      forgotAction: "Request account recovery",
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
      events: { title: "Event stream", tenant: "Tenant", result: "Result", status: "Status", geo: "Reported location", time: "Time" },
      tags: { title: "Tag profiles", profile: "Profile", status: "Status", inventory: "Inventory", activation: "Activation" },
      resellers: { title: "Reseller performance", reseller: "Reseller", status: "Status", clients: "Clients", revenue: "Revenue" },
      subscriptions: { title: "Subscriptions", tenant: "Tenant", plan: "Plan", status: "Status", renewal: "Renewal" },
      apiKeys: { title: "API keys", keyName: "Key", status: "Status", scope: "Scope", lastUsed: "Last used" },
      batches: { title: "Batches", batch: "Batch", type: "Type", status: "Status", quantity: "Quantity" },
      tenants: { title: "Tenants", tenant: "Tenant", plan: "Plan", status: "Status", region: "Region" },
    },
    analytics: {
      activeBatches: "Active batches",
      activeBatchesDelta: "Comparison N/A",
      activeTenants: "Active tenants",
      activeTenantsDelta: "Comparison N/A",
      resellerPerformance: "Reseller MRR",
      resellerPerformanceDelta: "N/A · billing source required",
      geoDistribution: "Geo distribution",
      geoDistributionDelta: "scope heatmap",
    },
    crmAi: {
      aiQueries: "AI Customer Queries",
      aiQueriesTitle: "Recorded customer queries",
      liveBeacon: "Source visible",
      aiAnswerHeader: "Response and provenance",
      queryRadar: "Query radar",
      liveQueries: "Recorded queries",
      intentDistribution: "Intent distribution",
      assistantLedger: "Assistant ledger",
      generatedAnswer: "Generated answer",
      category: "Category",
      noQueries: "No AI queries registered",
    },
    roles: { "tenant-owner": "Tenant Owner", "tenant-admin": "Tenant Admin", "security-analyst": "Security Analyst", "operations-manager": "Operations Manager", "packaging-operator": "Packaging Operator", "marketing-manager": "Marketing Manager", viewer: "Viewer", "reseller-admin": "Reseller Admin", "api-integration": "API Integration", "super-admin": "Super Admin", "security-operator": "Security Operator", reseller: "Reseller" },
    statuses: { active: "Active", pending: "Pending", revoked: "Revoked", healthy: "Healthy", risk: "Risk", draft: "Draft", valid: "Valid", duplicate: "Duplicate", tamper: "Tamper", INVALID: "Invalid", NOT_REGISTERED: "Not registered", NOT_ACTIVE: "Not active", REPLAY_SUSPECT: "Replay suspect", VALID: "Valid" },
  },
};
