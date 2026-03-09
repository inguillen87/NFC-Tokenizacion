import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { Card, SectionHeading } from "@product/ui";
import { getWebI18n } from "../../lib/locale";

type DocsCopy = {
  eyebrow: string;
  title: string;
  description: string;
  pillarsTitle: string;
  pillars: string[];
  apiTitle: string;
  apiIntro: string;
  apiRoutes: Array<{ method: string; path: string; detail: string }>;
  resellerTitle: string;
  resellerBullets: string[];
  buyerTitle: string;
  buyerBullets: string[];
  focusTitle: string;
  focusBullets: string[];
  caveatTitle: string;
  caveatBody: string;
  actionsTitle: string;
  openAssistant: string;
  talkAgent: string;
  bookDemo: string;
};

const docsCopy: Record<"es-AR" | "pt-BR" | "en", DocsCopy> = {
  "es-AR": {
    eyebrow: "Docs comercial + técnica",
    title: "Cómo funciona nexID para compradores, resellers e inversores",
    description: "Una guía clara del modelo Basic vs Secure, arquitectura API, operación white-label y flujos de implementación.",
    pillarsTitle: "Modelo de producto",
    pillars: [
      "Línea BASIC (NTAG213/215): eventos, activaciones, acceso y campañas de volumen.",
      "Línea SECURE (NTAG 424 DNA TagTamper): autenticidad, anti-clone, anti-fraude y trazabilidad premium.",
      "Modelo recurrente: hardware + setup + dashboard + API + soporte SaaS.",
      "Demo-first: pruebas en Demo Lab antes de salir a producción.",
    ],
    apiTitle: "API para integración enterprise",
    apiIntro: "Endpoints clave para operaciones, validación criptográfica, monitoreo y CRM comercial.",
    apiRoutes: [
      { method: "GET", path: "/health", detail: "Estado del backend para monitoreo y uptime checks." },
      { method: "GET", path: "/sun", detail: "Validación SDM/SUN para tags seguros NTAG 424 DNA." },
      { method: "POST", path: "/assistant/chat", detail: "Asistente comercial con captura de leads, tickets y pedidos." },
      { method: "GET/POST", path: "/admin/leads", detail: "CRM-lite: creación y lectura de leads para super-admin." },
      { method: "POST", path: "/internal/demo/use-pack", detail: "Carga packs demo por vertical (wine/events/cosmetics/agro/pharma)." },
      { method: "POST", path: "/internal/demo/simulate-tap", detail: "Simulación de tap NFC y estados de autenticidad." },
    ],
    resellerTitle: "White-label / reseller",
    resellerBullets: [
      "Operación multi-tenant para agencias, convertidores e integradores.",
      "Co-branded o private-label según canal y territorio.",
      "Escalado por vertical con playbooks de onboarding y activación comercial.",
      "Visibilidad de pipeline en leads, tickets y órdenes dentro del dashboard.",
    ],
    buyerTitle: "Para compradores e inversores",
    buyerBullets: [
      "Entendés claramente qué se resuelve con Basic vs Secure.",
      "Ves costos por escenarios y quote by volume sin commoditizar la propuesta.",
      "Accedés a evidencia operativa: feed live, mapa y trazabilidad por eventos.",
      "Evaluás potencial recurrente SaaS sobre hardware autenticado.",
    ],
    focusTitle: "Foco go-to-market recomendado",
    focusBullets: [
      "1) Wine Secure (NTAG 424 DNA TT).",
      "2) Events Basic + Events Secure para agencias y canal reseller.",
      "3) Docs & Presence Secure para evidencia verificable de personas y documentos.",
      "Expansión inmediata: cosmética premium. Expansión regulatoria: exportadores DPP-ready.",
    ],
    caveatTitle: "Criterio técnico importante",
    caveatBody: "TagTamper no reemplaza un sensor de temperatura ni corrige packaging deficiente: el valor real sale de chip + inlay + adhesivo + diseño físico + backend.",
    actionsTitle: "Siguientes pasos",
    openAssistant: "Abrir BotIA",
    talkAgent: "Hablar con agente (WhatsApp)",
    bookDemo: "Agendar demo",
  },
  "pt-BR": {
    eyebrow: "Docs comercial + técnica",
    title: "Como a nexID funciona para compradores, revendedores e investidores",
    description: "Guia clara do modelo Basic vs Secure, arquitetura API, operação white-label e rollout.",
    pillarsTitle: "Modelo de produto",
    pillars: [
      "Linha BASIC (NTAG213/215): eventos, ativações e campanhas de volume.",
      "Linha SECURE (NTAG 424 DNA TagTamper): autenticidade, anti-clone e rastreabilidade premium.",
      "Modelo recorrente: hardware + setup + dashboard + API + suporte SaaS.",
      "Demo-first: validação no Demo Lab antes da produção.",
    ],
    apiTitle: "API para integração enterprise",
    apiIntro: "Rotas principais para operação, validação criptográfica, monitoramento e CRM comercial.",
    apiRoutes: [
      { method: "GET", path: "/health", detail: "Saúde do backend para uptime e observabilidade." },
      { method: "GET", path: "/sun", detail: "Validação SDM/SUN para tags seguras NTAG 424 DNA." },
      { method: "POST", path: "/assistant/chat", detail: "Assistente comercial com captura de leads, tickets e pedidos." },
      { method: "GET/POST", path: "/admin/leads", detail: "CRM-lite para super-admin acompanhar pipeline." },
      { method: "POST", path: "/internal/demo/use-pack", detail: "Carrega packs demo por vertical." },
      { method: "POST", path: "/internal/demo/simulate-tap", detail: "Simula tap NFC e estado de autenticidade." },
    ],
    resellerTitle: "White-label / revenda",
    resellerBullets: [
      "Operação multi-tenant para agências, convertedores e integradores.",
      "Go-to-market co-branded ou private-label por território.",
      "Escala por vertical com playbooks de onboarding e ativação.",
      "Pipeline comercial visível em leads, tickets e pedidos.",
    ],
    buyerTitle: "Para compradores e investidores",
    buyerBullets: [
      "Entendimento objetivo de Basic vs Secure por risco.",
      "Cotação por volume com cenários sem preço commodity fixo.",
      "Prova operacional com feed live, mapa e rastreabilidade.",
      "Potencial de receita recorrente SaaS com base em hardware autenticado.",
    ],
    focusTitle: "Foco go-to-market recomendado",
    focusBullets: [
      "1) Wine Secure (NTAG 424 DNA TT).",
      "2) Events Basic + Events Secure para agências e canal revenda.",
      "3) Docs & Presence Secure para prova verificável de pessoas e documentos.",
      "Expansão imediata: cosméticos premium. Expansão regulatória: exportadores DPP-ready.",
    ],
    caveatTitle: "Critério técnico importante",
    caveatBody: "TagTamper não substitui sensor de temperatura nem corrige packaging ruim: o valor real vem de chip + inlay + adesivo + design físico + backend.",
    actionsTitle: "Próximos passos",
    openAssistant: "Abrir BotIA",
    talkAgent: "Falar com agente (WhatsApp)",
    bookDemo: "Agendar demo",
  },
  en: {
    eyebrow: "Commercial + technical docs",
    title: "How nexID works for buyers, resellers, and investors",
    description: "Clear guide to Basic vs Secure, API architecture, white-label channel model, and implementation flow.",
    pillarsTitle: "Product model",
    pillars: [
      "BASIC line (NTAG213/215): events, activations, access control, campaign scale.",
      "SECURE line (NTAG 424 DNA TagTamper): authenticity, anti-clone, anti-fraud, premium traceability.",
      "Recurring model: hardware + setup + dashboard + API + SaaS support.",
      "Demo-first validation with Demo Lab before production rollouts.",
    ],
    apiTitle: "Enterprise integration API",
    apiIntro: "Core routes for operations, crypto validation, monitoring, and commercial CRM workflows.",
    apiRoutes: [
      { method: "GET", path: "/health", detail: "Backend status for uptime monitoring." },
      { method: "GET", path: "/sun", detail: "SDM/SUN validation endpoint for NTAG 424 secure flows." },
      { method: "POST", path: "/assistant/chat", detail: "Sales assistant with lead, ticket, and order capture." },
      { method: "GET/POST", path: "/admin/leads", detail: "CRM-lite read/write route for super-admin pipeline." },
      { method: "POST", path: "/internal/demo/use-pack", detail: "Load vertical-specific demo packs." },
      { method: "POST", path: "/internal/demo/simulate-tap", detail: "Simulate NFC taps and authenticity states." },
    ],
    resellerTitle: "White-label / reseller",
    resellerBullets: [
      "Multi-tenant operation for agencies, converters, and integrators.",
      "Co-branded or private-label distribution by region.",
      "Vertical rollout playbooks with onboarding and activation support.",
      "Dashboard visibility across leads, tickets, and order requests.",
    ],
    buyerTitle: "For buyers and investors",
    buyerBullets: [
      "Clear value split between Basic and Secure use cases.",
      "Volume-based quoting without commodity-style public pricing.",
      "Operational proof via live feed, map, and event traceability.",
      "Recurring SaaS upside layered on authenticated hardware.",
    ],
    focusTitle: "Recommended go-to-market focus",
    focusBullets: [
      "1) Wine Secure (NTAG 424 DNA TT).",
      "2) Events Basic + Events Secure for agencies and reseller channel.",
      "3) Docs & Presence Secure for verified people/document evidence.",
      "Immediate expansion: premium cosmetics. Regulatory expansion: DPP-ready exporters.",
    ],
    caveatTitle: "Important technical caveat",
    caveatBody: "TagTamper is not a temperature sensor and cannot fix weak packaging alone: real value is chip + inlay + adhesive + physical design + backend.",
    actionsTitle: "Next steps",
    openAssistant: "Open AI assistant",
    talkAgent: "Talk to agent (WhatsApp)",
    bookDemo: "Book demo",
  },
};

export default async function DocsPage() {
  const { locale } = await getWebI18n();
  const copy = docsCopy[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white">{copy.pillarsTitle}</h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {copy.pillars.map((entry) => <li key={entry}>• {entry}</li>)}
        </ul>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white">{copy.apiTitle}</h3>
        <p className="mt-2 text-sm text-slate-300">{copy.apiIntro}</p>
        <div className="mt-4 space-y-3">
          {copy.apiRoutes.map((route) => (
            <div key={`${route.method}-${route.path}`} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <p className="font-semibold text-cyan-200">{route.method} <span className="text-white">{route.path}</span></p>
              <p className="mt-1 text-slate-300">{route.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.resellerTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {copy.resellerBullets.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.buyerTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {copy.buyerBullets.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.focusTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {copy.focusBullets.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.caveatTitle}</h3>
          <p className="mt-4 text-sm text-slate-300">{copy.caveatBody}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white">{copy.actionsTitle}</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100" href="/?assistant=open">
            {copy.openAssistant}
          </Link>
          <a className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-100" href="https://wa.me/5492613168608" target="_blank" rel="noreferrer">
            {copy.talkAgent}
          </a>
          <Link className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100" href="/?contact=demo#contact-modal">
            {copy.bookDemo}
          </Link>
        </div>
      </Card>
    </main>
  );
}
