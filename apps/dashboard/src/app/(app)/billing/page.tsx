import { pricingPlans } from "@product/config";
import { Badge, Card, SectionHeading } from "@product/ui";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";

export default function BillingPage() {
  return (
    <main className="space-y-8">
      <SectionHeading eyebrow="Plans" title="Subscriptions" description="BASIC, SECURE and ENTERPRISE / RESELLER plan governance." />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Plans hacen visible cómo se monetiza la plataforma por nivel de seguridad, volumen y distribución enterprise.", decision: "Decidís pricing ladder, expansión de margen y packaging para ventas o partners.", cta: "Usalo para mostrar que el producto tiene estrategia de monetización y upsell claro." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Plans traducen capacidades técnicas y operativas a niveles de servicio sostenibles.", decision: "Decidís qué features, soporte y compliance sostener por tipo de cliente.", cta: "Leelo como contrato entre plataforma, operación y entrega real." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Plans explican qué nivel de protección, experiencia y escalabilidad recibe cada cliente según necesidad real.", decision: "Decidís qué plan encaja con tu etapa, riesgo y ambición comercial.", cta: "Mostralo como una compra progresiva: empezar simple y escalar a secure / enterprise." }}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        {pricingPlans.map((p) => (
          <Card key={p.slug} className="p-6">
            <Badge tone={p.slug === "enterprise" ? "amber" : "cyan"}>{p.badge}</Badge>
            <h3 className="mt-3 text-xl text-white">{p.name}</h3>
            <p className="mt-2 text-sm text-slate-400">{p.monthlyLabel}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
