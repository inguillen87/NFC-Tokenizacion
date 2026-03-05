import type { AppLocale } from "@product/config";

export type LandingContent = {
  nav: { product: string; pricing: string; reseller: string; docs: string; cta: string; requestDemo: string };
  hero: { badge: string; title: string; body: string; primary: string; secondary: string; tertiary: string };
  what: { eyebrow: string; title: string; description: string; cards: Array<{ title: string; body: string }> };
  plans: { eyebrow: string; title: string; description: string; cards: Array<{ name: string; badge: string; price: string; body: string; bullets: string[] }> };
  secure: { eyebrow: string; title: string; description: string; bullets: string[] };
  useCases: { eyebrow: string; title: string; description: string; cards: Array<{ title: string; body: string }> };
  reseller: { eyebrow: string; title: string; description: string; cards: Array<{ title: string; body: string }> };
  api: { eyebrow: string; title: string; description: string; bullets: string[] };
  identity: { eyebrow: string; title: string; description: string; bullets: string[] };
  roi: { eyebrow: string; title: string; description: string; metrics: Array<{ label: string; value: string; detail: string }> };
  credibility: { eyebrow: string; title: string; description: string; items: string[] };
  cta: { title: string; body: string; primary: string; secondary: string };
};

export const landingContent: Record<AppLocale, LandingContent> = {
  "es-AR": {
    nav: { product: "Producto", pricing: "Planes", reseller: "Resellers", docs: "Docs", cta: "Dashboard", requestDemo: "Solicitar demo" },
    hero: {
      badge: "NFC Authentication + Digital Product Identity",
      title: "No vendemos solo tags NFC: operamos la plataforma de autenticación y trazabilidad.",
      body: "Desde NTAG215 para campañas hasta NTAG 424 DNA TagTamper para antifraude de alto riesgo, con gateway API, analítica de escaneos y capa premium de identidad/tokenización.",
      primary: "Solicitar demo enterprise",
      secondary: "Ver arquitectura",
      tertiary: "Ver pricing",
    },
    what: {
      eyebrow: "Qué hace la plataforma",
      title: "Encoded tags + API gateway + antifraude + SaaS multi-tenant",
      description: "Infraestructura lista para marcas, resellers y operaciones internacionales con control extremo de lote y validación.",
      cards: [
        { title: "Encoded secure tags", body: "Perfiles basic y secure, encodeo por lote y políticas de activación." },
        { title: "Authentication gateway", body: "Validación, deduplicación, eventos y detección de comportamiento sospechoso." },
        { title: "Traceability intelligence", body: "Taps geolocalizados, estados de lote y señales de riesgo en tiempo real." },
      ],
    },
    plans: {
      eyebrow: "Basic vs Secure vs Enterprise",
      title: "Packaging comercial para cada etapa",
      description: "Desde activaciones de marketing hasta autenticación crítica en exportación y pharma.",
      cards: [
        { name: "BASIC", badge: "NTAG215", price: "Desde USD 99 / mes", body: "Eventos, marketing, loyalty y tracking simple.", bullets: ["Tap-to-web", "Scan analytics", "Sin criptografía SUN"] },
        { name: "SECURE", badge: "NTAG 424 DNA TT", price: "Desde USD 200 / 10k", body: "Autenticación robusta para anti-counterfeit.", bullets: ["SUN validation", "Duplicate alerts", "Tamper intelligence"] },
        { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Canal partner, SLA y operación multi-tenant avanzada.", bullets: ["Branding white-label", "API keys y webhooks", "Digital identity premium"] },
      ],
    },
    secure: {
      eyebrow: "Por qué 424 TagTamper",
      title: "Capa secure para vino, cosmética y pharma",
      description: "NTAG 424 DNA TagTamper habilita autenticación dinámica, sensibilidad de manipulación y mejor resiliencia frente a clonación.",
      bullets: ["Challenge dinámico por tap", "Tamper signal para cierres y sellos", "Workflows de revocación por lote", "Trazabilidad anti-replay"],
    },
    useCases: {
      eyebrow: "Verticales",
      title: "Casos de uso con ROI directo",
      description: "Diseñado para operaciones donde el fraude impacta margen, reputación y cumplimiento.",
      cards: [
        { title: "Wine", body: "Autenticación de botella, export compliance y experiencia premium posventa." },
        { title: "Cosmetics", body: "Protección de marca, serialización inteligente y activación de consumidor." },
        { title: "Pharma", body: "Trazabilidad de producto y reducción de riesgo de falsificación." },
        { title: "Events", body: "Credenciales seguras, engagement y analítica de asistencia." },
      ],
    },
    reseller: {
      eyebrow: "Canal",
      title: "Modelo reseller / white-label desde día uno",
      description: "Agencias, convertidores y distribuidores pueden operar su cartera sobre la infraestructura central.",
      cards: [
        { title: "Co-branded operations", body: "Marca compartida, despliegue rápido y control centralizado." },
        { title: "Private-label workspace", body: "Experiencia con marca partner y aislamiento por tenant." },
      ],
    },
    api: {
      eyebrow: "Developer-friendly",
      title: "Gateway API listo para integrar",
      description: "Contratos previsibles, endpoints administrativos y flujo de validación robusto para escalar sin fricción.",
      bullets: ["/health y /sun en producción", "/admin/tenants, /admin/batches y activación", "Logs/eventos para observabilidad", "Base para SDK y webhooks"],
    },
    identity: {
      eyebrow: "Capa premium",
      title: "Digital identity / tokenization layer",
      description: "Cada producto puede evolucionar de autenticación a identidad digital persistente.",
      bullets: ["Ownership passport", "Warranty y lifecycle events", "Asset-grade records", "Tokenization-ready roadmap"],
    },
    roi: {
      eyebrow: "ROI",
      title: "Lógica económica clara para dirección y ventas",
      description: "Combinamos revenue por hardware, SaaS y módulos premium para crecimiento sostenible.",
      metrics: [
        { label: "Fraud loss reduction", value: "-30% a -70%", detail: "Según industria y nivel de adopción secure." },
        { label: "Scan visibility", value: "+10x", detail: "Mayor granularidad de trazabilidad y operación." },
        { label: "Margin expansion", value: "+8% a +18%", detail: "Por mezcla de secure + identidad digital." },
      ],
    },
    credibility: {
      eyebrow: "Investor-grade",
      title: "Credibilidad para enterprise buyers e inversores",
      description: "Narrativa respaldada por arquitectura, unit economics y estrategia de canal.",
      items: ["Monorepo productizado: web + dashboard + API", "Modelo multi-tenant escalable", "Canal white-label para expansión regional", "Roadmap premium de identidad/tokenización"],
    },
    cta: {
      title: "Listo para un piloto enterprise",
      body: "Co-diseñamos el despliegue para vino, cosmética, pharma o ecosistemas de resellers.",
      primary: "Agendar demo",
      secondary: "Hablar con ventas",
    },
  },
  "pt-BR": {
    nav: { product: "Produto", pricing: "Planos", reseller: "Revendedores", docs: "Docs", cta: "Painel", requestDemo: "Solicitar demo" },
    hero: { badge: "NFC Authentication + Digital Product Identity", title: "Não vendemos apenas tags NFC: operamos a plataforma de autenticação e rastreabilidade.", body: "De NTAG215 para campanhas até NTAG 424 DNA TagTamper para antifraude crítico, com gateway API, analytics e camada premium de identidade/tokenização.", primary: "Solicitar demo enterprise", secondary: "Ver arquitetura", tertiary: "Ver preços" },
    what: { eyebrow: "O que a plataforma faz", title: "Encoded tags + API gateway + antifraude + SaaS multi-tenant", description: "Infraestrutura para marcas, revendedores e operações internacionais.", cards: [{ title: "Encoded secure tags", body: "Perfis basic e secure com ativação por lote." }, { title: "Authentication gateway", body: "Validação, deduplicação e sinais de risco." }, { title: "Traceability intelligence", body: "Leituras geolocalizadas e status operacional." }] },
    plans: { eyebrow: "Basic vs Secure vs Enterprise", title: "Pacotes comerciais por estágio", description: "Do marketing ao anti-counterfeit de alta criticidade.", cards: [{ name: "BASIC", badge: "NTAG215", price: "A partir de USD 99 / mês", body: "Eventos, marketing e tracking básico.", bullets: ["Tap-to-web", "Scan analytics", "Sem SUN"] }, { name: "SECURE", badge: "NTAG 424 DNA TT", price: "A partir de USD 200 / 10k", body: "Autenticação robusta anti-fraude.", bullets: ["SUN validation", "Duplicate alerts", "Tamper intelligence"] }, { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Canal parceiro com SLA e multi-tenant.", bullets: ["White-label", "API keys", "Digital identity premium"] }] },
    secure: { eyebrow: "Por que 424 TagTamper", title: "Camada secure para vinho, cosméticos e pharma", description: "Autenticação dinâmica e melhor resiliência contra clonagem.", bullets: ["Challenge dinâmico", "Tamper signal", "Revogação por lote", "Anti-replay"] },
    useCases: { eyebrow: "Verticais", title: "Casos de uso com ROI direto", description: "Para setores em que fraude impacta margem e reputação.", cards: [{ title: "Wine", body: "Autenticação de garrafa e export compliance." }, { title: "Cosmetics", body: "Proteção de marca e engajamento." }, { title: "Pharma", body: "Rastreabilidade e redução de falsificação." }, { title: "Events", body: "Credenciais seguras e analytics." }] },
    reseller: { eyebrow: "Canal", title: "Modelo revendedor / white-label", description: "Agências e distribuidores operam sobre a infraestrutura central.", cards: [{ title: "Co-branded operations", body: "Marca compartilhada e rollout rápido." }, { title: "Private-label workspace", body: "Experiência com marca do parceiro." }] },
    api: { eyebrow: "Developer-friendly", title: "Gateway API pronto para integrar", description: "Contratos previsíveis para escalar com segurança.", bullets: ["/health e /sun", "Admin endpoints", "Logs de eventos", "Base para SDK/webhooks"] },
    identity: { eyebrow: "Camada premium", title: "Digital identity / tokenization layer", description: "Cada produto evolui para identidade digital persistente.", bullets: ["Ownership passport", "Warranty events", "Asset records", "Tokenization-ready roadmap"] },
    roi: { eyebrow: "ROI", title: "Lógica econômica clara", description: "Receita combinada de hardware + SaaS + módulos premium.", metrics: [{ label: "Fraud loss reduction", value: "-30% a -70%", detail: "Conforme vertical e adoção secure." }, { label: "Scan visibility", value: "+10x", detail: "Mais granularidade operacional." }, { label: "Margin expansion", value: "+8% a +18%", detail: "Mix secure + identidade digital." }] },
    credibility: { eyebrow: "Investor-grade", title: "Credibilidade para enterprise e investidores", description: "Arquitetura, economics e estratégia de canal em linha.", items: ["Monorepo com web + dashboard + API", "Modelo multi-tenant escalável", "Canal white-label regional", "Roadmap premium de identidade"] },
    cta: { title: "Pronto para um piloto enterprise", body: "Co-projetamos o rollout para vinho, cosméticos, pharma ou canais revendedores.", primary: "Agendar demo", secondary: "Falar com vendas" },
  },
  en: {
    nav: { product: "Product", pricing: "Pricing", reseller: "Resellers", docs: "Docs", cta: "Dashboard", requestDemo: "Request demo" },
    hero: { badge: "NFC Authentication + Digital Product Identity", title: "We do more than sell NFC tags: we run the authentication and traceability platform.", body: "From NTAG215 campaign programs to NTAG 424 DNA TagTamper anti-counterfeit deployments, powered by an API gateway, scan intelligence and a premium digital identity/tokenization layer.", primary: "Request enterprise demo", secondary: "View architecture", tertiary: "View pricing" },
    what: { eyebrow: "What the platform does", title: "Encoded tags + API gateway + anti-fraud + multi-tenant SaaS", description: "Infrastructure for global brands, agencies and international operations.", cards: [{ title: "Encoded secure tags", body: "Basic and secure profiles with batch-level activation governance." }, { title: "Authentication gateway", body: "Verification, deduplication and suspicious behavior detection." }, { title: "Traceability intelligence", body: "Geo-aware scans, batch status and risk signal visibility." }] },
    plans: { eyebrow: "Basic vs Secure vs Enterprise", title: "Commercial packaging by maturity stage", description: "From marketing use-cases to mission-critical anti-counterfeit programs.", cards: [{ name: "BASIC", badge: "NTAG215", price: "From USD 99 / month", body: "Events, marketing and simple tracking.", bullets: ["Tap-to-web", "Scan analytics", "No SUN crypto"] }, { name: "SECURE", badge: "NTAG 424 DNA TT", price: "From USD 200 / 10k", body: "High-confidence product authentication.", bullets: ["SUN validation", "Duplicate alerts", "Tamper intelligence"] }, { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Partner channel model with SLA and multi-tenant controls.", bullets: ["White-label branding", "API keys + webhooks", "Premium identity layer"] }] },
    secure: { eyebrow: "Why 424 TagTamper", title: "Secure profile for wine, cosmetics and pharma", description: "NTAG 424 DNA TagTamper supports dynamic authentication and stronger anti-clone resilience.", bullets: ["Dynamic challenge per tap", "Tamper signal for closures and seals", "Batch-level revocation workflows", "Replay-risk traceability"] },
    useCases: { eyebrow: "Vertical use cases", title: "Wine, cosmetics, pharma and events", description: "Built for industries where fraud impacts margin, trust and compliance.", cards: [{ title: "Wine", body: "Bottle authentication, export compliance and premium ownership journeys." }, { title: "Cosmetics", body: "Brand protection and consumer engagement." }, { title: "Pharma", body: "Product traceability and counterfeit mitigation." }, { title: "Events", body: "Secure credentials and attendance intelligence." }] },
    reseller: { eyebrow: "Distribution channel", title: "Reseller / white-label operating model", description: "Agencies and distributors can run their own portfolio on shared secure rails.", cards: [{ title: "Co-branded operations", body: "Shared branding with centralized control." }, { title: "Private-label workspace", body: "Partner-branded experience with tenant isolation." }] },
    api: { eyebrow: "Developer-friendly", title: "API gateway built for integration", description: "Predictable contracts and admin endpoints designed for fast enterprise rollout.", bullets: ["Production /health and /sun", "Admin endpoints for tenants and batches", "Event logs for observability", "SDK/webhook-ready foundation"] },
    identity: { eyebrow: "Premium module", title: "Digital identity / tokenization layer", description: "Each physical product can evolve from authentication to persistent digital identity.", bullets: ["Ownership passport", "Warranty and lifecycle events", "Asset-grade records", "Tokenization-ready roadmap"] },
    roi: { eyebrow: "ROI logic", title: "Clear economics for boards and sales teams", description: "Hardware + SaaS + premium identity creates defensible margin expansion.", metrics: [{ label: "Fraud loss reduction", value: "-30% to -70%", detail: "Depends on vertical and secure profile adoption." }, { label: "Scan visibility", value: "+10x", detail: "Higher granularity for operations and compliance." }, { label: "Margin expansion", value: "+8% to +18%", detail: "Driven by secure + digital identity mix." }] },
    credibility: { eyebrow: "Investor-facing credibility", title: "Built to be sold to enterprise buyers and partners now", description: "Architecture, unit economics and channel model aligned from day one.", items: ["Productized monorepo: web + dashboard + API", "Scalable multi-tenant operating model", "White-label channel for regional expansion", "Premium identity/tokenization growth layer"] },
    cta: { title: "Ready for an enterprise pilot", body: "We can co-design deployment for wine, cosmetics, pharma and reseller ecosystems.", primary: "Book a demo", secondary: "Talk to sales" },
  },
};
