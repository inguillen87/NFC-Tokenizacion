import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { BackLink } from "../../components/back-link";
import { PublicLinkChip } from "../../components/public-link-chip";
import { getWebI18n } from "../../lib/locale";
import {
  ArrowRight,
  BadgeCheck,
  BookText,
  CircleAlert,
  FileText,
  MessagesSquare,
  Sparkles,
  WandSparkles,
} from "lucide-react";

type GlossaryCopy = {
  eyebrow: string;
  title: string;
  description: string;
  guideLabel: string;
  guideTitle: string;
  guideBody: string;
  jumpTitle: string;
  jumpCards: Array<{ title: string; body: string; tone: "approved" | "avoid" | "say" }>;
  approvedTitle: string;
  approvedLead: string;
  approved: Array<{ term: string; def: string; label: string }>;
  avoidTitle: string;
  avoidLead: string;
  avoid: Array<{ term: string; why: string; sayInstead: string }>;
  canonicalTitle: string;
  canonicalLead: string;
  canonical: string[];
  replacementsTitle: string;
  replacementsLead: string;
  replacements: Array<{ bad: string; good: string }>;
  replacementsBadLabel: string;
  replacementsGoodLabel: string;
  sayInsteadLabel: string;
  usageTitle: string;
  usageLead: string;
  usageCards: Array<{ surface: string; goal: string; line: string }>;
  rulesTitle: string;
  rules: string[];
  helperTitle: string;
  helperBullets: string[];
  quickNavTitle: string;
  quickNav: Array<{ label: string; href: string; tone: "neutral" | "approved" | "avoid" | "say" }>;
  exploreTitle: string;
  exploreLinks: Array<{ label: string; href: string }>;
  docsEyebrow: string;
  docsTitle: string;
  docsBody: string;
  demoEyebrow: string;
  demoTitle: string;
  demoBody: string;
  ctaDocs: string;
  ctaDemo: string;
};

const toneClasses = {
  neutral: "border-white/10 bg-white/5 text-slate-100",
  approved: "border-cyan-300/25 bg-cyan-500/10 text-cyan-100",
  avoid: "border-rose-300/25 bg-rose-500/10 text-rose-100",
  say: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
} as const;

const copyByLocale: Record<"es-AR" | "pt-BR" | "en", GlossaryCopy> = {
  "es-AR": {
    eyebrow: "Language guide comercial",
    title: "Cómo hablar de nexID sin perder claridad",
    description:
      "Guía visual de lenguaje de marca y producto para web, deck, demos, ventas y documentación. Sirve para alinear discurso, evitar claims débiles y mantener una narrativa entendible para cliente, reseller o inversor.",
    guideLabel: "Source of truth",
    guideTitle: "Qué resuelve esta página",
    guideBody:
      "Usala para escribir, vender o revisar copy. Si alguien duda entre cómo presentar la compañía, cómo explicar Verify / Passport / Rights o qué claims evitar, la respuesta debería salir de acá.",
    jumpTitle: "Cómo leer esta guía",
    jumpCards: [
      {
        title: "Approved",
        body: "Lenguaje que expande la categoría y comunica producto real.",
        tone: "approved",
      },
      {
        title: "Avoid / Restricted",
        body: "Términos que achican el mercado, generan ruido o sobreprometen.",
        tone: "avoid",
      },
      {
        title: "Say it like this",
        body: "Frases y reemplazos listos para usar en deck, landing, WhatsApp o demo.",
        tone: "say",
      },
    ],
    approvedTitle: "Términos aprobados",
    approvedLead:
      "Son las expresiones que mejor describen la categoría, el producto y el valor comercial sin encerrar a nexID en una narrativa chica.",
    approved: [
      {
        term: "Identidad física verificable",
        def: "Categoría madre: objeto físico + identidad digital + capa de validación operativa.",
        label: "Categoría",
      },
      {
        term: "Verify",
        def: "Prueba autenticidad, estado, validez y señales de riesgo de una unidad o credencial.",
        label: "Capa 1",
      },
      {
        term: "Passport",
        def: "Gemelo digital con lote, origen, historial, canal, warranty y ownership.",
        label: "Capa 2",
      },
      {
        term: "Rights",
        def: "Derechos digitales: acceso, titularidad, vouchers, perks, garantía, transferencia.",
        label: "Capa 3",
      },
      {
        term: "QR fallback",
        def: "Mismo backend, otro carrier para continuidad operativa y cobertura de adopción.",
        label: "Cobertura",
      },
      {
        term: "Basic / NTAG215",
        def: "Interacción, volumen, serialización, activaciones y warranty de entrada.",
        label: "Perfil",
      },
      {
        term: "Secure / NTAG 424 DNA (TagTamper)",
        def: "Autenticidad fuerte, tamper y evidencia verificable para casos sensibles.",
        label: "Perfil",
      },
    ],
    avoidTitle: "Términos restringidos o a evitar",
    avoidLead:
      "No siempre están “prohibidos” en sentido absoluto, pero sí degradan el posicionamiento o abren preguntas innecesarias.",
    avoid: [
      {
        term: "Empresa de chips NFC",
        why: "Reduce la categoría a hardware commodity y borra la capa de software, validación y operación.",
        sayInstead: "Infraestructura para identidades físicas verificables usando NFC + QR.",
      },
      {
        term: "Empresa de tokenización de vinos",
        why: "Achica el mercado y hace parecer que solo resolvemos una vertical o un formato legal.",
        sayInstead: "Plataforma para productos, credenciales y documentos con despliegues por vertical.",
      },
      {
        term: "Blockchain-first",
        why: "Desordena el mensaje principal para B2B, canal y gobierno si el problema central es autenticidad/operación.",
        sayInstead: "Primero identidad física verificable; después derechos digitales si el caso lo necesita.",
      },
      {
        term: "Imposible de clonar",
        why: "Es un claim absoluto, legalmente riesgoso y comercialmente innecesario.",
        sayInstead: "Diseñado para elevar la confianza y detectar falsificaciones o anomalías.",
      },
      {
        term: "Cold-chain (sin sensor)",
        why: "No prometer sensing si no existe integración real con ese capability.",
        sayInstead: "Trazabilidad, autenticidad y estado operativo según la integración disponible.",
      },
    ],
    canonicalTitle: "Frases canónicas listas para usar",
    canonicalLead:
      "Estas frases sirven como base para hero copy, decks, ventas, introducciones de demo y documentos comerciales.",
    canonical: [
      "Convertimos productos, credenciales y documentos en identidades digitales verificables.",
      "Antifraude protege la verdad del objeto. Tokenización digitaliza derechos sobre ese objeto.",
      "Basic para interacción y escala. Secure para prueba y confianza.",
      "La tokenización no es el inicio: primero identidad física verificable, después derechos digitales.",
    ],
    replacementsTitle: "Reemplazos rápidos",
    replacementsLead:
      "Cuando un término genera ruido, cambiá la formulación por una que preserve precisión y amplitud comercial.",
    replacements: [
      { bad: "Vendemos tags NFC", good: "Operamos identidades físicas verificables sobre carriers como NFC y QR." },
      { bad: "Es una activación con chip", good: "Es una experiencia conectada a una plataforma de validación y derechos." },
      { bad: "Tokenizamos productos", good: "Primero verificamos el objeto y luego digitalizamos derechos sobre él." },
      { bad: "Es solo para vino", good: "Ya aplica a vino, eventos, documentos, credenciales, lujo y sector público." },
    ],
    replacementsBadLabel: "Evitá decir",
    replacementsGoodLabel: "Decilo así",
    sayInsteadLabel: "Decí mejor",
    usageTitle: "Cómo hablar según la superficie",
    usageLead:
      "No todo canal necesita el mismo nivel de detalle. Acá está el framing más útil según dónde estés comunicando o vendiendo.",
    usageCards: [
      {
        surface: "Homepage / hero",
        goal: "Abrir la categoría sin fricción",
        line: "Presentá a nexID como infraestructura para identidades físicas verificables, no como hardware o tokenización aislada.",
      },
      {
        surface: "Deck comercial",
        goal: "Mostrar claridad de producto",
        line: "Usá Verify → Passport → Rights para ordenar la conversación y separar autenticidad, datos y derechos digitales.",
      },
      {
        surface: "Canal / reseller",
        goal: "Vender resultado y margen",
        line: "Priorizá rollout, SKU, batches, activación, trazabilidad y revenue; evitá jerga interna si no agrega valor comercial.",
      },
      {
        surface: "Demo / WhatsApp",
        goal: "Explicar rápido sin sobrecargar",
        line: "Mostrá una prueba concreta de validación y después conectala con passport o rights según el caso.",
      },
    ],
    rulesTitle: "Reglas editoriales de uso",
    rules: [
      "Explicar siempre en orden: Verify → Passport → Rights.",
      "No usar tokenización como categoría principal del hero o la empresa.",
      "No confundir una activación aislada con una plataforma de validación operativa.",
      "Si un dato es demo, debe marcarse como demo o no auditado.",
      "Para reseller o partner: vender canal, margen y outcomes; no jerga interna de arquitectura.",
    ],
    helperTitle: "Checklist antes de publicar o vender",
    helperBullets: [
      "¿El texto amplía la categoría o encierra a nexID en hardware/una vertical?",
      "¿La secuencia Verify / Passport / Rights está clara para alguien nuevo?",
      "¿Hay algún claim absoluto o promesa técnica que no podamos defender?",
    ],
    quickNavTitle: "Ir directo a",
    quickNav: [
      { label: "Approved", href: "#approved", tone: "approved" },
      { label: "Avoid", href: "#avoid", tone: "avoid" },
      { label: "Usage", href: "#usage", tone: "neutral" },
      { label: "Replacements", href: "#replacements", tone: "say" },
    ],
    exploreTitle: "Seguir explorando",
    exploreLinks: [
      { label: "Ver stack Verify → Passport → Rights", href: "/stack" },
      { label: "Abrir docs comercial + técnica", href: "/docs" },
      { label: "Ver demo self-serve", href: "/demo" },
    ],
    docsEyebrow: "Para profundizar",
    docsTitle: "Llevá este lenguaje a la documentación",
    docsBody:
      "Si ya entendiste cómo nombrar la categoría y cada capa de producto, seguí con docs para ver rollout, perfiles de chip, API y FAQ comercial-técnica.",
    demoEyebrow: "Para verlo en acción",
    demoTitle: "Probalo en una demo real",
    demoBody:
      "La mejor forma de fijar el discurso es ver Verify, Passport y Rights funcionando juntos en una superficie operativa y mobile.",
    ctaDocs: "Abrir docs",
    ctaDemo: "Ver demo",
  },
  "pt-BR": {
    eyebrow: "Language guide comercial",
    title: "Como falar da nexID sem perder clareza",
    description:
      "Guia visual de linguagem de marca e produto para site, deck, demos, vendas e documentação. Ajuda a alinhar narrativa, evitar claims fracos e manter um discurso compreensível para cliente, revenda ou investidor.",
    guideLabel: "Source of truth",
    guideTitle: "O que esta página resolve",
    guideBody:
      "Use para escrever, vender ou revisar copy. Se alguém tiver dúvida sobre como apresentar a empresa, explicar Verify / Passport / Rights ou que claims evitar, a resposta deve sair daqui.",
    jumpTitle: "Como ler este guia",
    jumpCards: [
      {
        title: "Approved",
        body: "Linguagem que amplia a categoria e comunica produto real.",
        tone: "approved",
      },
      {
        title: "Avoid / Restricted",
        body: "Termos que encolhem o mercado, geram ruído ou prometem demais.",
        tone: "avoid",
      },
      {
        title: "Say it like this",
        body: "Frases e substituições prontas para deck, landing, WhatsApp ou demo.",
        tone: "say",
      },
    ],
    approvedTitle: "Termos aprovados",
    approvedLead:
      "São as expressões que melhor descrevem categoria, produto e valor comercial sem reduzir a nexID a uma narrativa pequena.",
    approved: [
      {
        term: "Identidade física verificável",
        def: "Categoria principal: objeto físico + identidade digital + camada de validação.",
        label: "Categoria",
      },
      {
        term: "Verify",
        def: "Valida autenticidade, estado, validade e sinais de risco.",
        label: "Camada 1",
      },
      {
        term: "Passport",
        def: "Gêmeo digital com lote, origem, histórico, garantia e ownership.",
        label: "Camada 2",
      },
      {
        term: "Rights",
        def: "Direitos digitais como acesso, titularidade, vouchers, perks e transferência.",
        label: "Camada 3",
      },
      {
        term: "QR fallback",
        def: "Mesmo backend com outro carrier para continuidade e cobertura.",
        label: "Cobertura",
      },
      {
        term: "Basic / NTAG215",
        def: "Interação, volume, serialização e warranty de entrada.",
        label: "Perfil",
      },
      {
        term: "Secure / NTAG 424 DNA (TagTamper)",
        def: "Autenticidade forte e tamper para casos sensíveis.",
        label: "Perfil",
      },
    ],
    avoidTitle: "Termos restritos ou a evitar",
    avoidLead:
      "Nem sempre são proibidos em sentido absoluto, mas degradam o posicionamento ou abrem perguntas desnecessárias.",
    avoid: [
      {
        term: "Empresa de chips NFC",
        why: "Reduz a categoria para hardware commodity e apaga software, validação e operação.",
        sayInstead: "Infraestrutura para identidades físicas verificáveis usando NFC + QR.",
      },
      {
        term: "Empresa de tokenização de vinhos",
        why: "Encolhe o mercado e faz parecer que só resolvemos uma vertical.",
        sayInstead: "Plataforma para produtos, credenciais e documentos com deploy por vertical.",
      },
      {
        term: "Blockchain-first",
        why: "Desorganiza a mensagem principal para B2B, canal e governo.",
        sayInstead: "Primeiro identidade física verificável; depois direitos digitais quando necessário.",
      },
      {
        term: "Impossível de clonar",
        why: "Claim absoluto, arriscado e desnecessário.",
        sayInstead: "Projetado para aumentar confiança e detectar falsificações ou anomalias.",
      },
      {
        term: "Cold-chain (sem sensor)",
        why: "Não prometer sensing sem integração real.",
        sayInstead: "Rastreabilidade, autenticidade e estado operacional conforme a integração disponível.",
      },
    ],
    canonicalTitle: "Frases canônicas prontas para uso",
    canonicalLead:
      "Estas frases servem de base para hero copy, decks, vendas, introduções de demo e documentos comerciais.",
    canonical: [
      "Convertimos produtos, credenciais e documentos em identidades digitais verificáveis.",
      "Antifraude protege a verdade do objeto. Tokenização digitaliza direitos sobre esse objeto.",
      "Basic para interação e escala. Secure para prova e confiança.",
      "Tokenização não é o começo: primeiro identidade física verificável, depois direitos digitais.",
    ],
    replacementsTitle: "Substituições rápidas",
    replacementsLead:
      "Quando um termo gerar ruído, troque por uma formulação mais precisa e comercialmente ampla.",
    replacements: [
      { bad: "Vendemos tags NFC", good: "Operamos identidades físicas verificáveis sobre carriers como NFC e QR." },
      { bad: "É uma ativação com chip", good: "É uma experiência conectada a uma plataforma de validação e direitos." },
      { bad: "Tokenizamos produtos", good: "Primeiro verificamos o objeto e depois digitalizamos direitos sobre ele." },
      { bad: "Serve só para vinho", good: "Também aplica a vinho, eventos, documentos, credenciais, luxo e governo." },
    ],
    replacementsBadLabel: "Evite dizer",
    replacementsGoodLabel: "Diga assim",
    sayInsteadLabel: "Diga melhor",
    usageTitle: "Como falar segundo a superfície",
    usageLead:
      "Nem todo canal precisa do mesmo nível de detalhe. Aqui está o framing mais útil segundo o contexto de comunicação ou venda.",
    usageCards: [
      {
        surface: "Homepage / hero",
        goal: "Abrir a categoria sem fricção",
        line: "Apresente a nexID como infraestrutura para identidades físicas verificáveis, não como hardware ou tokenização isolada.",
      },
      {
        surface: "Deck comercial",
        goal: "Mostrar clareza de produto",
        line: "Use Verify → Passport → Rights para ordenar a conversa e separar autenticidade, dados e direitos digitais.",
      },
      {
        surface: "Canal / revenda",
        goal: "Vender resultado e margem",
        line: "Priorize rollout, SKU, batches, ativação, rastreabilidade e revenue; evite jargão interno se não agregar valor comercial.",
      },
      {
        surface: "Demo / WhatsApp",
        goal: "Explicar rápido sem sobrecarga",
        line: "Mostre uma prova concreta de validação e depois conecte com passport ou rights conforme o caso.",
      },
    ],
    rulesTitle: "Regras editoriais",
    rules: [
      "Explicar sempre em ordem: Verify → Passport → Rights.",
      "Não usar tokenização como categoria principal do hero ou da empresa.",
      "Não confundir ativação isolada com plataforma de validação operacional.",
      "Se um dado for demo, marcar como demo ou não auditado.",
      "Para canal/revenda: vender margem e outcomes, não jargão interno.",
    ],
    helperTitle: "Checklist antes de publicar ou vender",
    helperBullets: [
      "O texto amplia a categoria ou reduz a nexID a hardware/uma vertical?",
      "A sequência Verify / Passport / Rights está clara para alguém novo?",
      "Existe algum claim absoluto ou promessa técnica difícil de sustentar?",
    ],
    quickNavTitle: "Ir direto para",
    quickNav: [
      { label: "Approved", href: "#approved", tone: "approved" },
      { label: "Avoid", href: "#avoid", tone: "avoid" },
      { label: "Usage", href: "#usage", tone: "neutral" },
      { label: "Replacements", href: "#replacements", tone: "say" },
    ],
    exploreTitle: "Continuar explorando",
    exploreLinks: [
      { label: "Ver stack Verify → Passport → Rights", href: "/stack" },
      { label: "Abrir docs comercial + técnica", href: "/docs" },
      { label: "Ver demo self-serve", href: "/demo" },
    ],
    docsEyebrow: "Para aprofundar",
    docsTitle: "Leve esta linguagem para a documentação",
    docsBody:
      "Se você já entendeu como nomear a categoria e cada camada do produto, siga para docs para ver rollout, perfis de chip, API e FAQ comercial-técnica.",
    demoEyebrow: "Para ver em ação",
    demoTitle: "Teste em uma demo real",
    demoBody:
      "A melhor forma de fixar o discurso é ver Verify, Passport e Rights funcionando juntos em uma superfície operacional e mobile.",
    ctaDocs: "Abrir docs",
    ctaDemo: "Ver demo",
  },
  en: {
    eyebrow: "Commercial language guide",
    title: "How to talk about nexID without losing clarity",
    description:
      "A visual brand and product language guide for website, decks, demos, sales and documentation. Use it to align positioning, avoid weak claims and keep the story understandable for buyers, resellers and investors.",
    guideLabel: "Source of truth",
    guideTitle: "What this page solves",
    guideBody:
      "Use this page to write, sell or review copy. If someone is unsure how to describe the company, explain Verify / Passport / Rights, or avoid misleading claims, this should be the answer hub.",
    jumpTitle: "How to read this guide",
    jumpCards: [
      {
        title: "Approved",
        body: "Language that expands the category and communicates the real product.",
        tone: "approved",
      },
      {
        title: "Avoid / Restricted",
        body: "Terms that shrink the market, create noise or overpromise.",
        tone: "avoid",
      },
      {
        title: "Say it like this",
        body: "Ready-to-use phrases and substitutions for decks, landings, WhatsApp or demos.",
        tone: "say",
      },
    ],
    approvedTitle: "Approved terms",
    approvedLead:
      "These are the strongest ways to describe the category, the product and the commercial value without boxing nexID into a narrow narrative.",
    approved: [
      {
        term: "Verifiable physical identity",
        def: "Core category: physical object + digital identity + operational validation layer.",
        label: "Category",
      },
      {
        term: "Verify",
        def: "Proves authenticity, state, validity and risk signals for a unit or credential.",
        label: "Layer 1",
      },
      {
        term: "Passport",
        def: "Digital twin with batch, origin, lifecycle, warranty and ownership.",
        label: "Layer 2",
      },
      {
        term: "Rights",
        def: "Digital rights such as access, ownership, vouchers, perks, warranty and transfer.",
        label: "Layer 3",
      },
      {
        term: "QR fallback",
        def: "Same backend with another carrier for continuity and adoption coverage.",
        label: "Coverage",
      },
      {
        term: "Basic / NTAG215",
        def: "Interaction, volume, serialization and entry-level warranty flows.",
        label: "Profile",
      },
      {
        term: "Secure / NTAG 424 DNA (TagTamper)",
        def: "High-trust authenticity and tamper evidence for sensitive use cases.",
        label: "Profile",
      },
    ],
    avoidTitle: "Restricted or avoid terms",
    avoidLead:
      "Not always literally forbidden, but they weaken positioning or trigger unnecessary objections.",
    avoid: [
      {
        term: "NFC chip company",
        why: "It reduces the category to commodity hardware and hides the software + validation stack.",
        sayInstead: "Infrastructure for verifiable physical identities using NFC + QR.",
      },
      {
        term: "Wine tokenization company",
        why: "It narrows the market and makes the company sound vertical-specific only.",
        sayInstead: "A platform for products, credentials and documents with vertical deployments.",
      },
      {
        term: "Blockchain-first",
        why: "It distracts from the core B2B, channel and public-sector value proposition.",
        sayInstead: "First establish a verifiable physical identity; add digital rights when needed.",
      },
      {
        term: "Impossible to clone",
        why: "Absolute claim with legal and commercial downside.",
        sayInstead: "Designed to raise trust and detect counterfeits or anomalies.",
      },
      {
        term: "Cold-chain (without sensor)",
        why: "Do not imply sensing unless a real integration exists.",
        sayInstead: "Traceability, authenticity and operational state according to the available integration.",
      },
    ],
    canonicalTitle: "Canonical ready-to-use phrases",
    canonicalLead:
      "Use these lines as starting points for hero copy, decks, sales intros, demo intros and commercial docs.",
    canonical: [
      "We turn products, credentials and documents into verifiable digital identities.",
      "Anti-fraud protects the truth of the object. Tokenization digitizes rights on top of that object.",
      "Basic for interaction and scale. Secure for proof and trust.",
      "Tokenization is not step one: first establish a verifiable physical identity, then add digital rights.",
    ],
    replacementsTitle: "Quick replacements",
    replacementsLead:
      "When wording creates friction, switch to a formulation that is more accurate and commercially scalable.",
    replacements: [
      { bad: "We sell NFC tags", good: "We operate verifiable physical identities on carriers such as NFC and QR." },
      { bad: "It is a chip activation", good: "It is an experience connected to a validation and rights platform." },
      { bad: "We tokenize products", good: "We first verify the object and then digitize rights on top of it." },
      { bad: "It is only for wine", good: "It already applies to wine, events, documents, credentials, luxury and public-sector flows." },
    ],
    replacementsBadLabel: "Avoid saying",
    replacementsGoodLabel: "Say this instead",
    sayInsteadLabel: "Say instead",
    usageTitle: "How to talk by surface",
    usageLead:
      "Not every channel needs the same level of detail. Use the framing below depending on where you are communicating or selling.",
    usageCards: [
      {
        surface: "Homepage / hero",
        goal: "Open the category with low friction",
        line: "Present nexID as infrastructure for verifiable physical identities, not as hardware or isolated tokenization.",
      },
      {
        surface: "Sales deck",
        goal: "Show product clarity",
        line: "Use Verify → Passport → Rights to structure the conversation and separate authenticity, data and digital rights.",
      },
      {
        surface: "Channel / reseller",
        goal: "Sell outcome and margin",
        line: "Prioritize rollout, SKU, batches, activation, traceability and revenue; avoid internal jargon unless it helps the buyer.",
      },
      {
        surface: "Demo / WhatsApp",
        goal: "Explain quickly without overload",
        line: "Start with a concrete validation proof and only then connect it to passport or rights depending on the use case.",
      },
    ],
    rulesTitle: "Editorial usage rules",
    rules: [
      "Always explain in order: Verify → Passport → Rights.",
      "Do not position tokenization as the main category for the hero or the company.",
      "Do not confuse a one-off activation with an operational validation platform.",
      "If data is demo data, label it as demo or unaudited.",
      "For reseller/partner pages, sell margin and outcomes, not internal architecture jargon.",
    ],
    helperTitle: "Checklist before publishing or selling",
    helperBullets: [
      "Does the copy expand the category or trap nexID inside hardware / one vertical?",
      "Is the Verify / Passport / Rights sequence clear for a first-time reader?",
      "Is there any absolute claim or technical promise we cannot defend?",
    ],
    quickNavTitle: "Jump straight to",
    quickNav: [
      { label: "Approved", href: "#approved", tone: "approved" },
      { label: "Avoid", href: "#avoid", tone: "avoid" },
      { label: "Usage", href: "#usage", tone: "neutral" },
      { label: "Replacements", href: "#replacements", tone: "say" },
    ],
    exploreTitle: "Keep exploring",
    exploreLinks: [
      { label: "View the Verify → Passport → Rights stack", href: "/stack" },
      { label: "Open commercial + technical docs", href: "/docs" },
      { label: "See the self-serve demo", href: "/demo" },
    ],
    docsEyebrow: "Go deeper",
    docsTitle: "Carry this language into the docs",
    docsBody:
      "Once the naming and product layers are clear, move into docs to review rollout standards, chip profiles, API surfaces and the short commercial FAQ.",
    demoEyebrow: "See it live",
    demoTitle: "Validate the story in a real demo",
    demoBody:
      "The fastest way to internalize the language is to see Verify, Passport and Rights working together in an operational and mobile experience.",
    ctaDocs: "Open docs",
    ctaDemo: "View demo",
  },
};

export default async function GlossaryPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink href="/docs" />
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="p-6 md:p-7">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" />
            {copy.guideLabel}
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white md:text-3xl">{copy.guideTitle}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">{copy.guideBody}</p>
        </Card>

        <Card className="p-6 md:p-7">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <WandSparkles className="h-4 w-4 text-cyan-300" />
            {copy.helperTitle}
          </p>
          <div className="mt-4 grid gap-3">
            {copy.helperBullets.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20"
              >
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            {copy.jumpTitle}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
          {copy.jumpCards.map((card) => (
            <Card key={card.title} className="p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${toneClasses[card.tone]}`}>
                {card.title}
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{card.body}</p>
            </Card>
          ))}
          </div>
        </div>

        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.quickNavTitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {copy.quickNav.map((item) => (
              <PublicLinkChip
                key={item.href}
                href={item.href}
                variant={
                  item.tone === "neutral"
                    ? "slate"
                    : item.tone === "approved"
                      ? "emerald"
                      : item.tone === "avoid"
                        ? "amber"
                        : item.tone === "say"
                          ? "cyan"
                          : "slate"
                }
                className="uppercase tracking-[0.16em] font-semibold"
              >
                {item.label}
              </PublicLinkChip>
            ))}
          </div>
        </Card>
      </div>

      <Card id="approved" className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
              <BadgeCheck className="h-5 w-5 text-cyan-300" />
              {copy.approvedTitle}
            </h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">{copy.approvedLead}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {copy.approved.map((item) => (
            <div
              key={item.term}
              className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/35"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-cyan-100">{item.term}</p>
                <span className="rounded-full border border-cyan-300/25 bg-slate-950/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                  {item.label}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">{item.def}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card id="avoid" className="p-6">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <CircleAlert className="h-5 w-5 text-rose-300" />
            {copy.avoidTitle}
          </h3>
          <p className="mt-2 text-sm text-slate-300">{copy.avoidLead}</p>
          <div className="mt-4 grid gap-3">
            {copy.avoid.map((item) => (
              <div key={item.term} className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4">
                <p className="text-sm font-semibold text-rose-100">{item.term}</p>
                <p className="mt-2 text-sm leading-6 text-rose-50/90">{item.why}</p>
                <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  <span className="font-semibold text-emerald-200">{copy.sayInsteadLabel}:</span> {item.sayInstead}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <FileText className="h-5 w-5 text-emerald-300" />
            {copy.canonicalTitle}
          </h3>
          <p className="mt-2 text-sm text-slate-300">{copy.canonicalLead}</p>
          <div className="mt-4 grid gap-3">
            {copy.canonical.map((line) => (
              <div
                key={line}
                className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-50"
              >
                {line}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card id="usage" className="p-6">
        <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
          <MessagesSquare className="h-5 w-5 text-cyan-300" />
          {copy.usageTitle}
        </h3>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">{copy.usageLead}</p>
        <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {copy.usageCards.map((item) => (
            <div key={item.surface} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/25">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{item.surface}</p>
              <p className="mt-2 text-sm font-semibold text-white">{item.goal}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.line}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card id="replacements" className="p-6">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <MessagesSquare className="h-5 w-5 text-cyan-300" />
            {copy.replacementsTitle}
          </h3>
          <p className="mt-2 text-sm text-slate-300">{copy.replacementsLead}</p>
          <div className="mt-4 grid gap-3">
            {copy.replacements.map((item) => (
              <div key={`${item.bad}-${item.good}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">{copy.replacementsBadLabel}</p>
                <p className="mt-1 text-sm text-rose-100">{item.bad}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">{copy.replacementsGoodLabel}</p>
                <p className="mt-1 text-sm text-emerald-100">{item.good}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <BookText className="h-5 w-5 text-cyan-300" />
            {copy.rulesTitle}
          </h3>
          <div className="mt-4 grid gap-3">
            {copy.rules.map((line) => (
              <div key={line} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {line}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.exploreTitle}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {copy.exploreLinks.map((item) => (
            <PublicLinkChip key={item.href} href={item.href} size="md" trailingArrow>
              {item.label}
            </PublicLinkChip>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">{copy.docsEyebrow}</p>
          <h3 className="mt-3 text-xl font-semibold text-white">{copy.docsTitle}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{copy.docsBody}</p>
          <Link
            href="/docs"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-transform duration-200 hover:-translate-y-0.5"
          >
            {copy.ctaDocs}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(16,185,129,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">{copy.demoEyebrow}</p>
          <h3 className="mt-3 text-xl font-semibold text-white">{copy.demoTitle}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{copy.demoBody}</p>
          <Link
            href="/demo"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 transition-transform duration-200 hover:-translate-y-0.5"
          >
            {copy.ctaDemo}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    </main>
  );
}
