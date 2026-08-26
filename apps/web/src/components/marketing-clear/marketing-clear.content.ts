import type { AppLocale } from "@product/config";
import { INDUSTRY_SLUGS, SOLUTION_SLUGS } from "../../lib/marketing-route-slugs";

export { INDUSTRY_SLUGS, SOLUTION_SLUGS } from "../../lib/marketing-route-slugs";

type Localized = Record<AppLocale, string>;

const localized = (es: string, en: string, pt: string): Localized => ({
  "es-AR": es,
  en,
  "pt-BR": pt,
});

const pick = (value: Localized, locale: AppLocale) => value[locale];

export type MarketingNavItem = {
  label: string;
  description: string;
  href: string;
  badge?: string;
  external?: boolean;
};

export type MarketingNavGroup = {
  id: "solutions" | "industries" | "platform" | "resources";
  label: string;
  eyebrow: string;
  description: string;
  items: MarketingNavItem[];
  featured: MarketingNavItem;
};

type CatalogSource = {
  slug: string;
  title: Localized;
  short: Localized;
  eyebrow: Localized;
  headline: Localized;
  intro: Localized;
  outcome: Localized;
  points: [Localized, Localized, Localized];
  steps: [Localized, Localized, Localized];
  boundary: Localized;
  demoHref: string;
  image?: string;
};

export type MarketingCatalogEntry = {
  slug: string;
  title: string;
  short: string;
  eyebrow: string;
  headline: string;
  intro: string;
  outcome: string;
  points: [string, string, string];
  steps: [string, string, string];
  boundary: string;
  demoHref: string;
  image?: string;
};

const solutionSources: CatalogSource[] = [
  {
    slug: "product-identity",
    title: localized("Identidad de producto", "Product identity", "Identidade do produto"),
    short: localized(
      "Conectá cada unidad con información y controles definidos por la marca.",
      "Connect each unit to information and controls defined by the brand.",
      "Conecte cada unidade a informações e controles definidos pela marca.",
    ),
    eyebrow: localized("Solución", "Solution", "Solução"),
    headline: localized(
      "Una identidad digital clara para cada producto conectado.",
      "A clear digital identity for every connected product.",
      "Uma identidade digital clara para cada produto conectado.",
    ),
    intro: localized(
      "Reuní el producto, el lote, la evidencia disponible y las próximas acciones en una experiencia simple para clientes y equipos.",
      "Bring product, batch, available evidence and next actions into one simple experience for customers and teams.",
      "Reúna produto, lote, evidências disponíveis e próximas ações em uma experiência simples para clientes e equipes.",
    ),
    outcome: localized("Menos dudas después de cada toque o scan.", "Less uncertainty after every tap or scan.", "Menos dúvidas após cada toque ou scan."),
    points: [
      localized("Identidad y datos declarados en un solo lugar.", "Identity and declared data in one place.", "Identidade e dados declarados em um só lugar."),
      localized("Lectura NFC o QR sin obligar al comprador a instalar una app.", "NFC or QR access without forcing buyers to install an app.", "Acesso NFC ou QR sem exigir que o comprador instale um app."),
      localized("Acciones habilitadas según la política de cada programa.", "Actions enabled according to each program policy.", "Ações habilitadas conforme a política de cada programa."),
    ],
    steps: [
      localized("Crear la identidad y asociarla al lote.", "Create the identity and associate it with a batch.", "Criar a identidade e associá-la ao lote."),
      localized("Vincular el carrier NFC o QR elegido.", "Link the selected NFC or QR carrier.", "Vincular o carrier NFC ou QR escolhido."),
      localized("Definir qué ve y qué puede hacer cada audiencia.", "Define what each audience can see and do.", "Definir o que cada público pode ver e fazer."),
    ],
    boundary: localized(
      "La identidad digital organiza evidencia y datos del programa; no demuestra por sí sola la autenticidad ni el contenido del objeto físico.",
      "Digital identity organizes program evidence and data; it does not by itself prove the physical object's authenticity or contents.",
      "A identidade digital organiza evidências e dados do programa; sozinha, não comprova a autenticidade nem o conteúdo do objeto físico.",
    ),
    demoHref: "/demo-lab?scenario=nfc-424",
  },
  {
    slug: "traceability",
    title: localized("Trazabilidad", "Traceability", "Rastreabilidade"),
    short: localized("Ordená los eventos reportados y el recorrido declarado del producto.", "Organize reported events and the product's declared journey.", "Organize eventos reportados e o percurso declarado do produto."),
    eyebrow: localized("Solución", "Solution", "Solução"),
    headline: localized("Del lote a la última interacción, sin perder el contexto.", "From batch to last interaction, without losing context.", "Do lote à última interação, sem perder o contexto."),
    intro: localized(
      "Consolidá eventos de planta, logística, distribución y cliente con su fuente identificada, para investigar, auditar y decidir con más orden.",
      "Consolidate plant, logistics, distribution and customer events with identified sources, so teams can investigate, audit and decide with more clarity.",
      "Consolide eventos de planta, logística, distribuição e cliente com fontes identificadas para investigar, auditar e decidir com mais clareza.",
    ),
    outcome: localized("Una historia operativa más legible y auditable.", "A more legible and auditable operating history.", "Uma história operacional mais legível e auditável."),
    points: [
      localized("Eventos reportados con fecha, fuente y contexto.", "Reported events with date, source and context.", "Eventos reportados com data, fonte e contexto."),
      localized("Vista por unidad, lote, ubicación informada o canal.", "Views by unit, batch, reported location or channel.", "Visões por unidade, lote, localização informada ou canal."),
      localized("Señales para revisar duplicados, desvíos y excepciones.", "Signals to review duplicates, deviations and exceptions.", "Sinais para revisar duplicatas, desvios e exceções."),
    ],
    steps: [
      localized("Definir el modelo de eventos y sus fuentes.", "Define the event model and its sources.", "Definir o modelo de eventos e suas fontes."),
      localized("Capturar y normalizar los hitos relevantes.", "Capture and normalize relevant milestones.", "Capturar e normalizar os marcos relevantes."),
      localized("Separar lo declarado, lo observado y lo verificado.", "Separate declared, observed and verified information.", "Separar o declarado, o observado e o verificado."),
    ],
    boundary: localized(
      "Un mapa de eventos reportados no prueba automáticamente custodia física continua, origen material ni presencia real del producto.",
      "A map of reported events does not automatically prove continuous physical custody, material origin or the product's real-world presence.",
      "Um mapa de eventos reportados não comprova automaticamente custódia física contínua, origem material ou presença real do produto.",
    ),
    demoHref: "/demo-lab?scenario=dual-proof",
  },
  {
    slug: "digital-passport",
    title: localized("Pasaporte digital", "Digital passport", "Passaporte digital"),
    short: localized("Mostrá la historia, el estado y los servicios del producto en una sola vista.", "Show product story, status and services in one view.", "Mostre história, estado e serviços do produto em uma única visão."),
    eyebrow: localized("Solución", "Solution", "Solução"),
    headline: localized("El lugar donde producto, información y postventa se encuentran.", "Where product, information and after-sales come together.", "Onde produto, informação e pós-venda se encontram."),
    intro: localized(
      "Creá una experiencia viva que acompañe al producto después de la venta: datos relevantes, instrucciones, garantía, beneficios y cambios de estado bajo política.",
      "Create a living experience that follows the product after the sale: relevant data, instructions, warranty, benefits and policy-controlled status changes.",
      "Crie uma experiência viva que acompanhe o produto depois da venda: dados relevantes, instruções, garantia, benefícios e mudanças de estado sob política.",
    ),
    outcome: localized("Más utilidad durante todo el ciclo de vida.", "More utility throughout the lifecycle.", "Mais utilidade durante todo o ciclo de vida."),
    points: [
      localized("Información configurable por producto, país y audiencia.", "Information configurable by product, country and audience.", "Informações configuráveis por produto, país e público."),
      localized("Garantía, cuidado, reparación, beneficios y recompra.", "Warranty, care, repair, benefits and repurchase.", "Garantia, cuidado, reparo, benefícios e recompra."),
      localized("Historial y cambios de estado con permisos definidos.", "History and status changes with defined permissions.", "Histórico e mudanças de estado com permissões definidas."),
    ],
    steps: [
      localized("Elegir la información útil para cada momento.", "Choose the useful information for each moment.", "Escolher as informações úteis para cada momento."),
      localized("Diseñar acciones y permisos por audiencia.", "Design actions and permissions by audience.", "Desenhar ações e permissões por público."),
      localized("Medir adopción y mejorar la experiencia.", "Measure adoption and improve the experience.", "Medir adoção e melhorar a experiência."),
    ],
    boundary: localized(
      "El pasaporte muestra datos y estados provenientes de fuentes identificadas; la calidad de cada dato depende de su fuente y control.",
      "The passport displays data and states from identified sources; the quality of each field depends on its source and control.",
      "O passaporte exibe dados e estados de fontes identificadas; a qualidade de cada campo depende de sua fonte e controle.",
    ),
    demoHref: "/login?next=/me/passport",
  },
  {
    slug: "customer-experience",
    title: localized("Experiencia y fidelización", "Experience and loyalty", "Experiência e fidelização"),
    short: localized("Convertí interacciones elegibles en postventa, comunidad y beneficios.", "Turn eligible interactions into after-sales, community and benefits.", "Transforme interações elegíveis em pós-venda, comunidade e benefícios."),
    eyebrow: localized("Solución", "Solution", "Solução"),
    headline: localized("Que el vínculo con el cliente empiece, no termine, con la compra.", "Let the customer relationship begin, not end, with the purchase.", "Faça o relacionamento com o cliente começar, e não terminar, na compra."),
    intro: localized(
      "Usá la identidad del producto como puerta de entrada a servicios relevantes, siempre con consentimiento, reglas claras y medición por piloto.",
      "Use product identity as the entry point to relevant services, always with consent, clear rules and pilot-based measurement.",
      "Use a identidade do produto como porta de entrada para serviços relevantes, sempre com consentimento, regras claras e medição por piloto.",
    ),
    outcome: localized("Una relación medible después de la venta.", "A measurable relationship after the sale.", "Um relacionamento mensurável depois da venda."),
    points: [
      localized("Garantía, registro, contenido y soporte contextual.", "Warranty, registration, content and contextual support.", "Garantia, registro, conteúdo e suporte contextual."),
      localized("Beneficios y campañas sujetos a elegibilidad.", "Benefits and campaigns subject to eligibility.", "Benefícios e campanhas sujeitos à elegibilidade."),
      localized("Señales para CRM sin exponer datos personales en pruebas públicas.", "CRM signals without exposing personal data in public proofs.", "Sinais para CRM sem expor dados pessoais em provas públicas."),
    ],
    steps: [
      localized("Definir el valor real para el cliente.", "Define the real value for the customer.", "Definir o valor real para o cliente."),
      localized("Configurar consentimiento, elegibilidad y acciones.", "Configure consent, eligibility and actions.", "Configurar consentimento, elegibilidade e ações."),
      localized("Medir conversión, uso y retorno del piloto.", "Measure pilot conversion, usage and return.", "Medir conversão, uso e retorno do piloto."),
    ],
    boundary: localized(
      "Los resultados comerciales son objetivos medibles del piloto, no promesas automáticas de conversión o recompra.",
      "Commercial results are measurable pilot objectives, not automatic promises of conversion or repurchase.",
      "Resultados comerciais são objetivos mensuráveis do piloto, não promessas automáticas de conversão ou recompra.",
    ),
    demoHref: "/demo-lab?vertical=perfume",
  },
  {
    slug: "offline-operations",
    title: localized("Operación offline", "Offline operations", "Operação offline"),
    short: localized("Continuá evaluando mensajes y registrando trabajo con conectividad limitada.", "Keep evaluating messages and recording work with limited connectivity.", "Continue avaliando mensagens e registrando trabalho com conectividade limitada."),
    eyebrow: localized("Solución", "Solution", "Solução"),
    headline: localized("Operación de campo preparada para cuando la señal no acompaña.", "Field operations prepared for when connectivity fails.", "Operação de campo preparada para quando o sinal não acompanha."),
    intro: localized(
      "Equipos autorizados pueden trabajar con un paquete limitado y sincronizar luego, sin entregar claves maestras ni convertir un resultado local en una certeza física.",
      "Authorized teams can work with a limited bundle and synchronize later, without exposing master keys or turning a local result into physical certainty.",
      "Equipes autorizadas podem trabalhar com um pacote limitado e sincronizar depois, sem expor chaves mestras nem transformar um resultado local em certeza física.",
    ),
    outcome: localized("Continuidad operativa con límites explícitos.", "Operational continuity with explicit limits.", "Continuidade operacional com limites explícitos."),
    points: [
      localized("Dispositivos enrolados y permisos acotados.", "Enrolled devices and scoped permissions.", "Dispositivos cadastrados e permissões limitadas."),
      localized("Cola local protegida y sincronización posterior.", "Protected local queue and later synchronization.", "Fila local protegida e sincronização posterior."),
      localized("Resultados provisionales claramente identificados.", "Clearly identified provisional results.", "Resultados provisórios claramente identificados."),
    ],
    steps: [
      localized("Enrolar al operador y su dispositivo.", "Enroll the operator and device.", "Cadastrar o operador e o dispositivo."),
      localized("Entregar un bundle mínimo y con vencimiento.", "Deliver a minimal, expiring bundle.", "Entregar um bundle mínimo e com vencimento."),
      localized("Sincronizar y reevaluar cuando vuelve la red.", "Synchronize and reassess when connectivity returns.", "Sincronizar e reavaliar quando a rede voltar."),
    ],
    boundary: localized(
      "La evaluación offline es provisional hasta sincronizar; no confirma por sí sola origen, custodia, contenido ni autenticidad física.",
      "Offline evaluation is provisional until synchronization; it does not by itself confirm origin, custody, contents or physical authenticity.",
      "A avaliação offline é provisória até a sincronização; sozinha, não confirma origem, custódia, conteúdo ou autenticidade física.",
    ),
    demoHref: "/demo-lab?scenario=offline-verifier",
  },
];

const industrySources: CatalogSource[] = [
  {
    slug: "wine-spirits",
    title: localized("Vinos y bebidas", "Wine and spirits", "Vinhos e bebidas"),
    short: localized("Origen declarado, botella conectada y relación postventa.", "Declared origin, connected bottle and after-sales relationship.", "Origem declarada, garrafa conectada e relacionamento pós-venda."),
    eyebrow: localized("Industria", "Industry", "Indústria"),
    headline: localized("Cada botella puede abrir una historia y un servicio.", "Every bottle can open a story and a service.", "Cada garrafa pode abrir uma história e um serviço."),
    intro: localized("Conectá lote, producto y cliente para mostrar información relevante, registrar interacciones y habilitar experiencias bajo política.", "Connect batch, product and customer to show relevant information, record interactions and enable policy-based experiences.", "Conecte lote, produto e cliente para mostrar informações relevantes, registrar interações e habilitar experiências sob política."),
    outcome: localized("Una experiencia premium que continúa después del descorche.", "A premium experience that continues after opening.", "Uma experiência premium que continua depois da abertura."),
    points: [localized("Historia del producto y origen declarado.", "Product story and declared origin.", "História do produto e origem declarada."), localized("Señales NFC o QR según riesgo y costo.", "NFC or QR signals according to risk and cost.", "Sinais NFC ou QR conforme risco e custo."), localized("Club, garantía, contenido y recompra medible.", "Club, warranty, content and measurable repurchase.", "Clube, garantia, conteúdo e recompra mensurável.")],
    steps: [localized("Definir el lote y la experiencia.", "Define the batch and experience.", "Definir o lote e a experiência."), localized("Elegir etiqueta y política.", "Choose tag and policy.", "Escolher etiqueta e política."), localized("Medir el piloto y escalar.", "Measure the pilot and scale.", "Medir o piloto e escalar.")],
    boundary: localized("Los datos de origen y recorrido deben presentarse según su fuente; una lectura no prueba por sí sola el contenido ni la custodia de la botella.", "Origin and journey data must be presented according to source; a read does not by itself prove bottle contents or custody.", "Dados de origem e percurso devem ser apresentados conforme a fonte; uma leitura sozinha não comprova conteúdo nem custódia da garrafa."),
    demoHref: "/demo-lab?vertical=wine",
    image: "/demo/wine-secure/real-malbec-bottle-pexels.jpg",
  },
  {
    slug: "luxury-beauty",
    title: localized("Lujo y belleza", "Luxury and beauty", "Luxo e beleza"),
    short: localized("Identidad premium, cuidado, garantía y experiencias de marca.", "Premium identity, care, warranty and brand experiences.", "Identidade premium, cuidado, garantia e experiências de marca."),
    eyebrow: localized("Industria", "Industry", "Indústria"),
    headline: localized("Protegé la experiencia de marca más allá del packaging.", "Protect the brand experience beyond packaging.", "Proteja a experiência da marca além da embalagem."),
    intro: localized("Uní identidad digital, instrucciones, registro y servicios postventa en una experiencia coherente para retail y cliente final.", "Unify digital identity, instructions, registration and after-sales services in one coherent retail and customer experience.", "Una identidade digital, instruções, registro e serviços pós-venda em uma experiência coerente para varejo e cliente final."),
    outcome: localized("Más continuidad entre producto, marca y cliente.", "More continuity between product, brand and customer.", "Mais continuidade entre produto, marca e cliente."),
    points: [localized("Experiencia sin app mediante NFC o QR.", "App-free experience through NFC or QR.", "Experiência sem app por NFC ou QR."), localized("Garantía, cuidado y beneficios elegibles.", "Warranty, care and eligible benefits.", "Garantia, cuidado e benefícios elegíveis."), localized("Señales para investigar copia o replay.", "Signals to investigate copying or replay.", "Sinais para investigar cópia ou replay.")],
    steps: [localized("Diseñar la experiencia de producto.", "Design the product experience.", "Desenhar a experiência do produto."), localized("Configurar carrier, lote y permisos.", "Configure carrier, batch and permissions.", "Configurar carrier, lote e permissões."), localized("Integrar CRM y postventa.", "Integrate CRM and after-sales.", "Integrar CRM e pós-venda.")],
    boundary: localized("La evidencia del tag ayuda a evaluar una interacción; no certifica por sí sola materiales, condición, origen o autenticidad física.", "Tag evidence helps assess an interaction; it does not by itself certify materials, condition, origin or physical authenticity.", "A evidência da tag ajuda a avaliar uma interação; sozinha, não certifica materiais, condição, origem ou autenticidade física."),
    demoHref: "/demo-lab?vertical=perfume",
    image: "/demo/cosmetics-secure/real-premium-perfume-crop-pexels.jpg",
  },
  {
    slug: "pharma-health",
    title: localized("Pharma y salud", "Pharma and health", "Farma e saúde"),
    short: localized("Información crítica, excepciones y trazabilidad con fuentes claras.", "Critical information, exceptions and traceability with clear sources.", "Informação crítica, exceções e rastreabilidade com fontes claras."),
    eyebrow: localized("Industria", "Industry", "Indústria"),
    headline: localized("Información legible y controlada para cadenas sensibles.", "Legible, controlled information for sensitive chains.", "Informação legível e controlada para cadeias sensíveis."),
    intro: localized("Organizá identidad, lote, documentación y eventos reportados para que cada rol encuentre lo necesario sin mezclarlo con el detalle técnico.", "Organize identity, batch, documentation and reported events so each role finds what it needs without technical overload.", "Organize identidade, lote, documentação e eventos reportados para que cada função encontre o necessário sem sobrecarga técnica."),
    outcome: localized("Más claridad para operaciones y auditoría.", "More clarity for operations and audit.", "Mais clareza para operações e auditoria."),
    points: [localized("Información por lote y unidad.", "Batch and unit-level information.", "Informação por lote e unidade."), localized("Alertas y excepciones con contexto.", "Context-rich alerts and exceptions.", "Alertas e exceções com contexto."), localized("Integraciones y permisos por tenant.", "Tenant-scoped integrations and permissions.", "Integrações e permissões por tenant.")],
    steps: [localized("Definir controles y fuentes.", "Define controls and sources.", "Definir controles e fontes."), localized("Integrar eventos y documentación.", "Integrate events and documentation.", "Integrar eventos e documentação."), localized("Pilotar con criterios de aceptación.", "Pilot with acceptance criteria.", "Pilotar com critérios de aceitação.")],
    boundary: localized("nexID organiza evidencia digital y datos reportados; no reemplaza controles regulatorios, clínicos, de laboratorio ni de cadena de custodia.", "nexID organizes digital evidence and reported data; it does not replace regulatory, clinical, laboratory or chain-of-custody controls.", "A nexID organiza evidências digitais e dados reportados; não substitui controles regulatórios, clínicos, laboratoriais ou de cadeia de custódia."),
    demoHref: "/demo-lab?vertical=pharma",
    image: "/sdk/pharma-authentication-pack.webp",
  },
  {
    slug: "agro-food",
    title: localized("Agro y alimentos", "Agro and food", "Agro e alimentos"),
    short: localized("Lotes, campo, distribución y evidencia disponible en una misma historia.", "Batches, field, distribution and available evidence in one story.", "Lotes, campo, distribuição e evidências disponíveis em uma mesma história."),
    eyebrow: localized("Industria", "Industry", "Indústria"),
    headline: localized("Más contexto para productos que recorren cadenas largas.", "More context for products moving through long chains.", "Mais contexto para produtos que percorrem cadeias longas."),
    intro: localized("Conectá el lote con eventos reportados, documentación y experiencias de cliente, incluso cuando parte de la operación ocurre con señal limitada.", "Connect the batch with reported events, documentation and customer experiences, even when part of the operation has limited connectivity.", "Conecte o lote a eventos reportados, documentação e experiências do cliente, mesmo quando parte da operação ocorre com sinal limitado."),
    outcome: localized("Una narrativa de lote más útil para todos los actores.", "A more useful batch narrative for every actor.", "Uma narrativa de lote mais útil para todos os atores."),
    points: [localized("Identidad por lote o unidad.", "Batch or unit identity.", "Identidade por lote ou unidade."), localized("Operación de campo y sync posterior.", "Field operations and later sync.", "Operação de campo e sync posterior."), localized("Información para canal y consumidor.", "Information for channel and consumer.", "Informação para canal e consumidor.")],
    steps: [localized("Definir fuentes y responsables.", "Define sources and owners.", "Definir fontes e responsáveis."), localized("Conectar los hitos relevantes.", "Connect relevant milestones.", "Conectar os marcos relevantes."), localized("Separar evidencia, declaración y contexto.", "Separate evidence, declaration and context.", "Separar evidência, declaração e contexto.")],
    boundary: localized("Los eventos y orígenes declarados deben identificarse como tales; no equivalen a una certificación material o sanitaria.", "Reported events and declared origins must be identified as such; they are not equivalent to material or health certification.", "Eventos reportados e origens declaradas devem ser identificados como tais; não equivalem a certificação material ou sanitária."),
    demoHref: "/demo-lab?vertical=seeds",
    image: "/demo/agro-secure/real-seed-packet-pexels.jpg",
  },
  {
    slug: "logistics",
    title: localized("Logística", "Logistics", "Logística"),
    short: localized("Eventos, excepciones y activos conectados para la operación.", "Events, exceptions and connected assets for operations.", "Eventos, exceções e ativos conectados para a operação."),
    eyebrow: localized("Industria", "Industry", "Indústria"),
    headline: localized("Del movimiento informado a una decisión operativa.", "From reported movement to an operating decision.", "Do movimento informado a uma decisão operacional."),
    intro: localized("Unificá lecturas, hitos y alertas reportadas para seguir lotes, contenedores o unidades sin convertir una visualización en una prueba que no es.", "Unify reported reads, milestones and alerts to follow batches, containers or units without turning a visualization into proof it is not.", "Unifique leituras, marcos e alertas reportados para acompanhar lotes, contêineres ou unidades sem transformar uma visualização em uma prova que ela não é."),
    outcome: localized("Excepciones más visibles y mejor contexto de decisión.", "More visible exceptions and better decision context.", "Exceções mais visíveis e melhor contexto de decisão."),
    points: [localized("Eventos por unidad, lote o contenedor.", "Events by unit, batch or container.", "Eventos por unidade, lote ou contêiner."), localized("Alertas con fuente y tiempo identificados.", "Alerts with identified source and time.", "Alertas com fonte e tempo identificados."), localized("Integración con sistemas existentes.", "Integration with existing systems.", "Integração com sistemas existentes.")],
    steps: [localized("Elegir los eventos accionables.", "Choose actionable events.", "Escolher eventos acionáveis."), localized("Normalizar IDs y fuentes.", "Normalize IDs and sources.", "Normalizar IDs e fontes."), localized("Diseñar alertas y revisión.", "Design alerts and review.", "Desenhar alertas e revisão."),
    ],
    boundary: localized("Una lectura o geolocalización reportada no demuestra automáticamente presencia física, custodia continua ni condición del activo.", "A reported read or location does not automatically prove physical presence, continuous custody or asset condition.", "Uma leitura ou localização reportada não comprova automaticamente presença física, custódia contínua ou condição do ativo."),
    demoHref: "/demo-lab?scenario=offline-verifier",
    image: "/sdk/verticals/logistics-uhf-nfc-qr.webp",
  },
  {
    slug: "events",
    title: localized("Eventos y acceso", "Events and access", "Eventos e acesso"),
    short: localized("Credenciales conectadas, acceso y relación posterior al evento.", "Connected credentials, access and post-event relationship.", "Credenciais conectadas, acesso e relacionamento pós-evento."),
    eyebrow: localized("Industria", "Industry", "Indústria"),
    headline: localized("Una credencial puede abrir más que una puerta.", "A credential can unlock more than a door.", "Uma credencial pode abrir mais do que uma porta."),
    intro: localized("Conectá ingreso, identidad de la credencial y experiencias posteriores con reglas claras para asistentes, sponsors y operadores.", "Connect entry, credential identity and follow-up experiences with clear rules for attendees, sponsors and operators.", "Conecte entrada, identidade da credencial e experiências posteriores com regras claras para participantes, patrocinadores e operadores."),
    outcome: localized("Acceso y engagement en un recorrido coherente.", "Access and engagement in one coherent journey.", "Acesso e engajamento em uma jornada coerente."),
    points: [localized("Credenciales NFC o QR por nivel de riesgo.", "NFC or QR credentials by risk level.", "Credenciais NFC ou QR por nível de risco."), localized("Estados de acceso y excepciones.", "Access states and exceptions.", "Estados de acesso e exceções."), localized("Beneficios y contenido posteriores al evento.", "Post-event benefits and content.", "Benefícios e conteúdo após o evento.")],
    steps: [localized("Definir identidad y reglas de acceso.", "Define identity and access rules.", "Definir identidade e regras de acesso."), localized("Emitir y operar credenciales.", "Issue and operate credentials.", "Emitir e operar credenciais."), localized("Activar la experiencia posterior.", "Activate the follow-up experience.", "Ativar a experiência posterior."),
    ],
    boundary: localized("La credencial y sus registros apoyan el control de acceso; no sustituyen identidad legal ni presencia física salvo controles separados.", "The credential and its records support access control; they do not replace legal identity or physical presence without separate controls.", "A credencial e seus registros apoiam o controle de acesso; não substituem identidade legal nem presença física sem controles separados."),
    demoHref: "/demo-lab?vertical=bracelet",
    image: "/demo/events-basic/real-event-wristband-pexels.jpg",
  },
];

function resolveEntry(source: CatalogSource, locale: AppLocale): MarketingCatalogEntry {
  return {
    slug: source.slug,
    title: pick(source.title, locale),
    short: pick(source.short, locale),
    eyebrow: pick(source.eyebrow, locale),
    headline: pick(source.headline, locale),
    intro: pick(source.intro, locale),
    outcome: pick(source.outcome, locale),
    points: source.points.map((item) => pick(item, locale)) as [string, string, string],
    steps: source.steps.map((item) => pick(item, locale)) as [string, string, string],
    boundary: pick(source.boundary, locale),
    demoHref: source.demoHref,
    image: source.image,
  };
}

export function getSolutionCatalog(locale: AppLocale) {
  return solutionSources.map((item) => resolveEntry(item, locale));
}

export function getIndustryCatalog(locale: AppLocale) {
  return industrySources.map((item) => resolveEntry(item, locale));
}

export function getSolution(locale: AppLocale, slug: string) {
  const source = solutionSources.find((item) => item.slug === slug);
  return source ? resolveEntry(source, locale) : null;
}

export function getIndustry(locale: AppLocale, slug: string) {
  const source = industrySources.find((item) => item.slug === slug);
  return source ? resolveEntry(source, locale) : null;
}

const copyByLocale = {
  "es-AR": {
    skip: "Saltar al contenido",
    nav: {
      solutions: ["Soluciones", "Por necesidad", "Elegí el resultado que querés lograr."],
      industries: ["Industrias", "Por contexto", "Experiencias adaptadas al producto y su operación."],
      platform: ["Plataforma", "Ver y probar", "Entrá a las superficies públicas y guiadas."],
      resources: ["Recursos", "Profundizar", "Documentación, SDK y evidencia técnica cuando la necesitás."],
      pricing: "Planes",
      login: "Ingresar",
      demo: "Solicitar demo",
      menu: "Abrir menú",
      close: "Cerrar menú",
      allSolutions: "Ver todas las soluciones",
      allIndustries: "Ver todas las industrias",
    },
    hero: {
      eyebrow: "Identidad digital para productos físicos",
      title: "Conectá cada producto con información clara y una próxima acción.",
      body: "nexID une NFC o QR, datos del producto y reglas de negocio para que clientes y equipos sepan qué información está disponible y qué pueden hacer después.",
      primary: "Ver demo institucional",
      secondary: "Explorar soluciones",
      note: "Sin app para el cliente. Pilotos medibles. La evidencia digital no prueba por sí sola el objeto físico.",
      demo: "Experiencia demostrativa",
      product: "Gran Reserva · Lote MZA-0424",
      state: "Mensaje de la etiqueta evaluado",
      declared: "Información declarada disponible",
      action: "Garantía y beneficios según política",
      tap: "Acercá el teléfono",
    },
    value: {
      eyebrow: "Una experiencia, tres momentos",
      title: "Menos explicación. Más claridad sobre lo que sucede.",
      body: "La complejidad queda detrás de la plataforma. La persona ve un recorrido simple y el equipo conserva el control.",
      items: [
        ["Conectar", "Asigná una identidad al producto y elegí NFC o QR según el caso."],
        ["Interpretar", "Mostrá la evidencia y los datos disponibles con su fuente y sus límites."],
        ["Activar", "Habilitá garantía, contenido, soporte o beneficios cuando las reglas lo permitan."],
      ],
    },
    video: {
      eyebrow: "En dos minutos",
      title: "Mirá la plataforma antes de entrar en el detalle.",
      body: "El video institucional queda en la Home porque explica la idea completa de forma visual. La arquitectura y la implementación viven en Recursos.",
    },
    outcomes: {
      eyebrow: "Lo que resuelve",
      title: "Una plataforma para producto, operación y relación con el cliente.",
      body: "Cada área entra por su necesidad. Nadie tiene que aprender toda la arquitectura para entender el valor.",
      items: [
        ["Producto", "Identidad, información, garantía y servicios durante el ciclo de vida.", "/solutions/digital-passport"],
        ["Operación", "Lotes, eventos reportados, excepciones y revisión con contexto.", "/solutions/traceability"],
        ["Cliente", "Experiencias y beneficios elegibles después del toque o scan.", "/solutions/customer-experience"],
      ],
    },
    explore: {
      eyebrow: "Elegí tu nivel de detalle",
      title: "Simple para decidir. Profunda cuando hace falta.",
      body: "La navegación separa negocio, demostración, operación y tecnología para evitar que todas las audiencias terminen en la misma página.",
      paths: [
        ["Entender", "Soluciones, industrias y planes explicados en lenguaje de negocio.", "/solutions", "Empezar por negocio"],
        ["Ver y probar", "Video, Demo Lab, experiencia de consumidor y verificación pública.", "/demo-lab", "Abrir experiencias"],
        ["Implementar", "Documentación, SDK, arquitectura, seguridad y límites técnicos.", "/docs", "Ir a recursos técnicos"],
      ],
    },
    finalCta: {
      eyebrow: "Primer paso",
      title: "Diseñemos un piloto que pueda medirse.",
      body: "Definimos producto, objetivo, carrier, fuentes y criterio de éxito antes de hablar de escala.",
      primary: "Contar mi caso",
      secondary: "Ver planes",
    },
    catalog: {
      solutionsEyebrow: "Soluciones nexID",
      solutionsTitle: "Entrá por el problema, no por la tecnología.",
      solutionsBody: "Cada solución tiene su propia página, explicación, recorrido y límites.",
      industriesEyebrow: "Industrias",
      industriesTitle: "La misma plataforma, experiencias distintas.",
      industriesBody: "El carrier, la información y las acciones cambian según el producto y el riesgo.",
      open: "Explorar",
    },
    detail: {
      outcome: "Resultado esperado",
      capabilities: "Qué reúne",
      how: "Cómo empezar",
      boundary: "Qué demuestra y qué no",
      demo: "Ver experiencia relacionada",
      docs: "Revisar documentación",
      allSolutions: "Todas las soluciones",
      allIndustries: "Todas las industrias",
    },
    footer: {
      statement: "Identidad digital y evidencia clara para productos conectados.",
      product: "Producto",
      company: "Empresa",
      technical: "Técnico",
      contact: "Contacto",
      fiscal: "Data fiscal",
      mipyme: "Certificado MiPyME",
      rights: "nexID · Intellitech. Todos los derechos reservados.",
    },
  },
  en: {
    skip: "Skip to content",
    nav: {
      solutions: ["Solutions", "By need", "Choose the outcome you want to achieve."],
      industries: ["Industries", "By context", "Experiences adapted to product and operations."],
      platform: ["Platform", "See and try", "Open public and guided product surfaces."],
      resources: ["Resources", "Go deeper", "Documentation, SDK and technical evidence when needed."],
      pricing: "Pricing",
      login: "Sign in",
      demo: "Request demo",
      menu: "Open menu",
      close: "Close menu",
      allSolutions: "View all solutions",
      allIndustries: "View all industries",
    },
    hero: {
      eyebrow: "Digital identity for physical products",
      title: "Connect every product to clear information and a next action.",
      body: "nexID brings together NFC or QR, product data and business rules so customers and teams know what information is available and what they can do next.",
      primary: "Watch institutional demo",
      secondary: "Explore solutions",
      note: "No customer app. Measurable pilots. Digital evidence does not by itself prove the physical object.",
      demo: "Demonstration experience",
      product: "Gran Reserva · Batch MZA-0424",
      state: "Tag message assessed",
      declared: "Declared information available",
      action: "Warranty and benefits by policy",
      tap: "Bring phone close",
    },
    value: {
      eyebrow: "One experience, three moments",
      title: "Less explanation. More clarity about what happens.",
      body: "Complexity stays behind the platform. People see a simple journey while teams retain control.",
      items: [
        ["Connect", "Assign an identity and choose NFC or QR for the use case."],
        ["Interpret", "Show available evidence and data with their source and limits."],
        ["Activate", "Enable warranty, content, support or benefits when rules allow."],
      ],
    },
    video: { eyebrow: "In two minutes", title: "See the platform before entering the detail.", body: "The institutional video remains on Home because it explains the whole idea visually. Architecture and implementation live under Resources." },
    outcomes: {
      eyebrow: "What it solves",
      title: "One platform for product, operations and customer relationships.",
      body: "Each team enters through its need. Nobody has to learn the whole architecture to understand the value.",
      items: [
        ["Product", "Identity, information, warranty and lifecycle services.", "/solutions/digital-passport"],
        ["Operations", "Batches, reported events, exceptions and contextual review.", "/solutions/traceability"],
        ["Customer", "Eligible experiences and benefits after a tap or scan.", "/solutions/customer-experience"],
      ],
    },
    explore: {
      eyebrow: "Choose your level of detail",
      title: "Simple for decisions. Deep when needed.",
      body: "Navigation separates business, demonstration, operations and technology so every audience gets the right page.",
      paths: [
        ["Understand", "Solutions, industries and pricing in business language.", "/solutions", "Start with business"],
        ["See and try", "Video, Demo Lab, consumer experience and public verification.", "/demo-lab", "Open experiences"],
        ["Implement", "Documentation, SDK, architecture, security and technical limits.", "/docs", "Open technical resources"],
      ],
    },
    finalCta: { eyebrow: "First step", title: "Let's design a pilot we can measure.", body: "We define product, objective, carrier, sources and success criteria before discussing scale.", primary: "Share my use case", secondary: "View pricing" },
    catalog: { solutionsEyebrow: "nexID solutions", solutionsTitle: "Enter through the problem, not the technology.", solutionsBody: "Each solution has its own page, explanation, journey and limits.", industriesEyebrow: "Industries", industriesTitle: "The same platform, different experiences.", industriesBody: "Carrier, information and actions change with product and risk.", open: "Explore" },
    detail: { outcome: "Expected outcome", capabilities: "What it brings together", how: "How to start", boundary: "What it proves and what it does not", demo: "View related experience", docs: "Review documentation", allSolutions: "All solutions", allIndustries: "All industries" },
    footer: { statement: "Digital identity and clear evidence for connected products.", product: "Product", company: "Company", technical: "Technical", contact: "Contact", fiscal: "Tax information", mipyme: "MiPyME certificate", rights: "nexID · Intellitech. All rights reserved." },
  },
  "pt-BR": {
    skip: "Pular para o conteúdo",
    nav: {
      solutions: ["Soluções", "Por necessidade", "Escolha o resultado que deseja alcançar."],
      industries: ["Indústrias", "Por contexto", "Experiências adaptadas ao produto e à operação."],
      platform: ["Plataforma", "Ver e testar", "Acesse superfícies públicas e guiadas."],
      resources: ["Recursos", "Aprofundar", "Documentação, SDK e evidência técnica quando necessário."],
      pricing: "Planos",
      login: "Entrar",
      demo: "Solicitar demo",
      menu: "Abrir menu",
      close: "Fechar menu",
      allSolutions: "Ver todas as soluções",
      allIndustries: "Ver todas as indústrias",
    },
    hero: {
      eyebrow: "Identidade digital para produtos físicos",
      title: "Conecte cada produto a informações claras e a uma próxima ação.",
      body: "A nexID reúne NFC ou QR, dados do produto e regras de negócio para que clientes e equipes saibam quais informações estão disponíveis e o que podem fazer depois.",
      primary: "Ver demo institucional",
      secondary: "Explorar soluções",
      note: "Sem app para o cliente. Pilotos mensuráveis. A evidência digital não comprova sozinha o objeto físico.",
      demo: "Experiência demonstrativa",
      product: "Gran Reserva · Lote MZA-0424",
      state: "Mensagem da etiqueta avaliada",
      declared: "Informação declarada disponível",
      action: "Garantia e benefícios por política",
      tap: "Aproxime o telefone",
    },
    value: {
      eyebrow: "Uma experiência, três momentos",
      title: "Menos explicação. Mais clareza sobre o que acontece.",
      body: "A complexidade fica atrás da plataforma. A pessoa vê uma jornada simples e a equipe mantém o controle.",
      items: [
        ["Conectar", "Atribua uma identidade e escolha NFC ou QR conforme o caso."],
        ["Interpretar", "Mostre evidências e dados disponíveis com sua fonte e seus limites."],
        ["Ativar", "Habilite garantia, conteúdo, suporte ou benefícios quando as regras permitirem."],
      ],
    },
    video: { eyebrow: "Em dois minutos", title: "Veja a plataforma antes de entrar nos detalhes.", body: "O vídeo institucional permanece na Home porque explica a ideia completa de forma visual. Arquitetura e implementação ficam em Recursos." },
    outcomes: {
      eyebrow: "O que resolve",
      title: "Uma plataforma para produto, operação e relacionamento com o cliente.",
      body: "Cada área entra por sua necessidade. Ninguém precisa aprender toda a arquitetura para entender o valor.",
      items: [
        ["Produto", "Identidade, informação, garantia e serviços durante o ciclo de vida.", "/solutions/digital-passport"],
        ["Operação", "Lotes, eventos reportados, exceções e revisão com contexto.", "/solutions/traceability"],
        ["Cliente", "Experiências e benefícios elegíveis após o toque ou scan.", "/solutions/customer-experience"],
      ],
    },
    explore: {
      eyebrow: "Escolha seu nível de detalhe",
      title: "Simples para decidir. Profunda quando necessário.",
      body: "A navegação separa negócio, demonstração, operação e tecnologia para que cada público chegue à página certa.",
      paths: [
        ["Entender", "Soluções, indústrias e planos em linguagem de negócio.", "/solutions", "Começar pelo negócio"],
        ["Ver e testar", "Vídeo, Demo Lab, experiência do consumidor e verificação pública.", "/demo-lab", "Abrir experiências"],
        ["Implementar", "Documentação, SDK, arquitetura, segurança e limites técnicos.", "/docs", "Ir para recursos técnicos"],
      ],
    },
    finalCta: { eyebrow: "Primeiro passo", title: "Vamos desenhar um piloto que possa ser medido.", body: "Definimos produto, objetivo, carrier, fontes e critério de sucesso antes de falar em escala.", primary: "Contar meu caso", secondary: "Ver planos" },
    catalog: { solutionsEyebrow: "Soluções nexID", solutionsTitle: "Entre pelo problema, não pela tecnologia.", solutionsBody: "Cada solução tem sua própria página, explicação, jornada e limites.", industriesEyebrow: "Indústrias", industriesTitle: "A mesma plataforma, experiências diferentes.", industriesBody: "Carrier, informação e ações mudam conforme produto e risco.", open: "Explorar" },
    detail: { outcome: "Resultado esperado", capabilities: "O que reúne", how: "Como começar", boundary: "O que demonstra e o que não demonstra", demo: "Ver experiência relacionada", docs: "Revisar documentação", allSolutions: "Todas as soluções", allIndustries: "Todas as indústrias" },
    footer: { statement: "Identidade digital e evidência clara para produtos conectados.", product: "Produto", company: "Empresa", technical: "Técnico", contact: "Contato", fiscal: "Dados fiscais", mipyme: "Certificado MiPyME", rights: "nexID · Intellitech. Todos os direitos reservados." },
  },
} as const;

export function getMarketingCopy(locale: AppLocale) {
  return copyByLocale[locale];
}

export function getMarketingNav(locale: AppLocale): MarketingNavGroup[] {
  const copy = copyByLocale[locale];
  const solutions = getSolutionCatalog(locale);
  const industries = getIndustryCatalog(locale);
  const platformItems: MarketingNavItem[] = [
    { label: "Demo Lab", description: locale === "en" ? "Run a guided journey with clearly labelled simulated data." : locale === "pt-BR" ? "Percorra uma experiência guiada com dados simulados identificados." : "Recorré una experiencia guiada con datos simulados identificados.", href: "/demo-lab", badge: locale === "en" ? "Try" : locale === "pt-BR" ? "Testar" : "Probar" },
    { label: locale === "en" ? "Consumer experience" : locale === "pt-BR" ? "Experiência do consumidor" : "Experiencia de consumidor", description: locale === "en" ? "See passport, services and wallet." : locale === "pt-BR" ? "Veja passaporte, serviços e wallet." : "Mirá pasaporte, servicios y wallet.", href: "/login?next=/me" },
    { label: "Proof Verify", description: locale === "en" ? "Interpret public hash-only evidence." : locale === "pt-BR" ? "Interprete evidências públicas hash-only." : "Interpretá evidencia pública hash-only.", href: "/proof/verify" },
    { label: "SUN", description: locale === "en" ? "Validate supported NFC messages." : locale === "pt-BR" ? "Valide mensagens NFC suportadas." : "Validá mensajes NFC compatibles.", href: "/sun" },
  ];
  const resourceItems: MarketingNavItem[] = [
    { label: locale === "en" ? "Documentation" : locale === "pt-BR" ? "Documentação" : "Documentación", description: locale === "en" ? "Architecture, guides and boundaries." : locale === "pt-BR" ? "Arquitetura, guias e limites." : "Arquitectura, guías y límites.", href: "/docs" },
    { label: "SDK & API", description: locale === "en" ? "Integration paths and developer resources." : locale === "pt-BR" ? "Integrações e recursos para developers." : "Integraciones y recursos para developers.", href: "/sdk" },
    { label: locale === "en" ? "Glossary" : locale === "pt-BR" ? "Glossário" : "Glosario", description: locale === "en" ? "Plain-language product concepts." : locale === "pt-BR" ? "Conceitos do produto em linguagem simples." : "Conceptos del producto en lenguaje simple.", href: "/glossary" },
    { label: locale === "en" ? "Reseller program" : locale === "pt-BR" ? "Programa revendedor" : "Programa reseller", description: locale === "en" ? "Channel, white-label and operating model." : locale === "pt-BR" ? "Canal, white-label e modelo operacional." : "Canal, white-label y modelo operativo.", href: "/resellers" },
  ];

  return [
    {
      id: "solutions",
      label: copy.nav.solutions[0],
      eyebrow: copy.nav.solutions[1],
      description: copy.nav.solutions[2],
      items: solutions.map((item) => ({ label: item.title, description: item.short, href: `/solutions/${item.slug}` })),
      featured: { label: copy.nav.allSolutions, description: copy.catalog.solutionsBody, href: "/solutions" },
    },
    {
      id: "industries",
      label: copy.nav.industries[0],
      eyebrow: copy.nav.industries[1],
      description: copy.nav.industries[2],
      items: industries.map((item) => ({ label: item.title, description: item.short, href: `/industries/${item.slug}` })),
      featured: { label: copy.nav.allIndustries, description: copy.catalog.industriesBody, href: "/industries" },
    },
    {
      id: "platform",
      label: copy.nav.platform[0],
      eyebrow: copy.nav.platform[1],
      description: copy.nav.platform[2],
      items: platformItems,
      featured: { label: locale === "en" ? "Open guided demo" : locale === "pt-BR" ? "Abrir demo guiada" : "Abrir demo guiada", description: locale === "en" ? "Start with a non-technical walkthrough." : locale === "pt-BR" ? "Comece por um percurso não técnico." : "Empezá por un recorrido no técnico.", href: "/demo-lab" },
    },
    {
      id: "resources",
      label: copy.nav.resources[0],
      eyebrow: copy.nav.resources[1],
      description: copy.nav.resources[2],
      items: resourceItems,
      featured: { label: locale === "en" ? "Open documentation" : locale === "pt-BR" ? "Abrir documentação" : "Abrir documentación", description: locale === "en" ? "Only when you need implementation detail." : locale === "pt-BR" ? "Somente quando precisar do detalhe técnico." : "Sólo cuando necesitás el detalle técnico.", href: "/docs" },
    },
  ];
}
