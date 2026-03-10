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
      title: "De producto físico a activo verificable.",
      body: "Unimos Verify + Passport + Rights: autenticás, trazás y activás derechos digitales sobre cada unidad con NFC básico y criptográfico.",
      primary: "Pedir muestras",
      secondary: "Ver demo",
      tertiary: "Quiero ser reseller",
    },
    trustBar: ["Programas NTAG215", "NTAG 424 DNA TagTamper", "API de autenticación", "SaaS multi-tenant", "Canal white-label"],
    howItWorks: {
      eyebrow: "Cómo funciona la rail",
      title: "Pegás, validás y vendés mejor",
      description: "Cada toque trae una respuesta simple: es real, dónde está y qué hacer ahora.",
      steps: [
        { title: "1. Cargás tus productos", body: "Subís lote, cantidad y tipo de chip." },
        { title: "2. El cliente toca el chip", body: "La app muestra si el producto es auténtico en segundos." },
        { title: "3. Se guarda la prueba", body: "Queda registro del lugar, hora y estado." },
        { title: "4. Tomás acción", body: "Activás campañas, alertas y ventas por zona." },
      ],
    },
    what: {
      eyebrow: "Qué hace la plataforma",
      title: "No vendemos chips sueltos: vendemos un SaaS que te hace vender más",
      description: "Una sola plataforma para trazabilidad, ownership/warranty/provenance y ventas con NFC.",
      cards: [
        { title: "SaaS de chips NFC", body: "Gestionás NTAG215 y NTAG424 en un mismo panel." },
        { title: "SaaS de trazabilidad", body: "Ves cada toque con contexto real de negocio." },
        { title: "Ownership / warranty / provenance", body: "Convertís cada producto en un registro verificable de ownership, garantía y procedencia." },
      ],
    },
    plans: {
      eyebrow: "Basic vs Secure vs Enterprise",
      title: "Packaging comercial por nivel de riesgo",
      description: "Desde campañas de marketing hasta anti-counterfeit de exportación.",
      cards: [
        { name: "BASIC", badge: "NTAG215", price: "Cotización por volumen", body: "Eventos, accesos y tracking simple.", bullets: ["Tap-to-web", "Analítica de escaneos", "Sin criptografía SUN"] },
        { name: "SECURE", badge: "NTAG 424 DNA TT", price: "Piloto + hardware codificado + SaaS", body: "Autenticación robusta para riesgo real.", bullets: ["SUN validation", "Duplicate alerts", "Tamper intelligence"] },
        { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Operación multi-tenant con SLA y canal.", bullets: ["Branding white-label", "API keys y webhooks", "Identidad digital premium"] },
      ],
    },
    secure: {
      eyebrow: "Por qué 424 TagTamper",
      title: "Capa secure para vino, cosmética y documentos",
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
        { title: "Wine / Mendoza", body: "Autenticación en botella real (vidrio curvo, humedad y logística de bodega) con foco en anti-falsificación y ROI exportador." },
        { title: "Cosmetics", body: "Protección de marca y trazabilidad de packaging." },
        { title: "Docs & Presence", body: "Certificados, credenciales contractor y evidencia de presencia física." },
        { title: "Events", body: "Acceso, engagement y control operativo de credenciales." },
      ],
    },
    radar: {
      eyebrow: "Auth radar (Demo Lab)",
      title: "Visualización operativa de eventos de verificación",
      description: "Usar como demo guiada. No representa métricas de producción ni tracción auditada.",
      liveLabel: "Demo stream",
      revenueLabel: "SaaS Revenue",
      mapCaption: "Eventos simulados de autenticación y tamper para validación comercial/técnica.",
      logsTitle: "Cloud identity logs",
      waitingLabel: "Esperando eventos...",
      signalTitle: "Señales de red",
      products: ["Wine Secure", "Cosmetics Secure", "Docs & Presence", "Events Secure"],
      signals: [
        { label: "Auth success rate", value: "99.3%" },
        { label: "Duplicate detection", value: "0.8%" },
        { label: "Tamper alerts", value: "12 / day" },
      ],
    },
    intelligence: {
      eyebrow: "Inteligencia global",
      title: "Mapa de escaneos y trazabilidad internacional",
      description: "Vista operativa para simulaciones comerciales y técnicas (Demo Lab).",
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
      title: "Digital identity layer",
      description: "Cada producto puede evolucionar de autenticación a activo digital con historial.",
      bullets: ["Ownership passport", "Warranty y lifecycle events", "Registro de procedencia", "Roadmap ready for ownership/warranty/provenance"],
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
    cta: { title: "Listo para piloto enterprise", body: "Diseñamos el rollout para vino, cosmética, docs/presence, eventos o canal reseller.", primary: "Agendar demo", secondary: "Hablar con ventas" },
    docsList: ["Discovery workshop and technical scoping", "Tenant onboarding and access governance", "Batch setup and activation playbook", "Operational monitoring and fraud alerts", "Go-live support and success metrics"],
  },
  "pt-BR": {
    nav: { product: "Produto", pricing: "Planos", reseller: "Revendedores", docs: "Arquitetura", cta: "Dashboard", requestDemo: "Solicitar demo" },
    hero: { badge: "Autenticação NFC + Identidade Digital de Produto", title: "Identidade digital inviolável para produtos físicos.", body: "Autenticidade, rastreabilidade e experiências Tap-to-Verify com NFC básico (NTAG215) e NFC criptográfico (NTAG 424 DNA TagTamper).", primary: "Solicitar amostras", secondary: "Ver demo", tertiary: "Quero ser revendedor" },
    trustBar: ["Programas NTAG215", "NTAG 424 DNA TagTamper", "API de autenticação", "SaaS multi-tenant", "Canal white-label"],
    howItWorks: { eyebrow: "Como funciona", title: "Encosta, valida e vende melhor", description: "Explicação simples: cada tap vira prova, alerta e oportunidade comercial.", steps: [{ title: "1. Você ativa o lote", body: "Escolhe chip, quantidade e campanha em poucos cliques." }, { title: "2. O cliente encosta o celular", body: "A tela mostra rápido se o produto é autêntico." }, { title: "3. O sistema registra tudo", body: "Fica salvo local, horário e resultado da leitura." }, { title: "4. Você vende com dados", body: "Dispara ação de marketing, suporte ou revenda." }] },
    what: { eyebrow: "Plataforma", title: "Não vendemos chip solto: vendemos SaaS que gera confiança e venda", description: "Uma operação única para chips, rastreio e identidade digital do produto.", cards: [{ title: "SaaS para chips NFC", body: "Gerencia NTAG215 e NTAG424 no mesmo painel." }, { title: "SaaS de rastreabilidade", body: "Mostra cada leitura com contexto real de negócio." }, { title: "Ownership / warranty / provenance", body: "Transforma cada produto em registro verificável de ownership, garantia e procedência." }] },
    plans: { eyebrow: "Basic vs Secure vs Enterprise", title: "Pacotes por nível de risco", description: "De campanhas a anti-counterfeit crítico.", cards: [{ name: "BASIC", badge: "NTAG215", price: "Cotação por volume", body: "Eventos e tracking simples.", bullets: ["Tap-to-web", "Analytics de scans", "Sem criptografia SUN"] }, { name: "SECURE", badge: "NTAG 424 DNA TT", price: "Piloto + hardware codificado + SaaS", body: "Autenticação robusta.", bullets: ["SUN validation", "Duplicate alerts", "Tamper intelligence"] }, { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Operação avançada com SLA.", bullets: ["Branding white-label", "API keys + webhooks", "Camada premium"] }] },
    secure: { eyebrow: "Por que 424 TagTamper", title: "Camada secure para vinho, cosméticos e documentos", description: "NTAG 424 DNA TagTamper habilita autenticação dinâmica e melhor resiliência anti-clone.", bullets: ["Challenge dinâmico por tap", "Tamper signal para selos", "Revogação por lote", "Rastreabilidade anti-replay"] },
    authenticity: { eyebrow: "Estados", title: "Sinalização de autenticidade", description: "Leitura clara para consumidor e operações.", badges: { good: "VÁLIDO", warn: "SINALIZADO", risk: "BLOQUEADO" }, cards: [{ state: "Autêntico", detail: "Lote ativo e validação íntegra.", tone: "good" }, { state: "Tampered", detail: "Manipulação detectada em selo/tampa.", tone: "warn" }, { state: "Consumido / invalidado", detail: "Tag revogada ou uso inválido.", tone: "risk" }] },
    useCases: { eyebrow: "Casos de uso", title: "Wine, cosmetics, docs e events", description: "Setores onde confiança e compliance importam.", cards: [{ title: "Wine", body: "Autenticação de garrafa e export compliance." }, { title: "Cosmetics", body: "Proteção de marca e embalagem inteligente." }, { title: "Docs & Presence", body: "Certificados, credenciais contractor e evidência de presença física." }, { title: "Events", body: "Credenciais seguras e analytics." }] },
    intelligence: { eyebrow: "Inteligência global", title: "Mapa mundial de escaneos", description: "Placeholder para hotspots e anomalias por região.", bullets: ["Top mercados", "Alertas por geografia", "Análise por batch/tenant", "Visão revendedor"] },
    radar: {
      eyebrow: "Auth radar (Demo Lab)",
      title: "Visualização operacional de eventos de verificação",
      description: "Use como demo guiada. Não representa métricas de produção nem tração auditada.",
      liveLabel: "Demo stream",
      revenueLabel: "SaaS Revenue",
      mapCaption: "Eventos simulados de autenticação e tamper para validação comercial/técnica.",
      logsTitle: "Cloud identity logs",
      waitingLabel: "Aguardando eventos...",
      signalTitle: "Sinais da rede",
      products: ["Wine Secure", "Cosmetics Secure", "Docs & Presence", "Events Secure"],
      signals: [
        { label: "Auth success rate", value: "99.3%" },
        { label: "Duplicate detection", value: "0.8%" },
        { label: "Tamper alerts", value: "12 / day" },
      ],
    },
    reseller: { eyebrow: "Canal", title: "Modelo revendedor / white-label", description: "Parceiros operam sobre infraestrutura central.", cards: [{ title: "Co-branded operations", body: "Go-to-market rápido com controle central." }, { title: "Private-label workspace", body: "Experiência de parceiro com isolamento." }] },
    api: { eyebrow: "Developer-friendly", title: "API gateway para integração", description: "Contratos previsíveis para ativação e autenticação.", bullets: ["Gateway de autenticação de alta disponibilidade", "Fluxos administrativos internos com controle por papel", "Eventos e telemetria de segurança", "Base enterprise para SDK/webhooks"] },
    identity: { eyebrow: "Camada premium", title: "Digital identity layer", description: "Produto físico evolui para identidade digital persistente.", bullets: ["Ownership passport", "Warranty events", "Registro de proveniência", "Roadmap ready for ownership/warranty/provenance"] },
    calculator: { eyebrow: "Calculadora", title: "Simulador de investimento", description: "Estimativa de hardware, SaaS e escopo de ativação.", volumeLabel: "Volume", productLabel: "Tipo de produto", securityLabel: "Nível de segurança", channelLabel: "Canal", recommendationLabel: "Plano recomendado", hardwareSpendLabel: "Investimento hardware", saasFeeLabel: "Taxa SaaS", activationScopeLabel: "Escopo de ativação", analyticsScopeLabel: "Escopo analítico", perYearLabel: "/ano", tagsUnitLabel: "tags", scopeLabels: { base: "Base", extended: "Estendido", advanced: "Avançado" }, cta: "Solicitar proposta custom", options: { product: [{ value: "wine", label: "Wine" }, { value: "cosmetics", label: "Cosmetics" }, { value: "events", label: "Events" }, { value: "pharma", label: "Pharma" }], security: [{ value: "basic", label: "Basic" }, { value: "secure", label: "Secure" }, { value: "enterprise", label: "Enterprise" }], channel: [{ value: "direct", label: "Direto" }, { value: "reseller", label: "Revendedor" }] } },
    roi: { eyebrow: "ROI", title: "Economia clara para conselho e vendas", description: "Hardware + SaaS + identidade premium.", metrics: [{ label: "Fraud loss reduction", value: "-30% a -70%", detail: "Conforme vertical e adoção secure." }, { label: "Scan visibility", value: "+10x", detail: "Mais granularidade operacional." }, { label: "Margin expansion", value: "+8% a +18%", detail: "Mix secure + identidade." }] },
    credibility: { eyebrow: "Investor-grade", title: "Credibilidade enterprise", description: "Arquitetura e canal alinhados para escalar.", items: ["Monorepo com web + dashboard + API", "Modelo multi-tenant", "Canal white-label regional", "Valor claro entre basic e secure"] },
    cta: { title: "Pronto para piloto enterprise", body: "Co-desenhamos o rollout para setores críticos.", primary: "Agendar demo", secondary: "Falar com vendas" },
    docsList: ["Discovery workshop and technical scoping", "Tenant onboarding and access governance", "Batch setup and activation playbook", "Operational monitoring and fraud alerts", "Go-live support and success metrics"],
  },
  en: {
    nav: { product: "Product", pricing: "Pricing", reseller: "Resellers", docs: "Docs", cta: "Dashboard", requestDemo: "Request demo" },
    hero: { badge: "NFC Authentication + Digital Product Identity", title: "Unforgeable digital identity for physical products.", body: "Authenticity, traceability, and tap-to-verify experiences with basic NFC (NTAG215) and cryptographic NFC (NTAG 424 DNA TagTamper).", primary: "Request samples", secondary: "View demo", tertiary: "Become a reseller" },
    trustBar: ["NTAG215 programs", "NTAG 424 DNA TagTamper", "Authentication API", "Multi-tenant SaaS", "White-label distribution"],
    howItWorks: { eyebrow: "How it works", title: "Tap, verify, and sell better", description: "Simple flow: each tap becomes proof, insight, and a sales action.", steps: [{ title: "1. Activate your batch", body: "Pick chip type, quantity, and campaign in minutes." }, { title: "2. Customer taps", body: "The phone shows authenticity instantly." }, { title: "3. Data is saved", body: "You keep place, time, and scan result." }, { title: "4. Teams take action", body: "Launch marketing, support, or reseller actions fast." }] },
    what: { eyebrow: "Platform value", title: "We do more than tags: we deliver SaaS that helps you sell", description: "One platform for NFC chips, traceability, and ownership/warranty/provenance identity.", cards: [{ title: "SaaS for NFC chips", body: "Manage NTAG215 and NTAG424 in one place." }, { title: "Traceability SaaS", body: "See every scan with business context." }, { title: "Ownership / warranty / provenance", body: "Turn each physical product into a verifiable ownership, warranty and provenance record." }] },
    plans: { eyebrow: "Basic vs Secure vs Enterprise", title: "Commercial packaging by risk profile", description: "From campaign activations to anti-counterfeit programs.", cards: [{ name: "BASIC", badge: "NTAG215", price: "Quote by volume", body: "Events, marketing and simple tracking.", bullets: ["Tap-to-web", "Scan analytics", "No SUN crypto"] }, { name: "SECURE", badge: "NTAG 424 DNA TT", price: "Pilot scope + encoded hardware + SaaS", body: "High-confidence authentication.", bullets: ["SUN validation", "Duplicate alerts", "Tamper intelligence"] }, { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Multi-tenant partner model with SLA.", bullets: ["White-label branding", "API keys + webhooks", "Premium identity layer"] }] },
    secure: { eyebrow: "Why 424 TagTamper", title: "Secure profile for wine, cosmetics and documents", description: "NTAG 424 DNA TagTamper supports dynamic authentication and stronger anti-clone resilience.", bullets: ["Dynamic challenge per tap", "Tamper signal for seals", "Batch-level revocation", "Replay-risk traceability"] },
    authenticity: { eyebrow: "Authenticity states", title: "Clear outcomes for consumers and ops teams", description: "Status UX mirrors real product security flows.", badges: { good: "VALID", warn: "FLAGGED", risk: "BLOCKED" }, cards: [{ state: "Authentic", detail: "Integrity check passed, active batch and valid origin.", tone: "good" }, { state: "Tampered", detail: "Seal/closure manipulation signal detected.", tone: "warn" }, { state: "Consumed / invalidated", detail: "Tag revoked or outside allowed consumption window.", tone: "risk" }] },
    useCases: { eyebrow: "Use cases", title: "Wine, cosmetics, docs and events", description: "Built for sectors where trust impacts margin and compliance.", cards: [{ title: "Wine", body: "Bottle authentication and export traceability." }, { title: "Cosmetics", body: "Brand protection and smart packaging." }, { title: "Docs & Presence", body: "Certificates, contractor credentials and proof-of-presence logs." }, { title: "Events", body: "Secure credentials and attendance analytics." }] },
    intelligence: { eyebrow: "Global intelligence", title: "World scan map and traceability hotspots", description: "Operational view for commercial and technical simulations (Demo Lab).", bullets: ["Top scan markets", "Unexpected geography alerts", "Batch and tenant overlays", "Reseller performance view"] },
    radar: {
      eyebrow: "Auth radar (Demo Lab)",
      title: "Operational visualization of verification events",
      description: "Use as a guided demo. It does not represent production metrics or audited traction.",
      liveLabel: "Demo stream",
      revenueLabel: "SaaS Revenue",
      mapCaption: "Simulated authentication and tamper events for commercial/technical validation.",
      logsTitle: "Cloud identity logs",
      waitingLabel: "Waiting for events...",
      signalTitle: "Network signals",
      products: ["Wine Secure", "Cosmetics Secure", "Docs & Presence", "Events Secure"],
      signals: [
        { label: "Auth success rate", value: "99.3%" },
        { label: "Duplicate detection", value: "0.8%" },
        { label: "Tamper alerts", value: "12 / day" },
      ],
    },
    reseller: { eyebrow: "Distribution", title: "Reseller / white-label operating model", description: "Agencies and converters can run downstream portfolios.", cards: [{ title: "Co-branded operations", body: "Fast launch with centralized governance." }, { title: "Private-label workspace", body: "Partner-branded tenant isolation." }] },
    api: { eyebrow: "Developer-friendly", title: "API gateway designed for enterprise integration", description: "Predictable contracts for activation, validation and observability.", bullets: ["High-availability authentication gateway", "Internal admin flows with role governance", "Security event stream", "Enterprise SDK/webhook-ready foundation"] },
    identity: { eyebrow: "Premium layer", title: "Digital identity layer", description: "Each physical product can become a persistent digital identity asset.", bullets: ["Ownership passport", "Warranty lifecycle", "Provenance records", "Roadmap ready for ownership/warranty/provenance"] },
    calculator: { eyebrow: "Calculator", title: "Interactive cost simulator", description: "Quick estimate for hardware spend, SaaS fee and activation scope.", volumeLabel: "Volume", productLabel: "Product type", securityLabel: "Security level", channelLabel: "Channel", recommendationLabel: "Recommended plan", hardwareSpendLabel: "Hardware spend", saasFeeLabel: "SaaS fee", activationScopeLabel: "Activation scope", analyticsScopeLabel: "Analytics scope", perYearLabel: "/year", tagsUnitLabel: "tags", scopeLabels: { base: "Base", extended: "Extended", advanced: "Advanced" }, cta: "Request custom quote", options: { product: [{ value: "wine", label: "Wine" }, { value: "cosmetics", label: "Cosmetics" }, { value: "events", label: "Events" }, { value: "pharma", label: "Pharma" }], security: [{ value: "basic", label: "Basic" }, { value: "secure", label: "Secure" }, { value: "enterprise", label: "Enterprise" }], channel: [{ value: "direct", label: "Direct" }, { value: "reseller", label: "Reseller" }] } },
    roi: { eyebrow: "ROI", title: "Economics for boards and operators", description: "Hardware + SaaS + premium identity supports margin growth.", metrics: [{ label: "Fraud loss reduction", value: "-30% to -70%", detail: "Depends on vertical and secure adoption." }, { label: "Scan visibility", value: "+10x", detail: "Higher granularity across operations." }, { label: "Margin expansion", value: "+8% to +18%", detail: "Driven by secure + identity mix." }] },
    credibility: { eyebrow: "Investor-grade", title: "Built to pitch enterprise buyers and investors now", description: "Architecture and channel strategy aligned from day one.", items: ["Productized monorepo: web + dashboard + API", "Scalable multi-tenant architecture", "Regional white-label distribution engine", "Clear basic vs secure value proposition"] },
    cta: { title: "Ready for an enterprise pilot", body: "Co-design rollout for wine, cosmetics, docs/presence, events or reseller channels.", primary: "Book a demo", secondary: "Talk to sales" },
    docsList: ["Discovery workshop and technical scoping", "Tenant onboarding and access governance", "Batch setup and activation playbook", "Operational monitoring and fraud alerts", "Go-live support and success metrics"],
  },
};
