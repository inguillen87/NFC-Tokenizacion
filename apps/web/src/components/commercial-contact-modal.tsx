"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
    close: "Cerrar",
    success: "Lead guardado correctamente.",
    error: "No se pudo enviar. Reintentá en unos segundos.",
    hint: "Contexto detectado",
  },
  "pt-BR": {
    demo: "Solicitar demo",
    sales: "Falar com vendas",
    reseller: "Quero ser reseller",
    quote: "Solicitar orçamento",
    subtitle: "Preencha os dados para registrar o lead no CRM super-admin.",
    submit: "Enviar",
    close: "Fechar",
    success: "Lead salvo com sucesso.",
    error: "Não foi possível enviar agora.",
    hint: "Contexto detectado",
  },
  en: {
    demo: "Request demo",
    sales: "Talk to sales",
    reseller: "Become reseller",
    quote: "Request quote",
    subtitle: "Share your details and we store your lead in super-admin CRM.",
    submit: "Submit",
    close: "Close",
    success: "Lead saved successfully.",
    error: "Could not submit right now.",
    hint: "Detected context",
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

function getLocale(): AppLocale {
  const match = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] : "es-AR";
  return match === "en" || match === "pt-BR" ? match : "es-AR";
}

export function CommercialContactModal() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const intent = search.get("contact") as Intent | null;
  const intentKey = search.get("intent") || "";
  const open = intent === "demo" || intent === "sales" || intent === "reseller" || intent === "quote";
  const locale = getLocale();
  const t = copy[locale];
  const intentCopy = useMemo(() => {
    const fallbackKey = intent === "quote" ? "company_rollout" : intent === "reseller" ? "reseller_program" : "default_demo";
    return intentMetaByLocale[locale][intentKey] || intentMetaByLocale[locale][fallbackKey];
  }, [intent, intentKey, locale]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [form, setForm] = useState<LeadForm>({ name: "", email: "", phone: "", company: "", country: "", role: "", vertical: "wine", volume: "", message: "" });

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
    setTimeout(close, 700);
  }

  if (!open || !intent) return null;

  return (
    <div id="contact-modal" className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-slate-950 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-white">{intentCopy.title || t[intent]}</h3>
              {intentCopy.badge ? <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-cyan-200">{t.hint}: {intentCopy.badge}</span> : null}
            </div>
            <p className="mt-1 text-sm text-slate-300">{intentCopy.subtitle || t.subtitle}</p>
          </div>
          <button suppressHydrationWarning onClick={close} className="rounded-md border border-white/20 px-3 py-1 text-xs text-slate-300">{t.close}</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input suppressHydrationWarning className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input suppressHydrationWarning className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input suppressHydrationWarning className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input suppressHydrationWarning className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input suppressHydrationWarning className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="País" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <input suppressHydrationWarning className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Rol / interés" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <input suppressHydrationWarning className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Vertical" value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} />
          <input suppressHydrationWarning className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Volumen anual" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} />
          <textarea suppressHydrationWarning className="md:col-span-2 min-h-[88px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Mensaje" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className={`text-xs ${status === "error" ? "text-rose-300" : "text-emerald-300"}`}>{status === "ok" ? t.success : status === "error" ? t.error : ""}</p>
          <button suppressHydrationWarning onClick={submit} disabled={status === "loading"} className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100 disabled:opacity-40">{t.submit}</button>
        </div>
      </div>
    </div>
  );
}
