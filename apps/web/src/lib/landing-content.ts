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
      body: "Con NFC o QR, tus clientes conocen el producto y acceden a garantía, beneficios o postventa en una sola experiencia. Vos decidís qué mostrar y medís qué funciona en cada piloto.",
      primary: "Agendar demo",
      secondary: "Ver cómo funciona",
      tertiary: "Quiero ser reseller",
    },
    trustBar: ["Evidencia NFC/SUN", "Origen y lote declarados", "Garantía por política", "Club y beneficios", "Marketplace white-label"],
    howItWorks: {
      eyebrow: "Como funciona",
      title: "Del producto físico al vínculo directo con el cliente",
      description: "Cada toque muestra qué mensaje NFC/SUN pasó la política, qué datos declaró la marca y qué puede hacer ahora el comprador.",
      steps: [
        { title: "1. Cargas lote e imágenes declaradas", body: "Referencia, etiqueta, origen declarado, reglas de claim y beneficios quedan listos antes de salir a góndola." },
        { title: "2. El cliente toca el producto", body: "La pantalla muestra el resultado del mensaje NFC/SUN y la política: válido, observado o bloqueado, junto con datos declarados y la próxima acción." },
        { title: "3. Se crea evidencia comercial", body: "Quedan registrados tap, ciudad aproximada reportada, TT reportado, canal y riesgo; no un recorrido o estado físico probado." },
        { title: "4. La marca activa postventa", body: "Garantía, club, puntos, experiencias, marketplace o NFT se habilitan sólo con su evidencia y política de aprobación." },
      ],
    },
    what: {
      eyebrow: "Que hace nexID",
      title: "Evidencia digital, trazabilidad declarada y postventa desde un solo toque",
      description: "La marca aplica reglas por unidad y el consumidor recibe una experiencia simple, confiable y accionable, sin confundir evidencia digital con prueba física.",
      cards: [
        { title: "Mensaje verificable", body: "El usuario entiende en segundos si el mensaje NFC/SUN pasa las reglas, qué TT fue reportado y si hay señales de riesgo." },
        { title: "Historia declarada visible", body: "Origen, lote, canal, taps y eventos reportados se convierten en una historia fácil de leer, no en prueba de ruta física." },
        { title: "Cliente conectado", body: "Garantía, club, beneficios, experiencias, reventa y NFT opcional quedan sujetos a evidencia y aprobación dentro del portal." },
      ],
    },
    plans: {
      eyebrow: "Planes según objetivo",
      title: "Empezá con un piloto claro y escalá cuando el negocio lo pruebe",
      description: "No se trata de comprar chips. Se trata de elegir cuánto querés proteger, medir y activar después de cada venta.",
      cards: [
        { name: "BASIC", badge: "QR / NTAG215", price: "Cotización por volumen", body: "Para campañas, eventos, garantías simples y medición de escaneos.", bullets: ["Tap-to-web", "Datos por ciudad y canal", "Ideal para alto volumen"] },
        { name: "SECURE", badge: "NTAG 424 DNA TT", price: "Piloto + hardware codificado + SaaS", body: "Para marcas que necesitan validar mensajes dinámicos, detectar replay y registrar TT.", bullets: ["Validación NFC/SUN", "Alertas por copia o replay", "TT reportado y trazabilidad declarada"] },
        { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Para operar varias marcas, países, integraciones, marketplace y datos propios.", bullets: ["Marca propia", "API y webhooks", "Portal, dashboard y soporte"] },
      ],
    },
    secure: {
      eyebrow: "Cuando hay riesgo alto",
      title: "Capa secure para vino, cosmética, lujo, eventos y documentos",
      description: "NTAG 424 DNA TagTamper aporta evidencia criptográfica del mensaje y un estado TT reportado cuando está disponible. No certifica por sí solo el envase, su contenido ni la custodia física.",
      bullets: ["Validación dinámica del mensaje", "Estado TT reportado para cierres y sellos", "Revocación por lote", "Detección de riesgo de replay"],
    },
    authenticity: {
      eyebrow: "Estados de validación NFC",
      title: "Lectura clara para consumidor, canal y equipo de riesgo",
      description: "La UX evita tecnicismos: muestra el resultado del mensaje y la política, el TT reportado, el riesgo y el próximo paso; no emite un veredicto físico.",
      badges: { good: "VÁLIDO", warn: "OBSERVADO", risk: "BLOQUEADO" },
      cards: [
        { state: "Mensaje válido", detail: "SUN/UID y política válidos; lote y origen siguen siendo datos declarados.", tone: "good" },
        { state: "TT abierto reportado", detail: "El tag reporta un cambio TT para revisión; no prueba por sí solo la apertura física ni el contenido.", tone: "warn" },
        { state: "Mensaje bloqueado", detail: "Replay, UID o uso fuera de regla requieren revisión; no determinan el estado físico del producto.", tone: "risk" },
      ],
    },
    useCases: {
      eyebrow: "Verticales",
      title: "Rubros donde la confianza cambia la venta",
      description: "Pensado para marcas que necesitan cuidar producto, canal, cliente y datos propios.",
      cards: [
        { title: "Vinos y bebidas", body: "Mensaje NFC verificable, origen y lote declarados, TT reportado, club, reventa y certificado digital sujeto a política." },
        { title: "Cosmética y perfumes", body: "Evidencia NFC/SUN, TT reportado, garantía, recompra y comunidad; sin certificar contenido o sello físico por el tap." },
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
      mapCaption: "Eventos simulados de mensajes NFC/SUN y TT reportado para validación comercial/técnica.",
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
      title: "Mapa de eventos para entender dónde aparecen las señales",
      description: "Muestra origen declarado, taps, países, riesgo, canal y oportunidades comerciales; no prueba recorrido ni custodia física.",
      bullets: ["Mercados con más demanda", "Alertas por geografía inesperada", "Análisis por lote, país y tenant", "Vista ejecutiva para marcas y resellers"],
    },
    reseller: {
      eyebrow: "Canal",
      title: "Programa reseller para vender confianza en más industrias",
      description: "Partners, agencias, distribuidores e integradores pueden ofrecer validación NFC/SUN, trazabilidad declarada, postventa, clubes y marketplace sin reconstruir la tecnología.",
      cards: [
        { title: "Propuesta lista para vender", body: "Bodega, cosmética, eventos, agro, lujo o pharma pueden empezar con un piloto claro y demostrable." },
        { title: "Workspace white-label", body: "El partner opera con su marca, clientes, lotes, activos visuales y reglas comerciales." },
      ],
    },
    api: {
      eyebrow: "Arquitectura",
      title: "La complejidad queda atrás; el usuario ve una respuesta simple",
      description: "nexID conecta producto, consumidor, marca y sistemas internos sin exponer criptografía, UID o integraciones al comprador final.",
      bullets: ["Mensaje NFC/SUN, TT reportado y reglas por unidad", "Portal mobile para consumidor y club", "Eventos, alertas y mapas con fuente declarada", "Integración con CRM, e-commerce, ERP y webhooks"],
    },
    identity: {
      eyebrow: "Capa premium",
      title: "Certificado digital, wallet y NFT cuando la marca lo necesita",
      description: "El NFT no es el punto de partida: primero se valida el mensaje NFC/SUN y, por separado, la evidencia de compra y la aprobación de ownership. El registro digital no certifica contenido, origen ni custodia física.",
      bullets: ["Certificado asociado a una referencia declarada", "Wallet custodial nexID o MetaMask", "Garantía y lifecycle events sujetos a política", "Polygon para ownership digital; hashes opcionales para auditoría cuando aplica"],
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
    roi: { eyebrow: "ROI medible", title: "Valor que se valida con datos del piloto", description: "El baseline, la adopción y los resultados del cliente determinan el impacto; nexID no publica mejoras porcentuales sin evidencia del caso.", metrics: [{ label: "Riesgo de fraude", value: "Medir en piloto", detail: "Comparar alertas, incidentes confirmados y pérdidas contra el baseline acordado." }, { label: "Visibilidad comercial", value: "Baseline + piloto", detail: "Medir eventos consentidos y utilizables por país, ciudad aproximada, canal, lote y campaña." }, { label: "Margen y fidelización", value: "Sujeto a evidencia", detail: "Medir conversión, recompra y costo operativo; no asumir uplift por activar club, garantía o marketplace." }] },
    credibility: { eyebrow: "Investor-grade", title: "Una historia entendible para empresas e inversores", description: "No vendemos chips: conectamos producto, cliente, canal y marca en una capa operativa.", items: ["Plataforma unificada: web + dashboard + API", "Operacion enterprise escalable", "Canal white-label para expansion regional", "Narrativa clara: validar mensaje, revisar evidencia, reclamar, guardar y vender"] },
    cta: { title: "Listo para un piloto claro y vendible", body: "Elegimos una línea, lote o edición premium; cargamos imágenes y datos declarados, reglas de validación, beneficios y dashboard; y medimos el flujo completo con usuarios del piloto.", primary: "Agendar demo", secondary: "Hablar con ventas" },
    docsList: ["Workshop comercial y técnico", "Alta de tenant, roles y permisos", "Carga de lote, tags y banco visual", "Monitoreo, mapa, alertas y experiencias con fuente declarada", "Go-live, métricas y plan de escala"],
  },
  "pt-BR": {
    nav: { product: "Produto", pricing: "Planos", reseller: "Revendedores", docs: "Arquitetura", cta: "Entrar", requestDemo: "Solicitar demo" },
    hero: { badge: "Produtos conectados para marcas", title: "Transforme cada produto em um canal direto de proteção, fidelização e novas vendas.", body: "Com NFC ou QR, seus clientes conhecem o produto e acessam garantia, benefícios ou pós-venda em uma só experiência. Você decide o que mostrar e mede o que funciona em cada piloto.", primary: "Agendar demo", secondary: "Ver como funciona", tertiary: "Quero ser revendedor" },
    trustBar: ["Evidência NFC/SUN", "Origem e lote declarados", "Garantia por política", "Clube e benefícios", "Canal white-label"],
    howItWorks: { eyebrow: "Como funciona", title: "Encoste, valide a mensagem e ative a pós-venda", description: "Cada toque mostra o resultado NFC/SUN, os dados declarados e a próxima ação permitida.", steps: [{ title: "1. Você ativa o lote", body: "Configura carrier, lote, dados declarados e política." }, { title: "2. O cliente encosta o celular", body: "A tela mostra mensagem válida, sinalizada ou bloqueada; não um veredito físico." }, { title: "3. O sistema registra evidência", body: "Ficam registrados horário, local aproximado informado e TT reportado." }, { title: "4. A marca ativa a pós-venda", body: "Garantia, benefícios ou ownership exigem sua própria evidência e aprovação." }] },
    what: { eyebrow: "Plataforma", title: "Uma infraestrutura para validar mensagens e ativar negócios", description: "Associe uma identidade digital declarada por unidade e opere com dashboard, API e webhooks.", cards: [{ title: "Verify", body: "Valida mensagem NFC/SUN, TT reportado e política; não o conteúdo físico." }, { title: "Passport", body: "Organiza lote, origem e eventos declarados, canal e garantia." }, { title: "Rights", body: "Ativa ownership, acesso, vouchers, transferências e garantias somente por política." }] },
    plans: { eyebrow: "Basic vs Secure vs Enterprise", title: "Pacotes por nível de risco", description: "De campanhas a programas antifraude baseados em evidência.", cards: [{ name: "BASIC", badge: "NTAG215", price: "Cotação por volume", body: "Eventos e tracking simples.", bullets: ["Tap-to-web", "Analytics de scans", "Sem criptografia SUN"] }, { name: "SECURE", badge: "NTAG 424 DNA TT", price: "Piloto + hardware codificado + SaaS", body: "Validação robusta da mensagem da tag.", bullets: ["Validação SUN", "Alertas de replay", "TT reportado"] }, { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Operação avançada; SLA sujeito a readiness review.", bullets: ["Branding white-label", "API keys + webhooks", "Camada premium"] }] },
    secure: { eyebrow: "Por que 424 TagTamper", title: "Camada secure para vinho, cosméticos e documentos", description: "NTAG 424 DNA TagTamper valida mensagens dinâmicas e informa TT quando disponível; isso não certifica embalagem, conteúdo ou custódia física.", bullets: ["Challenge dinâmico por tap", "Estado TT reportado", "Revogação por lote", "Detecção de risco de replay"] },
    authenticity: { eyebrow: "Estados de validação NFC", title: "Resultados claros da mensagem e da política", description: "A tela separa evidência digital de qualquer conclusão sobre o produto físico.", badges: { good: "VÁLIDO", warn: "SINALIZADO", risk: "BLOQUEADO" }, cards: [{ state: "Mensagem válida", detail: "SUN/UID e política válidos; origem e lote continuam declarados.", tone: "good" }, { state: "TT aberto reportado", detail: "A tag informa mudança de TT; não prova abertura física nem conteúdo.", tone: "warn" }, { state: "Mensagem bloqueada", detail: "Replay, UID ou uso fora da regra exigem revisão.", tone: "risk" }] },
    useCases: { eyebrow: "Casos de uso", title: "Wine, cosmetics, docs e events", description: "Setores onde evidência digital e compliance importam.", cards: [{ title: "Wine", body: "Mensagem NFC, origem e lote declarados e TT reportado para exportação." }, { title: "Cosmetics", body: "Proteção de marca com evidência da tag e embalagem conectada." }, { title: "Docs & Presence", body: "Credenciais e registros de presença declarados por evento." }, { title: "Events", body: "Credenciais seguras e analytics." }] },
    intelligence: { eyebrow: "Inteligência global", title: "Mapa mundial de eventos reportados", description: "Hotspots e anomalias por região; não representa rota ou custódia física.", bullets: ["Top mercados", "Alertas por geografia", "Análise por batch/tenant", "Visão revendedor"] },
    radar: {
      eyebrow: "Auth radar (Demo Lab)",
      title: "Visualização operacional de eventos de verificação",
      description: "Use como demo guiada. Não representa métricas de produção nem tração auditada.",
      liveLabel: "Demo stream",
      revenueLabel: "SaaS Revenue",
      mapCaption: "Eventos simulados de mensagens NFC/SUN e TT reportado para validação comercial/técnica.",
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
    api: { eyebrow: "Developer-friendly", title: "API gateway para integração", description: "Contratos previsíveis para ativação e validação de mensagens NFC/SUN.", bullets: ["Gateway serverless projetado para resiliência", "Fluxos administrativos internos com controle por papel", "Eventos e telemetria de segurança", "Base enterprise para SDK/webhooks"] },
    identity: { eyebrow: "Camada premium", title: "Digital identity layer", description: "Uma referência física declarada pode ser associada a uma identidade digital persistente; o registro não comprova conteúdo, origem ou custódia.", bullets: ["Ownership por aprovação", "Warranty events", "Registros de proveniência declarada", "Roadmap para ownership/warranty/provenance"] },
    calculator: { eyebrow: "Calculadora", title: "Simulador de investimento", description: "Estimativa de hardware, SaaS e escopo de ativação.", volumeLabel: "Volume", productLabel: "Tipo de produto", securityLabel: "Nível de segurança", channelLabel: "Canal", recommendationLabel: "Plano recomendado", hardwareSpendLabel: "Investimento hardware", saasFeeLabel: "Taxa SaaS", activationScopeLabel: "Escopo de ativação", analyticsScopeLabel: "Escopo analítico", perYearLabel: "/ano", tagsUnitLabel: "tags", scopeLabels: { base: "Base", extended: "Estendido", advanced: "Avançado" }, cta: "Solicitar proposta custom", options: { product: [{ value: "wine", label: "Wine" }, { value: "cosmetics", label: "Cosmetics" }, { value: "events", label: "Events" }, { value: "pharma", label: "Pharma" }], security: [{ value: "basic", label: "Basic" }, { value: "secure", label: "Secure" }, { value: "enterprise", label: "Enterprise" }], channel: [{ value: "direct", label: "Direto" }, { value: "reseller", label: "Revendedor" }] } },
    roi: { eyebrow: "ROI mensurável", title: "Valor validado com dados do piloto", description: "Baseline, adoção e resultados do cliente determinam o impacto; a nexID não publica ganhos percentuais sem evidência do caso.", metrics: [{ label: "Risco de fraude", value: "Medir no piloto", detail: "Comparar alertas, incidentes confirmados e perdas com o baseline acordado." }, { label: "Visibilidade comercial", value: "Baseline + piloto", detail: "Medir eventos consentidos e úteis por país, cidade aproximada, canal, lote e campanha." }, { label: "Margem e fidelização", value: "Depende dos dados", detail: "Medir conversão, recompra e custo operacional; não presumir uplift por ativar clube, garantia ou marketplace." }] },
    credibility: { eyebrow: "Investor-grade", title: "Credibilidade enterprise", description: "Arquitetura e canal alinhados para escalar.", items: ["Plataforma unificada com web + dashboard + API", "Modelo enterprise escalável", "Canal white-label regional", "Valor claro entre basic e secure"] },
    cta: { title: "Pronto para piloto enterprise", body: "Co-desenhamos o rollout para setores críticos.", primary: "Agendar demo", secondary: "Falar com vendas" },
    docsList: ["Discovery workshop and technical scoping", "Tenant onboarding and access governance", "Batch setup and activation playbook", "Operational monitoring and fraud alerts", "Go-live support and success metrics"],
  },
  en: {
    nav: { product: "Product", pricing: "Pricing", reseller: "Resellers", docs: "Docs", cta: "Login", requestDemo: "Request demo" },
    hero: { badge: "Connected products for brands", title: "Turn every product into a direct channel for protection, loyalty and new sales.", body: "With NFC or QR, customers discover the product and access warranties, benefits or after-sales support in one experience. You decide what to share and measure what works in each pilot.", primary: "Book a demo", secondary: "See how it works", tertiary: "Become a reseller" },
    trustBar: ["NFC/SUN evidence", "Declared origin and batch", "Policy-based warranty", "Multi-tenant SaaS", "White-label distribution"],
    howItWorks: { eyebrow: "How it works", title: "Tap, validate the message, and activate after-sales", description: "Each tap shows the NFC/SUN result, declared data and the next permitted action.", steps: [{ title: "1. Activate your batch", body: "Configure carrier, batch, declared data and policy." }, { title: "2. Customer taps", body: "The phone shows a valid, flagged or blocked tag message—not a physical-product verdict." }, { title: "3. Evidence is recorded", body: "Time, reported approximate location and reported TT state can be stored." }, { title: "4. Teams take action", body: "Warranty, benefits or ownership require their own evidence and approval." }] },
    what: { eyebrow: "Platform value", title: "One infrastructure to validate messages and activate business flows", description: "Associate a declared digital identity with each unit and operate it through dashboard, API and webhooks.", cards: [{ title: "Verify", body: "Validate the NFC/SUN message, reported TT and policy—not physical contents." }, { title: "Passport", body: "Organize declared batch, origin, events, channel and warranty." }, { title: "Rights", body: "Activate ownership, access, perks, transfers and warranties only under policy." }] },
    plans: { eyebrow: "Basic vs Secure vs Enterprise", title: "Commercial packaging by risk profile", description: "From campaign activations to evidence-based message and replay controls.", cards: [{ name: "BASIC", badge: "NTAG215", price: "Quote by volume", body: "Events, marketing and simple tracking.", bullets: ["Tap-to-web", "Scan analytics", "No SUN crypto"] }, { name: "SECURE", badge: "NTAG 424 DNA TT", price: "Pilot scope + encoded hardware + SaaS", body: "High-confidence tag-message validation.", bullets: ["SUN validation", "Replay alerts", "Reported TT state"] }, { name: "ENTERPRISE / RESELLER", badge: "White-label", price: "Custom", body: "Multi-tenant partner model; SLA subject to readiness review.", bullets: ["White-label branding", "API keys + webhooks", "Premium identity layer"] }] },
    secure: { eyebrow: "Why 424 TagTamper", title: "Secure profile for wine, cosmetics and documents", description: "NTAG 424 DNA TagTamper validates dynamic messages and reports TT when available; this alone does not certify packaging, contents or physical custody.", bullets: ["Dynamic message per tap", "Reported TT state", "Batch-level revocation", "Replay-risk detection"] },
    authenticity: { eyebrow: "NFC validation states", title: "Clear message and policy outcomes", description: "The UX separates digital tag evidence from any physical-product conclusion.", badges: { good: "VALID", warn: "FLAGGED", risk: "BLOCKED" }, cards: [{ state: "Valid message", detail: "SUN/UID and policy passed; origin and batch remain declared data.", tone: "good" }, { state: "Reported TT open", detail: "The tag reports a TT change; it does not prove physical opening or contents.", tone: "warn" }, { state: "Blocked message", detail: "Replay, UID or policy failure requires review.", tone: "risk" }] },
    useCases: { eyebrow: "Use cases", title: "Wine, cosmetics, docs and events", description: "Built for sectors where digital evidence impacts margin and compliance.", cards: [{ title: "Wine", body: "NFC message, declared origin and batch, and reported TT for export workflows." }, { title: "Cosmetics", body: "Brand protection with tag evidence and connected packaging." }, { title: "Docs & Presence", body: "Credentials and event-reported presence records." }, { title: "Events", body: "Secure credentials and attendance analytics." }] },
    intelligence: { eyebrow: "Global intelligence", title: "World map of reported scan events", description: "Operational view for commercial and technical simulations; not physical route or custody proof.", bullets: ["Top scan markets", "Unexpected geography alerts", "Batch and tenant overlays", "Reseller performance view"] },
    radar: {
      eyebrow: "Auth radar (Demo Lab)",
      title: "Operational visualization of verification events",
      description: "Use as a guided demo. It does not represent production metrics or audited traction.",
      liveLabel: "Demo stream",
      revenueLabel: "SaaS Revenue",
      mapCaption: "Simulated NFC/SUN message and reported-TT events for commercial/technical validation.",
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
    api: { eyebrow: "Developer-friendly", title: "API gateway designed for enterprise integration", description: "Predictable contracts for activation, NFC/SUN message validation and observability.", bullets: ["Serverless gateway designed for resilience", "Internal admin flows with role governance", "Security event stream", "Enterprise SDK/webhook-ready foundation"] },
    identity: { eyebrow: "Premium layer", title: "Digital identity layer", description: "A declared physical reference can be associated with a persistent digital identity; the record does not prove contents, origin or custody.", bullets: ["Policy-approved ownership", "Warranty lifecycle", "Declared provenance records", "Roadmap for ownership/warranty/provenance"] },
    calculator: { eyebrow: "Calculator", title: "Interactive cost simulator", description: "Quick estimate for hardware spend, SaaS fee and activation scope.", volumeLabel: "Volume", productLabel: "Product type", securityLabel: "Security level", channelLabel: "Channel", recommendationLabel: "Recommended plan", hardwareSpendLabel: "Hardware spend", saasFeeLabel: "SaaS fee", activationScopeLabel: "Activation scope", analyticsScopeLabel: "Analytics scope", perYearLabel: "/year", tagsUnitLabel: "tags", scopeLabels: { base: "Base", extended: "Extended", advanced: "Advanced" }, cta: "Request custom quote", options: { product: [{ value: "wine", label: "Wine" }, { value: "cosmetics", label: "Cosmetics" }, { value: "events", label: "Events" }, { value: "pharma", label: "Pharma" }], security: [{ value: "basic", label: "Basic" }, { value: "secure", label: "Secure" }, { value: "enterprise", label: "Enterprise" }], channel: [{ value: "direct", label: "Direct" }, { value: "reseller", label: "Reseller" }] } },
    roi: { eyebrow: "Measurable ROI", title: "Value validated with pilot data", description: "The customer baseline, adoption and measured outcomes determine impact; nexID does not publish unsupported percentage gains.", metrics: [{ label: "Fraud risk", value: "Measure in pilot", detail: "Compare alerts, confirmed incidents and losses against the agreed baseline." }, { label: "Commercial visibility", value: "Baseline + pilot", detail: "Measure consented, usable events by country, approximate city, channel, batch and campaign." }, { label: "Margin and loyalty", value: "Evidence required", detail: "Measure conversion, repeat purchase and operating cost; do not assume uplift from club, warranty or marketplace activation." }] },
    credibility: { eyebrow: "Investor-grade", title: "Built to pitch enterprise buyers and investors now", description: "Architecture and channel strategy aligned from day one.", items: ["Unified platform: web + dashboard + API", "Scalable enterprise architecture", "Regional white-label distribution engine", "Clear basic vs secure value proposition"] },
    cta: { title: "Ready for an enterprise pilot", body: "Co-design rollout for wine, cosmetics, docs/presence, events or reseller channels.", primary: "Book a demo", secondary: "Talk to sales" },
    docsList: ["Discovery workshop and technical scoping", "Tenant onboarding and access governance", "Batch setup and activation playbook", "Operational monitoring and fraud alerts", "Go-live support and success metrics"],
  },
};
