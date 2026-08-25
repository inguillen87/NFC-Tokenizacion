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
    imageAlt: string;
    screenKicker: string;
    screenTitle: string;
    accepted: string;
    acceptedNote: string;
    declaredLabel: string;
    declaredValue: string;
    nextLabel: string;
    nextValue: string;
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
      title: "Cada producto puede demostrar más y activar una relación útil.",
      body:
        "nexID conecta NFC seguro o QR con evidencia digital, información declarada, garantía y postventa. El comprador accede desde el navegador, sin instalar una app.",
      primary: "Ver cómo funciona",
      secondary: "Hablar de un piloto",
      evidence: "Qué verifica exactamente",
      visualKicker: "Experiencia posterior al tap",
      visualTitle: "Gran Reserva · Demo",
      visualStatus: "El mensaje NFC pasó los controles configurados",
      visualOrigin: "Información del producto",
      visualOriginValue: "Origen y lote declarados por la marca",
      visualBoundary: "El tap no confirma por sí solo el contenido, el origen físico ni la custodia.",
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
      eyebrow: "Caso guiado",
      title: "Un producto, de punta a punta.",
      body: "La demo muestra una botella conectada y separa con claridad el mensaje observado, los datos declarados y la acción disponible.",
      demoLabel: "Escenario simulado",
      imageAlt: "Botella de vino usada como ejemplo visual de la demo nexID",
      screenKicker: "nexID · Wine Secure",
      screenTitle: "Gran Reserva Malbec",
      accepted: "Mensaje NFC aceptado",
      acceptedNote: "Controles criptográficos y de política superados en este escenario de demo.",
      declaredLabel: "Datos declarados",
      declaredValue: "Mendoza, Argentina · Lote de demostración",
      nextLabel: "Siguiente acción",
      nextValue: "Consultar historia o registrar garantía",
      cta: "Probar la demo guiada",
    },
    evidence: {
      eyebrow: "Confianza sin atajos",
      title: "Claridad comercial sin ocultar los límites técnicos.",
      body: "nexID distingue lo observado por el sistema, lo declarado por cada actor y las pruebas opcionales. Así, una experiencia simple no se convierte en un claim exagerado.",
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
      title: "Every product can show more and enable a useful relationship.",
      body:
        "nexID connects secure NFC or QR with digital evidence, declared product information, warranty and after-sales journeys. Buyers use it in the browser, with no app to install.",
      primary: "See how it works",
      secondary: "Discuss a pilot",
      evidence: "What it verifies",
      visualKicker: "Post-tap experience",
      visualTitle: "Gran Reserva · Demo",
      visualStatus: "The NFC message passed the configured checks",
      visualOrigin: "Product information",
      visualOriginValue: "Origin and batch declared by the brand",
      visualBoundary: "A tap alone does not confirm contents, physical origin or custody.",
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
      eyebrow: "Guided case",
      title: "One product, end to end.",
      body: "The demo follows a connected bottle and clearly separates the observed message, declared data and available action.",
      demoLabel: "Simulated scenario",
      imageAlt: "Wine bottle used as a visual example in the nexID demo",
      screenKicker: "nexID · Wine Secure",
      screenTitle: "Gran Reserva Malbec",
      accepted: "NFC message accepted",
      acceptedNote: "Cryptographic and policy checks passed in this demo scenario.",
      declaredLabel: "Declared data",
      declaredValue: "Mendoza, Argentina · Demo batch",
      nextLabel: "Next action",
      nextValue: "View the story or register a warranty",
      cta: "Try the guided demo",
    },
    evidence: {
      eyebrow: "Trust without shortcuts",
      title: "Commercial clarity without hiding technical boundaries.",
      body: "nexID separates what the system observes, what each actor declares and which optional proofs exist. A simple experience never needs an inflated claim.",
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
      title: "Cada produto pode demonstrar mais e ativar uma relação útil.",
      body:
        "A nexID conecta NFC seguro ou QR com evidência digital, informações declaradas, garantia e pós-venda. O comprador acessa tudo pelo navegador, sem instalar um aplicativo.",
      primary: "Ver como funciona",
      secondary: "Conversar sobre um piloto",
      evidence: "O que é verificado",
      visualKicker: "Experiência após o tap",
      visualTitle: "Gran Reserva · Demo",
      visualStatus: "A mensagem NFC passou pelos controles configurados",
      visualOrigin: "Informações do produto",
      visualOriginValue: "Origem e lote declarados pela marca",
      visualBoundary: "O tap, isoladamente, não confirma conteúdo, origem física ou custódia.",
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
      eyebrow: "Caso guiado",
      title: "Um produto, de ponta a ponta.",
      body: "A demo mostra uma garrafa conectada e separa claramente a mensagem observada, os dados declarados e a ação disponível.",
      demoLabel: "Cenário simulado",
      imageAlt: "Garrafa de vinho usada como exemplo visual na demo da nexID",
      screenKicker: "nexID · Wine Secure",
      screenTitle: "Gran Reserva Malbec",
      accepted: "Mensagem NFC aceita",
      acceptedNote: "Controles criptográficos e de política aprovados neste cenário de demo.",
      declaredLabel: "Dados declarados",
      declaredValue: "Mendoza, Argentina · Lote de demonstração",
      nextLabel: "Próxima ação",
      nextValue: "Consultar a história ou registrar a garantia",
      cta: "Testar a demo guiada",
    },
    evidence: {
      eyebrow: "Confiança sem atalhos",
      title: "Clareza comercial sem esconder os limites técnicos.",
      body: "A nexID separa o que o sistema observa, o que cada ator declara e quais provas opcionais existem. Uma experiência simples não precisa de um claim exagerado.",
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
