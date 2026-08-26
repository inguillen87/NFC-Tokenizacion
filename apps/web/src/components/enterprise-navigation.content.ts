import type { AppLocale } from "@product/config";

export type EnterpriseNavItem = {
  label: string;
  description: string;
  href: string;
  badge?: string;
};

export type EnterpriseNavGroup = {
  id: "product" | "solutions" | "industries" | "demos" | "resources";
  label: string;
  eyebrow: string;
  description: string;
  items: EnterpriseNavItem[];
  featured: EnterpriseNavItem;
};

export type EnterpriseHeaderCopy = {
  navigationLabel: string;
  menuLabel: string;
  closeLabel: string;
  demoLabel: string;
  salesLabel: string;
  loginLabel: string;
};

type NavigationContent = {
  header: EnterpriseHeaderCopy;
  groups: EnterpriseNavGroup[];
};

const navigationByLocale: Record<AppLocale, NavigationContent> = {
  "es-AR": {
    header: {
      navigationLabel: "Navegación principal",
      menuLabel: "Abrir menú",
      closeLabel: "Cerrar menú",
      demoLabel: "Ver demostración",
      salesLabel: "Hablar con ventas",
      loginLabel: "Ingresar",
    },
    groups: [
      {
        id: "product",
        label: "Producto",
        eyebrow: "Qué es nexID",
        description: "Entendé la propuesta y el recorrido del producto antes de entrar en el detalle.",
        items: [
          { label: "Visión general", description: "Qué conecta nexID y qué obtiene cada persona.", href: "/" },
          { label: "Portal del producto", description: "Ingresá para consultar información y próximas acciones.", href: "/login?next=/me" },
          { label: "Operación sin conexión", description: "Consultas y comprobaciones preparadas para campo.", href: "/offline" },
          { label: "Garantía y titularidad", description: "Derechos posteriores a la venta bajo reglas definidas.", href: "/proof/ownership" },
        ],
        featured: { label: "Ver capacidades", description: "Recorré las capacidades principales sin mezclar toda la información en una sola página.", href: "/#activacion" },
      },
      {
        id: "solutions",
        label: "Soluciones",
        eyebrow: "Resultados de negocio",
        description: "Elegí el problema que necesitás resolver y avanzá hacia la vista adecuada.",
        items: [
          { label: "Información confiable por producto", description: "Relacioná cada unidad con datos y controles definidos.", href: "/sun" },
          { label: "Seguimiento de lotes y operaciones", description: "Ordená eventos reportados, lotes y señales para revisar.", href: "/demo-lab?vertical=logistics" },
          { label: "Pasaporte y postventa", description: "Conocé información, servicios y beneficios después de la compra.", href: "/demo-lab?vertical=sneaker" },
          { label: "Verificación pública", description: "Consultá evidencia pública sin exponer datos privados.", href: "/proof/verify" },
        ],
        featured: { label: "Diseñar un piloto", description: "Definí alcance, rubro y resultado esperado con el equipo comercial.", href: "/?contact=sales&intent=company_rollout#contact-modal" },
      },
      {
        id: "industries",
        label: "Rubros",
        eyebrow: "Una plataforma, distintos contextos",
        description: "Explorá experiencias preparadas para productos y operaciones diferentes.",
        items: [
          { label: "Agro e insumos", description: "Semillas, agroquímicos, lotes y uso responsable.", href: "/demo-lab?vertical=seeds" },
          { label: "Medicamentos y salud", description: "Envases, lotes, información aprobada y retiro dirigido.", href: "/demo-lab?vertical=pharma" },
          { label: "Bodegas y bebidas", description: "Origen declarado, protección y experiencia posterior.", href: "/demo-lab?vertical=wine" },
          { label: "Moda y bienes durables", description: "Garantía, cuidado, titularidad y reventa asistida.", href: "/demo-lab?vertical=sneaker" },
        ],
        featured: { label: "Comparar alcance", description: "Revisá alternativas de piloto y puesta en marcha según volumen y necesidad.", href: "/pricing" },
      },
      {
        id: "demos",
        label: "Demostraciones",
        eyebrow: "Mirá antes de decidir",
        description: "Recorridos identificados como demostración, sin presentar datos simulados como reales.",
        items: [
          { label: "Recorrido general", description: "Conocé la experiencia completa paso a paso.", href: "/demo-lab" },
          { label: "Agro y semillas", description: "Identidad de lote, consulta en campo y próxima acción.", href: "/demo-lab?vertical=seeds" },
          { label: "Medicamentos y salud", description: "Cada envase identificado, información de lote y retiro dirigido.", href: "/demo-lab?vertical=pharma" },
          { label: "Moda y calzado", description: "Producto conectado, garantía y servicios posteriores.", href: "/demo-lab?vertical=sneaker" },
        ],
        featured: { label: "Abrir entorno de pruebas", description: "Probá un recorrido controlado con datos de demostración.", href: "/demo-sandbox" },
      },
      {
        id: "resources",
        label: "Recursos",
        eyebrow: "Profundidad cuando la necesitás",
        description: "La información técnica, de integración y seguridad queda organizada fuera de la portada.",
        items: [
          { label: "Documentación", description: "Arquitectura, guías, límites y respuestas frecuentes.", href: "/docs" },
          { label: "Tecnología y seguridad", description: "Capas de protección, comprobación y operación.", href: "/stack" },
          { label: "Para desarrolladores", description: "Guías de integración y herramientas para equipos técnicos.", href: "/sdk" },
          { label: "Glosario", description: "Conceptos de la plataforma explicados en lenguaje claro.", href: "/glossary" },
        ],
        featured: { label: "Abrir verificador público", description: "Interpretá evidencia pública con sus fuentes y límites identificados.", href: "/proof/verify" },
      },
    ],
  },
  en: {
    header: {
      navigationLabel: "Main navigation",
      menuLabel: "Open menu",
      closeLabel: "Close menu",
      demoLabel: "View demo",
      salesLabel: "Talk to sales",
      loginLabel: "Sign in",
    },
    groups: [
      {
        id: "product",
        label: "Product",
        eyebrow: "What nexID is",
        description: "Understand the product journey before opening the technical detail.",
        items: [
          { label: "Overview", description: "What nexID connects and what each person receives.", href: "/" },
          { label: "Product portal", description: "Sign in to view information and next actions.", href: "/login?next=/me" },
          { label: "Offline operations", description: "Field-ready checks and product queries.", href: "/offline" },
          { label: "Warranty and ownership", description: "Policy-controlled rights after the sale.", href: "/proof/ownership" },
        ],
        featured: { label: "View capabilities", description: "Explore the main capabilities without putting every detail on one page.", href: "/#activacion" },
      },
      {
        id: "solutions",
        label: "Solutions",
        eyebrow: "Business outcomes",
        description: "Choose the problem you need to solve and open the right product view.",
        items: [
          { label: "Identity and evidence", description: "Connect each unit to defined data and controls.", href: "/sun" },
          { label: "Operational traceability", description: "Organize reported events, batches and review signals.", href: "/demo-lab?vertical=logistics" },
          { label: "Passport and after-sales", description: "Explore information, services and benefits after purchase.", href: "/demo-lab?vertical=sneaker" },
          { label: "Public verification", description: "Review public evidence without exposing private data.", href: "/proof/verify" },
        ],
        featured: { label: "Design a pilot", description: "Define scope, industry and expected outcome with the sales team.", href: "/?contact=sales&intent=company_rollout#contact-modal" },
      },
      {
        id: "industries",
        label: "Industries",
        eyebrow: "One platform, different contexts",
        description: "Explore experiences prepared for different products and operations.",
        items: [
          { label: "Agriculture and inputs", description: "Seeds, crop protection, batches and responsible use.", href: "/demo-lab?vertical=seeds" },
          { label: "Pharma and health", description: "Units, batches, approved information and targeted recall.", href: "/demo-lab?vertical=pharma" },
          { label: "Wine and beverages", description: "Declared origin, protection and after-sales experience.", href: "/demo-lab?vertical=wine" },
          { label: "Fashion and durable goods", description: "Warranty, care, ownership and assisted resale.", href: "/demo-lab?vertical=sneaker" },
        ],
        featured: { label: "Compare scope", description: "Review pilot and rollout options by volume and need.", href: "/pricing" },
      },
      {
        id: "demos",
        label: "Demos",
        eyebrow: "See it before deciding",
        description: "Journeys clearly identified as demos, without presenting simulated data as real.",
        items: [
          { label: "General journey", description: "Explore the complete experience step by step.", href: "/demo-lab" },
          { label: "Agriculture and seeds", description: "Batch identity, field query and next action.", href: "/demo-lab?vertical=seeds" },
          { label: "Pharmaceutical", description: "Serialized unit, batch information and targeted recall.", href: "/demo-lab?vertical=pharma" },
          { label: "Fashion and footwear", description: "Connected product, warranty and after-sales services.", href: "/demo-lab?vertical=sneaker" },
        ],
        featured: { label: "Open test environment", description: "Try a controlled journey with demo data.", href: "/demo-sandbox" },
      },
      {
        id: "resources",
        label: "Resources",
        eyebrow: "Depth when you need it",
        description: "Technical, integration and security information stays organized away from the home page.",
        items: [
          { label: "Documentation", description: "Architecture, guides, boundaries and common questions.", href: "/docs" },
          { label: "Technology and security", description: "Protection, verification and operating layers.", href: "/stack" },
          { label: "For developers", description: "Integration guides and tools for technical teams.", href: "/sdk" },
          { label: "Glossary", description: "Platform concepts explained in plain language.", href: "/glossary" },
        ],
        featured: { label: "Open public verifier", description: "Interpret public evidence with identified sources and boundaries.", href: "/proof/verify" },
      },
    ],
  },
  "pt-BR": {
    header: {
      navigationLabel: "Navegação principal",
      menuLabel: "Abrir menu",
      closeLabel: "Fechar menu",
      demoLabel: "Ver demonstração",
      salesLabel: "Falar com vendas",
      loginLabel: "Entrar",
    },
    groups: [
      {
        id: "product",
        label: "Produto",
        eyebrow: "O que é a nexID",
        description: "Entenda a proposta e a jornada do produto antes do detalhe técnico.",
        items: [
          { label: "Visão geral", description: "O que a nexID conecta e o que cada pessoa recebe.", href: "/" },
          { label: "Portal do produto", description: "Entre para consultar informações e próximas ações.", href: "/login?next=/me" },
          { label: "Operação sem conexão", description: "Consultas e verificações preparadas para campo.", href: "/offline" },
          { label: "Garantia e titularidade", description: "Direitos após a venda sob regras definidas.", href: "/proof/ownership" },
        ],
        featured: { label: "Ver capacidades", description: "Explore as principais capacidades sem reunir todos os detalhes em uma página.", href: "/#activacion" },
      },
      {
        id: "solutions",
        label: "Soluções",
        eyebrow: "Resultados de negócio",
        description: "Escolha o problema que precisa resolver e abra a visão adequada.",
        items: [
          { label: "Identidade e evidência", description: "Relacione cada unidade com dados e controles definidos.", href: "/sun" },
          { label: "Rastreabilidade operacional", description: "Organize eventos reportados, lotes e sinais de revisão.", href: "/demo-lab?vertical=logistics" },
          { label: "Passaporte e pós-venda", description: "Conheça informações, serviços e benefícios após a compra.", href: "/demo-lab?vertical=sneaker" },
          { label: "Verificação pública", description: "Consulte evidências públicas sem expor dados privados.", href: "/proof/verify" },
        ],
        featured: { label: "Desenhar um piloto", description: "Defina escopo, setor e resultado esperado com a equipe comercial.", href: "/?contact=sales&intent=company_rollout#contact-modal" },
      },
      {
        id: "industries",
        label: "Setores",
        eyebrow: "Uma plataforma, contextos diferentes",
        description: "Explore experiências preparadas para produtos e operações diferentes.",
        items: [
          { label: "Agro e insumos", description: "Sementes, defensivos, lotes e uso responsável.", href: "/demo-lab?vertical=seeds" },
          { label: "Medicamentos e saúde", description: "Unidades, lotes, informação aprovada e recolhimento direcionado.", href: "/demo-lab?vertical=pharma" },
          { label: "Vinhos e bebidas", description: "Origem declarada, proteção e experiência posterior.", href: "/demo-lab?vertical=wine" },
          { label: "Moda e bens duráveis", description: "Garantia, cuidado, titularidade e revenda assistida.", href: "/demo-lab?vertical=sneaker" },
        ],
        featured: { label: "Comparar escopo", description: "Revise opções de piloto e implantação por volume e necessidade.", href: "/pricing" },
      },
      {
        id: "demos",
        label: "Demonstrações",
        eyebrow: "Veja antes de decidir",
        description: "Jornadas identificadas como demonstração, sem apresentar dados simulados como reais.",
        items: [
          { label: "Jornada geral", description: "Conheça a experiência completa passo a passo.", href: "/demo-lab" },
          { label: "Agro e sementes", description: "Identidade do lote, consulta no campo e próxima ação.", href: "/demo-lab?vertical=seeds" },
          { label: "Medicamentos e saúde", description: "Cada embalagem identificada, informação de lote e recolhimento direcionado.", href: "/demo-lab?vertical=pharma" },
          { label: "Moda e calçados", description: "Produto conectado, garantia e serviços posteriores.", href: "/demo-lab?vertical=sneaker" },
        ],
        featured: { label: "Abrir ambiente de testes", description: "Teste uma jornada controlada com dados de demonstração.", href: "/demo-sandbox" },
      },
      {
        id: "resources",
        label: "Recursos",
        eyebrow: "Profundidade quando você precisa",
        description: "Informações técnicas, de integração e segurança ficam organizadas fora da página inicial.",
        items: [
          { label: "Documentação", description: "Arquitetura, guias, limites e perguntas frequentes.", href: "/docs" },
          { label: "Tecnologia e segurança", description: "Camadas de proteção, verificação e operação.", href: "/stack" },
          { label: "Para desenvolvedores", description: "Guias de integração e ferramentas para equipes técnicas.", href: "/sdk" },
          { label: "Glossário", description: "Conceitos da plataforma explicados em linguagem clara.", href: "/glossary" },
        ],
        featured: { label: "Abrir verificador público", description: "Interprete evidências públicas com fontes e limites identificados.", href: "/proof/verify" },
      },
    ],
  },
};

export function getEnterpriseNavigation(locale: AppLocale): NavigationContent {
  return navigationByLocale[locale];
}
