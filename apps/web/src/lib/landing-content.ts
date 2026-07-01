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
    nav: { product: "Producto", pricing: "Planes", reseller: "Canal", docs: "Arquitectura", cta: "Ingresar", requestDemo: "Solicitar demo" },
    hero: {
      badge: "Protección y crecimiento corporativo",
      title: "Transformá cada producto en un canal directo de protección, lealtad y nuevas ventas.",
      body: "Elevá el prestigio de tu marca. Con un simple toque, tus clientes verifican autenticidad, conocen el origen exacto y acceden a una experiencia exclusiva que asegura recompras sin intermediarios.",
      primary: "Agendar demo",
      secondary: "Ver Demo Lab",
      tertiary: "Quiero ser reseller",
    },
    trustBar: ["Evidencia de autenticidad", "Origen y lote", "Garantía digital", "Club y beneficios", "Marketplace white-label"],
    howItWorks: {
      eyebrow: "Como funciona",
      title: "Del producto físico al vínculo directo con el cliente",
      description: "Cada toque responde tres preguntas simples: qué evidencia hay, de dónde viene y qué puede hacer ahora el comprador.",
      steps: [
        { title: "1. Cargas lote y fotos reales", body: "Producto, etiqueta, origen, reglas de claim y beneficios quedan listos antes de salir a góndola." },
        { title: "2. El cliente toca el producto", body: "La pantalla muestra una respuesta clara: válido, observado o bloqueado, con origen visible y próxima acción." },
        { title: "3. Se crea evidencia comercial", body: "Quedan registrados tap, ciudad aproximada, estado del sello, canal y riesgo." },
        { title: "4. La marca activa postventa", body: "Garantía, club, puntos, experiencias verificadas, marketplace o NFT según estrategia y política de aprobación." },
      ],
    },
    what: {
      eyebrow: "Que hace nexID",
      title: "Autenticidad, trazabilidad y relación postventa desde un solo toque",
      description: "La marca protege cada unidad y el consumidor recibe una experiencia simple, confiable y accionable.",
      cards: [
        { title: "Producto verificable", body: "El usuario entiende en segundos si la unidad pasa las reglas configuradas, si el sello está correcto y si hay riesgo." },
        { title: "Historia visible", body: "Origen, lote, canal, taps y eventos se convierten en una historia fácil de leer." },
        { title: "Cliente conectado", body: "Garantía, club, beneficios, experiencias verificadas, reventa y NFT opcional quedan dentro del portal." },
      ],
    },
    plans: {
      eyebrow: "Planes según objetivo",
      title: "Empezá con un piloto claro y escalá cuando el negocio lo pruebe",
      description: "No se trata de comprar chips. Se trata de elegir cuánto querés proteger, medir y activar después de cada venta.",
      cards: [
        { name: "BASIC", badge: "QR / NTAG215", price: "Cotización por volumen", body: "Para campañas, eventos, garantías simples y medición de escaneos.", bullets: ["Tap-to-web", "Datos por ciudad y canal", "Ideal para alto volumen"] },
        { name: "SECURE", badge: "NTAG 424 DNA TT", price: "Piloto + hardware codificado + SaaS", body: "Para marcas que necesitan autenticar, evitar copia y controlar apertura o uso.", bullets: ["Validación dinámica", "Alertas por copia", "Sello físico y trazabilidad"] },
        { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Para operar varias marcas, países, integraciones, marketplace y datos propios.", bullets: ["Marca propia", "API y webhooks", "Portal, dashboard y soporte"] },
      ],
    },
    secure: {
      eyebrow: "Cuando hay riesgo alto",
      title: "Capa secure para vino, cosmética, lujo, eventos y documentos",
      description: "NTAG 424 DNA TagTamper aporta evidencia de presencia física y señal de apertura para casos donde el sello importa.",
      bullets: ["Validación dinámica por tap", "Señal de apertura para cierres y sellos", "Revocación por lote", "Trazabilidad anti-replay"],
    },
    authenticity: {
      eyebrow: "Estados de autenticidad",
      title: "Lectura clara para consumidor, canal y equipo de riesgo",
      description: "La UX evita tecnicismos: muestra si la lectura es válida, si hay riesgo y cuál es el próximo paso.",
      badges: { good: "VÁLIDO", warn: "OBSERVADO", risk: "BLOQUEADO" },
      cards: [
        { state: "Válido", detail: "Lote activo, tap válido y origen coherente.", tone: "good" },
        { state: "Sello abierto", detail: "La apertura queda registrada para garantía, postventa o reclamo.", tone: "warn" },
        { state: "Bloqueado", detail: "Replay, copia o uso fuera de regla; el sistema protege marca y comprador.", tone: "risk" },
      ],
    },
    useCases: {
      eyebrow: "Verticales",
      title: "Rubros donde la confianza cambia la venta",
      description: "Pensado para marcas que necesitan cuidar producto, canal, cliente y datos propios.",
      cards: [
        { title: "Vinos y bebidas", body: "Botella verificable, origen, lote, apertura, club, reventa y certificado digital para exportación." },
        { title: "Cosmética y perfumes", body: "Producto con evidencia de confianza, sello en el punto de apertura, garantía, recompra y comunidad verificada." },
        { title: "Eventos y membresías", body: "Pulseras, entradas y accesos con tap físico, beneficios y control de reventa." },
        { title: "Agro, pharma y bienes premium", body: "Trazabilidad por lote, evidencia de canal, alertas y dashboard para operar." },
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
      title: "Mapa de confianza para entender donde vive el producto",
      description: "La ruta no es decoración: muestra origen, taps, países, riesgo, canal y oportunidades comerciales.",
      bullets: ["Mercados con más demanda", "Alertas por geografía inesperada", "Análisis por lote, país y tenant", "Vista ejecutiva para marcas y resellers"],
    },
    reseller: {
      eyebrow: "Canal",
      title: "Programa reseller para vender confianza en más industrias",
      description: "Partners, agencias, distribuidores e integradores pueden ofrecer autenticidad, trazabilidad, postventa, clubes y marketplace sin reconstruir la tecnología.",
      cards: [
        { title: "Propuesta lista para vender", body: "Bodega, cosmética, eventos, agro, lujo o pharma pueden empezar con un piloto claro y demostrable." },
        { title: "Workspace white-label", body: "El partner opera con su marca, clientes, lotes, activos visuales y reglas comerciales." },
      ],
    },
    api: {
      eyebrow: "Arquitectura",
      title: "La complejidad queda atrás; el usuario ve una respuesta simple",
      description: "nexID conecta producto, consumidor, marca y sistemas internos sin exponer criptografía, UID o integraciones al comprador final.",
      bullets: ["Autenticidad, estado y reglas por unidad", "Portal mobile para consumidor y club", "Eventos, alertas y mapas para el dashboard", "Integración con CRM, e-commerce, ERP y webhooks"],
    },
    identity: {
      eyebrow: "Capa premium",
      title: "Certificado digital, wallet y NFT cuando la marca lo necesita",
      description: "El NFT no es el punto de partida: primero se valida evidencia del producto, compra, ownership y confianza. Después se puede guardar o transferir como certificado digital si la política lo permite.",
      bullets: ["Certificado por producto premium", "Wallet custodial nexID o MetaMask", "Garantía, lifecycle events y procedencia verificable", "Polygon para ownership; hashes opcionales para auditoría cuando aplica"],
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
    roi: { eyebrow: "ROI estimado", title: "Valor defendible para dirección e inversores", description: "Menos fraude, más datos propios y más relación postventa por cada unidad vendida.", metrics: [{ label: "Riesgo de fraude", value: "-30% a -70%", detail: "Modelo estimado: depende de vertical, carrier y adopción secure." }, { label: "Visibilidad comercial", value: "+10x", detail: "Modelo estimado: más datos por país, ciudad, canal, lote y evento." }, { label: "Margen y fidelización", value: "+8% a +18%", detail: "Modelo estimado: activado por club, garantía, marketplace y certificados." }] },
    credibility: { eyebrow: "Investor-grade", title: "Una historia entendible para empresas e inversores", description: "No vendemos chips: conectamos producto, cliente, canal y marca en una capa operativa.", items: ["Plataforma unificada: web + dashboard + API", "Operacion enterprise escalable", "Canal white-label para expansion regional", "Narrativa clara: autenticar, reclamar, guardar, vender"] },
    cta: { title: "Listo para un piloto claro y vendible", body: "Elegimos una línea, lote o edición premium; cargamos fotos reales, reglas de validación, beneficios y dashboard; y probamos el flujo completo con usuarios reales.", primary: "Agendar demo", secondary: "Hablar con ventas" },
    docsList: ["Workshop comercial y técnico", "Alta de tenant, roles y permisos", "Carga de lote, tags y banco visual", "Monitoreo, mapa, alertas y experiencias verificadas", "Go-live, métricas y plan de escala"],
  },
  "pt-BR": {
    nav: { product: "Produto", pricing: "Planos", reseller: "Revendedores", docs: "Arquitetura", cta: "Entrar", requestDemo: "Solicitar demo" },
    hero: { badge: "Autenticidade, rastreabilidade e pos-venda digital", title: "Transforme cada produto premium em um canal verificavel de confianca, garantia e fidelizacao.", body: "O cliente toca NFC ou QR, vê o resultado de confiança, revisa origem e lote, ativa garantia quando aplicável, recebe benefícios e guarda seu certificado digital.", primary: "Agendar demo", secondary: "Ver Demo Lab", tertiary: "Quero ser revendedor" },
    trustBar: ["Programas NTAG215", "NTAG 424 DNA TagTamper", "API de autenticação", "SaaS de validación", "Canal white-label"],
    howItWorks: { eyebrow: "Como funciona", title: "Encosta, valida e vende melhor", description: "Explicação simples: cada tap vira evidência, alerta e oportunidade comercial.", steps: [{ title: "1. Você ativa o lote", body: "Escolhe chip, quantidade e campanha em poucos cliques." }, { title: "2. O cliente encosta o celular", body: "A tela mostra rápido o resultado de confiança." }, { title: "3. O sistema registra tudo", body: "Fica salvo local, horário e resultado da leitura." }, { title: "4. Você vende com dados", body: "Dispara ação de marketing, suporte ou revenda." }] },
    what: { eyebrow: "Plataforma", title: "Uma infraestrutura para validar objetos e ativar negócio", description: "Emita uma identidade digital por unidade e opere com dashboard, API e webhooks.", cards: [{ title: "Verify", body: "Confirma autenticidade, estado e regras a cada toque." }, { title: "Passport", body: "Monta o gêmeo digital com lote, origem, eventos, canal e garantia." }, { title: "Rights", body: "Ativa ownership, acesso, vouchers, benefícios, transferências e garantias." }] },
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
    roi: { eyebrow: "ROI estimado", title: "Economia clara para conselho e vendas", description: "Hardware + SaaS + identidade premium.", metrics: [{ label: "Fraud loss reduction", value: "-30% a -70%", detail: "Modelo estimado: conforme vertical e adoção secure." }, { label: "Scan visibility", value: "+10x", detail: "Modelo estimado: mais granularidade operacional." }, { label: "Margin expansion", value: "+8% a +18%", detail: "Modelo estimado: mix secure + identidade." }] },
    credibility: { eyebrow: "Investor-grade", title: "Credibilidade enterprise", description: "Arquitetura e canal alinhados para escalar.", items: ["Plataforma unificada com web + dashboard + API", "Modelo enterprise escalável", "Canal white-label regional", "Valor claro entre basic e secure"] },
    cta: { title: "Pronto para piloto enterprise", body: "Co-desenhamos o rollout para setores críticos.", primary: "Agendar demo", secondary: "Falar com vendas" },
    docsList: ["Discovery workshop and technical scoping", "Tenant onboarding and access governance", "Batch setup and activation playbook", "Operational monitoring and fraud alerts", "Go-live support and success metrics"],
  },
  en: {
    nav: { product: "Product", pricing: "Pricing", reseller: "Resellers", docs: "Docs", cta: "Login", requestDemo: "Request demo" },
    hero: { badge: "Authenticity, traceability and digital after-sales", title: "Turn every premium product into a trusted channel for verification, warranty and loyalty.", body: "A customer taps NFC or QR, sees if the product is real, checks origin and batch, claims warranty, receives benefits and keeps a digital certificate.", primary: "Book demo", secondary: "Open Demo Lab", tertiary: "Become a reseller" },
    trustBar: ["NTAG215 programs", "NTAG 424 DNA TagTamper", "Authentication API", "Multi-tenant SaaS", "White-label distribution"],
    howItWorks: { eyebrow: "How it works", title: "Tap, verify, and sell better", description: "Simple flow: each tap becomes proof, insight, and a sales action.", steps: [{ title: "1. Activate your batch", body: "Pick chip type, quantity, and campaign in minutes." }, { title: "2. Customer taps", body: "The phone shows authenticity instantly." }, { title: "3. Data is saved", body: "You keep place, time, and scan result." }, { title: "4. Teams take action", body: "Launch marketing, support, or reseller actions fast." }] },
    what: { eyebrow: "Platform value", title: "One infrastructure to validate physical assets and activate business flows", description: "Issue one digital identity per unit and operate it through dashboard, API and webhooks.", cards: [{ title: "Verify", body: "Prove authenticity, state and policy outcome on every touchpoint." }, { title: "Passport", body: "Build a digital twin with batch, origin, events, channel and warranty." }, { title: "Rights", body: "Activate ownership, access, perks, vouchers, transfers and warranties." }] },
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
    roi: { eyebrow: "Estimated ROI", title: "Economics for boards and operators", description: "Hardware + SaaS + premium identity supports margin growth.", metrics: [{ label: "Fraud loss reduction", value: "-30% to -70%", detail: "Estimated model: depends on vertical and secure adoption." }, { label: "Scan visibility", value: "+10x", detail: "Estimated model: higher granularity across operations." }, { label: "Margin expansion", value: "+8% to +18%", detail: "Estimated model: driven by secure + identity mix." }] },
    credibility: { eyebrow: "Investor-grade", title: "Built to pitch enterprise buyers and investors now", description: "Architecture and channel strategy aligned from day one.", items: ["Unified platform: web + dashboard + API", "Scalable enterprise architecture", "Regional white-label distribution engine", "Clear basic vs secure value proposition"] },
    cta: { title: "Ready for an enterprise pilot", body: "Co-design rollout for wine, cosmetics, docs/presence, events or reseller channels.", primary: "Book a demo", secondary: "Talk to sales" },
    docsList: ["Discovery workshop and technical scoping", "Tenant onboarding and access governance", "Batch setup and activation playbook", "Operational monitoring and fraud alerts", "Go-live support and success metrics"],
  },
};
