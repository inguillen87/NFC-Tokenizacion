import type { AppLocale } from "@product/config";

type CopyCard = { title: string; body: string };

export type LandingContent = {
  nav: { product: string; pricing: string; reseller: string; docs: string; cta: string; requestDemo: string };
  hero: { badge: string; title: string; body: string; primary: string; secondary: string; tertiary: string };
  trustBar: string[];
  howItWorks: { eyebrow: string; title: string; description: string; steps: Array<{ title: string; body: string }> };
  what: { eyebrow: string; title: string; description: string; cards: CopyCard[] };
  plans: { eyebrow: string; title: string; description: string; cards: Array<{ name: string; badge: string; price: string; body: string; bullets: string[] }> };
  secure: { eyebrow: string; title: string; description: string; bullets: string[] };
  authenticity: { eyebrow: string; title: string; description: string; badges: { good: string; warn: string; risk: string }; cards: Array<{ state: string; detail: string; tone: "good" | "warn" | "risk" }> };
  useCases: { eyebrow: string; title: string; description: string; cards: CopyCard[] };
  radar: { eyebrow: string; title: string; description: string; liveLabel: string; revenueLabel: string; mapCaption: string; logsTitle: string; waitingLabel: string; signalTitle: string; products: string[]; signals: Array<{ label: string; value: string }> };
  intelligence: { eyebrow: string; title: string; description: string; bullets: string[] };
  reseller: { eyebrow: string; title: string; description: string; cards: CopyCard[] };
  api: { eyebrow: string; title: string; description: string; bullets: string[] };
  identity: { eyebrow: string; title: string; description: string; bullets: string[] };
  calculator: {
    eyebrow: string;
    title: string;
    description: string;
    volumeLabel: string;
    productLabel: string;
    securityLabel: string;
    channelLabel: string;
    recommendationLabel: string;
    hardwareSpendLabel: string;
    saasFeeLabel: string;
    activationScopeLabel: string;
    analyticsScopeLabel: string;
    perYearLabel: string;
    tagsUnitLabel: string;
    scopeLabels: { base: string; extended: string; advanced: string };
    cta: string;
    options: {
      product: Array<{ value: "wine" | "cosmetics" | "events" | "pharma"; label: string }>;
      security: Array<{ value: "basic" | "secure" | "enterprise"; label: string }>;
      channel: Array<{ value: "direct" | "reseller"; label: string }>;
    };
  };
  roi: { eyebrow: string; title: string; description: string; metrics: Array<{ label: string; value: string; detail: string }> };
  credibility: { eyebrow: string; title: string; description: string; items: string[] };
  cta: { title: string; body: string; primary: string; secondary: string };
  docsList: string[];
};

export const landingContent: Record<AppLocale, LandingContent> = {
  "es-AR": {
    nav: { product: "Producto", pricing: "Planes", reseller: "Canal", docs: "Arquitectura", cta: "Dashboard", requestDemo: "Solicitar demo" },
    hero: {
      badge: "Autenticación NFC + Identidad Digital de Producto",
      title: "Autenticá productos. Activá inteligencia. Escalá confianza.",
      body: "Inmovar Identity Rail integra chip NFC + API de autenticación + inteligencia antifraude para convertir cada producto físico en un activo digital trazable y monetizable.",
      primary: "Solicitar demo enterprise",
      secondary: "Ver arquitectura",
      tertiary: "Ver pricing",
    },
    trustBar: ["Programas NTAG215", "NTAG 424 DNA TagTamper", "API de autenticación", "SaaS multi-tenant", "Canal white-label"],
    howItWorks: {
      eyebrow: "Cómo funciona la rail",
      title: "Tag → Tap → Validación API → Inteligencia de negocio",
      description: "Un flujo claro que conecta hardware codificado con decisiones operativas en tiempo real.",
      steps: [
        { title: "1. Encode por lote", body: "Definí perfiles basic o secure, SKU, tenant y políticas de activación/revocación." },
        { title: "2. Tap en campo", body: "Cada lectura ejecuta validación con señales de duplicado, geografía y riesgo de tamper." },
        { title: "3. API Authentication", body: "Gateway central con contratos estables para SUN, eventos y operación administrativa." },
        { title: "4. Dashboard intelligence", body: "KPIs, alertas y performance por marca, mercado y partner reseller." },
      ],
    },
    what: {
      eyebrow: "Qué hace la plataforma",
      title: "No es venta de tags sueltos: es infraestructura de identidad de producto",
      description: "Hardware + software + analytics con separación clara entre basic y secure value.",
      cards: [
        { title: "Encoded secure tags", body: "Perfiles NTAG215 y NTAG424 con gobierno de activación por lote." },
        { title: "Authentication gateway", body: "Validación criptográfica, deduplicación y alertas antifraude." },
        { title: "Traceability intelligence", body: "Estados de autenticidad, distribución geográfica y señales operativas." },
      ],
    },
    plans: {
      eyebrow: "Basic vs Secure vs Enterprise",
      title: "Packaging comercial por nivel de riesgo",
      description: "Desde campañas de marketing hasta anti-counterfeit de exportación.",
      cards: [
        { name: "BASIC", badge: "NTAG215", price: "Desde USD 99 / mes", body: "Eventos, accesos y tracking simple.", bullets: ["Tap-to-web", "Analítica de escaneos", "Sin criptografía SUN"] },
        { name: "SECURE", badge: "NTAG 424 DNA TT", price: "Desde USD 200 / 10k", body: "Autenticación robusta para riesgo real.", bullets: ["SUN validation", "Duplicate alerts", "Tamper intelligence"] },
        { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Operación multi-tenant con SLA y canal.", bullets: ["Branding white-label", "API keys y webhooks", "Identidad digital premium"] },
      ],
    },
    secure: {
      eyebrow: "Por qué 424 TagTamper",
      title: "Capa secure para vino, cosmética y pharma",
      description: "NTAG 424 DNA TagTamper habilita autenticación dinámica y resiliencia superior frente a clonación.",
      bullets: ["Challenge dinámico por tap", "Tamper signal para cierres y sellos", "Revocación por lote", "Trazabilidad anti-replay"],
    },
    authenticity: {
      eyebrow: "Estados de autenticidad",
      title: "Lectura clara para consumidor, canal y equipo de riesgo",
      description: "La UX diferencia autenticidad válida, manipulación y consumo/invalidación.",
      badges: { good: "VÁLIDO", warn: "OBSERVADO", risk: "BLOQUEADO" },
      cards: [
        { state: "Auténtico", detail: "Validación íntegra, lote activo y origen coherente.", tone: "good" },
        { state: "Tampered", detail: "Señal de manipulación detectada en sello/cierre.", tone: "warn" },
        { state: "Consumido / invalidado", detail: "Tag revocado o uso fuera de ventana permitida.", tone: "risk" },
      ],
    },
    useCases: {
      eyebrow: "Verticales",
      title: "Casos de uso con impacto directo",
      description: "Diseñado para operación internacional y control de fraude.",
      cards: [
        { title: "Wine", body: "Autenticación de botella, export compliance y experiencia premium." },
        { title: "Cosmetics", body: "Protección de marca y trazabilidad de packaging." },
        { title: "Pharma", body: "Seguimiento de producto y mitigación de falsificación." },
        { title: "Events", body: "Acceso, engagement y control operativo de credenciales." },
      ],
    },
    intelligence: {
      eyebrow: "Inteligencia global",
      title: "Mapa de escaneos y trazabilidad internacional",
      description: "Placeholder visual para distribución de escaneos, hotspots y anomalías por región.",
      bullets: ["Top mercados por volumen", "Alertas por geografía inesperada", "Análisis por batch y tenant", "Vista para operaciones reseller"],
    },
    radar: {
      eyebrow: "Global auth radar",
      title: "Visualización en vivo de escaneos y revenue SaaS",
      description: "Inspirado en la demo de inversores, adaptado para demostrar capacidad operativa real a clientes y partners.",
      liveLabel: "Network live",
      revenueLabel: "SaaS Revenue",
      mapCaption: "Escaneos autenticados en tiempo real (placeholder visual).",
      logsTitle: "Cloud identity logs",
      waitingLabel: "Esperando eventos...",
      signalTitle: "Señales de red",
      products: ["Wine premium", "Cosmetics", "Pharma", "VIP event"],
      signals: [
        { label: "Auth success rate", value: "99.3%" },
        { label: "Duplicate detection", value: "0.8%" },
        { label: "Tamper alerts", value: "12 / day" },
      ],
    },
    intelligence: {
      eyebrow: "Inteligencia global",
      title: "Mapa de escaneos y trazabilidad internacional",
      description: "Placeholder visual para distribución de escaneos, hotspots y anomalías por región.",
      bullets: ["Top mercados por volumen", "Alertas por geografía inesperada", "Análisis por batch y tenant", "Vista para operaciones reseller"],
    },
    reseller: {
      eyebrow: "Canal",
      title: "Programa reseller / white-label desde día uno",
      description: "Agencias, convertidores y distribuidores operan sobre rails compartidas.",
      cards: [
        { title: "Co-branded operations", body: "Lanzamiento rápido con gobierno central de autenticación." },
        { title: "Private-label workspace", body: "Experiencia partner con aislamiento multi-tenant." },
      ],
    },
    api: {
      eyebrow: "Developer-friendly",
      title: "API gateway listo para integraciones enterprise",
      description: "Contratos previsibles para activación, validación y observabilidad.",
      bullets: ["Gateway de autenticación de alta disponibilidad", "Flujos administrativos internos con control por rol", "Eventos y telemetría de seguridad", "Base enterprise para SDK y webhooks"],
    },
    identity: {
      eyebrow: "Capa premium",
      title: "Digital identity / tokenization layer",
      description: "Cada producto puede evolucionar de autenticación a activo digital con historial.",
      bullets: ["Ownership passport", "Warranty y lifecycle events", "Registro de procedencia", "Roadmap tokenization-ready"],
    },
    calculator: {
      eyebrow: "Calculadora",
      title: "Simulador de inversión por volumen",
      description: "Estimación rápida de hardware, SaaS y alcance de activación/analítica.",
      volumeLabel: "Volumen",
      productLabel: "Tipo de producto",
      securityLabel: "Nivel de seguridad",
      channelLabel: "Canal",
      recommendationLabel: "Plan recomendado",
      hardwareSpendLabel: "Inversión hardware",
      saasFeeLabel: "Fee SaaS",
      activationScopeLabel: "Alcance de activación",
      analyticsScopeLabel: "Alcance analítico",
      perYearLabel: "/año",
      tagsUnitLabel: "tags",
      scopeLabels: { base: "Base", extended: "Extendido", advanced: "Avanzado" },
      cta: "Solicitar cotización custom",
      options: {
        product: [
          { value: "wine", label: "Wine" },
          { value: "cosmetics", label: "Cosmetics" },
          { value: "events", label: "Events" },
          { value: "pharma", label: "Pharma" },
        ],
        security: [
          { value: "basic", label: "Basic" },
          { value: "secure", label: "Secure" },
          { value: "enterprise", label: "Enterprise" },
        ],
        channel: [
          { value: "direct", label: "Directo" },
          { value: "reseller", label: "Reseller" },
        ],
      },
    },
    roi: { eyebrow: "ROI", title: "Modelo de negocio defendible", description: "Hardware + SaaS + identidad digital para expandir margen.", metrics: [{ label: "Fraud loss reduction", value: "-30% a -70%", detail: "Depende de vertical y adopción secure." }, { label: "Scan visibility", value: "+10x", detail: "Granularidad operativa para compliance." }, { label: "Margin expansion", value: "+8% a +18%", detail: "Impulsado por secure + identidad digital." }] },
    credibility: { eyebrow: "Investor-grade", title: "Credibilidad para buyers enterprise e inversores", description: "Arquitectura, economics y distribución alineados para escalar.", items: ["Monorepo productizado: web + dashboard + API", "Operación multi-tenant desde base", "Canal white-label para expansión regional", "Narrativa clara de valor basic vs secure"] },
    cta: { title: "Listo para piloto enterprise", body: "Diseñamos el rollout para vino, cosmética, pharma, eventos o canal reseller.", primary: "Agendar demo", secondary: "Hablar con ventas" },
    docsList: ["Discovery workshop and technical scoping", "Tenant onboarding and access governance", "Batch setup and activation playbook", "Operational monitoring and fraud alerts", "Go-live support and success metrics"],
  },
  "pt-BR": {
    nav: { product: "Produto", pricing: "Planos", reseller: "Revendedores", docs: "Arquitetura", cta: "Dashboard", requestDemo: "Solicitar demo" },
    hero: { badge: "Autenticação NFC + Identidade Digital de Produto", title: "Autentique produtos. Ative inteligência. Escale confiança.", body: "Inmovar Identity Rail integra chip NFC + API de autenticação + inteligência antifraude para transformar cada produto físico em ativo digital rastreável e monetizável.", primary: "Solicitar demo enterprise", secondary: "Ver arquitetura", tertiary: "Ver pricing" },
    trustBar: ["Programas NTAG215", "NTAG 424 DNA TagTamper", "API de autenticação", "SaaS multi-tenant", "Canal white-label"],
    howItWorks: { eyebrow: "Como funciona", title: "Tag → Tap → Validação API → Inteligência", description: "Fluxo que conecta hardware e software para decisões em tempo real.", steps: [{ title: "1. Encode por lote", body: "Configure perfil, SKU, tenant e política de ativação/revogação." }, { title: "2. Tap em campo", body: "Cada leitura gera sinais de duplicidade, geografia e tamper." }, { title: "3. API Authentication", body: "Gateway central com contratos estáveis para SUN e administração." }, { title: "4. Dashboard intelligence", body: "KPIs e alertas por marca, mercado e revendedor." }] },
    what: { eyebrow: "Plataforma", title: "Infraestrutura de identidade de produto", description: "Separação clara entre valor basic e secure.", cards: [{ title: "Encoded secure tags", body: "Perfis NTAG215 e NTAG424 com governança por lote." }, { title: "Authentication gateway", body: "Validação criptográfica, deduplicação e anti-fraude." }, { title: "Traceability intelligence", body: "Estados de autenticidade e distribuição geográfica." }] },
    plans: { eyebrow: "Basic vs Secure vs Enterprise", title: "Pacotes por nível de risco", description: "De campanhas a anti-counterfeit crítico.", cards: [{ name: "BASIC", badge: "NTAG215", price: "A partir de USD 99 / mês", body: "Eventos e tracking simples.", bullets: ["Tap-to-web", "Analytics de scans", "Sem criptografia SUN"] }, { name: "SECURE", badge: "NTAG 424 DNA TT", price: "A partir de USD 200 / 10k", body: "Autenticação robusta.", bullets: ["SUN validation", "Duplicate alerts", "Tamper intelligence"] }, { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Operação avançada com SLA.", bullets: ["Branding white-label", "API keys + webhooks", "Camada premium"] }] },
    secure: { eyebrow: "Por que 424 TagTamper", title: "Camada secure para vinho, cosméticos e pharma", description: "NTAG 424 DNA TagTamper habilita autenticação dinâmica e melhor resiliência anti-clone.", bullets: ["Challenge dinâmico por tap", "Tamper signal para selos", "Revogação por lote", "Rastreabilidade anti-replay"] },
    authenticity: { eyebrow: "Estados", title: "Sinalização de autenticidade", description: "Leitura clara para consumidor e operações.", badges: { good: "VÁLIDO", warn: "SINALIZADO", risk: "BLOQUEADO" }, cards: [{ state: "Autêntico", detail: "Lote ativo e validação íntegra.", tone: "good" }, { state: "Tampered", detail: "Manipulação detectada em selo/tampa.", tone: "warn" }, { state: "Consumido / invalidado", detail: "Tag revogada ou uso inválido.", tone: "risk" }] },
    useCases: { eyebrow: "Casos de uso", title: "Wine, cosmetics, pharma e events", description: "Setores onde confiança e compliance importam.", cards: [{ title: "Wine", body: "Autenticação de garrafa e export compliance." }, { title: "Cosmetics", body: "Proteção de marca e embalagem inteligente." }, { title: "Pharma", body: "Rastreabilidade e mitigação de falsificação." }, { title: "Events", body: "Credenciais seguras e analytics." }] },
    intelligence: { eyebrow: "Inteligência global", title: "Mapa mundial de escaneos", description: "Placeholder para hotspots e anomalias por região.", bullets: ["Top mercados", "Alertas por geografia", "Análise por batch/tenant", "Visão revendedor"] },
    radar: {
      eyebrow: "Global auth radar",
      title: "Visualização ao vivo de escaneos e receita SaaS",
      description: "Inspirado no demo para investidores, adaptado para demonstrar capacidade operacional real para clientes e parceiros.",
      liveLabel: "Network live",
      revenueLabel: "SaaS Revenue",
      mapCaption: "Escaneos autenticados em tempo real (placeholder visual).",
      logsTitle: "Cloud identity logs",
      waitingLabel: "Aguardando eventos...",
      signalTitle: "Sinais da rede",
      products: ["Wine premium", "Cosmetics", "Pharma", "VIP event"],
      signals: [
        { label: "Auth success rate", value: "99.3%" },
        { label: "Duplicate detection", value: "0.8%" },
        { label: "Tamper alerts", value: "12 / day" },
      ],
    },
    reseller: { eyebrow: "Canal", title: "Modelo revendedor / white-label", description: "Parceiros operam sobre infraestrutura central.", cards: [{ title: "Co-branded operations", body: "Go-to-market rápido com controle central." }, { title: "Private-label workspace", body: "Experiência de parceiro com isolamento." }] },
    api: { eyebrow: "Developer-friendly", title: "API gateway para integração", description: "Contratos previsíveis para ativação e autenticação.", bullets: ["Gateway de autenticação de alta disponibilidade", "Fluxos administrativos internos com controle por papel", "Eventos e telemetria de segurança", "Base enterprise para SDK/webhooks"] },
    identity: { eyebrow: "Camada premium", title: "Digital identity / tokenization layer", description: "Produto físico evolui para identidade digital persistente.", bullets: ["Ownership passport", "Warranty events", "Registro de proveniência", "Roadmap tokenization-ready"] },
    calculator: { eyebrow: "Calculadora", title: "Simulador de investimento", description: "Estimativa de hardware, SaaS e escopo de ativação.", volumeLabel: "Volume", productLabel: "Tipo de produto", securityLabel: "Nível de segurança", channelLabel: "Canal", recommendationLabel: "Plano recomendado", hardwareSpendLabel: "Investimento hardware", saasFeeLabel: "Taxa SaaS", activationScopeLabel: "Escopo de ativação", analyticsScopeLabel: "Escopo analítico", perYearLabel: "/ano", tagsUnitLabel: "tags", scopeLabels: { base: "Base", extended: "Estendido", advanced: "Avançado" }, cta: "Solicitar proposta custom", options: { product: [{ value: "wine", label: "Wine" }, { value: "cosmetics", label: "Cosmetics" }, { value: "events", label: "Events" }, { value: "pharma", label: "Pharma" }], security: [{ value: "basic", label: "Basic" }, { value: "secure", label: "Secure" }, { value: "enterprise", label: "Enterprise" }], channel: [{ value: "direct", label: "Direto" }, { value: "reseller", label: "Revendedor" }] } },
    roi: { eyebrow: "ROI", title: "Economia clara para conselho e vendas", description: "Hardware + SaaS + identidade premium.", metrics: [{ label: "Fraud loss reduction", value: "-30% a -70%", detail: "Conforme vertical e adoção secure." }, { label: "Scan visibility", value: "+10x", detail: "Mais granularidade operacional." }, { label: "Margin expansion", value: "+8% a +18%", detail: "Mix secure + identidade." }] },
    credibility: { eyebrow: "Investor-grade", title: "Credibilidade enterprise", description: "Arquitetura e canal alinhados para escalar.", items: ["Monorepo com web + dashboard + API", "Modelo multi-tenant", "Canal white-label regional", "Valor claro entre basic e secure"] },
    cta: { title: "Pronto para piloto enterprise", body: "Co-desenhamos o rollout para setores críticos.", primary: "Agendar demo", secondary: "Falar com vendas" },
    docsList: ["Discovery workshop and technical scoping", "Tenant onboarding and access governance", "Batch setup and activation playbook", "Operational monitoring and fraud alerts", "Go-live support and success metrics"],
  },
  en: {
    nav: { product: "Product", pricing: "Pricing", reseller: "Resellers", docs: "Docs", cta: "Dashboard", requestDemo: "Request demo" },
    hero: { badge: "NFC Authentication + Digital Product Identity", title: "Authenticate products. Activate intelligence. Scale trust.", body: "Inmovar Identity Rail combines NFC chips, authentication APIs and anti-fraud intelligence to turn each physical product into a traceable, monetizable digital asset.", primary: "Request enterprise demo", secondary: "View architecture", tertiary: "View pricing" },
    trustBar: ["NTAG215 programs", "NTAG 424 DNA TagTamper", "Authentication API", "Multi-tenant SaaS", "White-label distribution"],
    howItWorks: { eyebrow: "How the rail works", title: "Tag → Tap → API Validation → Dashboard Intelligence", description: "A hardware + software loop built for risk-aware operations.", steps: [{ title: "1. Batch encoding", body: "Configure basic/secure profile, SKU, tenant and activation rules." }, { title: "2. Field tap", body: "Each tap runs duplicate, geo and tamper-adjacent checks." }, { title: "3. Authentication gateway", body: "Stable contracts for SUN validation and admin operations." }, { title: "4. Business intelligence", body: "KPIs and alerts per brand, market and reseller partner." }] },
    what: { eyebrow: "Platform value", title: "Beyond NFC tags: product identity infrastructure", description: "Clear separation between basic and secure value layers.", cards: [{ title: "Encoded secure tags", body: "NTAG215 and NTAG424 profiles with batch-level governance." }, { title: "Authentication gateway", body: "Cryptographic validation, deduplication and anti-fraud controls." }, { title: "Traceability intelligence", body: "Authenticity states and geo-distributed scan visibility." }] },
    plans: { eyebrow: "Basic vs Secure vs Enterprise", title: "Commercial packaging by risk profile", description: "From campaign activations to anti-counterfeit programs.", cards: [{ name: "BASIC", badge: "NTAG215", price: "From USD 99 / month", body: "Events, marketing and simple tracking.", bullets: ["Tap-to-web", "Scan analytics", "No SUN crypto"] }, { name: "SECURE", badge: "NTAG 424 DNA TT", price: "From USD 200 / 10k", body: "High-confidence authentication.", bullets: ["SUN validation", "Duplicate alerts", "Tamper intelligence"] }, { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Multi-tenant partner model with SLA.", bullets: ["White-label branding", "API keys + webhooks", "Premium identity layer"] }] },
    secure: { eyebrow: "Why 424 TagTamper", title: "Secure profile for wine, cosmetics and pharma", description: "NTAG 424 DNA TagTamper supports dynamic authentication and stronger anti-clone resilience.", bullets: ["Dynamic challenge per tap", "Tamper signal for seals", "Batch-level revocation", "Replay-risk traceability"] },
    authenticity: { eyebrow: "Authenticity states", title: "Clear outcomes for consumers and ops teams", description: "Status UX mirrors real product security flows.", badges: { good: "VALID", warn: "FLAGGED", risk: "BLOCKED" }, cards: [{ state: "Authentic", detail: "Integrity check passed, active batch and valid origin.", tone: "good" }, { state: "Tampered", detail: "Seal/closure manipulation signal detected.", tone: "warn" }, { state: "Consumed / invalidated", detail: "Tag revoked or outside allowed consumption window.", tone: "risk" }] },
    useCases: { eyebrow: "Use cases", title: "Wine, cosmetics, pharma and events", description: "Built for sectors where trust impacts margin and compliance.", cards: [{ title: "Wine", body: "Bottle authentication and export traceability." }, { title: "Cosmetics", body: "Brand protection and smart packaging." }, { title: "Pharma", body: "Product intelligence and anti-counterfeit workflows." }, { title: "Events", body: "Secure credentials and attendance analytics." }] },
    intelligence: { eyebrow: "Global intelligence", title: "World scan map and traceability hotspots", description: "Visual placeholder for geography-driven risk monitoring.", bullets: ["Top scan markets", "Unexpected geography alerts", "Batch and tenant overlays", "Reseller performance view"] },
    radar: {
      eyebrow: "Global auth radar",
      title: "Live visualization of scans and SaaS revenue",
      description: "Inspired by the investor demo and adapted to showcase real operational capability to buyers and partners.",
      liveLabel: "Network live",
      revenueLabel: "SaaS Revenue",
      mapCaption: "Authenticated scans in real time (visual placeholder).",
      logsTitle: "Cloud identity logs",
      waitingLabel: "Waiting for events...",
      signalTitle: "Network signals",
      products: ["Wine premium", "Cosmetics", "Pharma", "VIP event"],
      signals: [
        { label: "Auth success rate", value: "99.3%" },
        { label: "Duplicate detection", value: "0.8%" },
        { label: "Tamper alerts", value: "12 / day" },
      ],
    },
    reseller: { eyebrow: "Distribution", title: "Reseller / white-label operating model", description: "Agencies and converters can run downstream portfolios.", cards: [{ title: "Co-branded operations", body: "Fast launch with centralized governance." }, { title: "Private-label workspace", body: "Partner-branded tenant isolation." }] },
    api: { eyebrow: "Developer-friendly", title: "API gateway designed for enterprise integration", description: "Predictable contracts for activation, validation and observability.", bullets: ["High-availability authentication gateway", "Internal admin flows with role governance", "Security event stream", "Enterprise SDK/webhook-ready foundation"] },
    identity: { eyebrow: "Premium layer", title: "Digital identity / tokenization layer", description: "Each physical product can become a persistent digital identity asset.", bullets: ["Ownership passport", "Warranty lifecycle", "Provenance records", "Tokenization-ready roadmap"] },
    calculator: { eyebrow: "Calculator", title: "Interactive cost simulator", description: "Quick estimate for hardware spend, SaaS fee and activation scope.", volumeLabel: "Volume", productLabel: "Product type", securityLabel: "Security level", channelLabel: "Channel", recommendationLabel: "Recommended plan", hardwareSpendLabel: "Hardware spend", saasFeeLabel: "SaaS fee", activationScopeLabel: "Activation scope", analyticsScopeLabel: "Analytics scope", perYearLabel: "/year", tagsUnitLabel: "tags", scopeLabels: { base: "Base", extended: "Extended", advanced: "Advanced" }, cta: "Request custom quote", options: { product: [{ value: "wine", label: "Wine" }, { value: "cosmetics", label: "Cosmetics" }, { value: "events", label: "Events" }, { value: "pharma", label: "Pharma" }], security: [{ value: "basic", label: "Basic" }, { value: "secure", label: "Secure" }, { value: "enterprise", label: "Enterprise" }], channel: [{ value: "direct", label: "Direct" }, { value: "reseller", label: "Reseller" }] } },
    roi: { eyebrow: "ROI", title: "Economics for boards and operators", description: "Hardware + SaaS + premium identity supports margin growth.", metrics: [{ label: "Fraud loss reduction", value: "-30% to -70%", detail: "Depends on vertical and secure adoption." }, { label: "Scan visibility", value: "+10x", detail: "Higher granularity across operations." }, { label: "Margin expansion", value: "+8% to +18%", detail: "Driven by secure + identity mix." }] },
    credibility: { eyebrow: "Investor-grade", title: "Built to pitch enterprise buyers and investors now", description: "Architecture and channel strategy aligned from day one.", items: ["Productized monorepo: web + dashboard + API", "Scalable multi-tenant architecture", "Regional white-label distribution engine", "Clear basic vs secure value proposition"] },
    cta: { title: "Ready for an enterprise pilot", body: "Co-design rollout for wine, cosmetics, pharma, events or reseller channels.", primary: "Book a demo", secondary: "Talk to sales" },
    docsList: ["Discovery workshop and technical scoping", "Tenant onboarding and access governance", "Batch setup and activation playbook", "Operational monitoring and fraud alerts", "Go-live support and success metrics"],
  },
};
