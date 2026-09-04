"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  Gift,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  Map,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Tag,
  Wine,
} from "lucide-react";
import { useState } from "react";
import type { AppLocale } from "@product/config";
import {
  DEMO_PRODUCT_PROFILES,
  type DemoExperienceAction,
  type DemoProductProfileKey,
} from "../../../lib/demo-product-profiles";
import styles from "./demo-lab-featured-journey.module.css";

type JourneyStep = 0 | 1 | 2 | 3;
type JourneyAction = DemoExperienceAction;

type JourneyCopy = {
  eyebrow: string;
  title: string;
  lede: string;
  truthBadge: string;
  truthDetail: string;
  productPrompt: string;
  productHint: string;
  productLabels: Readonly<Record<DemoProductProfileKey, string>>;
  progressLabel: string;
  steps: readonly {
    short: string;
    eyebrow: string;
    title: string;
    body: string;
    concept: string;
    conceptBody: string;
    primary?: string;
  }[];
  visualLabels: readonly string[];
  visualReadyLabel: string;
  visualReadyTitle: string;
  visualReadLabel: string;
  visualReadTitle: string;
  visualActionsLabel: string;
  visualCompleteLabel: string;
  readoutTitle: string;
  declaredSuffix: string;
  readout: readonly { label: string; value: string }[];
  boundary: string;
  chooseTitle: string;
  actions: Readonly<Record<JourneyAction, { label: string; description: string }>>;
  chosenLabel: string;
  resultTitle: string;
  resultBody: string;
  brandSignal: string;
  signalEyebrow: string;
  signalTitle: string;
  signalIntro: string;
  flowLabel: string;
  flow: readonly { label: string; detail: string }[];
  packetLabel: string;
  signalFields: {
    event: string;
    context: string;
    actor: string;
    consent: string;
    location: string;
    provenance: string;
  };
  actorUnknown: string;
  consentNotAssumed: string;
  locationNotReported: string;
  demoProvenance: string;
  customerValueLabel: string;
  businessValueLabel: string;
  nextBusinessActionLabel: string;
  actionSignals: Readonly<Record<JourneyAction, {
    event: string;
    customerValue: string;
    businessValue: string;
    nextAction: string;
  }>>;
  heatmapTitle: string;
  heatmapState: string;
  heatmapBody: string;
  heatmapFootnote: string;
  signalBoundary: string;
  back: string;
  restart: string;
  openPreview: string;
  helper: string;
};

const COPY: Record<"es" | "en" | "pt", JourneyCopy> = {
  es: {
    eyebrow: "Recorrido guiado · 60 segundos",
    title: "Probá cómo un producto abre una relación.",
    lede: "Tocá los controles. nexID te muestra qué ve el cliente y qué recibe la marca, paso a paso y sin glosario técnico.",
    truthBadge: "Demo ilustrativa · sin tap físico",
    truthDetail: "Producto, lote, origen y resultados son datos de muestra. Esta experiencia no escribe registros reales.",
    productPrompt: "Elegí un producto",
    productHint: "Elegí un ejemplo. Al final vas a ver la experiencia exacta que se abre en el celular.",
    productLabels: { wine: "Botella premium", perfume: "Packaging premium", agro: "Agro y semillas" },
    progressLabel: "Progreso del recorrido",
    steps: [
      {
        short: "Acercá",
        eyebrow: "01 · Descubrir",
        title: "Acercá el celular a la etiqueta.",
        body: "El cliente no descarga una app: acerca el teléfono al NFC o escanea el QR del producto.",
        concept: "¿Qué hace la etiqueta?",
        conceptBody: "Abre en el navegador el recorrido que la marca configuró para ese producto.",
        primary: "Simular acercamiento",
      },
      {
        short: "Entendé",
        eyebrow: "02 · Responder",
        title: "Recibí una respuesta clara.",
        body: "nexID interpreta la lectura y muestra información útil, en lenguaje simple y con su fuente visible.",
        concept: "¿Qué es evidencia digital?",
        conceptBody: "Es la información que nexID puede evaluar a partir del mensaje de la etiqueta y de los datos configurados por la marca.",
        primary: "Ver qué recibió el celular",
      },
      {
        short: "Elegí",
        eyebrow: "03 · Activar",
        title: "Elegí la próxima acción.",
        body: "La experiencia no termina en la lectura. El producto puede abrir el servicio que el cliente necesita ahora.",
        concept: "¿Qué decide la marca?",
        conceptBody: "Qué información mostrar y qué acciones habilitar: garantía, beneficio, soporte u otro recorrido.",
      },
      {
        short: "Continuá",
        eyebrow: "04 · Conectar",
        title: "La relación continúa después de la compra.",
        body: "El cliente obtiene un próximo paso útil y la marca recibe una señal para atender mejor esa interacción.",
        concept: "¿Qué gana el negocio?",
        conceptBody: "Un canal propio para informar, atender y aprender de las acciones elegidas dentro de la experiencia.",
      },
    ],
    visualLabels: ["Celular acercándose", "Lectura recibida", "Acciones disponibles", "Recorrido completado"],
    visualReadyLabel: "Listo para acercar",
    visualReadyTitle: "Acercá el celular para iniciar",
    visualReadLabel: "En el celular",
    visualReadTitle: "Lectura recibida",
    visualActionsLabel: "Próximas acciones",
    visualCompleteLabel: "Recorrido completado",
    readoutTitle: "En el celular",
    declaredSuffix: "declarado",
    readout: [
      { label: "Producto", value: "Reserva Andina" },
      { label: "Lote", value: "RA-2407" },
      { label: "Origen", value: "Mendoza · declarado" },
      { label: "Lectura", value: "Mensaje digital recibido" },
    ],
    boundary: "La lectura evalúa evidencia digital disponible. No certifica por sí sola el producto, su contenido ni su autenticidad física.",
    chooseTitle: "¿Qué querés hacer?",
    actions: {
      warranty: { label: "Iniciar garantía", description: "Abrir el alta configurada por la marca." },
      benefit: { label: "Ver beneficios", description: "Mostrar experiencias o ventajas disponibles." },
      support: { label: "Hablar con la marca", description: "Continuar por el canal de atención elegido." },
    },
    chosenLabel: "Acción elegida en esta simulación",
    resultTitle: "Ahora mirá la experiencia final.",
    resultBody: "Demo Lab explica el gesto y después abre la ficha que verá el cliente, con el producto, su información y las opciones de posventa.",
    brandSignal: "Vista final del cliente · experiencia de muestra",
    signalEyebrow: "Del producto al centro de control",
    signalTitle: "Qué volvería al dashboard de la empresa.",
    signalIntro: "En un recorrido real, la interacción puede generar una señal contextual. Acá ves el contrato de datos antes de abrir la experiencia final: qué se registra, qué no se presume y qué puede hacer el equipo.",
    flowLabel: "Flujo ilustrativo desde la persona hasta el dashboard empresarial",
    flow: [
      { label: "Persona", detail: "Elige una acción" },
      { label: "Pasaporte", detail: "Conserva producto y lote" },
      { label: "Servicio", detail: "Registra intención, no resultado" },
      { label: "Dashboard", detail: "Recibe una señal contextual" },
    ],
    packetLabel: "Paquete ilustrativo de la señal",
    signalFields: {
      event: "Taxonomía",
      context: "Producto y lote",
      actor: "Actor",
      consent: "Consentimiento",
      location: "Ubicación",
      provenance: "Procedencia",
    },
    actorUnknown: "No identificado",
    consentNotAssumed: "No asumido",
    locationNotReported: "No informada",
    demoProvenance: "Demo ilustrativa · no persistida",
    customerValueLabel: "Qué obtiene la persona",
    businessValueLabel: "Qué aprende la empresa",
    nextBusinessActionLabel: "Siguiente acción empresarial",
    actionSignals: {
      warranty: {
        event: "WARRANTY_STARTED",
        customerValue: "Inicia el alta desde el producto. La garantía sigue pendiente hasta que un sistema autorizado la confirme.",
        businessValue: "Postventa y fidelización con contexto de producto y lote, sin confundir un inicio con una garantía confirmada.",
        nextAction: "Crear una tarea de seguimiento y confirmar la garantía desde el sistema autorizado.",
      },
      benefit: {
        event: "LOYALTY_OFFER_VIEWED",
        customerValue: "Consulta una recompensa, trivia o experiencia; verla no demuestra adhesión ni canje.",
        businessValue: "Gamificación medible para aprender interés y recurrencia sin convertir el tap en una identidad.",
        nextAction: "Invitar al opt-in y medir participación antes de activar una campaña de fidelización.",
      },
      support: {
        event: "SUPPORT_STARTED",
        customerValue: "Abre el canal de ayuda elegido para ese producto; la conversación todavía debe ser atendida.",
        businessValue: "Contacto con producto y lote; la identidad aparece sólo si la persona decide compartirla.",
        nextAction: "Derivar al canal configurado y pedir datos únicamente con consentimiento explícito.",
      },
    },
    heatmapTitle: "Mapa y mapa de calor: preparados, sin puntos inventados",
    heatmapState: "Esperando una zona informada o ubicación consentida",
    heatmapBody: "El dashboard muestra densidad sólo cuando un evento real incluye una zona reportada o una ubicación que la persona compartió con permiso.",
    heatmapFootnote: "Este Demo Lab no infiere GPS ni dibuja actividad ficticia.",
    signalBoundary: "Esta vista explica el contrato de datos. No afirma conversión, identidad, ubicación ni confirmación de servicio.",
    back: "Volver",
    restart: "Reiniciar recorrido",
    openPreview: "Ver la experiencia final",
    helper: "Sin app para el cliente · Sin escritura on-chain · Datos ilustrativos",
  },
  en: {
    eyebrow: "Guided journey · 60 seconds",
    title: "See how a product starts a relationship.",
    lede: "Use the controls. nexID shows what the customer sees and what the brand receives, one clear step at a time.",
    truthBadge: "Illustrative demo · no physical tap",
    truthDetail: "Product, batch, origin and outcomes are sample data. This experience writes no real records.",
    productPrompt: "Choose a product",
    productHint: "Choose an example. At the end, you will see the exact experience that opens on the phone.",
    productLabels: { wine: "Premium bottle", perfume: "Premium packaging", agro: "Agriculture and seeds" },
    progressLabel: "Journey progress",
    steps: [
      { short: "Tap", eyebrow: "01 · Discover", title: "Bring the phone close to the label.", body: "No app is required: the customer taps the NFC label or scans the product QR.", concept: "What does the label do?", conceptBody: "It opens the browser journey configured by the brand for that product.", primary: "Simulate tap" },
      { short: "Understand", eyebrow: "02 · Respond", title: "Get a clear response.", body: "nexID interprets the read and shows useful information with a visible source.", concept: "What is digital evidence?", conceptBody: "Information nexID can evaluate from the label message and brand-configured data.", primary: "View the phone response" },
      { short: "Choose", eyebrow: "03 · Activate", title: "Choose the next action.", body: "The journey does not end at the read. The product can open the service the customer needs.", concept: "What does the brand decide?", conceptBody: "Which information and actions are available: warranty, benefits, support or another journey." },
      { short: "Continue", eyebrow: "04 · Connect", title: "The relationship continues after purchase.", body: "The customer gets a useful next step and the brand gets a signal to serve that interaction.", concept: "What does the business gain?", conceptBody: "A direct channel to inform, support and learn from actions inside the experience." },
    ],
    visualLabels: ["Phone approaching", "Read received", "Actions available", "Journey completed"],
    visualReadyLabel: "Ready to tap",
    visualReadyTitle: "Bring the phone closer to start",
    visualReadLabel: "On the phone",
    visualReadTitle: "Read received",
    visualActionsLabel: "Next actions",
    visualCompleteLabel: "Journey completed",
    readoutTitle: "On the phone",
    declaredSuffix: "declared",
    readout: [
      { label: "Product", value: "Reserva Andina" },
      { label: "Batch", value: "RA-2407" },
      { label: "Origin", value: "Mendoza · declared" },
      { label: "Read", value: "Digital message received" },
    ],
    boundary: "The read evaluates available digital evidence. It does not by itself certify the product, its contents or its physical authenticity.",
    chooseTitle: "What would you like to do?",
    actions: {
      warranty: { label: "Start warranty", description: "Open the brand-configured registration." },
      benefit: { label: "View benefits", description: "Show available experiences or advantages." },
      support: { label: "Contact the brand", description: "Continue through the selected support channel." },
    },
    chosenLabel: "Action selected in this simulation",
    resultTitle: "Now see the final experience.",
    resultBody: "Demo Lab explains the gesture, then opens the page customers will see, with the product, its information and after-sales options.",
    brandSignal: "Customer view · sample experience",
    signalEyebrow: "From product to control center",
    signalTitle: "What would return to the company dashboard.",
    signalIntro: "In a real journey, the interaction can create a contextual signal. This is the data contract before opening the final experience: what is recorded, what is not assumed and what the team can do next.",
    flowLabel: "Illustrative flow from the person to the company dashboard",
    flow: [
      { label: "Person", detail: "Chooses an action" },
      { label: "Passport", detail: "Keeps product and batch context" },
      { label: "Service", detail: "Records intent, not outcome" },
      { label: "Dashboard", detail: "Receives a contextual signal" },
    ],
    packetLabel: "Illustrative signal packet",
    signalFields: {
      event: "Taxonomy",
      context: "Product and batch",
      actor: "Actor",
      consent: "Consent",
      location: "Location",
      provenance: "Provenance",
    },
    actorUnknown: "Unidentified",
    consentNotAssumed: "Not assumed",
    locationNotReported: "Not reported",
    demoProvenance: "Illustrative demo · not persisted",
    customerValueLabel: "What the person gets",
    businessValueLabel: "What the company learns",
    nextBusinessActionLabel: "Next business action",
    actionSignals: {
      warranty: {
        event: "WARRANTY_STARTED",
        customerValue: "Starts registration from the product. The warranty remains pending until an authorized system confirms it.",
        businessValue: "After-sales and loyalty context tied to product and batch, without treating a start as a confirmed warranty.",
        nextAction: "Create a follow-up task and confirm the warranty in the authorized system.",
      },
      benefit: {
        event: "LOYALTY_OFFER_VIEWED",
        customerValue: "Views a reward, challenge or experience; a view does not prove enrollment or redemption.",
        businessValue: "Measurable gamification for learning interest and recurrence without turning a tap into an identity.",
        nextAction: "Invite opt-in and measure participation before activating a loyalty campaign.",
      },
      support: {
        event: "SUPPORT_STARTED",
        customerValue: "Opens the help channel selected for that product; the conversation still needs to be handled.",
        businessValue: "Contact with product and batch context; identity appears only if the person chooses to share it.",
        nextAction: "Route to the configured channel and request data only with explicit consent.",
      },
    },
    heatmapTitle: "Map and heatmap: ready, with no invented points",
    heatmapState: "Waiting for a reported zone or consented location",
    heatmapBody: "The dashboard shows density only when a real event contains a reported zone or a location the person shared with permission.",
    heatmapFootnote: "This Demo Lab neither infers GPS nor draws fictional activity.",
    signalBoundary: "This view explains the data contract. It does not claim a conversion, identity, location or confirmed service outcome.",
    back: "Back",
    restart: "Restart journey",
    openPreview: "View the final experience",
    helper: "No customer app · No on-chain write · Illustrative data",
  },
  pt: {
    eyebrow: "Jornada guiada · 60 segundos",
    title: "Veja como um produto inicia uma relação.",
    lede: "Use os controles. A nexID mostra o que o cliente vê e o que a marca recebe, passo a passo e sem glossário técnico.",
    truthBadge: "Demo ilustrativa · sem toque físico",
    truthDetail: "Produto, lote, origem e resultados são dados de exemplo. Esta experiência não grava registros reais.",
    productPrompt: "Escolha um produto",
    productHint: "Escolha um exemplo. No final, você verá a experiência exata que abre no celular.",
    productLabels: { wine: "Garrafa premium", perfume: "Packaging premium", agro: "Agro e sementes" },
    progressLabel: "Progresso da jornada",
    steps: [
      { short: "Aproxime", eyebrow: "01 · Descobrir", title: "Aproxime o celular da etiqueta.", body: "Sem baixar app: o cliente aproxima o celular do NFC ou lê o QR do produto.", concept: "O que a etiqueta faz?", conceptBody: "Abre no navegador a jornada configurada pela marca para esse produto.", primary: "Simular aproximação" },
      { short: "Entenda", eyebrow: "02 · Responder", title: "Receba uma resposta clara.", body: "A nexID interpreta a leitura e mostra informação útil com a fonte visível.", concept: "O que é evidência digital?", conceptBody: "Informação que a nexID pode avaliar a partir da mensagem da etiqueta e dos dados configurados pela marca.", primary: "Ver a resposta no celular" },
      { short: "Escolha", eyebrow: "03 · Ativar", title: "Escolha a próxima ação.", body: "A jornada não termina na leitura. O produto pode abrir o serviço que o cliente precisa.", concept: "O que a marca decide?", conceptBody: "Quais informações e ações ficam disponíveis: garantia, benefício, suporte ou outra jornada." },
      { short: "Continue", eyebrow: "04 · Conectar", title: "A relação continua depois da compra.", body: "O cliente recebe um próximo passo útil e a marca recebe um sinal para atender melhor.", concept: "O que a empresa ganha?", conceptBody: "Um canal próprio para informar, atender e aprender com as ações dentro da experiência." },
    ],
    visualLabels: ["Celular se aproximando", "Leitura recebida", "Ações disponíveis", "Jornada concluída"],
    visualReadyLabel: "Pronto para aproximar",
    visualReadyTitle: "Aproxime o celular para começar",
    visualReadLabel: "No celular",
    visualReadTitle: "Leitura recebida",
    visualActionsLabel: "Próximas ações",
    visualCompleteLabel: "Jornada concluída",
    readoutTitle: "No celular",
    declaredSuffix: "declarada",
    readout: [
      { label: "Produto", value: "Reserva Andina" },
      { label: "Lote", value: "RA-2407" },
      { label: "Origem", value: "Mendoza · declarada" },
      { label: "Leitura", value: "Mensagem digital recebida" },
    ],
    boundary: "A leitura avalia a evidência digital disponível. Ela não certifica sozinha o produto, seu conteúdo ou sua autenticidade física.",
    chooseTitle: "O que você quer fazer?",
    actions: {
      warranty: { label: "Iniciar garantia", description: "Abrir o cadastro configurado pela marca." },
      benefit: { label: "Ver benefícios", description: "Mostrar experiências ou vantagens disponíveis." },
      support: { label: "Falar com a marca", description: "Continuar pelo canal de atendimento escolhido." },
    },
    chosenLabel: "Ação escolhida nesta simulação",
    resultTitle: "Agora veja a experiência final.",
    resultBody: "O Demo Lab explica o gesto e depois abre a página que o cliente verá, com o produto, suas informações e opções de pós-venda.",
    brandSignal: "Visão do cliente · experiência de exemplo",
    signalEyebrow: "Do produto ao centro de controle",
    signalTitle: "O que voltaria ao dashboard da empresa.",
    signalIntro: "Em uma jornada real, a interação pode gerar um sinal contextual. Aqui você vê o contrato de dados antes de abrir a experiência final: o que é registrado, o que não é presumido e o que a equipe pode fazer.",
    flowLabel: "Fluxo ilustrativo da pessoa até o dashboard empresarial",
    flow: [
      { label: "Pessoa", detail: "Escolhe uma ação" },
      { label: "Passaporte", detail: "Mantém produto e lote" },
      { label: "Serviço", detail: "Registra intenção, não resultado" },
      { label: "Dashboard", detail: "Recebe um sinal contextual" },
    ],
    packetLabel: "Pacote ilustrativo do sinal",
    signalFields: {
      event: "Taxonomia",
      context: "Produto e lote",
      actor: "Ator",
      consent: "Consentimento",
      location: "Localização",
      provenance: "Procedência",
    },
    actorUnknown: "Não identificado",
    consentNotAssumed: "Não presumido",
    locationNotReported: "Não informada",
    demoProvenance: "Demo ilustrativa · não persistida",
    customerValueLabel: "O que a pessoa recebe",
    businessValueLabel: "O que a empresa aprende",
    nextBusinessActionLabel: "Próxima ação empresarial",
    actionSignals: {
      warranty: {
        event: "WARRANTY_STARTED",
        customerValue: "Inicia o cadastro pelo produto. A garantia continua pendente até que um sistema autorizado a confirme.",
        businessValue: "Pós-venda e fidelização com contexto de produto e lote, sem tratar um início como garantia confirmada.",
        nextAction: "Criar uma tarefa de acompanhamento e confirmar a garantia no sistema autorizado.",
      },
      benefit: {
        event: "LOYALTY_OFFER_VIEWED",
        customerValue: "Consulta uma recompensa, desafio ou experiência; a visualização não comprova adesão nem resgate.",
        businessValue: "Gamificação mensurável para entender interesse e recorrência sem transformar o toque em identidade.",
        nextAction: "Convidar para o opt-in e medir participação antes de ativar uma campanha de fidelização.",
      },
      support: {
        event: "SUPPORT_STARTED",
        customerValue: "Abre o canal de ajuda escolhido para esse produto; a conversa ainda precisa ser atendida.",
        businessValue: "Contato com contexto de produto e lote; a identidade aparece somente se a pessoa decidir compartilhá-la.",
        nextAction: "Encaminhar ao canal configurado e solicitar dados apenas com consentimento explícito.",
      },
    },
    heatmapTitle: "Mapa e mapa de calor: prontos, sem pontos inventados",
    heatmapState: "Aguardando zona informada ou localização consentida",
    heatmapBody: "O dashboard mostra densidade somente quando um evento real contém uma zona reportada ou uma localização compartilhada pela pessoa com permissão.",
    heatmapFootnote: "Este Demo Lab não infere GPS nem desenha atividade fictícia.",
    signalBoundary: "Esta visão explica o contrato de dados. Ela não afirma conversão, identidade, localização nem confirmação de serviço.",
    back: "Voltar",
    restart: "Reiniciar jornada",
    openPreview: "Ver a experiência final",
    helper: "Sem app para o cliente · Sem escrita on-chain · Dados ilustrativos",
  },
};

const ACTION_ICONS = {
  warranty: ShieldCheck,
  benefit: Gift,
  support: Headphones,
} as const;

const SIGNAL_FLOW_ICONS = [CircleUserRound, BookOpenCheck, Sparkles, LayoutDashboard] as const;

function localeKey(locale: AppLocale): keyof typeof COPY {
  if (locale === "en") return "en";
  if (locale === "pt-BR") return "pt";
  return "es";
}

function buildSunPreviewHref(
  profile: DemoProductProfileKey,
  intent: JourneyAction,
  locale: AppLocale,
  hash = "",
) {
  const query = new URLSearchParams({
    demo: "1",
    source: "demo-lab",
    profile,
    action: intent,
    locale,
  });
  return `/sun?${query.toString()}${hash}`;
}

export function DemoLabFeaturedJourney({
  locale,
  initialProfile = "wine",
}: {
  locale: AppLocale;
  initialProfile?: DemoProductProfileKey;
}) {
  const copy = COPY[localeKey(locale)];
  const [step, setStep] = useState<JourneyStep>(0);
  const [furthestStep, setFurthestStep] = useState<JourneyStep>(0);
  const [selectedAction, setSelectedAction] = useState<JourneyAction>("warranty");
  const [productKey, setProductKey] = useState<DemoProductProfileKey>(initialProfile);
  const product = DEMO_PRODUCT_PROFILES[productKey];
  const current = copy.steps[step];
  const actionSignal = copy.actionSignals[selectedAction];
  const sunPreviewHref = buildSunPreviewHref(productKey, selectedAction, locale);

  const moveToStep = (next: JourneyStep) => {
    setStep(next);
    setFurthestStep((previous) => Math.max(previous, next) as JourneyStep);
    window.requestAnimationFrame(() => {
      document.getElementById("demo-lab-featured-step-title")?.focus({ preventScroll: true });
    });
  };

  const selectAction = (action: JourneyAction) => {
    setSelectedAction(action);
    moveToStep(3);
  };

  const restart = () => {
    setSelectedAction("warranty");
    setFurthestStep(0);
    moveToStep(0);
  };

  const chooseProduct = (nextProduct: DemoProductProfileKey) => {
    setProductKey(nextProduct);
    setSelectedAction("warranty");
    setFurthestStep(0);
    setStep(0);
  };

  return (
    <section
      className={styles.journey}
      data-demo-featured-journey
      data-step={step}
      aria-labelledby="demo-lab-featured-title"
    >
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <h2 id="demo-lab-featured-title">{copy.title}</h2>
          <p>{copy.lede}</p>
        </div>
        <aside className={styles.truthNote} aria-label={copy.truthBadge}>
          <span><BadgeCheck aria-hidden="true" />{copy.truthBadge}</span>
          <p>{copy.truthDetail}</p>
        </aside>
      </header>

      <div className={styles.productSelector}>
        <div>
          <strong>{copy.productPrompt}</strong>
          <small>{copy.productHint}</small>
        </div>
        <div role="group" aria-label={copy.productPrompt}>
          {(Object.keys(DEMO_PRODUCT_PROFILES) as DemoProductProfileKey[]).map((key) => {
            const item = DEMO_PRODUCT_PROFILES[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={productKey === key}
                data-active={productKey === key}
                onClick={() => chooseProduct(key)}
              >
                {key === "wine" ? <Wine aria-hidden="true" /> : key === "perfume" ? <Gift aria-hidden="true" /> : <Tag aria-hidden="true" />}
                <span><strong>{copy.productLabels[key]}</strong><small>{item.name}</small></span>
              </button>
            );
          })}
        </div>
      </div>

      <nav className={styles.stepper} aria-label={copy.progressLabel}>
        <ol>
          {copy.steps.map((item, index) => {
            const stepIndex = index as JourneyStep;
            const isAvailable = stepIndex <= furthestStep;
            const isCurrent = stepIndex === step;
            return (
              <li key={item.short} data-active={isCurrent} data-complete={stepIndex < step}>
                <button
                  type="button"
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${index + 1}. ${item.title}`}
                  disabled={!isAvailable}
                  onClick={() => moveToStep(stepIndex)}
                >
                  <span>{stepIndex < step ? <CheckCircle2 aria-hidden="true" /> : index + 1}</span>
                  <strong>{item.short}</strong>
                </button>
              </li>
            );
          })}
        </ol>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label={copy.progressLabel}
          aria-valuemin={1}
          aria-valuemax={copy.steps.length}
          aria-valuenow={step + 1}
        >
          <span style={{ width: `${((step + 1) / copy.steps.length) * 100}%` }} />
        </div>
      </nav>

      <div className={styles.stage}>
        <div className={styles.visual} role="group" aria-label={copy.visualLabels[step]}>
          <Image
            key={`${productKey}-${product.images[step]}`}
            src={product.images[step]}
            alt={copy.visualLabels[step]}
            fill
            priority={step === 0}
            sizes="(max-width: 760px) 100vw, 58vw"
            className={styles.sceneImage}
          />
          <div className={styles.sceneShade} aria-hidden="true" />

          <span className={styles.demoChip}><Wine aria-hidden="true" />{product.name}</span>
          <span className={styles.nfcChip}><Tag aria-hidden="true" />NFC</span>

          {step === 0 ? (
            <div className={styles.radioSignal} aria-hidden="true">
              <i /><i /><i />
            </div>
          ) : null}

          <div className={styles.visualBubble} data-step={step} role="status" aria-live="polite">
            {step === 0 ? (
              <>
                <span><Smartphone aria-hidden="true" />{copy.visualReadyLabel}</span>
                <strong>{copy.visualReadyTitle}</strong>
              </>
            ) : null}
            {step === 1 ? (
              <>
                <span><BadgeCheck aria-hidden="true" />{copy.visualReadLabel}</span>
                <strong>{copy.visualReadTitle}</strong>
                <small>{product.name} · {product.lot}</small>
              </>
            ) : null}
            {step === 2 ? (
              <>
                <span><Gift aria-hidden="true" />{copy.visualActionsLabel}</span>
                <strong>{copy.actions[selectedAction].label}</strong>
                <small>{copy.actions[selectedAction].description}</small>
              </>
            ) : null}
            {step === 3 ? (
              <>
                <span><CheckCircle2 aria-hidden="true" />{copy.visualCompleteLabel}</span>
                <strong>{copy.actions[selectedAction].label}</strong>
                <small>{copy.brandSignal}</small>
              </>
            ) : null}
          </div>
        </div>

        <div className={styles.panel}>
          <span className={styles.panelEyebrow}>{current.eyebrow}</span>
          <h3 id="demo-lab-featured-step-title" tabIndex={-1}>{current.title}</h3>
          <p className={styles.panelBody}>{current.body}</p>

          <div className={styles.conceptCard}>
            <span><BadgeCheck aria-hidden="true" />{current.concept}</span>
            <p>{current.conceptBody}</p>
          </div>

          {step === 1 ? (
            <div className={styles.readout} role="region" aria-label={copy.readoutTitle}>
              <span className={styles.readoutTitle}>{copy.readoutTitle}</span>
              <dl>
                {copy.readout.map((item, index) => {
                  const productValue = index === 0
                    ? product.name
                    : index === 1
                      ? product.lot
                      : index === 2
                        ? `${product.region} · ${copy.declaredSuffix}`
                        : item.value;
                  return (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{productValue}</dd>
                    </div>
                  );
                })}
              </dl>
              <p className={styles.boundary}><ShieldCheck aria-hidden="true" />{copy.boundary}</p>
            </div>
          ) : null}

          {step === 2 ? (
            <fieldset className={styles.actions}>
              <legend>{copy.chooseTitle}</legend>
              {(["warranty", "benefit", "support"] as JourneyAction[]).map((action) => {
                const Icon = ACTION_ICONS[action];
                const item = copy.actions[action];
                return (
                  <button
                    key={action}
                    type="button"
                    aria-pressed={selectedAction === action}
                    data-selected={selectedAction === action}
                    onClick={() => selectAction(action)}
                  >
                    <span><Icon aria-hidden="true" /></span>
                    <span><strong>{item.label}</strong><small>{item.description}</small></span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                );
              })}
            </fieldset>
          ) : null}

          {step === 3 ? (
            <div className={styles.result}>
              <span className={styles.resultIcon}><CheckCircle2 aria-hidden="true" /></span>
              <div>
                <small>{copy.chosenLabel}</small>
                <strong>{copy.actions[selectedAction].label}</strong>
                <h4>{copy.resultTitle}</h4>
                <p>{copy.resultBody}</p>
              </div>
            </div>
          ) : null}

          <div className={styles.controls}>
            {step > 0 && step < 3 ? (
              <button type="button" className={styles.secondaryButton} onClick={() => moveToStep((step - 1) as JourneyStep)}>
                <ChevronLeft aria-hidden="true" />{copy.back}
              </button>
            ) : null}

            {step < 2 ? (
              <button type="button" className={styles.primaryButton} onClick={() => moveToStep((step + 1) as JourneyStep)}>
                {current.primary}<ArrowRight aria-hidden="true" />
              </button>
            ) : null}

            {step === 3 ? (
              <>
                <button type="button" className={styles.secondaryButton} onClick={restart}>
                  <RotateCcw aria-hidden="true" />{copy.restart}
                </button>
                <Link href={sunPreviewHref} className={styles.primaryButton} data-sun-preview-handoff>
                  {copy.openPreview}<ArrowRight aria-hidden="true" />
                </Link>
              </>
            ) : null}
          </div>
          <small className={styles.helper}>{copy.helper}</small>
        </div>

        {step === 3 ? (
          <section
            className={styles.businessSignal}
            data-demo-business-signal
            aria-labelledby="demo-business-signal-title"
          >
            <header className={styles.signalHeader}>
              <div>
                <span className={styles.signalEyebrow}><Activity aria-hidden="true" />{copy.signalEyebrow}</span>
                <h3 id="demo-business-signal-title">{copy.signalTitle}</h3>
                <p>{copy.signalIntro}</p>
              </div>
              <span className={styles.signalProvenance}>
                <LockKeyhole aria-hidden="true" />{copy.demoProvenance}
              </span>
            </header>

            <ol className={styles.signalFlow} aria-label={copy.flowLabel}>
              {copy.flow.map((item, index) => {
                const Icon = SIGNAL_FLOW_ICONS[index];
                const detail = index === 2
                  ? `${copy.actions[selectedAction].label} · ${item.detail}`
                  : item.detail;
                return (
                  <li key={item.label}>
                    <span className={styles.signalFlowIcon}><Icon aria-hidden="true" /></span>
                    <span><strong>{item.label}</strong><small>{detail}</small></span>
                  </li>
                );
              })}
            </ol>

            <div className={styles.signalWorkspace}>
              <section className={styles.signalPacket} aria-label={copy.packetLabel}>
                <div className={styles.signalSectionTitle}>
                  <span><Radio aria-hidden="true" /></span>
                  <div><small>{copy.packetLabel}</small><strong>{copy.actions[selectedAction].label}</strong></div>
                </div>
                <dl>
                  <div><dt>{copy.signalFields.event}</dt><dd><code>{actionSignal.event}</code></dd></div>
                  <div><dt>{copy.signalFields.context}</dt><dd>{product.name} · {product.lot}</dd></div>
                  <div><dt>{copy.signalFields.actor}</dt><dd>{copy.actorUnknown}</dd></div>
                  <div><dt>{copy.signalFields.consent}</dt><dd>{copy.consentNotAssumed}</dd></div>
                  <div><dt>{copy.signalFields.location}</dt><dd>{copy.locationNotReported}</dd></div>
                  <div><dt>{copy.signalFields.provenance}</dt><dd>{copy.demoProvenance}</dd></div>
                </dl>
              </section>

              <aside className={styles.signalImpact} aria-label={copy.businessValueLabel}>
                <article>
                  <span><CircleUserRound aria-hidden="true" /></span>
                  <div><small>{copy.customerValueLabel}</small><p>{actionSignal.customerValue}</p></div>
                </article>
                <article>
                  <span><Building2 aria-hidden="true" /></span>
                  <div><small>{copy.businessValueLabel}</small><p>{actionSignal.businessValue}</p></div>
                </article>
                <div className={styles.nextBusinessAction}>
                  <span>{copy.nextBusinessActionLabel}</span>
                  <strong>{actionSignal.nextAction}</strong>
                  <ArrowRight aria-hidden="true" />
                </div>
              </aside>
            </div>

            <section className={styles.heatmapReadiness} aria-labelledby="demo-heatmap-readiness-title">
              <div className={styles.heatmapCopy}>
                <span><Map aria-hidden="true" />{copy.signalFields.location}</span>
                <h4 id="demo-heatmap-readiness-title">{copy.heatmapTitle}</h4>
                <p>{copy.heatmapBody}</p>
                <small>{copy.heatmapFootnote}</small>
              </div>
              <div className={styles.heatmapEmpty} role="status" aria-label={copy.heatmapState}>
                <div className={styles.heatmapEmptyGrid} aria-hidden="true">
                  {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
                </div>
                <span><Map aria-hidden="true" />{copy.heatmapState}</span>
              </div>
            </section>

            <p className={styles.signalBoundary}>
              <ShieldCheck aria-hidden="true" />{copy.signalBoundary}
            </p>
          </section>
        ) : null}
      </div>
    </section>
  );
}
