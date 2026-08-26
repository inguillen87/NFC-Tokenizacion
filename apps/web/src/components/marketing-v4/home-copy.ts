import type { AppLocale } from "@product/config";

export type HomeHeroSector = {
  id: "agro" | "pharma" | "wine" | "premium";
  title: string;
  body: string;
  image: string;
  alt: string;
  visualKicker: string;
  visualTitle: string;
  visualStatus: string;
  visualOrigin: string;
  visualOriginValue: string;
  visualBoundary: string;
};

export type HomeMotionCopy = {
  eyebrow: string;
  title: string;
  body: string;
  play: string;
  pause: string;
  replay: string;
  openDemo: string;
  mediaLabel: string;
  boundary: string;
};

export type HomeFlowCopy = {
  eyebrow: string;
  title: string;
  body: string;
  personLabel: string;
  businessLabel: string;
  sampleLabel: string;
  steps: Array<{
    number: string;
    shortTitle: string;
    title: string;
    body: string;
    person: string;
    business: string;
    signal: string;
  }>;
  detail: string;
};

export type HomeRolesCopy = {
  eyebrow: string;
  title: string;
  body: string;
  scenarioLabel: string;
  items: Array<{ role: string; title: string; body: string; outcome: string }>;
  workspace: {
    portfolioTitle: string;
    portfolioItems: string[];
    activeLabel: string;
    configuredLabel: string;
    reviewLabel: string;
    signalsTitle: string;
    signals: string[];
    sequenceLabel: string;
    activityLabel: string;
    mapZoomIn: string;
    mapZoomOut: string;
    mapAttribution: string;
    customerTitle: string;
    informationLabel: string;
    nextActionLabel: string;
    viewDetail: string;
  };
};

type HomeV4Copy = {
  a11y: {
    skipToContent: string;
    footerNavigation: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primary: string;
    secondary: string;
    evidence: string;
    sectorsLabel: string;
    rotationLabel: string;
    pauseRotation: string;
    resumeRotation: string;
    capabilitiesLabel: string;
    capabilities: string[];
    sectors: HomeHeroSector[];
  };
  flow: HomeFlowCopy;
  roles: HomeRolesCopy;
  video: HomeMotionCopy;
  evidence: {
    eyebrow: string;
    title: string;
    body: string;
    items: Array<{ label: string; title: string; body: string }>;
    sampleLabel: string;
    sampleTitle: string;
    sampleStatus: string;
    sourceLabel: string;
    limitLabel: string;
    publicProof: string;
    pilot: string;
  };
  footer: {
    eyebrow: string;
    title: string;
    ctaBody: string;
    primary: string;
    secondary: string;
    body: string;
    solutionBy: string;
    platformLabel: string;
    exploreLabel: string;
    integrationLabel: string;
    contactLabel: string;
    howItWorks: string;
    solutions: string;
    documentation: string;
    technology: string;
    contact: string;
    audience: string;
    demo: string;
    proof: string;
    developers: string;
    pricing: string;
    fiscal: string;
    certificate: string;
    rights: string;
  };
};

export const HOME_V4_COPY: Record<AppLocale, HomeV4Copy> = {
  "es-AR": {
    a11y: {
      skipToContent: "Ir al contenido",
      footerNavigation: "Navegación del pie",
    },
    hero: {
      eyebrow: "Identidad digital para cada unidad",
      title: "Conectá cada producto con su información y el próximo paso.",
      body:
        "nexID vincula una etiqueta inteligente o un código con la información y la evidencia disponibles. La persona consulta desde el navegador y tu empresa define qué mostrar y qué acción habilitar.",
      primary: "Ver cómo funciona",
      secondary: "Hablar de un piloto",
      evidence: "Qué verifica exactamente",
      sectorsLabel: "Una plataforma. Distintas industrias.",
      rotationLabel: "Elegí un rubro o mirá cómo cambia la experiencia.",
      pauseRotation: "Pausar rotación",
      resumeRotation: "Reanudar rotación",
      capabilitiesLabel: "Preparado para integrarse",
      capabilities: ["Etiqueta inteligente o código", "Consulta desde el navegador, sin instalar una aplicación", "Integración con sistemas existentes"],
      sectors: [
        {
          id: "agro",
          title: "Agro e insumos",
          body: "Lote, envase y uso responsable",
          image: "/images/nexid-v4/agro-enterprise.webp",
          alt: "Envase agrícola, bolsa de semillas y teléfono conectados por una identidad digital",
          visualKicker: "Agro e insumos",
          visualTitle: "Envase agro · Demostración",
          visualStatus: "El mensaje pasó los controles configurados",
          visualOrigin: "Datos declarados",
          visualOriginValue: "Producto, lote y mercado de destino",
          visualBoundary: "La lectura valida el mensaje y las reglas configuradas; no acredita por sí sola el contenido ni el objeto físico.",
        },
        {
          id: "pharma",
          title: "Farma y salud",
          body: "Lote, vigencia e información aprobada",
          image: "/images/nexid-v4/pharma-enterprise.webp",
          alt: "Vial farmacéutico, envase y teléfono conectados por una identidad digital",
          visualKicker: "Farma y salud",
          visualTitle: "Producto farmacéutico · Demostración",
          visualStatus: "La identidad y la vigencia fueron consultadas",
          visualOrigin: "Datos declarados",
          visualOriginValue: "Producto, lote, vigencia e información aprobada",
          visualBoundary: "La lectura valida el mensaje y las reglas configuradas; no acredita por sí sola el contenido ni el objeto físico.",
        },
        {
          id: "wine",
          title: "Bodegas de alta gama",
          body: "Origen, lote y experiencia posterior",
          image: "/images/nexid-v4/winery-enterprise.webp",
          alt: "Botella de vino de alta gama, estuche y teléfono conectados por una identidad digital",
          visualKicker: "Bodegas de alta gama",
          visualTitle: "Botella conectada · Demostración",
          visualStatus: "El mensaje y la información de origen fueron consultados",
          visualOrigin: "Datos declarados",
          visualOriginValue: "Producto, lote, origen y experiencia disponible",
          visualBoundary: "La lectura valida el mensaje y las reglas configuradas; no acredita por sí sola el contenido, el origen físico ni la custodia.",
        },
        {
          id: "premium",
          title: "Moda y bienes durables",
          body: "Garantía, derechos y postventa",
          image: "/images/nexid-v4/fashion-enterprise.webp",
          alt: "Calzado de alta gama, etiqueta inteligente y teléfono vinculados a una identidad digital",
          visualKicker: "Moda y bienes durables",
          visualTitle: "Producto durable · Demostración",
          visualStatus: "La identidad y las reglas fueron consultadas",
          visualOrigin: "Datos declarados",
          visualOriginValue: "Unidad, garantía y derechos digitales",
          visualBoundary: "La lectura valida el mensaje y las reglas configuradas; no acredita por sí sola la autenticidad física ni la cadena de custodia.",
        },
      ],
    },
    flow: {
      eyebrow: "Cómo funciona en la práctica",
      title: "Una lectura clara. Una decisión útil.",
      body: "La misma identidad acompaña al producto desde su configuración hasta la consulta y la acción posterior.",
      personLabel: "Lo que ve la persona",
      businessLabel: "Lo que obtiene la empresa",
      sampleLabel: "Ejemplo ilustrativo · Sin datos de cliente",
      steps: [
        {
          number: "01",
          shortTitle: "Producto",
          title: "Prepará el producto",
          body: "Vinculá una unidad o un lote con la información que tu organización autoriza.",
          person: "El producto incorpora una etiqueta inteligente o un código listo para consultar.",
          business: "Una referencia ordenada para administrar información, lotes y experiencias.",
          signal: "Identidad asignada · Unidad 000128",
        },
        {
          number: "02",
          shortTitle: "Consulta",
          title: "Mostrá un resultado comprensible",
          body: "La consulta separa lo observado, lo declarado y aquello que todavía no puede confirmarse.",
          person: "Un mensaje breve que explica qué se consultó y cuáles son sus límites.",
          business: "Una lectura registrada y señales para revisar cuando algo requiere atención.",
          signal: "Consulta aceptada · Límites visibles",
        },
        {
          number: "03",
          shortTitle: "Acción",
          title: "Abrí el siguiente paso",
          body: "Información, soporte, garantía o beneficios aparecen sólo cuando las reglas lo permiten.",
          person: "Una acción concreta, sin instalar una aplicación ni recorrer menús técnicos.",
          business: "Un canal directo posterior a la venta, conectado con sus sistemas y políticas.",
          signal: "Próxima acción · Información aprobada",
        },
      ],
      detail: "Ver evidencia y límites",
    },
    roles: {
      eyebrow: "Valor por rol",
      title: "La plataforma, vista por cada equipo.",
      body: "Marca, operaciones y cliente acceden a una vista preparada para la decisión que deben tomar.",
      scenarioLabel: "Escenario ilustrativo · Sin datos de cliente",
      items: [
        { role: "Marca", title: "Protegé la relación", body: "Conectá cada unidad con información, garantía y acciones posteriores a la venta.", outcome: "Canal directo" },
        { role: "Operaciones", title: "Trabajá con señales", body: "Revisá lotes, hechos informados, lecturas repetidas y estados que requieren atención.", outcome: "Decisiones trazables" },
        { role: "Cliente", title: "Entendé y actuá", body: "Consultá el resultado, la información declarada y el próximo paso sin instalar nada.", outcome: "Menos fricción" },
      ],
      workspace: {
        portfolioTitle: "Productos conectados",
        portfolioItems: ["Lote agrícola 24A", "Unidad farmacéutica 000128", "Serie de indumentaria M-420"],
        activeLabel: "Activo",
        configuredLabel: "En configuración",
        reviewLabel: "Revisar",
        signalsTitle: "Señales de operación",
        signals: ["Lecturas registradas", "Lotes consultados", "Revisión requerida"],
        sequenceLabel: "Secuencia simulada",
        activityLabel: "Actividad ilustrativa",
        mapZoomIn: "Acercar mapa",
        mapZoomOut: "Alejar mapa",
        mapAttribution: "Mostrar información del mapa",
        customerTitle: "Consulta del producto",
        informationLabel: "Información disponible",
        nextActionLabel: "Próxima acción",
        viewDetail: "Ver detalle",
      },
    },
    video: {
      eyebrow: "Recorrido visual",
      title: "Del producto físico a una experiencia útil.",
      body: "Mirá cómo una lectura conecta la identidad, la evidencia disponible y la próxima acción. La secuencia ilustra el flujo; cada implementación depende de sus datos y controles.",
      play: "Iniciar recorrido",
      pause: "Pausar recorrido",
      replay: "Repetir recorrido",
      openDemo: "Explorar demostraciones",
      mediaLabel: "Escena ilustrativa de un producto conectado por nexID",
      boundary: "Secuencia ilustrativa · Sin datos de cliente",
    },
    evidence: {
      eyebrow: "Claridad que da confianza",
      title: "Cada resultado explica de dónde sale.",
      body: "nexID presenta una respuesta útil sin mezclar una lectura técnica con datos aportados por la organización ni con pruebas que todavía faltan.",
      items: [
        { label: "Observado", title: "Mensaje y reglas", body: "Validez del mensaje, vigencia, lecturas repetidas y estado informado cuando corresponda." },
        { label: "Declarado", title: "Producto y recorrido", body: "Origen, lote, contenido y eventos aportados por la marca o sus operadores." },
        { label: "Por confirmar", title: "Contenido y custodia física", body: "Lo que la lectura no puede acreditar por sí sola queda señalado, sin convertir una suposición en certeza." },
      ],
      sampleLabel: "Lectura de ejemplo",
      sampleTitle: "Unidad 000128",
      sampleStatus: "Resultado disponible",
      sourceLabel: "Fuente visible",
      limitLabel: "Límite explícito",
      publicProof: "Ver evidencia pública",
      pilot: "Diseñar un piloto",
    },
    footer: {
      eyebrow: "Un piloto empieza por un caso concreto",
      title: "Elegí un producto, un objetivo y una señal para medir.",
      ctaBody: "Diseñamos el recorrido inicial con tu equipo y definimos desde el comienzo qué información se mostrará, qué sistemas se integrarán y qué resultado podrá evaluarse.",
      primary: "Hablar con ventas",
      secondary: "Explorar demostraciones",
      body: "Un producto de Inmovar Latam SAS para conectar productos, operaciones y personas con identidad y evidencia digital.",
      solutionBy: "Una solución de Inmovar Latam SAS",
      platformLabel: "Plataforma",
      exploreLabel: "Explorar",
      integrationLabel: "Integración",
      contactLabel: "Contacto",
      howItWorks: "Cómo funciona",
      solutions: "Soluciones por equipo",
      documentation: "Documentación",
      technology: "Tecnología",
      contact: "Hablar con ventas",
      audience: "Para quién es",
      demo: "Demostraciones",
      proof: "Verificador público",
      developers: "Desarrolladores",
      pricing: "Planes",
      fiscal: "Información fiscal",
      certificate: "Certificado MiPyME",
      rights: "nexID · Inmovar Latam SAS. Todos los derechos reservados.",
    },
  },
  en: {
    a11y: {
      skipToContent: "Skip to content",
      footerNavigation: "Footer navigation",
    },
    hero: {
      eyebrow: "Digital identity and evidence for every item",
      title: "Connect every product to its information and next step.",
      body:
        "nexID links a smart tag or code to the available information and evidence. People check it in their browser, while your business decides what to show and which action to enable.",
      primary: "See how it works",
      secondary: "Discuss a pilot",
      evidence: "What it verifies",
      sectorsLabel: "One platform. Different industries.",
      rotationLabel: "Choose a sector or watch the experience adapt.",
      pauseRotation: "Pause rotation",
      resumeRotation: "Resume rotation",
      capabilitiesLabel: "Ready to integrate",
      capabilities: ["Smart tag or code", "Browser experience with no app", "Integration with existing systems"],
      sectors: [
        {
          id: "agro",
          title: "Agriculture and inputs",
          body: "Batch, package and responsible use",
          image: "/images/nexid-v4/agro-enterprise.webp",
          alt: "Agricultural container, seed pouch and phone connected through a digital identity",
          visualKicker: "Agriculture and inputs",
          visualTitle: "Agricultural package · Demo scenario",
          visualStatus: "The identifier and policy passed the checks configured for this demo",
          visualOrigin: "Declared data",
          visualOriginValue: "Product, batch and destination market",
          visualBoundary: "The reading validates the configured message and policy; it does not prove the contents or physical item by itself.",
        },
        {
          id: "pharma",
          title: "Pharma and healthcare",
          body: "Batch, validity and approved information",
          image: "/images/nexid-v4/pharma-enterprise.webp",
          alt: "Pharmaceutical vial, package and phone connected through a digital identity",
          visualKicker: "Pharma and healthcare",
          visualTitle: "Pharmaceutical product · Demo scenario",
          visualStatus: "The identity and validity were queried",
          visualOrigin: "Declared data",
          visualOriginValue: "Product, batch, validity and approved information",
          visualBoundary: "The reading validates the configured message and policy; it does not prove the contents or physical item by itself.",
        },
        {
          id: "wine",
          title: "Premium wineries",
          body: "Origin, batch and post-sale experience",
          image: "/images/nexid-v4/winery-enterprise.webp",
          alt: "Premium wine bottle, presentation box and phone connected through a digital identity",
          visualKicker: "Premium wineries",
          visualTitle: "Connected bottle · Demo scenario",
          visualStatus: "The message and declared origin were queried",
          visualOrigin: "Declared data",
          visualOriginValue: "Product, batch, origin and available experience",
          visualBoundary: "The reading validates the configured message and policy; it does not prove the contents, physical origin or custody by itself.",
        },
        {
          id: "premium",
          title: "Fashion and durable goods",
          body: "Warranty, rights and after-sales",
          image: "/images/nexid-v4/fashion-enterprise.webp",
          alt: "Premium footwear, smart label and phone connected to a digital identity",
          visualKicker: "Fashion and durable goods",
          visualTitle: "Durable product · Demo scenario",
          visualStatus: "The identity and policy were queried",
          visualOrigin: "Declared data",
          visualOriginValue: "Item, warranty and digital rights",
          visualBoundary: "The reading validates the configured message and policy; it does not prove physical authenticity or custody by itself.",
        },
      ],
    },
    flow: {
      eyebrow: "How it works in practice",
      title: "One clear reading. One useful decision.",
      body: "The same identity follows the product from setup to consultation and the next permitted action.",
      personLabel: "What people see",
      businessLabel: "What the business gets",
      sampleLabel: "Illustrative example · No customer data",
      steps: [
        {
          number: "01",
          shortTitle: "Product",
          title: "Prepare the product",
          body: "Link an item or batch to the information your organization authorizes.",
          person: "The product carries a smart tag or code that is ready to scan.",
          business: "An ordered reference for managing information, batches and experiences.",
          signal: "Identity assigned · Unit 000128",
        },
        {
          number: "02",
          shortTitle: "Check",
          title: "Show a clear result",
          body: "The result distinguishes what was observed, what was declared and what remains unconfirmed.",
          person: "A short message explaining what was checked and where its limits are.",
          business: "A recorded reading and signals for anything that needs attention.",
          signal: "Check completed · Limits visible",
        },
        {
          number: "03",
          shortTitle: "Action",
          title: "Open the next step",
          body: "Information, support, warranty or benefits appear only when the rules allow them.",
          person: "A concrete action without installing an app or navigating technical menus.",
          business: "A direct post-sale channel connected to its systems and policies.",
          signal: "Next action · Approved information",
        },
      ],
      detail: "See evidence and limits",
    },
    roles: {
      eyebrow: "Value by role",
      title: "The platform, seen by every team.",
      body: "Brand, operations and customer each get a view designed for the decision they need to make.",
      scenarioLabel: "Simulated scenario · No customer data",
      items: [
        { role: "Brand", title: "Protect the relationship", body: "Connect every item with information, warranty and post-sale actions.", outcome: "Direct channel" },
        { role: "Operations", title: "Work with signals", body: "Review batches, reported events, replay and states that need attention.", outcome: "Traceable decisions" },
        { role: "Customer", title: "Understand and act", body: "See the result, declared information and next step without downloading an app.", outcome: "Less friction" },
      ],
      workspace: {
        portfolioTitle: "Connected products",
        portfolioItems: ["Agricultural batch 24A", "Pharmaceutical unit 000128", "Apparel series M-420"],
        activeLabel: "Active",
        configuredLabel: "Being configured",
        reviewLabel: "Review",
        signalsTitle: "Operational signals",
        signals: ["Recorded readings", "Queried batches", "Review required"],
        sequenceLabel: "Simulated sequence",
        activityLabel: "Illustrative activity",
        mapZoomIn: "Zoom in",
        mapZoomOut: "Zoom out",
        mapAttribution: "Show map information",
        customerTitle: "Product lookup",
        informationLabel: "Available information",
        nextActionLabel: "Next action",
        viewDetail: "View details",
      },
    },
    video: {
      eyebrow: "Visual walkthrough",
      title: "From a physical product to a useful experience.",
      body: "See how a reading connects identity, available evidence and the next action. This sequence illustrates the flow; every implementation depends on its data and controls.",
      play: "Start walkthrough",
      pause: "Pause walkthrough",
      replay: "Replay walkthrough",
      openDemo: "Explore Demo Lab",
      mediaLabel: "Illustrative scene of a product connected by nexID",
      boundary: "Illustrative sequence · No customer data",
    },
    evidence: {
      eyebrow: "Clarity builds trust",
      title: "Every result explains where it came from.",
      body: "nexID provides a useful answer without mixing a technical reading, organization-supplied data and proof that is still missing.",
      items: [
        { label: "Observed", title: "Message and policy", body: "SUN/SDM validation, freshness, replay and reported state when available." },
        { label: "Declared", title: "Product and journey", body: "Origin, batch, contents and events provided by the brand or its operators." },
        { label: "Unconfirmed", title: "Contents and physical custody", body: "Anything the reading cannot establish on its own stays clearly identified instead of being presented as certain." },
      ],
      sampleLabel: "Example reading",
      sampleTitle: "Unit 000128",
      sampleStatus: "Result available",
      sourceLabel: "Visible source",
      limitLabel: "Explicit limit",
      publicProof: "View public evidence",
      pilot: "Design a pilot",
    },
    footer: {
      eyebrow: "A pilot starts with a concrete case",
      title: "Choose one product, one objective and one signal to measure.",
      ctaBody: "We design the first journey with your team and define from day one which information is shown, which systems are connected and which outcome can be evaluated.",
      primary: "Talk to sales",
      secondary: "Explore demonstrations",
      body: "A product by Inmovar Latam SAS that connects products, operations and people with digital identity and evidence.",
      solutionBy: "A solution by Inmovar Latam SAS",
      platformLabel: "Platform",
      exploreLabel: "Explore",
      integrationLabel: "Integration",
      contactLabel: "Contact",
      howItWorks: "How it works",
      solutions: "Solutions by team",
      documentation: "Documentation",
      technology: "Technology",
      contact: "Talk to sales",
      audience: "Who it is for",
      demo: "Demo Lab",
      proof: "Proof Verify",
      developers: "Developers",
      pricing: "Pricing",
      fiscal: "Tax information",
      certificate: "MiPyME certificate",
      rights: "nexID · Inmovar Latam SAS. All rights reserved.",
    },
  },
  "pt-BR": {
    a11y: {
      skipToContent: "Ir para o conteúdo",
      footerNavigation: "Navegação do rodapé",
    },
    hero: {
      eyebrow: "Identidade digital para cada unidade",
      title: "Conecte cada produto às suas informações e ao próximo passo.",
      body:
        "A nexID vincula uma etiqueta inteligente ou um código às informações e evidências disponíveis. A pessoa consulta pelo navegador, enquanto sua empresa define o que mostrar e qual ação habilitar.",
      primary: "Ver como funciona",
      secondary: "Conversar sobre um piloto",
      evidence: "O que é verificado",
      sectorsLabel: "Uma plataforma. Diferentes indústrias.",
      rotationLabel: "Escolha um setor ou veja como a experiência se adapta.",
      pauseRotation: "Pausar rotação",
      resumeRotation: "Retomar rotação",
      capabilitiesLabel: "Pronta para integração",
      capabilities: ["Etiqueta inteligente ou código", "Consulta pelo navegador, sem instalar aplicativo", "Integração com sistemas existentes"],
      sectors: [
        {
          id: "agro",
          title: "Agro e insumos",
          body: "Lote, embalagem e uso responsável",
          image: "/images/nexid-v4/agro-enterprise.webp",
          alt: "Embalagem agrícola, bolsa de sementes e telefone conectados por uma identidade digital",
          visualKicker: "Agro e insumos",
          visualTitle: "Embalagem agrícola · Cenário de demonstração",
          visualStatus: "A mensagem passou pelos controles configurados",
          visualOrigin: "Dados declarados",
          visualOriginValue: "Produto, lote e mercado de destino",
          visualBoundary: "A leitura valida a mensagem e as regras configuradas; por si só, não comprova o conteúdo nem o objeto físico.",
        },
        {
          id: "pharma",
          title: "Farmacêutica e saúde",
          body: "Lote, validade e informação aprovada",
          image: "/images/nexid-v4/pharma-enterprise.webp",
          alt: "Frasco farmacêutico, embalagem e telefone conectados por uma identidade digital",
          visualKicker: "Farmacêutica e saúde",
          visualTitle: "Produto farmacêutico · Demonstração",
          visualStatus: "A identidade e a validade foram consultadas",
          visualOrigin: "Dados declarados",
          visualOriginValue: "Produto, lote, validade e informação aprovada",
          visualBoundary: "A leitura valida a mensagem e as regras configuradas; por si só, não comprova o conteúdo nem o objeto físico.",
        },
        {
          id: "wine",
          title: "Vinícolas de alto padrão",
          body: "Origem, lote e experiência pós-venda",
          image: "/images/nexid-v4/winery-enterprise.webp",
          alt: "Garrafa de vinho, estojo e telefone conectados por uma identidade digital",
          visualKicker: "Vinícolas de alto padrão",
          visualTitle: "Garrafa conectada · Demonstração",
          visualStatus: "A mensagem e a origem declarada foram consultadas",
          visualOrigin: "Dados declarados",
          visualOriginValue: "Produto, lote, origem e experiência disponível",
          visualBoundary: "A leitura valida a mensagem e as regras configuradas; por si só, não comprova o conteúdo, a origem física nem a custódia.",
        },
        {
          id: "premium",
          title: "Moda e bens duráveis",
          body: "Garantia, direitos e pós-venda",
          image: "/images/nexid-v4/fashion-enterprise.webp",
          alt: "Calçado de alta qualidade, etiqueta inteligente e telefone conectados a uma identidade digital",
          visualKicker: "Moda e bens duráveis",
          visualTitle: "Produto durável · Cenário de demonstração",
          visualStatus: "A identidade e as regras foram consultadas",
          visualOrigin: "Dados declarados",
          visualOriginValue: "Unidade, garantia e direitos digitais",
          visualBoundary: "A leitura valida a mensagem e as regras configuradas; por si só, não comprova autenticidade física nem cadeia de custódia.",
        },
      ],
    },
    flow: {
      eyebrow: "Como funciona na prática",
      title: "Uma leitura clara. Uma decisão útil.",
      body: "A mesma identidade acompanha o produto desde a configuração até a consulta e a próxima ação permitida.",
      personLabel: "O que a pessoa vê",
      businessLabel: "O que a empresa obtém",
      sampleLabel: "Exemplo ilustrativo · Sem dados de cliente",
      steps: [
        {
          number: "01",
          shortTitle: "Produto",
          title: "Prepare o produto",
          body: "Vincule uma unidade ou lote às informações autorizadas pela sua organização.",
          person: "O produto recebe uma etiqueta inteligente ou um código pronto para consulta.",
          business: "Uma referência organizada para administrar informações, lotes e experiências.",
          signal: "Identidade atribuída · Unidade 000128",
        },
        {
          number: "02",
          shortTitle: "Consulta",
          title: "Mostre um resultado compreensível",
          body: "A consulta separa o que foi observado, o que foi declarado e o que ainda não pode ser confirmado.",
          person: "Uma mensagem breve que explica o que foi consultado e quais são seus limites.",
          business: "Uma leitura registrada e sinais para revisar quando algo exige atenção.",
          signal: "Consulta aceita · Limites visíveis",
        },
        {
          number: "03",
          shortTitle: "Ação",
          title: "Abra o próximo passo",
          body: "Informação, suporte, garantia ou benefícios aparecem somente quando as regras permitem.",
          person: "Uma ação concreta, sem instalar um aplicativo nem navegar por menus técnicos.",
          business: "Um canal direto após a venda, conectado aos seus sistemas e políticas.",
          signal: "Próxima ação · Informação aprovada",
        },
      ],
      detail: "Ver evidência e limites",
    },
    roles: {
      eyebrow: "Valor por função",
      title: "A plataforma, vista por cada equipe.",
      body: "Marca, operações e cliente acessam uma visão preparada para a decisão que precisam tomar.",
      scenarioLabel: "Cenário ilustrativo · Sem dados de cliente",
      items: [
        { role: "Marca", title: "Proteja a relação", body: "Conecte cada unidade a informações, garantia e ações posteriores à venda.", outcome: "Canal direto" },
        { role: "Operações", title: "Trabalhe com sinais", body: "Revise lotes, eventos informados, leituras repetidas e estados que exigem atenção.", outcome: "Decisões rastreáveis" },
        { role: "Cliente", title: "Entenda e aja", body: "Consulte o resultado, as informações declaradas e o próximo passo sem instalar nada.", outcome: "Menos atrito" },
      ],
      workspace: {
        portfolioTitle: "Produtos conectados",
        portfolioItems: ["Lote agrícola 24A", "Unidade farmacêutica 000128", "Série de vestuário M-420"],
        activeLabel: "Ativo",
        configuredLabel: "Em configuração",
        reviewLabel: "Revisar",
        signalsTitle: "Sinais operacionais",
        signals: ["Leituras registradas", "Lotes consultados", "Revisão necessária"],
        sequenceLabel: "Sequência simulada",
        activityLabel: "Atividade ilustrativa",
        mapZoomIn: "Aproximar mapa",
        mapZoomOut: "Afastar mapa",
        mapAttribution: "Mostrar informações do mapa",
        customerTitle: "Consulta do produto",
        informationLabel: "Informações disponíveis",
        nextActionLabel: "Próxima ação",
        viewDetail: "Ver detalhes",
      },
    },
    video: {
      eyebrow: "Percurso visual",
      title: "Do produto físico a uma experiência útil.",
      body: "Veja como uma leitura conecta identidade, evidência disponível e a próxima ação. A sequência ilustra o fluxo; cada implementação depende de seus dados e controles.",
      play: "Iniciar percurso",
      pause: "Pausar percurso",
      replay: "Repetir percurso",
      openDemo: "Explorar demonstrações",
      mediaLabel: "Cena ilustrativa de um produto conectado pela nexID",
      boundary: "Sequência ilustrativa · Sem dados de cliente",
    },
    evidence: {
      eyebrow: "Clareza que gera confiança",
      title: "Cada resultado explica de onde veio.",
      body: "A nexID apresenta uma resposta útil sem misturar uma leitura técnica, dados fornecidos pela organização e provas que ainda faltam.",
      items: [
        { label: "Observado", title: "Mensagem e regras", body: "Validade da mensagem, vigência, leituras repetidas e estado informado quando disponível." },
        { label: "Declarado", title: "Produto e percurso", body: "Origem, lote, conteúdo e eventos fornecidos pela marca ou por seus operadores." },
        { label: "A confirmar", title: "Conteúdo e custódia física", body: "O que a leitura não pode comprovar por si só permanece indicado, sem transformar uma suposição em certeza." },
      ],
      sampleLabel: "Leitura de exemplo",
      sampleTitle: "Unidade 000128",
      sampleStatus: "Resultado disponível",
      sourceLabel: "Fonte visível",
      limitLabel: "Limite explícito",
      publicProof: "Ver evidência pública",
      pilot: "Desenhar um piloto",
    },
    footer: {
      eyebrow: "Um piloto começa por um caso concreto",
      title: "Escolha um produto, um objetivo e um sinal para medir.",
      ctaBody: "Desenhamos o percurso inicial com sua equipe e definimos desde o começo quais informações serão exibidas, quais sistemas serão integrados e qual resultado poderá ser avaliado.",
      primary: "Falar com vendas",
      secondary: "Explorar demonstrações",
      body: "Um produto da Inmovar Latam SAS para conectar produtos, operações e pessoas com identidade e evidência digital.",
      solutionBy: "Uma solução da Inmovar Latam SAS",
      platformLabel: "Plataforma",
      exploreLabel: "Explorar",
      integrationLabel: "Integração",
      contactLabel: "Contato",
      howItWorks: "Como funciona",
      solutions: "Soluções por equipe",
      documentation: "Documentação",
      technology: "Tecnologia",
      contact: "Falar com vendas",
      audience: "Para quem é",
      demo: "Demonstrações",
      proof: "Verificador público",
      developers: "Desenvolvedores",
      pricing: "Planos",
      fiscal: "Informações fiscais",
      certificate: "Certificado MiPyME",
      rights: "nexID · Inmovar Latam SAS. Todos os direitos reservados.",
    },
  },
};
