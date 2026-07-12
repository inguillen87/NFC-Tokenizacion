"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { schedulingUrls } from "@product/config";

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
    demo: "Pedir demo",
    sales: "Hablar con ventas",
    reseller: "Quiero ser reseller",
    quote: "Solicitar presupuesto",
    subtitle: "Completá tus datos y guardamos tu lead en el CRM super-admin.",
    submit: "Enviar",
    submitted: "Enviado",
    close: "Cerrar",
    success: "Lead guardado. El equipo enterprise lo revisa y responde dentro de 1 dia habil.",
    error: "No se pudo enviar. Reintentá en unos segundos.",
    hint: "Contexto detectado",
    meeting: "Agendar reunion",
    meetingHint: "Reservar horario directo",
    nameField: "Nombre",
    companyField: "Empresa",
    emailField: "Email",
    phoneField: "WhatsApp",
    countryField: "Pais",
    roleField: "Rol / interes",
    verticalField: "Vertical",
    volumeField: "Volumen anual",
    messageField: "Mensaje",
  },
  "pt-BR": {
    demo: "Solicitar demo",
    sales: "Falar com vendas",
    reseller: "Quero ser reseller",
    quote: "Solicitar orçamento",
    subtitle: "Preencha os dados para registrar o lead no CRM super-admin.",
    submit: "Enviar",
    submitted: "Enviado",
    close: "Fechar",
    success: "Lead salvo. A equipe enterprise revisa e responde em ate 1 dia util.",
    error: "Não foi possível enviar agora.",
    hint: "Contexto detectado",
    meeting: "Agendar reuniao",
    meetingHint: "Reservar horario direto",
    nameField: "Nome",
    companyField: "Empresa",
    emailField: "E-mail",
    phoneField: "WhatsApp",
    countryField: "Pais",
    roleField: "Cargo / interesse",
    verticalField: "Vertical",
    volumeField: "Volume anual",
    messageField: "Mensagem",
  },
  en: {
    demo: "Request demo",
    sales: "Talk to sales",
    reseller: "Become reseller",
    quote: "Request quote",
    subtitle: "Share your details and we store your lead in super-admin CRM.",
    submit: "Submit",
    submitted: "Submitted",
    close: "Close",
    success: "Lead saved. The enterprise team will review it and respond within 1 business day.",
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

const intentMetaByLocale: Record<AppLocale, Record<string, IntentMeta>> = {
  "es-AR": {
    default_demo: {
      title: "Demo guiada",
      subtitle: "Contanos el caso y coordinamos la demo con el pack correcto.",
      source: "demo_request",
      role: "Evaluación comercial",
      vertical: "wine",
      volume: "",
      message: "Quiero una demo guiada para evaluar nexID.",
      badge: "demo",
    },
    company_rollout: {
      title: "Evaluación para empresa",
      subtitle: "Vamos directo a rollout, perfil de chip y modelo operativo.",
      source: "intent_company_rollout",
      role: "Buyer enterprise",
      vertical: "wine",
      volume: "50000",
      message: "Quiero evaluar nexID para mi empresa y entender rollout, chip profile y operación.",
      badge: "empresa",
    },
    pricing_starter: {
      title: "Piloto QR / NFC",
      subtitle: "Validemos alcance, unidades, carrier y criterio de exito del primer piloto.",
      source: "pricing_starter",
      role: "Buyer / piloto",
      vertical: "wine",
      volume: "10000",
      message: "Quiero cotizar un piloto Starter y definir alcance, carrier, unidades y criterio de aceptacion.",
      badge: "starter",
    },
    pricing_pro: {
      title: "Rollout seguro",
      subtitle: "Revisemos NFC criptografico, tamper, integraciones y operacion del rollout.",
      source: "pricing_pro",
      role: "Buyer / rollout",
      vertical: "pharma",
      volume: "50000",
      message: "Quiero evaluar el plan Pro con NFC seguro, tamper, CRM y soporte de implementacion.",
      badge: "pro",
    },
    pricing_enterprise: {
      title: "Evaluacion enterprise",
      subtitle: "Armemos el alcance multi-tenant, integraciones, gobierno, SLA y procurement.",
      source: "pricing_enterprise",
      role: "Buyer enterprise",
      vertical: "pharma",
      volume: "100000",
      message: "Quiero evaluar nexID Enterprise: tenants, API, DPP, seguridad, SLA y rollout multi-pais.",
      badge: "enterprise",
    },
    pricing_roi: {
      title: "Escenario de valor modelado",
      subtitle: "Revisamos los supuestos, los convertimos en KPIs de piloto y separamos exposicion de retorno validado.",
      source: "pricing_roi_model",
      role: "Buyer / business case",
      vertical: "pharma",
      volume: "50000",
      message: "Quiero revisar un escenario de valor modelado y convertirlo en KPIs medibles para un piloto.",
      badge: "business case",
    },
    buyer_profile: {
      title: "Diagnóstico de buyer profile",
      subtitle: "Te ayudamos a adaptar el pitch según marca, reseller, gobierno u operador.",
      source: "intent_buyer_profile",
      role: "Buyer discovery",
      vertical: "wine",
      volume: "",
      message: "Quiero identificar el buyer profile correcto y el pitch comercial recomendado.",
      badge: "buyer",
    },
    demo_lab: {
      title: "Demo técnica / Demo Lab",
      subtitle: "Pedí una demo acompañada para recorrer el flujo real de validación.",
      source: "intent_demo_lab",
      role: "Demo técnica",
      vertical: "events",
      volume: "10000",
      message: "Quiero ver el Demo Lab con acompañamiento comercial o técnico.",
      badge: "demo lab",
    },
    investor_snapshot: {
      title: "Conversación inversor",
      subtitle: "Tomamos tu contexto y armamos la narrativa correcta de plataforma, moat y expansión.",
      source: "intent_investor_snapshot",
      role: "Investor / strategic partner",
      vertical: "pharma",
      volume: "",
      message: "Quiero conversar el ángulo inversor de nexID, moat, roadmap y expansión.",
      badge: "investor",
    },
    brands: {
      title: "Caso marcas / enterprise",
      subtitle: "Entramos por revenue protegido, postventa y control de canal.",
      source: "audience_brands",
      role: "Marca / enterprise",
      vertical: "wine",
      volume: "50000",
      message: "Quiero evaluar nexID para marca/empresa con foco en antifraude, CRM y control de canal.",
      badge: "brand",
    },
    reseller_program: {
      title: "Programa reseller",
      subtitle: "Conversemos margen recurrente, setup cobrable y operación white-label.",
      source: "audience_reseller",
      role: "Reseller / integrador",
      vertical: "events",
      volume: "25000",
      message: "Quiero sumarme al programa reseller y entender margen, setup y soporte comercial.",
      badge: "reseller",
    },
    government_stack: {
      title: "Sector público / verificable",
      subtitle: "Hablemos de auditabilidad, cadena de custodia y evidencia verificable.",
      source: "audience_government",
      role: "Gobierno / sector público",
      vertical: "pharma",
      volume: "10000",
      message: "Quiero evaluar nexID para documentos, cadena de custodia o presencia verificable.",
      badge: "gov",
    },
    customer_demo: {
      title: "Experiencia end user",
      subtitle: "Diseñamos una demo simple de tap, validación y beneficio.",
      source: "audience_customer",
      role: "Experiencia cliente final",
      vertical: "cosmetics",
      volume: "10000",
      message: "Quiero ver una experiencia simple para cliente final con validación y beneficio.",
      badge: "ux",
    },
  },
  "pt-BR": {
    default_demo: {
      title: "Demo guiada",
      subtitle: "Conte seu caso e alinhamos a demo com o pack certo.",
      source: "demo_request",
      role: "Avaliação comercial",
      vertical: "wine",
      volume: "",
      message: "Quero uma demo guiada para avaliar a nexID.",
      badge: "demo",
    },
    company_rollout: {
      title: "Avaliação para empresa",
      subtitle: "Vamos direto para rollout, perfil de chip e operação.",
      source: "intent_company_rollout",
      role: "Buyer enterprise",
      vertical: "wine",
      volume: "50000",
      message: "Quero avaliar a nexID para minha empresa e entender rollout, chip profile e operação.",
      badge: "empresa",
    },
    pricing_starter: {
      title: "Piloto QR / NFC",
      subtitle: "Vamos validar escopo, unidades, carrier e criterio de sucesso do primeiro piloto.",
      source: "pricing_starter",
      role: "Buyer / piloto",
      vertical: "wine",
      volume: "10000",
      message: "Quero cotar um piloto Starter e definir escopo, carrier, unidades e criterio de aceitacao.",
      badge: "starter",
    },
    pricing_pro: {
      title: "Rollout seguro",
      subtitle: "Vamos revisar NFC criptografico, tamper, integracoes e operacao do rollout.",
      source: "pricing_pro",
      role: "Buyer / rollout",
      vertical: "pharma",
      volume: "50000",
      message: "Quero avaliar o plano Pro com NFC seguro, tamper, CRM e suporte de implementacao.",
      badge: "pro",
    },
    pricing_enterprise: {
      title: "Avaliacao enterprise",
      subtitle: "Vamos estruturar multi-tenant, integracoes, governanca, SLA e procurement.",
      source: "pricing_enterprise",
      role: "Buyer enterprise",
      vertical: "pharma",
      volume: "100000",
      message: "Quero avaliar nexID Enterprise: tenants, API, DPP, seguranca, SLA e rollout multi-pais.",
      badge: "enterprise",
    },
    pricing_roi: {
      title: "Cenario de valor modelado",
      subtitle: "Revisamos as premissas, convertemos em KPIs de piloto e separamos exposicao de retorno validado.",
      source: "pricing_roi_model",
      role: "Buyer / business case",
      vertical: "pharma",
      volume: "50000",
      message: "Quero revisar um cenario de valor modelado e converter em KPIs mensuraveis para um piloto.",
      badge: "business case",
    },
    buyer_profile: {
      title: "Diagnóstico de buyer profile",
      subtitle: "Ajudamos você a ajustar o pitch por marca, revenda, governo ou operador.",
      source: "intent_buyer_profile",
      role: "Buyer discovery",
      vertical: "wine",
      volume: "",
      message: "Quero identificar o buyer profile correto e o pitch comercial recomendado.",
      badge: "buyer",
    },
    demo_lab: {
      title: "Demo técnica / Demo Lab",
      subtitle: "Peça uma demo assistida para percorrer o fluxo real de validação.",
      source: "intent_demo_lab",
      role: "Demo técnica",
      vertical: "events",
      volume: "10000",
      message: "Quero ver o Demo Lab com apoio comercial ou técnico.",
      badge: "demo lab",
    },
    investor_snapshot: {
      title: "Conversa com investidor",
      subtitle: "Montamos a narrativa certa de plataforma, moat e expansão.",
      source: "intent_investor_snapshot",
      role: "Investor / strategic partner",
      vertical: "pharma",
      volume: "",
      message: "Quero conversar sobre o ângulo investidor da nexID, moat, roadmap e expansão.",
      badge: "investor",
    },
    brands: {
      title: "Caso marcas / enterprise",
      subtitle: "Entramos por receita protegida, pós-venda e controle de canal.",
      source: "audience_brands",
      role: "Marca / enterprise",
      vertical: "wine",
      volume: "50000",
      message: "Quero avaliar a nexID para marcas/empresas com foco em antifraude, CRM e canal.",
      badge: "brand",
    },
    reseller_program: {
      title: "Programa revendedor",
      subtitle: "Vamos falar de margem recorrente, setup cobrável e operação white-label.",
      source: "audience_reseller",
      role: "Revendedor / integrador",
      vertical: "events",
      volume: "25000",
      message: "Quero entrar no programa revendedor e entender margem, setup e suporte comercial.",
      badge: "reseller",
    },
    government_stack: {
      title: "Setor público / verificável",
      subtitle: "Falemos de auditabilidade, cadeia de custódia e evidência verificável.",
      source: "audience_government",
      role: "Governo / setor público",
      vertical: "pharma",
      volume: "10000",
      message: "Quero avaliar a nexID para documentos, cadeia de custódia ou presença verificável.",
      badge: "gov",
    },
    customer_demo: {
      title: "Experiência end user",
      subtitle: "Desenhamos uma demo simples de tap, validação e benefício.",
      source: "audience_customer",
      role: "Experiência do cliente final",
      vertical: "cosmetics",
      volume: "10000",
      message: "Quero ver uma experiência simples para cliente final com validação e benefício.",
      badge: "ux",
    },
  },
  en: {
    default_demo: {
      title: "Guided demo",
      subtitle: "Share your use case and we will align the right demo pack.",
      source: "demo_request",
      role: "Commercial evaluation",
      vertical: "wine",
      volume: "",
      message: "I want a guided demo to evaluate nexID.",
      badge: "demo",
    },
    company_rollout: {
      title: "Company evaluation",
      subtitle: "Go straight into rollout, chip profile and operating model.",
      source: "intent_company_rollout",
      role: "Enterprise buyer",
      vertical: "wine",
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
  const [form, setForm] = useState<LeadForm>({ name: "", email: "", phone: "", company: "", country: "", role: "", vertical: "wine", volume: "", message: "" });
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

    const vertical = search.get("vertical") || intentCopy.vertical;
    const role = search.get("role") || intentCopy.role;
    const volume = search.get("volume") || intentCopy.volume;
    const message = search.get("message") || intentCopy.message;

    setStatus("idle");
    setForm((prev) => ({
      ...prev,
      role,
      vertical,
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
        vertical: form.vertical,
        role_interest: form.role,
        estimated_volume: form.volume,
        message: form.message,
        contact,
        volume: Number(form.volume || 0),
        tag_type: form.vertical === "events" ? "basic" : "secure",
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
