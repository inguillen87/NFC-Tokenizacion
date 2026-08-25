import type { AppLocale } from "@product/config";

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
    visualKicker: string;
    visualTitle: string;
    visualStatus: string;
    visualOrigin: string;
    visualOriginValue: string;
    visualBoundary: string;
    visualAlt: string;
    sectorsLabel: string;
    sectors: Array<{ title: string; body: string }>;
  };
  flow: {
    eyebrow: string;
    title: string;
    body: string;
    steps: Array<{ number: string; title: string; body: string }>;
    detail: string;
  };
  roles: {
    eyebrow: string;
    title: string;
    body: string;
    items: Array<{ role: string; title: string; body: string; outcome: string }>;
  };
  caseStudy: {
    eyebrow: string;
    title: string;
    body: string;
    demoLabel: string;
    screenKicker: string;
    screenTitle: string;
    accepted: string;
    acceptedNote: string;
    declaredLabel: string;
    declaredValue: string;
    nextLabel: string;
    nextValue: string;
    journeyLabel: string;
    journey: Array<{ step: string; title: string; body: string }>;
    cta: string;
  };
  evidence: {
    eyebrow: string;
    title: string;
    body: string;
    items: Array<{ label: string; title: string; body: string }>;
    publicProof: string;
    pilot: string;
  };
  footer: {
    body: string;
    product: string;
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
      eyebrow: "Identidad digital para productos físicos",
      title: "Cada producto, una identidad clara.",
      body:
        "nexID conecta cada envase o unidad con NFC seguro o QR para mostrar datos declarados, evidencia digital y el próximo paso. Todo desde el navegador.",
      primary: "Ver cómo funciona",
      secondary: "Hablar de un piloto",
      evidence: "Qué verifica exactamente",
      visualKicker: "Lectura de producto",
      visualTitle: "Lote de semillas · Demo",
      visualStatus: "La lectura pasó los controles configurados",
      visualOrigin: "Datos declarados",
      visualOriginValue: "Producto, lote y mercado de destino",
      visualBoundary: "La lectura no confirma por sí sola el contenido, la calidad, el origen físico ni la custodia.",
      visualAlt: "Semillas cayendo desde un sobre hacia las manos, como contexto visual del caso agro de nexID",
      sectorsLabel: "Una plataforma. Distintas industrias.",
      sectors: [
        { title: "Agro, semillas e insumos", body: "Lote, envase y uso responsable" },
        { title: "Alimentos y bebidas", body: "Origen declarado, campaña y postventa" },
        { title: "Farma y salud", body: "Unidad, lote y recall" },
        { title: "Lujo y bienes durables", body: "Garantía, derechos y reventa" },
      ],
    },
    flow: {
      eyebrow: "Un flujo, tres momentos",
      title: "Conectá. Verificá. Activá.",
      body: "La tecnología aparece cuando aporta evidencia. La experiencia empieza por lo que la persona necesita hacer.",
      steps: [
        { number: "01", title: "Conectá el producto", body: "Asigná una identidad por unidad y vinculá NFC o QR con los datos autorizados por la marca." },
        { number: "02", title: "Mostrá la evidencia", body: "Cada tap o scan devuelve un resultado comprensible, con sus límites y señales de riesgo." },
        { number: "03", title: "Activá el siguiente paso", body: "Garantía, contenido, beneficios, loyalty u ownership se habilitan según política." },
      ],
      detail: "Ver evidencia y límites",
    },
    roles: {
      eyebrow: "Valor por rol",
      title: "Una identidad. Tres resultados claros.",
      body: "La misma infraestructura se adapta a la tarea de cada persona sin mezclar todos los conceptos en una pantalla.",
      items: [
        { role: "Marca", title: "Protegé la relación", body: "Conectá cada unidad con información, garantía y acciones posteriores a la venta.", outcome: "Canal directo" },
        { role: "Operaciones", title: "Trabajá con señales", body: "Revisá lotes, eventos reportados, replay y estados que requieren atención.", outcome: "Decisiones trazables" },
        { role: "Cliente", title: "Entendé y actuá", body: "Consultá el resultado, la información declarada y el próximo paso sin descargar una app.", outcome: "Menos fricción" },
      ],
    },
    caseStudy: {
      eyebrow: "Caso guiado · Agro",
      title: "Del envase al próximo paso.",
      body: "Este escenario simulado sigue un lote de semillas desde su identidad digital hasta una consulta en campo. Distingue la lectura observada, los datos declarados y la acción permitida.",
      demoLabel: "Escenario simulado · Sin datos de cliente",
      screenKicker: "nexID · Agro",
      screenTitle: "Lote de semillas",
      accepted: "Lectura aceptada",
      acceptedNote: "El identificador y la política superaron los controles configurados en esta demo.",
      declaredLabel: "Datos declarados",
      declaredValue: "Variedad, lote y mercado · Datos simulados",
      nextLabel: "Siguiente acción",
      nextValue: "Consultar ficha aprobada o pedir soporte técnico",
      journeyLabel: "Lo que la demo hace visible",
      journey: [
        { step: "01", title: "Identidad del envase", body: "Código o tag asociado al lote configurado." },
        { step: "02", title: "Datos declarados", body: "Producto, mercado e información aprobada por la empresa." },
        { step: "03", title: "Lectura observada", body: "Resultado y próxima acción disponible para esa consulta." },
      ],
      cta: "Abrir la demo agro",
    },
    evidence: {
      eyebrow: "Claridad que da confianza",
      title: "Lo verificado, lo declarado y lo que aún no se sabe.",
      body: "nexID separa cada capa para que una experiencia simple siga siendo técnicamente honesta.",
      items: [
        { label: "Observado", title: "Mensaje y política", body: "Validación SUN/SDM, freshness, replay y estado reportado cuando corresponda." },
        { label: "Declarado", title: "Producto y recorrido", body: "Origen, lote, contenido y eventos aportados por la marca o sus operadores." },
        { label: "Opcional", title: "Prueba y derechos", body: "Anclajes, certificados u ownership digital sólo cuando el caso y la evidencia lo justifican." },
      ],
      publicProof: "Ver evidencia pública",
      pilot: "Diseñar un piloto",
    },
    footer: {
      body: "Identidad y evidencia digital para conectar productos, operaciones y personas.",
      product: "Producto",
      demo: "Demo Lab",
      proof: "Proof Verify",
      developers: "Developers",
      pricing: "Planes",
      fiscal: "Información fiscal",
      certificate: "Certificado MiPyME",
      rights: "nexID · Intellitech. Todos los derechos reservados.",
    },
  },
  en: {
    a11y: {
      skipToContent: "Skip to content",
      footerNavigation: "Footer navigation",
    },
    hero: {
      eyebrow: "Digital identity for physical products",
      title: "A clear identity for every product.",
      body:
        "nexID connects every package or item with secure NFC or QR to show declared data, digital evidence and the next step. All in the browser.",
      primary: "See how it works",
      secondary: "Discuss a pilot",
      evidence: "What it verifies",
      visualKicker: "Product reading",
      visualTitle: "Seed batch · Demo",
      visualStatus: "The reading passed the configured checks",
      visualOrigin: "Declared data",
      visualOriginValue: "Product, batch and destination market",
      visualBoundary: "A reading alone does not confirm contents, quality, physical origin or custody.",
      visualAlt: "Seeds falling from a packet into a person's hands as visual context for the nexID agriculture case",
      sectorsLabel: "One platform. Different industries.",
      sectors: [
        { title: "Agriculture, seeds and inputs", body: "Batch, package and responsible use" },
        { title: "Food and beverages", body: "Declared origin, campaign and after-sales" },
        { title: "Pharma and health", body: "Item, batch and recall" },
        { title: "Luxury and durable goods", body: "Warranty, rights and resale" },
      ],
    },
    flow: {
      eyebrow: "One flow, three moments",
      title: "Connect. Verify. Activate.",
      body: "Technology appears when it adds evidence. The experience starts with what the person needs to do.",
      steps: [
        { number: "01", title: "Connect the product", body: "Assign an item identity and link NFC or QR to the information authorized by the brand." },
        { number: "02", title: "Show the evidence", body: "Each tap or scan returns a clear result, its limits and relevant risk signals." },
        { number: "03", title: "Enable the next step", body: "Warranty, content, benefits, loyalty or ownership become available under policy." },
      ],
      detail: "See evidence and limits",
    },
    roles: {
      eyebrow: "Value by role",
      title: "One identity. Three clear outcomes.",
      body: "The same infrastructure adapts to each person's task without mixing every concept on one screen.",
      items: [
        { role: "Brand", title: "Protect the relationship", body: "Connect every item with information, warranty and post-sale actions.", outcome: "Direct channel" },
        { role: "Operations", title: "Work with signals", body: "Review batches, reported events, replay and states that need attention.", outcome: "Traceable decisions" },
        { role: "Customer", title: "Understand and act", body: "See the result, declared information and next step without downloading an app.", outcome: "Less friction" },
      ],
    },
    caseStudy: {
      eyebrow: "Guided case · Agriculture",
      title: "From the package to the next step.",
      body: "This simulated scenario follows a seed batch from its digital identity to a field query. It separates the observed reading, declared data and permitted action.",
      demoLabel: "Simulated scenario · No customer data",
      screenKicker: "nexID · Agriculture",
      screenTitle: "Seed batch",
      accepted: "Reading accepted",
      acceptedNote: "The identifier and policy passed the checks configured for this demo.",
      declaredLabel: "Declared data",
      declaredValue: "Variety, batch and market · Simulated data",
      nextLabel: "Next action",
      nextValue: "View approved information or request technical support",
      journeyLabel: "What the demo makes visible",
      journey: [
        { step: "01", title: "Package identity", body: "Code or tag associated with the configured batch." },
        { step: "02", title: "Declared data", body: "Product, market and information approved by the company." },
        { step: "03", title: "Observed reading", body: "Result and next action available for that query." },
      ],
      cta: "Open the agriculture demo",
    },
    evidence: {
      eyebrow: "Clarity builds trust",
      title: "What is verified, what is declared and what is still unknown.",
      body: "nexID separates each layer so a simple experience remains technically honest.",
      items: [
        { label: "Observed", title: "Message and policy", body: "SUN/SDM validation, freshness, replay and reported state when available." },
        { label: "Declared", title: "Product and journey", body: "Origin, batch, contents and events provided by the brand or its operators." },
        { label: "Optional", title: "Proof and rights", body: "Anchors, certificates or digital ownership only when the case and evidence justify them." },
      ],
      publicProof: "View public evidence",
      pilot: "Design a pilot",
    },
    footer: {
      body: "Digital identity and evidence that connect products, operations and people.",
      product: "Product",
      demo: "Demo Lab",
      proof: "Proof Verify",
      developers: "Developers",
      pricing: "Pricing",
      fiscal: "Tax information",
      certificate: "MiPyME certificate",
      rights: "nexID · Intellitech. All rights reserved.",
    },
  },
  "pt-BR": {
    a11y: {
      skipToContent: "Ir para o conteúdo",
      footerNavigation: "Navegação do rodapé",
    },
    hero: {
      eyebrow: "Identidade digital para produtos físicos",
      title: "Uma identidade clara para cada produto.",
      body:
        "A nexID conecta cada embalagem ou unidade com NFC seguro ou QR para mostrar dados declarados, evidência digital e o próximo passo. Tudo pelo navegador.",
      primary: "Ver como funciona",
      secondary: "Conversar sobre um piloto",
      evidence: "O que é verificado",
      visualKicker: "Leitura do produto",
      visualTitle: "Lote de sementes · Demo",
      visualStatus: "A leitura passou pelos controles configurados",
      visualOrigin: "Dados declarados",
      visualOriginValue: "Produto, lote e mercado de destino",
      visualBoundary: "A leitura, isoladamente, não confirma conteúdo, qualidade, origem física ou custódia.",
      visualAlt: "Sementes caindo de um pacote nas mãos de uma pessoa como contexto visual do caso agrícola da nexID",
      sectorsLabel: "Uma plataforma. Diferentes indústrias.",
      sectors: [
        { title: "Agro, sementes e insumos", body: "Lote, embalagem e uso responsável" },
        { title: "Alimentos e bebidas", body: "Origem declarada, campanha e pós-venda" },
        { title: "Farma e saúde", body: "Unidade, lote e recall" },
        { title: "Luxo e bens duráveis", body: "Garantia, direitos e revenda" },
      ],
    },
    flow: {
      eyebrow: "Um fluxo, três momentos",
      title: "Conecte. Verifique. Ative.",
      body: "A tecnologia aparece quando agrega evidência. A experiência começa pelo que a pessoa precisa fazer.",
      steps: [
        { number: "01", title: "Conecte o produto", body: "Atribua uma identidade por unidade e vincule NFC ou QR aos dados autorizados pela marca." },
        { number: "02", title: "Mostre a evidência", body: "Cada tap ou scan devolve um resultado claro, seus limites e sinais de risco relevantes." },
        { number: "03", title: "Ative o próximo passo", body: "Garantia, conteúdo, benefícios, loyalty ou ownership são habilitados conforme a política." },
      ],
      detail: "Ver evidência e limites",
    },
    roles: {
      eyebrow: "Valor por função",
      title: "Uma identidade. Três resultados claros.",
      body: "A mesma infraestrutura se adapta à tarefa de cada pessoa sem misturar todos os conceitos em uma tela.",
      items: [
        { role: "Marca", title: "Proteja a relação", body: "Conecte cada unidade a informações, garantia e ações posteriores à venda.", outcome: "Canal direto" },
        { role: "Operações", title: "Trabalhe com sinais", body: "Revise lotes, eventos reportados, replay e estados que exigem atenção.", outcome: "Decisões rastreáveis" },
        { role: "Cliente", title: "Entenda e aja", body: "Consulte o resultado, as informações declaradas e o próximo passo sem baixar um app.", outcome: "Menos atrito" },
      ],
    },
    caseStudy: {
      eyebrow: "Caso guiado · Agro",
      title: "Da embalagem ao próximo passo.",
      body: "Este cenário simulado acompanha um lote de sementes desde sua identidade digital até uma consulta em campo. Separa a leitura observada, os dados declarados e a ação permitida.",
      demoLabel: "Cenário simulado · Sem dados de cliente",
      screenKicker: "nexID · Agro",
      screenTitle: "Lote de sementes",
      accepted: "Leitura aceita",
      acceptedNote: "O identificador e a política passaram pelos controles configurados nesta demo.",
      declaredLabel: "Dados declarados",
      declaredValue: "Variedade, lote e mercado · Dados simulados",
      nextLabel: "Próxima ação",
      nextValue: "Consultar informação aprovada ou pedir suporte técnico",
      journeyLabel: "O que a demo torna visível",
      journey: [
        { step: "01", title: "Identidade da embalagem", body: "Código ou tag associado ao lote configurado." },
        { step: "02", title: "Dados declarados", body: "Produto, mercado e informação aprovada pela empresa." },
        { step: "03", title: "Leitura observada", body: "Resultado e próxima ação disponível para essa consulta." },
      ],
      cta: "Abrir a demo agro",
    },
    evidence: {
      eyebrow: "Clareza que gera confiança",
      title: "O que foi verificado, o que foi declarado e o que ainda não se sabe.",
      body: "A nexID separa cada camada para que uma experiência simples continue tecnicamente honesta.",
      items: [
        { label: "Observado", title: "Mensagem e política", body: "Validação SUN/SDM, freshness, replay e estado reportado quando disponível." },
        { label: "Declarado", title: "Produto e percurso", body: "Origem, lote, conteúdo e eventos fornecidos pela marca ou por seus operadores." },
        { label: "Opcional", title: "Prova e direitos", body: "Âncoras, certificados ou ownership digital somente quando o caso e a evidência justificam." },
      ],
      publicProof: "Ver evidência pública",
      pilot: "Desenhar um piloto",
    },
    footer: {
      body: "Identidade e evidência digital para conectar produtos, operações e pessoas.",
      product: "Produto",
      demo: "Demo Lab",
      proof: "Proof Verify",
      developers: "Developers",
      pricing: "Planos",
      fiscal: "Informações fiscais",
      certificate: "Certificado MiPyME",
      rights: "nexID · Intellitech. Todos os direitos reservados.",
    },
  },
};
