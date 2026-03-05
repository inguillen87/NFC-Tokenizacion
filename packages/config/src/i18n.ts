export const locales = ["es-AR", "pt-BR", "en"] as const;
export type AppLocale = (typeof locales)[number];

export function resolveLocale(value?: string | null): AppLocale {
  if (value && locales.includes(value as AppLocale)) {
    return value as AppLocale;
  }
  return "es-AR";
}

type I18nSchema = {
  common: {
    language: string;
    dashboard: string;
    docs: string;
    pricing: string;
    resellers: string;
    login: string;
    register: string;
    logout: string;
    apiConnected: string;
    plans: string;
  };
  web: {
    navProduct: string;
    heroBadge: string;
    heroTitle: string;
    heroBody: string;
    heroPrimaryCta: string;
    heroSecondaryCta: string;
    heroResellerCta: string;
    stats: {
      latency: string;
      unitEconomics: string;
      businessModel: string;
      latencyDelta: string;
      economicsDelta: string;
      businessDelta: string;
    };
    sections: {
      architectureEyebrow: string;
      architectureTitle: string;
      architectureDescription: string;
      useCasesEyebrow: string;
      useCasesTitle: string;
      useCasesDescription: string;
      pricingEyebrow: string;
      pricingTitle: string;
      pricingDescription: string;
      resellerEyebrow: string;
      resellerTitle: string;
      resellerDescription: string;
      docsEyebrow: string;
      docsTitle: string;
      docsDescription: string;
    };
    rails: Array<{ title: string; body: string }>;
    resellerCards: Array<{ title: string; body: string }>;
    docsList: string[];
    auth: {
      loginTitle: string;
      loginBody: string;
      registerTitle: string;
      registerBody: string;
      companyPlaceholder: string;
      emailPlaceholder: string;
      passwordPlaceholder: string;
    };
  };
  dashboard: {
    title: string;
    subtitle: string;
    overview: string;
    batches: string;
    analytics: string;
    events: string;
    tenants: string;
    tags: string;
    subscriptions: string;
    apiKeys: string;
    forgotPassword: string;
    roleBasedOps: string;
    overviewDescription: string;
    analyticsTitle: string;
    analyticsDescription: string;
    batchLifecycleTitle: string;
    batchLifecycleDescription: string;
    eventsTitle: string;
    eventsDescription: string;
    resellersTitle: string;
    resellersDescription: string;
    tenantsTitle: string;
    tenantsDescription: string;
    tagsTitle: string;
    tagsDescription: string;
    subscriptionsTitle: string;
    subscriptionsDescription: string;
    apiKeysTitle: string;
    apiKeysDescription: string;
    auth: {
      loginBody: string;
      registerBody: string;
      forgotBody: string;
    };
    forms: {
      roleHeading: string;
      roleHint: Record<"super-admin" | "tenant-admin" | "reseller" | "viewer", string>;
      roleLabel: string;
      createTenant: string;
      createBatch: string;
      importManifest: string;
      activateRevoke: string;
      apiStatus: string;
      fields: {
        tenantName: string;
        tenantSlug: string;
        tenantPlan: string;
        tenantId: string;
        batchId: string;
        sku: string;
        quantity: string;
        csv: string;
        count: string;
        reason: string;
      };
      actions: {
        createTenant: string;
        createBatch: string;
        importManifest: string;
        activateTags: string;
        revokeBatch: string;
      };
    };
    kpis: {
      scans: string;
      validInvalid: string;
      duplicates: string;
      tamper: string;
      scansDelta: string;
      validInvalidDelta: string;
      duplicatesDelta: string;
      tamperDelta: string;
      trendTitle: string;
      statusTitle: string;
    };
  };
};

export const messages: Record<AppLocale, I18nSchema> = {
  "es-AR": {
    common: {
      language: "Idioma",
      dashboard: "Dashboard",
      docs: "Docs",
      pricing: "Precios",
      resellers: "Resellers",
      login: "Ingresar",
      register: "Registrarse",
      logout: "Salir",
      apiConnected: "API conectada",
      plans: "Planes",
    },
    web: {
      navProduct: "Producto",
      heroBadge: "NFC Authentication + Digital Identity",
      heroTitle: "Autenticación NFC, antifraude y producto digital para marcas globales.",
      heroBody:
        "Plataforma SaaS multi-tenant para programas con NTAG215 y NTAG 424 DNA TagTamper, con validación segura, trazabilidad y capa premium de identidad/tokenización.",
      heroPrimaryCta: "Solicitar demo",
      heroSecondaryCta: "Ver precios",
      heroResellerCta: "Programa reseller",
      stats: {
        latency: "Latencia objetivo API",
        unitEconomics: "Economía secure",
        businessModel: "Modelo de negocio",
        latencyDelta: "P95 < 150ms",
        economicsDelta: "10k botellas × USD 0.02",
        businessDelta: "Hardware + SaaS + identidad",
      },
      sections: {
        architectureEyebrow: "Arquitectura",
        architectureTitle: "Gateway de autenticación, tags codificados y capa de identidad digital",
        architectureDescription:
          "Diseño enterprise para vino, cosmética, pharma y eventos, con observabilidad antifraude y despliegues multi-país.",
        useCasesEyebrow: "Casos de uso",
        useCasesTitle: "Wine, cosmetics, pharma y eventos",
        useCasesDescription:
          "Narrativa comercial orientada a compradores enterprise, resellers y partners internacionales.",
        pricingEyebrow: "Pricing",
        pricingTitle: "BASIC · SECURE · ENTERPRISE / RESELLER",
        pricingDescription:
          "Empaquetado comercial para marketing, anti-fraude crítico y crecimiento white-label.",
        resellerEyebrow: "Canal",
        resellerTitle: "Programa white-label y reseller",
        resellerDescription:
          "Habilitamos agencias y convertidores con operación multi-tenant, SLA y control de lotes.",
        docsEyebrow: "Implementación",
        docsTitle: "Quickstart operativo",
        docsDescription: "Rutas desplegadas y flujo recomendado para onboarding técnico.",
      },
      rails: [
        {
          title: "Authentication gateway",
          body: "Validación SUN, detección de duplicados, alertas de tamper y control de eventos en tiempo real.",
        },
        {
          title: "Encoded tags",
          body: "NTAG215 para campañas y NTAG 424 DNA TagTamper para autenticación de producto de alta seguridad.",
        },
        {
          title: "Identity layer",
          body: "Capa premium tokenization-ready para ownership, historial de producto y servicios postventa.",
        },
      ],
      resellerCards: [
        {
          title: "Co-branded SaaS",
          body: "Operación compartida con branding de partner para despliegues rápidos en retail y eventos.",
        },
        {
          title: "Private-label operation",
          body: "Fleet multi-tenant dedicado para agencias, distribuidores y convertidores de packaging.",
        },
      ],
      docsList: [
        "Health check: /health/",
        "SUN validation: /sun/",
        "Create tenant: /admin/tenants/",
        "Batch lifecycle: /admin/batches/",
        "Manifest import: /admin/batches/:bid/import-manifest/",
      ],
      auth: {
        loginTitle: "Acceso cliente",
        loginBody: "Entrá al panel de autenticación enterprise.",
        registerTitle: "Solicitud de acceso",
        registerBody: "Onboarding para marcas, resellers y partners internacionales.",
        companyPlaceholder: "Empresa",
        emailPlaceholder: "Email laboral",
        passwordPlaceholder: "Contraseña",
      },
    },
    dashboard: {
      title: "Control de autenticación",
      subtitle: "Operación enterprise multi-tenant",
      overview: "Resumen",
      batches: "Lotes",
      analytics: "Analítica",
      events: "Eventos",
      tenants: "Tenants",
      tags: "Tags",
      subscriptions: "Suscripciones",
      apiKeys: "API Keys",
      forgotPassword: "Recuperar contraseña",
      roleBasedOps: "Operaciones por rol",
      overviewDescription: "KPIs de escaneo, fraude y estado de lotes para operación ejecutiva.",
      analyticsTitle: "Inteligencia de escaneos",
      analyticsDescription: "Scans, válidos/inválidos, duplicados, tamper y huella geográfica.",
      batchLifecycleTitle: "Ciclo de vida de lote",
      batchLifecycleDescription: "Crear lote, importar manifest, activar tags y revocar por riesgo.",
      eventsTitle: "Flujo de eventos de seguridad",
      eventsDescription: "Trazabilidad de lecturas con foco en duplicados, replay y tamper.",
      resellersTitle: "Gestión de canal white-label",
      resellersDescription: "Control de partners, subclientes y performance comercial por región.",
      tenantsTitle: "Gestión de tenants",
      tenantsDescription: "Onboarding, planes y gobierno de acceso por cliente enterprise.",
      tagsTitle: "Gestión de tags",
      tagsDescription: "Activación, tipo de perfil (basic/secure) y control operativo de inventario.",
      subscriptionsTitle: "Revenue operations",
      subscriptionsDescription: "Lifecycle de suscripción, upgrades y estado contractual.",
      apiKeysTitle: "Gestión de credenciales API",
      apiKeysDescription: "Emisión, rotación y revocación de claves por tenant o reseller.",
      auth: {
        loginBody: "Portal seguro para super admin, tenant admin, reseller y viewer.",
        registerBody: "Creá tu organización y plan inicial para operar lotes y autenticación.",
        forgotBody: "Te enviamos un link para recuperar acceso.",
      },
      forms: {
        roleHeading: "UX por rol",
        roleHint: {
          "super-admin": "Acceso global a tenants, lotes, revocaciones y partners.",
          "tenant-admin": "Gestión operativa del tenant: lotes, activación y analítica.",
          reseller: "Gestión de subclientes y flujo white-label asignado.",
          viewer: "Modo lectura: sólo analítica y eventos.",
        },
        roleLabel: "Rol",
        createTenant: "Crear tenant",
        createBatch: "Crear lote",
        importManifest: "Importar manifest CSV",
        activateRevoke: "Activar tags / Revocar lote",
        apiStatus: "Estado API",
        fields: {
          tenantName: "Nombre del tenant",
          tenantSlug: "tenant-slug",
          tenantPlan: "Plan",
          tenantId: "tenant_id",
          batchId: "batch_id",
          sku: "SKU",
          quantity: "Cantidad",
          csv: "CSV manifest",
          count: "Cantidad a activar",
          reason: "Motivo de revocación",
        },
        actions: {
          createTenant: "Crear tenant",
          createBatch: "Crear lote",
          importManifest: "Importar manifest",
          activateTags: "Activar tags",
          revokeBatch: "Revocar lote",
        },
      },
      kpis: {
        scans: "Scans",
        validInvalid: "Válidos / inválidos",
        duplicates: "Duplicados",
        tamper: "Tamper alerts",
        scansDelta: "+12.4% (7d)",
        validInvalidDelta: "98.8% / 1.2%",
        duplicatesDelta: "-8.3%",
        tamperDelta: "+4 incidentes",
        trendTitle: "Tendencia de seguridad",
        statusTitle: "Estado de lotes",
      },
    },
  },
  "pt-BR": {
    common: {
      language: "Idioma",
      dashboard: "Painel",
      docs: "Docs",
      pricing: "Preços",
      resellers: "Revendedores",
      login: "Entrar",
      register: "Registrar",
      logout: "Sair",
      apiConnected: "API conectada",
      plans: "Planos",
    },
    web: {
      navProduct: "Produto",
      heroBadge: "NFC Authentication + Digital Identity",
      heroTitle: "Autenticação NFC, antifraude e produto digital para marcas globais.",
      heroBody:
        "Plataforma SaaS multi-tenant para NTAG215 e NTAG 424 DNA TagTamper com validação segura, rastreabilidade e camada premium de identidade/tokenização.",
      heroPrimaryCta: "Solicitar demo",
      heroSecondaryCta: "Ver preços",
      heroResellerCta: "Programa revendedor",
      stats: {
        latency: "Latência alvo API",
        unitEconomics: "Economia secure",
        businessModel: "Modelo de negócio",
        latencyDelta: "P95 < 150ms",
        economicsDelta: "10k garrafas × USD 0.02",
        businessDelta: "Hardware + SaaS + identidade",
      },
      sections: {
        architectureEyebrow: "Arquitetura",
        architectureTitle: "Gateway de autenticação, tags codificadas e camada de identidade digital",
        architectureDescription:
          "Design enterprise para vinho, cosméticos, pharma e eventos, com observabilidade antifraude.",
        useCasesEyebrow: "Casos de uso",
        useCasesTitle: "Wine, cosmetics, pharma e eventos",
        useCasesDescription: "Narrativa de vendas para compradores enterprise e parceiros globais.",
        pricingEyebrow: "Pricing",
        pricingTitle: "BASIC · SECURE · ENTERPRISE / RESELLER",
        pricingDescription: "Pacotes para campanhas, anti-fraude crítico e escala white-label.",
        resellerEyebrow: "Canal",
        resellerTitle: "Programa white-label e revendedores",
        resellerDescription: "Operação multi-tenant para agências, distribuidores e convertedores.",
        docsEyebrow: "Implementação",
        docsTitle: "Quickstart operacional",
        docsDescription: "Rotas em produção e fluxo técnico recomendado.",
      },
      rails: [
        { title: "Authentication gateway", body: "Validação SUN, detecção de duplicatas, alertas tamper e eventos em tempo real." },
        { title: "Encoded tags", body: "NTAG215 para campanhas e NTAG 424 DNA TagTamper para autenticação de alta segurança." },
        { title: "Identity layer", body: "Camada premium pronta para tokenização de ownership e histórico do produto." },
      ],
      resellerCards: [
        { title: "Co-branded SaaS", body: "Operação compartilhada com marca do parceiro." },
        { title: "Private-label operation", body: "Frota multi-tenant dedicada ao revendedor." },
      ],
      docsList: [
        "Health check: /health/",
        "SUN validation: /sun/",
        "Create tenant: /admin/tenants/",
        "Batch lifecycle: /admin/batches/",
        "Manifest import: /admin/batches/:bid/import-manifest/",
      ],
      auth: {
        loginTitle: "Acesso do cliente",
        loginBody: "Entre no painel de autenticação enterprise.",
        registerTitle: "Solicitação de acesso",
        registerBody: "Onboarding para marcas, revendedores e parceiros.",
        companyPlaceholder: "Empresa",
        emailPlaceholder: "Email corporativo",
        passwordPlaceholder: "Senha",
      },
    },
    dashboard: {
      title: "Controle de autenticação",
      subtitle: "Operação enterprise multi-tenant",
      overview: "Visão geral",
      batches: "Lotes",
      analytics: "Analytics",
      events: "Eventos",
      tenants: "Tenants",
      tags: "Tags",
      subscriptions: "Assinaturas",
      apiKeys: "Chaves API",
      forgotPassword: "Recuperar senha",
      roleBasedOps: "Operações por papel",
      overviewDescription: "KPIs de leitura, fraude e status de lotes para operação executiva.",
      analyticsTitle: "Inteligência de leituras",
      analyticsDescription: "Scans, válidos/inválidos, duplicatas, tamper e geografia.",
      batchLifecycleTitle: "Ciclo de vida do lote",
      batchLifecycleDescription: "Criar lote, importar manifest, ativar tags e revogar.",
      eventsTitle: "Fluxo de eventos de segurança",
      eventsDescription: "Rastreabilidade de leituras com foco em replay e tamper.",
      resellersTitle: "Gestão de canal white-label",
      resellersDescription: "Controle de parceiros e subclientes por região.",
      tenantsTitle: "Gestão de tenants",
      tenantsDescription: "Onboarding, plano e governança de acesso.",
      tagsTitle: "Gestão de tags",
      tagsDescription: "Ativação e controle operacional de inventário.",
      subscriptionsTitle: "Operações de receita",
      subscriptionsDescription: "Lifecycle de assinatura e status contratual.",
      apiKeysTitle: "Gestão de credenciais API",
      apiKeysDescription: "Emitir, rotacionar e revogar chaves.",
      auth: {
        loginBody: "Portal seguro para super admin, tenant admin, reseller e viewer.",
        registerBody: "Crie sua organização e plano inicial.",
        forgotBody: "Enviaremos um link para recuperar o acesso.",
      },
      forms: {
        roleHeading: "UX por papel",
        roleHint: {
          "super-admin": "Acesso global a tenants, lotes e parceiros.",
          "tenant-admin": "Gestão operacional do tenant.",
          reseller: "Gestão de subclientes white-label.",
          viewer: "Somente leitura.",
        },
        roleLabel: "Papel",
        createTenant: "Criar tenant",
        createBatch: "Criar lote",
        importManifest: "Importar manifest CSV",
        activateRevoke: "Ativar tags / Revogar lote",
        apiStatus: "Status da API",
        fields: {
          tenantName: "Nome do tenant",
          tenantSlug: "tenant-slug",
          tenantPlan: "Plano",
          tenantId: "tenant_id",
          batchId: "batch_id",
          sku: "SKU",
          quantity: "Quantidade",
          csv: "CSV manifest",
          count: "Quantidade para ativar",
          reason: "Motivo da revogação",
        },
        actions: {
          createTenant: "Criar tenant",
          createBatch: "Criar lote",
          importManifest: "Importar manifest",
          activateTags: "Ativar tags",
          revokeBatch: "Revogar lote",
        },
      },
      kpis: {
        scans: "Scans",
        validInvalid: "Válidos / inválidos",
        duplicates: "Duplicatas",
        tamper: "Tamper alerts",
        scansDelta: "+12.4% (7d)",
        validInvalidDelta: "98.8% / 1.2%",
        duplicatesDelta: "-8.3%",
        tamperDelta: "+4 incidentes",
        trendTitle: "Tendência de segurança",
        statusTitle: "Status dos lotes",
      },
    },
  },
  en: {
    common: {
      language: "Language",
      dashboard: "Dashboard",
      docs: "Docs",
      pricing: "Pricing",
      resellers: "Resellers",
      login: "Login",
      register: "Register",
      logout: "Logout",
      apiConnected: "API connected",
      plans: "Plans",
    },
    web: {
      navProduct: "Product",
      heroBadge: "NFC Authentication + Digital Identity",
      heroTitle: "NFC authentication, anti-fraud and digital product identity for global brands.",
      heroBody:
        "Multi-tenant SaaS for NTAG215 and NTAG 424 DNA TagTamper programs with secure verification, traceability and a premium tokenization-ready identity layer.",
      heroPrimaryCta: "Request demo",
      heroSecondaryCta: "View pricing",
      heroResellerCta: "Reseller program",
      stats: {
        latency: "API latency target",
        unitEconomics: "Secure unit economics",
        businessModel: "Business model",
        latencyDelta: "P95 < 150ms",
        economicsDelta: "10k bottles × USD 0.02",
        businessDelta: "Hardware + SaaS + identity",
      },
      sections: {
        architectureEyebrow: "Architecture",
        architectureTitle: "Authentication gateway, encoded tags and digital identity layer",
        architectureDescription:
          "Enterprise design for wine, cosmetics, pharma and events with anti-fraud observability.",
        useCasesEyebrow: "Use cases",
        useCasesTitle: "Wine, cosmetics, pharma and events",
        useCasesDescription: "Go-to-market narrative for enterprise buyers and global partners.",
        pricingEyebrow: "Pricing",
        pricingTitle: "BASIC · SECURE · ENTERPRISE / RESELLER",
        pricingDescription: "Commercial packaging for growth from pilots to channel scale.",
        resellerEyebrow: "Channel",
        resellerTitle: "White-label reseller program",
        resellerDescription: "Enable agencies and distributors with secure multi-tenant operations.",
        docsEyebrow: "Implementation",
        docsTitle: "Operational quickstart",
        docsDescription: "Production endpoints and recommended onboarding flow.",
      },
      rails: [
        { title: "Authentication gateway", body: "SUN validation, duplicate detection, tamper alerts and real-time events." },
        { title: "Encoded tags", body: "NTAG215 for campaigns and NTAG 424 DNA TagTamper for high-security authentication." },
        { title: "Identity layer", body: "Premium tokenization-ready layer for ownership and lifecycle services." },
      ],
      resellerCards: [
        { title: "Co-branded SaaS", body: "Shared operations with partner branding for fast market entry." },
        { title: "Private-label operation", body: "Dedicated multi-tenant fleet for reseller-owned customer portfolios." },
      ],
      docsList: [
        "Health check: /health/",
        "SUN validation: /sun/",
        "Create tenant: /admin/tenants/",
        "Batch lifecycle: /admin/batches/",
        "Manifest import: /admin/batches/:bid/import-manifest/",
      ],
      auth: {
        loginTitle: "Client access",
        loginBody: "Sign in to the enterprise authentication workspace.",
        registerTitle: "Request access",
        registerBody: "Onboarding for brands, resellers and international partners.",
        companyPlaceholder: "Company",
        emailPlaceholder: "Work email",
        passwordPlaceholder: "Password",
      },
    },
    dashboard: {
      title: "Authentication control",
      subtitle: "Enterprise multi-tenant operations",
      overview: "Overview",
      batches: "Batches",
      analytics: "Analytics",
      events: "Events",
      tenants: "Tenants",
      tags: "Tags",
      subscriptions: "Subscriptions",
      apiKeys: "API Keys",
      forgotPassword: "Forgot password",
      roleBasedOps: "Role-based operations",
      overviewDescription: "Scan, fraud and batch KPIs for executive operations.",
      analyticsTitle: "Scan intelligence",
      analyticsDescription: "Scans, valid/invalid, duplicates, tamper and geo footprint.",
      batchLifecycleTitle: "Batch lifecycle",
      batchLifecycleDescription: "Create batch, import manifest, activate tags and revoke compromised lots.",
      eventsTitle: "Security event stream",
      eventsDescription: "Traceability feed focused on duplicates, replay and tamper.",
      resellersTitle: "White-label channel management",
      resellersDescription: "Manage partners, sub-tenants and regional growth performance.",
      tenantsTitle: "Tenant management",
      tenantsDescription: "Onboard customers, assign plans and govern access.",
      tagsTitle: "Tag management",
      tagsDescription: "Activation and inventory controls for basic and secure profiles.",
      subscriptionsTitle: "Revenue operations",
      subscriptionsDescription: "Subscription lifecycle, upgrades and contract health.",
      apiKeysTitle: "API credential management",
      apiKeysDescription: "Issue, rotate and revoke keys for tenant integrations.",
      auth: {
        loginBody: "Secure portal for super admin, tenant admin, reseller and viewer.",
        registerBody: "Create your organization and initial operating plan.",
        forgotBody: "We will email a secure reset link.",
      },
      forms: {
        roleHeading: "Role UX",
        roleHint: {
          "super-admin": "Global access to tenants, batches, revocations and partners.",
          "tenant-admin": "Tenant operations for batches, activation and analytics.",
          reseller: "Sub-tenant and white-label channel management.",
          viewer: "Read-only mode for analytics and events.",
        },
        roleLabel: "Role",
        createTenant: "Create tenant",
        createBatch: "Create batch",
        importManifest: "Import manifest CSV",
        activateRevoke: "Activate tags / Revoke batch",
        apiStatus: "API status",
        fields: {
          tenantName: "Tenant name",
          tenantSlug: "tenant-slug",
          tenantPlan: "Plan",
          tenantId: "tenant_id",
          batchId: "batch_id",
          sku: "SKU",
          quantity: "Quantity",
          csv: "CSV manifest",
          count: "Activation count",
          reason: "Revoke reason",
        },
        actions: {
          createTenant: "Create tenant",
          createBatch: "Create batch",
          importManifest: "Import manifest",
          activateTags: "Activate tags",
          revokeBatch: "Revoke batch",
        },
      },
      kpis: {
        scans: "Scans",
        validInvalid: "Valid / Invalid",
        duplicates: "Duplicates",
        tamper: "Tamper alerts",
        scansDelta: "+12.4% (7d)",
        validInvalidDelta: "98.8% / 1.2%",
        duplicatesDelta: "-8.3%",
        tamperDelta: "+4 incidents",
        trendTitle: "Security trend",
        statusTitle: "Batch status",
      },
    },
  },
};
