export const locales = ["es-AR", "pt-BR", "en"] as const;
export type AppLocale = (typeof locales)[number];

export function resolveLocale(value?: string | null): AppLocale {
  if (value && locales.includes(value as AppLocale)) return value as AppLocale;
  return "es-AR";
}

export const messages: Record<AppLocale, {
  common: { language: string; dashboard: string; docs: string; pricing: string; resellers: string; login: string; register: string; logout: string; apiConnected: string };
  web: { heroTitle: string; heroBody: string; demo: string; sections: { product: string; pricing: string; reseller: string; docs: string } };
  dashboard: { title: string; subtitle: string; overview: string; batches: string; analytics: string; events: string; tenants: string; tags: string; subscriptions: string; apiKeys: string; forgotPassword: string };
}> = {
  "es-AR": {
    common: { language: "Idioma", dashboard: "Dashboard", docs: "Docs", pricing: "Precios", resellers: "Resellers", login: "Ingresar", register: "Registrarse", logout: "Salir", apiConnected: "API conectada" },
    web: {
      heroTitle: "Autenticación NFC y producto digital para empresas globales.",
      heroBody: "Plataforma SaaS multi-tenant para tags básicas, tags seguras NTAG 424 DNA TagTamper, antifraude, trazabilidad y capa premium de identidad/tokenización.",
      demo: "Solicitar demo",
      sections: { product: "Producto", pricing: "Planes", reseller: "Programa white-label", docs: "Documentación" },
    },
    dashboard: { title: "Control de autenticación", subtitle: "Operación enterprise multi-tenant", overview: "Resumen", batches: "Lotes", analytics: "Analítica", events: "Eventos", tenants: "Tenants", tags: "Tags", subscriptions: "Suscripciones", apiKeys: "API Keys", forgotPassword: "Recuperar contraseña" },
  },
  "pt-BR": {
    common: { language: "Idioma", dashboard: "Painel", docs: "Docs", pricing: "Preços", resellers: "Revendedores", login: "Entrar", register: "Registrar", logout: "Sair", apiConnected: "API conectada" },
    web: {
      heroTitle: "Autenticação NFC e identidade digital para operações enterprise.",
      heroBody: "SaaS multi-tenant para tags básicas, tags seguras NTAG 424 DNA TagTamper, antifraude, rastreabilidade e módulo premium de tokenização.",
      demo: "Solicitar demo",
      sections: { product: "Produto", pricing: "Planos", reseller: "Programa white-label", docs: "Documentação" },
    },
    dashboard: { title: "Controle de autenticação", subtitle: "Operação multi-tenant", overview: "Visão geral", batches: "Lotes", analytics: "Analytics", events: "Eventos", tenants: "Tenants", tags: "Tags", subscriptions: "Assinaturas", apiKeys: "Chaves de API", forgotPassword: "Esqueci a senha" },
  },
  en: {
    common: { language: "Language", dashboard: "Dashboard", docs: "Docs", pricing: "Pricing", resellers: "Resellers", login: "Login", register: "Register", logout: "Logout", apiConnected: "API connected" },
    web: {
      heroTitle: "NFC authentication and digital product identity for global brands.",
      heroBody: "Multi-tenant SaaS for basic tags, secure NTAG 424 DNA TagTamper programs, anti-fraud, traceability, and premium tokenization-ready identity.",
      demo: "Request demo",
      sections: { product: "Product", pricing: "Plans", reseller: "White-label", docs: "Documentation" },
    },
    dashboard: { title: "Authentication control", subtitle: "Enterprise multi-tenant operations", overview: "Overview", batches: "Batches", analytics: "Analytics", events: "Events", tenants: "Tenants", tags: "Tags", subscriptions: "Subscriptions", apiKeys: "API Keys", forgotPassword: "Forgot password" },
  },
};
