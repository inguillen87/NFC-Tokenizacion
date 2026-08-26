"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { schedulingUrls } from "@product/config";
import { normalizeCommercialVertical } from "../lib/demo-lab-vertical-story";

type AppLocale = "es-AR" | "pt-BR" | "en";

type Intent = "demo" | "sales" | "reseller" | "quote";

type LeadForm = {
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  role: string;
  vertical: string;
  volume: string;
  message: string;
};

type IntentMeta = {
  title: string;
  subtitle: string;
  source: string;
  role: string;
  vertical: string;
  volume: string;
  message: string;
  badge?: string;
};

const copy: Record<AppLocale, Record<string, string>> = {
  "es-AR": {
    demo: "Solicitar demostración",
    sales: "Hablar con ventas",
    reseller: "Quiero ser distribuidor",
    quote: "Solicitar presupuesto",
    subtitle: "Completá tus datos para que el equipo comercial prepare una respuesta adecuada.",
    submit: "Enviar",
    submitted: "Enviado",
    close: "Cerrar",
    success: "Solicitud recibida. El equipo comercial la revisará y se comunicará con vos.",
    error: "No se pudo enviar. Reintentá en unos segundos.",
    hint: "Solicitud",
    meeting: "Agendar reunión",
    meetingHint: "Reservar un horario",
    nameField: "Nombre",
    companyField: "Empresa",
    emailField: "Correo electrónico",
    phoneField: "WhatsApp",
    countryField: "País",
    roleField: "Cargo / interés",
    verticalField: "Industria",
    volumeField: "Unidades estimadas al año",
    messageField: "Mensaje",
  },
  "pt-BR": {
    demo: "Solicitar demonstração",
    sales: "Falar com vendas",
    reseller: "Quero ser revendedor",
    quote: "Solicitar orçamento",
    subtitle: "Preencha seus dados para que a equipe comercial prepare uma resposta adequada.",
    submit: "Enviar",
    submitted: "Enviado",
    close: "Fechar",
    success: "Solicitação recebida. A equipe comercial fará a análise e entrará em contato.",
    error: "Não foi possível enviar agora.",
    hint: "Solicitação",
    meeting: "Agendar reunião",
    meetingHint: "Reservar um horário",
    nameField: "Nome",
    companyField: "Empresa",
    emailField: "E-mail",
    phoneField: "WhatsApp",
    countryField: "País",
    roleField: "Cargo / interesse",
    verticalField: "Setor",
    volumeField: "Unidades estimadas por ano",
    messageField: "Mensagem",
  },
  en: {
    demo: "Request demo",
    sales: "Talk to sales",
    reseller: "Become reseller",
    quote: "Request quote",
    subtitle: "Share your details so our commercial team can prepare the right response.",
    submit: "Submit",
    submitted: "Submitted",
    close: "Close",
    success: "Request received. Our commercial team will review it and contact you using the details provided.",
    error: "Could not submit right now.",
    hint: "Detected context",
    meeting: "Schedule meeting",
    meetingHint: "Reserve live slot",
    nameField: "Name",
    companyField: "Company",
    emailField: "Email",
    phoneField: "Phone / WhatsApp",
    countryField: "Country",
    roleField: "Role / interest",
    verticalField: "Vertical",
    volumeField: "Annual volume",
    messageField: "Message",
  },
};

const verticalLabelsByLocale: Record<AppLocale, Record<string, string>> = {
  "es-AR": {
    agro: "Agro e insumos",
    wine: "Vinos y bodegas",
    pharma: "Farmacéutica y salud",
    events: "Eventos",
    cosmetics: "Cosmética y cuidado personal",
    luxury: "Bienes de alta gama",
    textile: "Textil y moda",
    logistics: "Logística",
    hospitality: "Hotelería",
    chemicals: "Industria química",
  },
  "pt-BR": {
    agro: "Agro e insumos",
    wine: "Vinhos e adegas",
    pharma: "Farmacêutica e saúde",
    events: "Eventos",
    cosmetics: "Cosméticos e cuidados pessoais",
    luxury: "Produtos de alto padrão",
    textile: "Têxtil e moda",
    logistics: "Logística",
    hospitality: "Hotelaria",
    chemicals: "Indústria química",
  },
  en: {
    agro: "Agriculture and inputs",
    wine: "Wine and wineries",
    pharma: "Pharmaceuticals and health",
    events: "Events",
    cosmetics: "Cosmetics and personal care",
    luxury: "Luxury goods",
    textile: "Textiles and fashion",
    logistics: "Logistics",
    hospitality: "Hospitality",
    chemicals: "Chemicals",
  },
};

function getVisibleVertical(vertical: string, locale: AppLocale) {
  return verticalLabelsByLocale[locale][vertical] || vertical;
}

function getSubmittedVertical(visibleVertical: string, locale: AppLocale) {
  const candidate = visibleVertical.trim().toLocaleLowerCase(locale);
  const localizedMatch = Object.entries(verticalLabelsByLocale[locale])
    .find(([, label]) => label.toLocaleLowerCase(locale) === candidate);
  return localizedMatch?.[0] || normalizeCommercialVertical(visibleVertical);
}

const intentMetaByLocale: Record<AppLocale, Record<string, IntentMeta>> = {
  "es-AR": {
    default_demo: {
      title: "Demostración guiada",
      subtitle: "Contanos el caso y preparamos el recorrido más adecuado.",
      source: "demo_request",
      role: "Evaluación comercial",
      vertical: "",
      volume: "",
      message: "Quiero una demostración guiada para evaluar nexID.",
      badge: "demostración",
    },
    company_rollout: {
      title: "Evaluación para empresa",
      subtitle: "Revisamos el alcance, el tipo de etiqueta y el modelo operativo para la implementación.",
      source: "intent_company_rollout",
      role: "Responsable de compras",
      vertical: "",
      volume: "50000",
      message: "Quiero evaluar nexID para mi empresa y definir el alcance, la etiqueta, las integraciones y la operación.",
      badge: "empresa",
    },
    pricing_starter: {
      title: "Primer piloto",
      subtitle: "Definamos el alcance, las unidades, el tipo de etiqueta y el criterio de aceptación.",
      source: "pricing_starter",
      role: "Responsable del piloto",
      vertical: "wine",
      volume: "10000",
      message: "Quiero cotizar un primer piloto y definir el alcance, el tipo de etiqueta, las unidades y el criterio de aceptación.",
      badge: "piloto",
    },
    pricing_pro: {
      title: "Implementación protegida",
      subtitle: "Revisemos las etiquetas protegidas, las señales de apertura, las integraciones y la operación.",
      source: "pricing_pro",
      role: "Responsable de la implementación",
      vertical: "pharma",
      volume: "50000",
      message: "Quiero evaluar una implementación protegida, con gestión de clientes y acompañamiento operativo.",
      badge: "avanzado",
    },
    pricing_enterprise: {
      title: "Evaluación para gran empresa",
      subtitle: "Definamos organizaciones, integraciones, gobierno, niveles de servicio y proceso de compras.",
      source: "pricing_enterprise",
      role: "Responsable de compras empresariales",
      vertical: "pharma",
      volume: "100000",
      message: "Quiero evaluar nexID para varias organizaciones, con integraciones, pasaporte digital del producto, seguridad y despliegue en varios países.",
      badge: "gran empresa",
    },
    pricing_roi: {
      title: "Escenario de valor modelado",
      subtitle: "Revisamos los supuestos, los convertimos en indicadores de piloto y separamos la exposición del retorno validado.",
      source: "pricing_roi_model",
      role: "Responsable del caso de negocio",
      vertical: "pharma",
      volume: "50000",
      message: "Quiero revisar un escenario de valor modelado y convertirlo en indicadores medibles para un piloto.",
      badge: "análisis",
    },
    buyer_profile: {
      title: "Diagnóstico del perfil de compra",
      subtitle: "Te ayudamos a adaptar la propuesta comercial para marcas, distribuidores, organismos públicos u operadores.",
      source: "intent_buyer_profile",
      role: "Definición de compra",
      vertical: "wine",
      volume: "",
      message: "Quiero identificar el perfil de compra correcto y la propuesta comercial recomendada.",
      badge: "perfil",
    },
    demo_lab: {
      title: "Demostración técnica",
      subtitle: "Pedí un recorrido acompañado por el flujo real de validación.",
      source: "intent_demo_lab",
      role: "Evaluación técnica",
      vertical: "events",
      volume: "10000",
      message: "Quiero ver una demostración técnica con acompañamiento comercial o especializado.",
      badge: "demostración",
    },
    investor_snapshot: {
      title: "Conversación con inversores",
      subtitle: "Tomamos tu contexto y preparamos una presentación clara sobre la plataforma, su ventaja competitiva y su expansión.",
      source: "intent_investor_snapshot",
      role: "Inversor / socio estratégico",
      vertical: "pharma",
      volume: "",
      message: "Quiero conversar sobre nexID como inversión, su ventaja competitiva, su hoja de ruta y su expansión.",
      badge: "inversión",
    },
    brands: {
      title: "Caso para marcas y grandes empresas",
      subtitle: "Trabajamos sobre ingresos protegidos, posventa y control del canal.",
      source: "audience_brands",
      role: "Marca / gran empresa",
      vertical: "wine",
      volume: "50000",
      message: "Quiero evaluar nexID para una marca o empresa, con foco en prevención de fraude, gestión de clientes y control del canal.",
      badge: "marca",
    },
    reseller_program: {
      title: "Programa para distribuidores",
      subtitle: "Conversemos sobre margen recurrente, puesta en marcha y operación con marca propia.",
      source: "audience_reseller",
      role: "Distribuidor / integrador",
      vertical: "events",
      volume: "25000",
      message: "Quiero sumarme al programa para distribuidores y conocer el margen, la puesta en marcha y el acompañamiento comercial.",
      badge: "distribución",
    },
    government_stack: {
      title: "Sector público y trazabilidad",
      subtitle: "Hablemos de controles, cadena de custodia y evidencia verificable.",
      source: "audience_government",
      role: "Gobierno / sector público",
      vertical: "pharma",
      volume: "10000",
      message: "Quiero evaluar nexID para documentos, cadena de custodia o presencia verificable.",
      badge: "sector público",
    },
    customer_demo: {
      title: "Experiencia para el cliente final",
      subtitle: "Diseñamos una demostración simple: acercar el teléfono, validar y acceder a un beneficio.",
      source: "audience_customer",
      role: "Experiencia cliente final",
      vertical: "cosmetics",
      volume: "10000",
      message: "Quiero ver una experiencia simple para cliente final con validación y beneficio.",
      badge: "experiencia",
    },
  },
  "pt-BR": {
    default_demo: {
      title: "Demonstração guiada",
      subtitle: "Conte seu caso e preparamos o percurso mais adequado.",
      source: "demo_request",
      role: "Avaliação comercial",
      vertical: "",
      volume: "",
      message: "Quero uma demonstração guiada para avaliar a nexID.",
      badge: "demonstração",
    },
    company_rollout: {
      title: "Avaliação para empresa",
      subtitle: "Revisamos o escopo, o tipo de etiqueta e o modelo operacional para a implantação.",
      source: "intent_company_rollout",
      role: "Responsável por compras",
      vertical: "",
      volume: "50000",
      message: "Quero avaliar a nexID para minha empresa e definir o escopo, a etiqueta, as integrações e a operação.",
      badge: "empresa",
    },
    pricing_starter: {
      title: "Primeiro piloto",
      subtitle: "Vamos definir o escopo, as unidades, o tipo de etiqueta e o critério de aceitação.",
      source: "pricing_starter",
      role: "Responsável pelo piloto",
      vertical: "wine",
      volume: "10000",
      message: "Quero cotar um primeiro piloto e definir o escopo, o tipo de etiqueta, as unidades e o critério de aceitação.",
      badge: "piloto",
    },
    pricing_pro: {
      title: "Implantação protegida",
      subtitle: "Vamos revisar as etiquetas protegidas, os sinais de abertura, as integrações e a operação.",
      source: "pricing_pro",
      role: "Responsável pela implantação",
      vertical: "pharma",
      volume: "50000",
      message: "Quero avaliar uma implantação protegida, com gestão de clientes e acompanhamento operacional.",
      badge: "avançado",
    },
    pricing_enterprise: {
      title: "Avaliação para grandes empresas",
      subtitle: "Vamos definir organizações, integrações, governança, níveis de serviço e processo de compras.",
      source: "pricing_enterprise",
      role: "Responsável por compras empresariais",
      vertical: "pharma",
      volume: "100000",
      message: "Quero avaliar a nexID para várias organizações, com integrações, passaporte digital do produto, segurança e implantação em vários países.",
      badge: "grande empresa",
    },
    pricing_roi: {
      title: "Cenário de valor modelado",
      subtitle: "Revisamos as premissas, convertemos em indicadores do piloto e separamos a exposição do retorno validado.",
      source: "pricing_roi_model",
      role: "Responsável pelo caso de negócio",
      vertical: "pharma",
      volume: "50000",
      message: "Quero revisar um cenário de valor modelado e transformá-lo em indicadores mensuráveis para um piloto.",
      badge: "análise",
    },
    buyer_profile: {
      title: "Diagnóstico do perfil de compra",
      subtitle: "Ajudamos você a adaptar a proposta comercial para marcas, revendedores, órgãos públicos ou operadores.",
      source: "intent_buyer_profile",
      role: "Definição de compra",
      vertical: "wine",
      volume: "",
      message: "Quero identificar o perfil de compra correto e a proposta comercial recomendada.",
      badge: "perfil",
    },
    demo_lab: {
      title: "Demonstração técnica",
      subtitle: "Solicite um percurso acompanhado pelo fluxo real de validação.",
      source: "intent_demo_lab",
      role: "Avaliação técnica",
      vertical: "events",
      volume: "10000",
      message: "Quero ver uma demonstração técnica com acompanhamento comercial ou especializado.",
      badge: "demonstração",
    },
    investor_snapshot: {
      title: "Conversa com investidor",
      subtitle: "Preparamos uma apresentação clara sobre a plataforma, sua vantagem competitiva e sua expansão.",
      source: "intent_investor_snapshot",
      role: "Investidor / parceiro estratégico",
      vertical: "pharma",
      volume: "",
      message: "Quero conversar sobre a nexID como investimento, sua vantagem competitiva, seus planos de evolução e sua expansão.",
      badge: "investimento",
    },
    brands: {
      title: "Caso para marcas e grandes empresas",
      subtitle: "Entramos por receita protegida, pós-venda e controle de canal.",
      source: "audience_brands",
      role: "Marca / grande empresa",
      vertical: "wine",
      volume: "50000",
      message: "Quero avaliar a nexID para uma marca ou empresa, com foco em prevenção de fraude, gestão de clientes e controle de canal.",
      badge: "marca",
    },
    reseller_program: {
      title: "Programa revendedor",
      subtitle: "Vamos falar de margem recorrente, implantação e operação com marca própria.",
      source: "audience_reseller",
      role: "Revendedor / integrador",
      vertical: "events",
      volume: "25000",
      message: "Quero entrar no programa de revendedores e conhecer a margem, a implantação e o acompanhamento comercial.",
      badge: "revenda",
    },
    government_stack: {
      title: "Setor público e rastreabilidade",
      subtitle: "Falemos de controles, cadeia de custódia e evidência verificável.",
      source: "audience_government",
      role: "Governo / setor público",
      vertical: "pharma",
      volume: "10000",
      message: "Quero avaliar a nexID para documentos, cadeia de custódia ou presença verificável.",
      badge: "setor público",
    },
    customer_demo: {
      title: "Experiência para o cliente final",
      subtitle: "Criamos uma demonstração simples: aproximar o telefone, validar e acessar um benefício.",
      source: "audience_customer",
      role: "Experiência do cliente final",
      vertical: "cosmetics",
      volume: "10000",
      message: "Quero ver uma experiência simples para cliente final com validação e benefício.",
      badge: "experiência",
    },
  },
  en: {
    default_demo: {
      title: "Guided demo",
      subtitle: "Share your use case and we will align the right demo pack.",
      source: "demo_request",
      role: "Commercial evaluation",
      vertical: "",
      volume: "",
      message: "I want a guided demo to evaluate nexID.",
      badge: "demo",
    },
    company_rollout: {
      title: "Company evaluation",
      subtitle: "Go straight into rollout, chip profile and operating model.",
      source: "intent_company_rollout",
      role: "Enterprise buyer",
      vertical: "",
      volume: "50000",
      message: "I want to evaluate nexID for my company and understand rollout, chip profile and operations.",
      badge: "company",
    },
    pricing_starter: {
      title: "QR / NFC pilot",
      subtitle: "Validate scope, units, carrier and acceptance criteria for the first pilot.",
      source: "pricing_starter",
      role: "Pilot buyer",
      vertical: "wine",
      volume: "10000",
      message: "I want to quote a Starter pilot and define scope, carrier, units and acceptance criteria.",
      badge: "starter",
    },
    pricing_pro: {
      title: "Secure rollout",
      subtitle: "Review cryptographic NFC, tamper, integrations and rollout operations.",
      source: "pricing_pro",
      role: "Rollout buyer",
      vertical: "pharma",
      volume: "50000",
      message: "I want to evaluate Pro with secure NFC, tamper, CRM and implementation support.",
      badge: "pro",
    },
    pricing_enterprise: {
      title: "Enterprise evaluation",
      subtitle: "Shape multi-tenant scope, integrations, governance, SLA and procurement.",
      source: "pricing_enterprise",
      role: "Enterprise buyer",
      vertical: "pharma",
      volume: "100000",
      message: "I want to evaluate nexID Enterprise: tenants, API, DPP, security, SLA and multi-country rollout.",
      badge: "enterprise",
    },
    pricing_roi: {
      title: "Modeled value scenario",
      subtitle: "Review assumptions, convert them into pilot KPIs and keep exposure separate from validated return.",
      source: "pricing_roi_model",
      role: "Buyer / business case",
      vertical: "pharma",
      volume: "50000",
      message: "I want to review a modeled value scenario and turn it into measurable pilot KPIs.",
      badge: "business case",
    },
    buyer_profile: {
      title: "Buyer profile diagnosis",
      subtitle: "We help tailor the pitch for brand, reseller, government or operator.",
      source: "intent_buyer_profile",
      role: "Buyer discovery",
      vertical: "wine",
      volume: "",
      message: "I want to identify the right buyer profile and recommended sales pitch.",
      badge: "buyer",
    },
    demo_lab: {
      title: "Technical demo / Demo Lab",
      subtitle: "Request a guided session to walk through the live validation flow.",
      source: "intent_demo_lab",
      role: "Technical demo",
      vertical: "events",
      volume: "10000",
      message: "I want to review Demo Lab with commercial or technical guidance.",
      badge: "demo lab",
    },
    investor_snapshot: {
      title: "Investor conversation",
      subtitle: "We frame the right platform, moat and expansion narrative for your context.",
      source: "intent_investor_snapshot",
      role: "Investor / strategic partner",
      vertical: "pharma",
      volume: "",
      message: "I want to discuss nexID from the investor angle, including moat, roadmap and expansion.",
      badge: "investor",
    },
    brands: {
      title: "Brands / enterprise case",
      subtitle: "Lead with protected revenue, after-sales and channel control.",
      source: "audience_brands",
      role: "Brand / enterprise",
      vertical: "wine",
      volume: "50000",
      message: "I want to evaluate nexID for a brand or enterprise with anti-fraud, CRM and channel control in mind.",
      badge: "brand",
    },
    reseller_program: {
      title: "Reseller program",
      subtitle: "Discuss recurring margin, billable setup and white-label operations.",
      source: "audience_reseller",
      role: "Reseller / integrator",
      vertical: "events",
      volume: "25000",
      message: "I want to join the reseller program and understand margin, setup and commercial support.",
      badge: "reseller",
    },
    government_stack: {
      title: "Government / verifiable stack",
      subtitle: "Talk through auditability, chain of custody and verifiable evidence.",
      source: "audience_government",
      role: "Government / public sector",
      vertical: "pharma",
      volume: "10000",
      message: "I want to evaluate nexID for documents, chain of custody or proof-of-presence use cases.",
      badge: "gov",
    },
    customer_demo: {
      title: "End-user experience",
      subtitle: "We can shape a simple tap, validate and unlock-value demo.",
      source: "audience_customer",
      role: "End customer experience",
      vertical: "cosmetics",
      volume: "10000",
      message: "I want to see a simple end-user experience with validation and benefit unlock.",
      badge: "ux",
    },
  },
};

function getLocale(fallback: AppLocale): AppLocale {
  const match = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] : fallback;
  return match === "en" || match === "pt-BR" || match === "es-AR" ? match : fallback;
}

export function CommercialContactModal({ initialLocale = "es-AR" }: { initialLocale?: AppLocale }) {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const intent = search.get("contact") as Intent | null;
  const intentKey = search.get("intent") || "";
  const open = intent === "demo" || intent === "sales" || intent === "reseller" || intent === "quote";
  const locale = getLocale(initialLocale);
  const t = copy[locale];
  const intentCopy = useMemo(() => {
    const fallbackKey = intent === "quote" ? "company_rollout" : intent === "reseller" ? "reseller_program" : "default_demo";
    return intentMetaByLocale[locale][intentKey] || intentMetaByLocale[locale][fallbackKey];
  }, [intent, intentKey, locale]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [form, setForm] = useState<LeadForm>({ name: "", email: "", phone: "", company: "", country: "", role: "", vertical: "", volume: "", message: "" });
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const overlay = overlayRef.current;
    const siblings = Array.from(overlay?.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay)
      .map((element) => ({
        element,
        inert: element.hasAttribute("inert"),
        ariaHidden: element.getAttribute("aria-hidden"),
      }));
    siblings.forEach(({ element }) => {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        router.replace(pathname, { scroll: false });
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      siblings.forEach(({ element, inert, ariaHidden }) => {
        if (!inert) element.removeAttribute("inert");
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
    };
  }, [open, pathname, router]);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      return;
    }

    const vertical = normalizeCommercialVertical(search.get("vertical") || intentCopy.vertical);
    const visibleVertical = getVisibleVertical(vertical, locale);
    const role = search.get("role") || intentCopy.role;
    const volume = search.get("volume") || intentCopy.volume;
    const message = search.get("message") || intentCopy.message;

    setStatus("idle");
    setForm((prev) => ({
      ...prev,
      role,
      vertical: visibleVertical,
      volume,
      message,
    }));
  }, [intentCopy, open, search]);

  const source = useMemo(() => {
    if (intentKey && intentMetaByLocale[locale][intentKey]) return intentMetaByLocale[locale][intentKey].source;
    if (intent === "reseller") return "reseller_cta";
    if (intent === "sales") return "hero_cta";
    if (intent === "quote") return "pricing_cta";
    return "demo_request";
  }, [intent, intentKey, locale]);

  function close() {
    router.replace(pathname, { scroll: false });
  }

  async function submit() {
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    const submittedVertical = getSubmittedVertical(form.vertical, locale);
    const contact = [form.email.trim(), form.phone.trim()].filter(Boolean).join(" | ");
    const notes = [
      `name=${form.name}`,
      `role=${form.role}`,
      `message=${form.message}`,
      `phone=${form.phone}`,
      `email=${form.email}`,
      intentKey ? `intent=${intentKey}` : "",
      intentCopy.title ? `context=${intentCopy.title}` : "",
    ].filter(Boolean).join(" | ");

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company,
        country: form.country,
        vertical: submittedVertical,
        role_interest: form.role,
        estimated_volume: form.volume,
        message: form.message,
        contact,
        volume: Number(form.volume || 0),
        tag_type: submittedVertical === "events" ? "basic" : "secure",
        source,
        notes,
      }),
    }).catch(() => null);

    if (!res?.ok) {
      setStatus("error");
      return;
    }

    setStatus("ok");
  }

  if (!open || !intent) return null;

  return (
    <div ref={overlayRef} id="contact-modal" className="contact-modal-overlay fixed inset-0 z-[90] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" className="contact-modal-card w-full max-w-2xl rounded-2xl border border-white/15 bg-slate-950 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="contact-modal-title" className="text-xl font-semibold text-white">{intentCopy.title || t[intent]}</h3>
              {intentCopy.badge ? <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-cyan-200">{t.hint}: {intentCopy.badge}</span> : null}
            </div>
            <p className="mt-1 text-sm text-slate-300">{intentCopy.subtitle || t.subtitle}</p>
          </div>
          <button ref={closeButtonRef} suppressHydrationWarning onClick={close} className="contact-modal-close rounded-md border border-white/20 px-3 py-1 text-xs text-slate-300">{t.close}</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input suppressHydrationWarning className="contact-modal-field rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" aria-label={t.nameField} placeholder={t.nameField} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input suppressHydrationWarning className="contact-modal-field rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" aria-label={t.companyField} placeholder={t.companyField} autoComplete="organization" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input suppressHydrationWarning type="email" className="contact-modal-field rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" aria-label={t.emailField} placeholder={t.emailField} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input suppressHydrationWarning type="tel" className="contact-modal-field rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" aria-label={t.phoneField} placeholder={t.phoneField} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input suppressHydrationWarning className="contact-modal-field rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" aria-label={t.countryField} placeholder={t.countryField} autoComplete="country-name" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <input suppressHydrationWarning className="contact-modal-field rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" aria-label={t.roleField} placeholder={t.roleField} autoComplete="organization-title" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <input suppressHydrationWarning className="contact-modal-field rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" aria-label={t.verticalField} placeholder={t.verticalField} value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} />
          <input suppressHydrationWarning inputMode="numeric" className="contact-modal-field rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" aria-label={t.volumeField} placeholder={t.volumeField} value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} />
          <textarea suppressHydrationWarning className="contact-modal-field md:col-span-2 min-h-[88px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" aria-label={t.messageField} placeholder={t.messageField} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className={`text-xs ${status === "error" ? "text-rose-300" : "text-emerald-300"}`}>{status === "ok" ? t.success : status === "error" ? t.error : ""}</p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={schedulingUrls.meeting}
              target="_blank"
              rel="noreferrer"
              className="contact-modal-calendar rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              {t.meeting}
            </a>
            <button suppressHydrationWarning onClick={submit} disabled={status === "loading" || status === "ok"} className="contact-modal-submit rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40">{status === "ok" ? t.submitted : t.submit}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
