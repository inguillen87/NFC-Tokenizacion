import { pricingPlans, productUrls } from "@product/config";
import { Badge, Card, SectionHeading } from "@product/ui";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";

export default function BillingPage() {
  return (
    <main className="space-y-8">
      <SectionHeading eyebrow="Plans" title="Subscriptions" description="Referencias recurrentes de software. Setup, hardware, encoding, rollout y gas se cotizan por alcance." />
      <section role="note" className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
        <strong className="block text-amber-100">Una suscripción no es el costo total de un piloto.</strong>
        <span>Estos valores ordenan la recurrencia de plataforma; la propuesta comercial debe separar implementación, tags, fábrica, logística, servicios y uso de redes públicas.</span>
        <a className="mt-2 block w-fit font-black text-cyan-200 underline underline-offset-4" href={`${productUrls.web}/pricing`} target="_blank" rel="noreferrer">Abrir pricing y calculadora pública</a>
      </section>
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Plans hacen visible cómo se monetiza la plataforma por nivel de seguridad, volumen y distribución enterprise.", decision: "Decidís pricing ladder, expansión de margen y packaging para ventas o partners.", cta: "Usalo para mostrar que el producto tiene estrategia de monetización y upsell claro." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Plans traducen capacidades técnicas y operativas a niveles de servicio sostenibles.", decision: "Decidís qué features, soporte y compliance sostener por tipo de cliente.", cta: "Leelo como contrato entre plataforma, operación y entrega real." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Plans explican qué nivel de protección, experiencia y escalabilidad recibe cada cliente según necesidad real.", decision: "Decidís qué plan encaja con tu etapa, riesgo y ambición comercial.", cta: "Mostralo como una compra progresiva: empezar simple y escalar a secure / enterprise." }}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        {pricingPlans.map((p) => (
          <Card key={p.slug} className="flex h-full flex-col p-6">
            <Badge tone={p.slug === "enterprise" ? "amber" : "cyan"}>{p.badge}</Badge>
            <h3 className="mt-3 text-xl font-black text-white">{p.name}</h3>
            <p className="mt-2 text-lg font-black text-cyan-100">{p.monthlyLabel}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{p.description}</p>
            <p className="mt-3 rounded-lg border border-white/10 bg-slate-950/45 p-3 text-xs leading-5 text-slate-400">{p.unitExample}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {p.features.map((feature) => <li key={feature} className="flex gap-2"><span aria-hidden="true" className="text-emerald-300">✓</span><span>{feature}</span></li>)}
            </ul>
          </Card>
        ))}
      </div>
    </main>
  );
}
