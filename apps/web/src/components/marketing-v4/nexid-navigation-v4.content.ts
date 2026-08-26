import type { NexidNavigationV4Content } from "./nexid-navigation-v4.types";

const sharedHrefs = {
  product: "/#product",
  solutions: "/#solutions",
  demo: "/demo-lab",
  resources: "/proof/verify",
  developers: "/sdk",
  demoCta: "/demo-lab",
  salesCta: "/?contact=sales#contact-modal",
} as const;

const esAR = {
  aria: {
    home: "Ir al inicio de nexID",
    primaryNavigation: "Navegación principal",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    mobileDialog: "Menú de navegación de nexID",
    mobileNavigation: "Secciones principales",
    actions: "Acciones",
    preferences: "Idioma y apariencia",
    opensNewWindow: "Abre en una pestaña nueva",
  },
  mobileEyebrow: "Explorar nexID",
  categories: {
    product: {
      label: "Producto",
      href: sharedHrefs.product,
      summary: "Identidad, comprobación y derechos digitales en una sola plataforma.",
      overviewLabel: "Conocer el producto",
      links: [
        { label: "Cómo funciona", href: sharedHrefs.product, description: "Del producto físico a una experiencia verificable." },
        { label: "Comprobar evidencia", href: "/proof/verify", description: "Consultar una prueba sin entrar al panel de gestión." },
        { label: "Titularidad digital", href: "/proof/ownership", description: "Activación y transferencia de derechos digitales." },
      ],
    },
    solutions: {
      label: "Soluciones",
      href: sharedHrefs.solutions,
      summary: "Recorridos claros para marcas, operaciones y socios comerciales.",
      overviewLabel: "Ver soluciones",
      links: [
        { label: "Por audiencia", href: "/audiences", description: "Encontrá el recorrido adecuado para tu equipo." },
        { label: "Operaciones sin conexión", href: "/offline", description: "Continuidad de campo con sincronización controlada." },
        { label: "Socios y revendedores", href: "/resellers", description: "Implementación y comercialización con nexID." },
      ],
    },
    demo: {
      label: "Demostraciones",
      href: sharedHrefs.demo,
      summary: "Probá el recorrido del producto, la evidencia y la experiencia posterior a la lectura.",
      overviewLabel: "Abrir demostraciones",
      links: [
        { label: "Laboratorio de demostraciones", href: "/demo-lab", description: "Escenarios guiados por industria y objetivo." },
        { label: "Demostración comercial", href: "/demo", description: "Una introducción breve para evaluar el producto." },
        { label: "Entorno de pruebas", href: "/demo-sandbox", description: "Pruebas controladas para equipos de integración." },
      ],
    },
    resources: {
      label: "Recursos",
      href: sharedHrefs.resources,
      summary: "Evidencia pública, documentación y criterios de adopción.",
      overviewLabel: "Abrir verificador",
      links: [
        { label: "Centro de verificación", href: "/proof/verify", description: "Validá evidencia y revisá su alcance." },
        { label: "Documentación", href: "/docs", description: "Guías funcionales y técnicas." },
        { label: "Precios", href: "/pricing", description: "Configuración y estimación del despliegue." },
      ],
    },
    developers: {
      label: "Desarrolladores",
      href: sharedHrefs.developers,
      summary: "Herramientas, arquitectura y recursos para integrar nexID.",
      overviewLabel: "Explorar integración",
      links: [
        { label: "Kit de integración", href: "/sdk", description: "Puntos de entrada para comenzar una integración." },
        { label: "Documentación técnica", href: "/docs", description: "Contratos, flujos y ejemplos de uso." },
        { label: "Tecnología", href: "/stack", description: "Arquitectura y tecnologías de la plataforma." },
      ],
    },
  },
  actions: {
    demo: { label: "Ver demostración", href: sharedHrefs.demoCta },
    sales: { label: "Hablar con ventas", href: sharedHrefs.salesCta },
    loginLabel: "Ingresar",
  },
} satisfies NexidNavigationV4Content;

const en = {
  aria: {
    home: "Go to the nexID home page",
    primaryNavigation: "Primary navigation",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    mobileDialog: "nexID navigation menu",
    mobileNavigation: "Main sections",
    actions: "Actions",
    preferences: "Language and appearance",
    opensNewWindow: "Opens in a new tab",
  },
  mobileEyebrow: "Explore nexID",
  categories: {
    product: {
      label: "Product",
      href: sharedHrefs.product,
      summary: "Identity, verification, and digital ownership in one platform.",
      overviewLabel: "Explore the product",
      links: [
        { label: "How it works", href: sharedHrefs.product, description: "From a physical product to a verifiable experience." },
        { label: "Verify evidence", href: "/proof/verify", description: "Review proof without signing in to the dashboard." },
        { label: "Digital title", href: "/proof/ownership", description: "Activate and transfer digital product rights." },
      ],
    },
    solutions: {
      label: "Solutions",
      href: sharedHrefs.solutions,
      summary: "Clear paths for brands, operations teams, and commercial partners.",
      overviewLabel: "View solutions",
      links: [
        { label: "By audience", href: "/audiences", description: "Find the right path for your team." },
        { label: "Offline operations", href: "/offline", description: "Field continuity with controlled synchronization." },
        { label: "Partners and resellers", href: "/resellers", description: "Implement and sell with nexID." },
      ],
    },
    demo: {
      label: "Demo",
      href: sharedHrefs.demo,
      summary: "Try the product, evidence, and post-tap journey.",
      overviewLabel: "Open Demo Lab",
      links: [
        { label: "Demo Lab", href: "/demo-lab", description: "Guided scenarios by industry and goal." },
        { label: "Product demo", href: "/demo", description: "A short introduction for product evaluation." },
        { label: "Technical sandbox", href: "/demo-sandbox", description: "Controlled testing for technical teams." },
      ],
    },
    resources: {
      label: "Resources",
      href: sharedHrefs.resources,
      summary: "Public evidence, documentation, and adoption guidance.",
      overviewLabel: "Open verifier",
      links: [
        { label: "Verification center", href: "/proof/verify", description: "Validate evidence and review its scope." },
        { label: "Documentation", href: "/docs", description: "Functional and technical guidance." },
        { label: "Pricing", href: "/pricing", description: "Configure and estimate a rollout." },
      ],
    },
    developers: {
      label: "Developers",
      href: sharedHrefs.developers,
      summary: "SDK, architecture, and resources for integrating nexID.",
      overviewLabel: "Explore the SDK",
      links: [
        { label: "SDK", href: "/sdk", description: "Entry points for starting an integration." },
        { label: "Technical docs", href: "/docs", description: "Contracts, flows, and usage examples." },
        { label: "Stack", href: "/stack", description: "Platform architecture and technologies." },
      ],
    },
  },
  actions: {
    demo: { label: "View demo", href: sharedHrefs.demoCta },
    sales: { label: "Talk to sales", href: sharedHrefs.salesCta },
    loginLabel: "Sign in",
  },
} satisfies NexidNavigationV4Content;

const ptBR = {
  aria: {
    home: "Ir para a página inicial da nexID",
    primaryNavigation: "Navegação principal",
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
    mobileDialog: "Menu de navegação da nexID",
    mobileNavigation: "Seções principais",
    actions: "Ações",
    preferences: "Idioma e aparência",
    opensNewWindow: "Abre em uma nova aba",
  },
  mobileEyebrow: "Explorar nexID",
  categories: {
    product: {
      label: "Produto",
      href: sharedHrefs.product,
      summary: "Identidade, verificação e propriedade digital em uma plataforma.",
      overviewLabel: "Conhecer o produto",
      links: [
        { label: "Como funciona", href: sharedHrefs.product, description: "Do produto físico a uma experiência verificável." },
        { label: "Verificar evidência", href: "/proof/verify", description: "Consulte uma prova sem entrar no painel de gestão." },
        { label: "Titularidade digital", href: "/proof/ownership", description: "Ativação e transferência de direitos digitais." },
      ],
    },
    solutions: {
      label: "Soluções",
      href: sharedHrefs.solutions,
      summary: "Caminhos claros para marcas, operações e parceiros comerciais.",
      overviewLabel: "Ver soluções",
      links: [
        { label: "Por público", href: "/audiences", description: "Encontre o caminho certo para sua equipe." },
        { label: "Operações sem conexão", href: "/offline", description: "Continuidade em campo com sincronização controlada." },
        { label: "Parceiros e revendedores", href: "/resellers", description: "Implemente e comercialize com a nexID." },
      ],
    },
    demo: {
      label: "Demonstrações",
      href: sharedHrefs.demo,
      summary: "Teste o produto, a evidência e a jornada pós-toque.",
      overviewLabel: "Abrir demonstrações",
      links: [
        { label: "Laboratório de demonstrações", href: "/demo-lab", description: "Cenários guiados por indústria e objetivo." },
        { label: "Demonstração comercial", href: "/demo", description: "Uma introdução curta para avaliar o produto." },
        { label: "Ambiente de testes", href: "/demo-sandbox", description: "Testes controlados para equipes de integração." },
      ],
    },
    resources: {
      label: "Recursos",
      href: sharedHrefs.resources,
      summary: "Evidência pública, documentação e critérios de adoção.",
      overviewLabel: "Abrir verificador",
      links: [
        { label: "Centro de verificação", href: "/proof/verify", description: "Valide evidências e consulte seu alcance." },
        { label: "Documentação", href: "/docs", description: "Guias funcionais e técnicos." },
        { label: "Preços", href: "/pricing", description: "Configure e estime uma implementação." },
      ],
    },
    developers: {
      label: "Desenvolvedores",
      href: sharedHrefs.developers,
      summary: "Ferramentas, arquitetura e recursos para integrar a nexID.",
      overviewLabel: "Explorar integração",
      links: [
        { label: "Kit de integração", href: "/sdk", description: "Pontos de entrada para iniciar uma integração." },
        { label: "Documentação técnica", href: "/docs", description: "Contratos, fluxos e exemplos de uso." },
        { label: "Tecnologia", href: "/stack", description: "Arquitetura e tecnologias da plataforma." },
      ],
    },
  },
  actions: {
    demo: { label: "Ver demonstração", href: sharedHrefs.demoCta },
    sales: { label: "Falar com vendas", href: sharedHrefs.salesCta },
    loginLabel: "Entrar",
  },
} satisfies NexidNavigationV4Content;

export const NEXID_NAVIGATION_V4_CONTENT = {
  "es-AR": esAR,
  es: esAR,
  en,
  "pt-BR": ptBR,
  pt: ptBR,
} as const satisfies Record<string, NexidNavigationV4Content>;

export function getNexidNavigationV4Content(locale: string): NexidNavigationV4Content {
  return NEXID_NAVIGATION_V4_CONTENT[locale as keyof typeof NEXID_NAVIGATION_V4_CONTENT] ?? esAR;
}
