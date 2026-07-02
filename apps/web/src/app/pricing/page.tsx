import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { getWebI18n } from "../../lib/locale";
import { JsonLd } from "../../components/json-ld";

export const metadata: Metadata = {
  title: "Pricing | nexID enterprise product identity",
  description: "Pilot and rollout pricing for NFC, QR, DPP-ready product identity, anti-counterfeit verification, traceability, warranty and lifecycle engagement.",
  openGraph: {
    title: "Pricing | nexID",
    description: "Choose a rollout model for secure digital product identity across QR, NFC, DPP, analytics and enterprise integrations.",
    images: [{ url: "/opengraph-image?surface=pricing&campaign=enterprise", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | nexID",
    images: ["/twitter-image?surface=pricing&campaign=enterprise"],
  },
};

type Tier = {
  name: string;
  label: string;
  price: string;
  body: string;
  cta: string;
  href: string;
  featured?: boolean;
  popular?: boolean;
  bullets: string[];
};

const copyByLocale = {
  en: {
    back: "Back to platform",
    title: "Pricing built for pilots that can scale.",
    body: "nexID pricing is not a generic tag subscription. Start with a controlled product identity pilot, then scale into secure NFC, DPP, analytics, APIs and enterprise rollout operations when the evidence justifies it.",
    note: "All plans include secure cloud, role management, audit logs and GDPR-conscious data minimization. Hardware, encoding and managed rollout services are quoted by volume.",
    popular: "Most popular",
    enterprise: "Enterprise highlight",
    tiers: [
      {
        name: "Starter",
        label: "QR / NFC pilot",
        price: "From $2,500",
        body: "For one product line, limited batches and fast buyer validation.",
        cta: "Request pilot",
        href: "/?contact=quote&intent=pricing_starter#contact-modal",
        bullets: ["QR or NTAG pilot flow", "Product passport and verification page", "Basic analytics and scan export", "Demo Lab handoff for sales"],
      },
      {
        name: "Pro",
        label: "Secure rollout",
        price: "From $7,500",
        body: "For brands that need cryptographic NFC, tamper states and post-sale actions.",
        cta: "Plan rollout",
        href: "/?contact=quote&intent=pricing_pro#contact-modal",
        popular: true,
        bullets: ["NTAG 424 DNA / TagTamper option", "Warranty, club and contextual offers", "Fraud alerts and live CRM feed", "Priority implementation support"],
      },
      {
        name: "Enterprise",
        label: "Multi-brand platform",
        price: "Custom",
        body: "For regulated, multi-country or reseller operations with integrations and governance.",
        cta: "Talk to enterprise",
        href: "/?contact=sales&intent=pricing_enterprise#contact-modal",
        featured: true,
        bullets: ["Tenant Vault, API and webhooks", "DPP event model and audit exports", "Offline verifier and supplier ops", "Custom deployment and SLA"],
      },
    ] satisfies Tier[],
    compare: [
      ["Product identity", "QR/NFC pilot", "Secure NFC + passport", "Multi-brand identity graph"],
      ["Anti-counterfeit", "Basic verification", "SUN/SDM and replay signals", "Policy, alerts and audit workflow"],
      ["Lifecycle actions", "Lead capture", "Warranty, loyalty, offers", "Ownership, resale, support and integrations"],
      ["Compliance", "Exportable events", "DPP-ready fields", "DPP/audit model and data governance"],
      ["Operations", "Guided setup", "Priority rollout", "Dedicated success and SLA"],
    ],
  },
  "pt-BR": {
    back: "Voltar para plataforma",
    title: "Pricing para pilotos que podem escalar.",
    body: "nexID nao e uma assinatura generica de etiquetas. Comece com um piloto controlado de identidade de produto, depois escale para NFC seguro, DPP, analytics, APIs e operacao enterprise quando a evidencia justificar.",
    note: "Todos os planos incluem cloud segura, roles, audit logs e minimizacao de dados. Hardware, encoding e servicos gerenciados sao cotados por volume.",
    popular: "Mais escolhido",
    enterprise: "Enterprise destaque",
    tiers: [
      {
        name: "Starter",
        label: "Piloto QR / NFC",
        price: "Desde US$ 2.500",
        body: "Para uma linha de produto, lotes limitados e validacao rapida.",
        cta: "Solicitar piloto",
        href: "/?contact=quote&intent=pricing_starter#contact-modal",
        bullets: ["Fluxo piloto QR ou NTAG", "Passport e pagina de verificacao", "Analytics basico e export de scans", "Demo Lab para vendas"],
      },
      {
        name: "Pro",
        label: "Rollout seguro",
        price: "Desde US$ 7.500",
        body: "Para marcas que precisam de NFC criptografico, tamper e pos-venda.",
        cta: "Planejar rollout",
        href: "/?contact=quote&intent=pricing_pro#contact-modal",
        popular: true,
        bullets: ["Opcao NTAG 424 DNA / TagTamper", "Garantia, clube e ofertas", "Alertas antifraude e CRM live", "Suporte prioritario"],
      },
      {
        name: "Enterprise",
        label: "Plataforma multi-marca",
        price: "Custom",
        body: "Para operacoes reguladas, multi-pais ou reseller com integracoes.",
        cta: "Falar com enterprise",
        href: "/?contact=sales&intent=pricing_enterprise#contact-modal",
        featured: true,
        bullets: ["Tenant Vault, API e webhooks", "Modelo DPP e exports de auditoria", "Offline verifier e supplier ops", "Deploy custom e SLA"],
      },
    ] satisfies Tier[],
    compare: [
      ["Identidade", "Piloto QR/NFC", "NFC seguro + passport", "Grafo multi-marca"],
      ["Antifraude", "Verificacao basica", "SUN/SDM e replay", "Politica, alertas e auditoria"],
      ["Lifecycle", "Captura de lead", "Garantia, loyalty, ofertas", "Ownership, resale e integracoes"],
      ["Compliance", "Eventos exportaveis", "Campos DPP-ready", "Governanca DPP/audit"],
      ["Operacao", "Setup guiado", "Rollout prioritario", "Success dedicado e SLA"],
    ],
  },
  "es-AR": {
    back: "Volver a plataforma",
    title: "Pricing para pilotos que pueden escalar.",
    body: "nexID no es una suscripcion generica de etiquetas. Empeza con un piloto controlado de identidad de producto y escala a NFC seguro, DPP, analytics, APIs y operacion enterprise cuando la evidencia lo justifique.",
    note: "Todos los planes incluyen cloud segura, roles, audit logs y minimizacion de datos. Hardware, encoding y servicios de rollout se cotizan por volumen.",
    popular: "Mas elegido",
    enterprise: "Enterprise destacado",
    tiers: [
      {
        name: "Starter",
        label: "Piloto QR / NFC",
        price: "Desde US$ 2.500",
        body: "Para una linea de producto, lotes limitados y validacion rapida.",
        cta: "Solicitar piloto",
        href: "/?contact=quote&intent=pricing_starter#contact-modal",
        bullets: ["Flujo piloto QR o NTAG", "Pasaporte y pagina de verificacion", "Analytics basico y export de scans", "Demo Lab para ventas"],
      },
      {
        name: "Pro",
        label: "Rollout seguro",
        price: "Desde US$ 7.500",
        body: "Para marcas que necesitan NFC criptografico, tamper y acciones postventa.",
        cta: "Planear rollout",
        href: "/?contact=quote&intent=pricing_pro#contact-modal",
        popular: true,
        bullets: ["Opcion NTAG 424 DNA / TagTamper", "Garantia, club y ofertas", "Alertas antifraude y CRM live", "Soporte prioritario"],
      },
      {
        name: "Enterprise",
        label: "Plataforma multi-marca",
        price: "Custom",
        body: "Para operaciones reguladas, multi-pais o reseller con integraciones y gobierno.",
        cta: "Hablar con enterprise",
        href: "/?contact=sales&intent=pricing_enterprise#contact-modal",
        featured: true,
        bullets: ["Tenant Vault, API y webhooks", "Modelo DPP y exports de auditoria", "Offline verifier y supplier ops", "Deploy custom y SLA"],
      },
    ] satisfies Tier[],
    compare: [
      ["Identidad", "Piloto QR/NFC", "NFC seguro + pasaporte", "Grafo multi-marca"],
      ["Antifraude", "Verificacion basica", "SUN/SDM y replay", "Politica, alertas y auditoria"],
      ["Lifecycle", "Captura de lead", "Garantia, loyalty, ofertas", "Ownership, resale e integraciones"],
      ["Compliance", "Eventos exportables", "Campos DPP-ready", "Gobierno DPP/audit"],
      ["Operacion", "Setup guiado", "Rollout prioritario", "Success dedicado y SLA"],
    ],
  },
};

export default async function PricingPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];
  const pricingSchema = [
    {
      "@context": "https://schema.org",
      "@type": "OfferCatalog",
      name: "nexID pricing",
      itemListElement: copy.tiers.map((tier) => ({
        "@type": "Offer",
        name: tier.name,
        category: tier.label,
        description: tier.body,
        url: `https://nexid.lat${tier.href}`,
        priceSpecification: {
          "@type": "PriceSpecification",
          priceCurrency: "USD",
          description: tier.price,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "nexID",
          item: "https://nexid.lat/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Pricing",
          item: "https://nexid.lat/pricing",
        },
      ],
    },
  ];

  return (
    <main className="nexid-pricing-page min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      {pricingSchema.map((schema) => (
        <JsonLd key={schema["@type"]} data={schema} />
      ))}
      <div className="container-shell py-8 md:py-12">
        <Link href="/" className="nexid-pricing-back inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-cyan-700">
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </Link>

        <section className="nexid-pricing-hero grid min-w-0 gap-5 py-10 md:py-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-end">
          <div>
            <h1 className="max-w-5xl text-4xl font-black leading-[0.95] tracking-normal text-slate-950 sm:text-5xl md:text-7xl">{copy.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">{copy.body}</p>
          </div>
          <div className="nexid-pricing-hero__proof grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
            <ShieldCheck className="h-5 w-5 text-cyan-700" />
            <strong className="text-slate-950">DPP / NFC / QR / CRM</strong>
            <span className="text-sm leading-6 text-slate-600">{copy.note}</span>
          </div>
        </section>

        <section className="nexid-pricing-grid grid min-w-0 gap-4 lg:grid-cols-3" aria-label="Pricing tiers">
          {copy.tiers.map((tier) => (
            <article key={tier.name} className={`nexid-pricing-card flex min-h-[31rem] min-w-0 flex-col rounded-3xl border p-5 shadow-xl ${tier.featured ? "is-enterprise border-cyan-200 bg-cyan-50 shadow-cyan-100/70" : "border-slate-200 bg-white shadow-slate-200/60"}`}>
              {tier.popular ? <span className="nexid-pricing-card__badge mb-3 w-fit rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-cyan-800">{copy.popular}</span> : null}
              {tier.featured ? <span className="nexid-pricing-card__badge is-enterprise mb-3 w-fit rounded-full border border-cyan-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wider text-cyan-800">{copy.enterprise}</span> : null}
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">{tier.label}</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">{tier.name}</h2>
              <strong className="mt-2 break-words text-2xl font-black text-slate-950">{tier.price}</strong>
              <span className="mt-3 text-sm leading-6 text-slate-600">{tier.body}</span>
              <ul className="my-6 grid gap-3">
                {tier.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />{bullet}</li>
                ))}
              </ul>
              <Link href={tier.href} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-cyan-200">
                {tier.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </section>

        <section className="nexid-pricing-compare mt-5 max-w-full overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60" aria-label="Feature comparison">
          <table className="w-full min-w-[620px] border-collapse md:min-w-[760px]">
            <thead>
              <tr>
                <th className="border-b border-slate-200 p-4 text-left text-xs font-black uppercase tracking-wider text-slate-950">Feature</th>
                {copy.tiers.map((tier) => <th key={tier.name} className="border-b border-slate-200 p-4 text-left text-xs font-black uppercase tracking-wider text-slate-950">{tier.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {copy.compare.map(([feature, starter, pro, enterprise]) => (
                <tr key={feature}>
                  <td className="border-b border-slate-200 p-4 align-top text-sm font-black text-cyan-800">{feature}</td>
                  <td className="border-b border-slate-200 p-4 align-top text-sm leading-6 text-slate-600">{starter}</td>
                  <td className="border-b border-slate-200 p-4 align-top text-sm leading-6 text-slate-600">{pro}</td>
                  <td className="border-b border-slate-200 p-4 align-top text-sm leading-6 text-slate-600">{enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
