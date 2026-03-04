import Link from "next/link";
import { pricingPlans, siteConfig } from "@product/config";
import { Badge, Button, Card } from "@product/ui";

export default function PricingPage() {
  return (
    <main className="container-shell py-16">
      <Link href="/" className="text-sm text-cyan-300">← Volver</Link>
      <h1 className="mt-6 text-4xl font-black text-white">Pricing model - {siteConfig.productName}</h1>
      <p className="mt-4 max-w-3xl text-slate-400">Pricing visible para ordenar el discurso comercial. El pricing real enterprise se puede cerrar despues por volumen, SLA y vertical.</p>
      <div className="mt-10 grid gap-6 xl:grid-cols-3">
        {pricingPlans.map((plan) => (
          <Card key={plan.slug} className="p-6">
            <Badge tone={plan.slug === "enterprise" ? "amber" : "cyan"}>{plan.badge}</Badge>
            <div className="mt-4 text-2xl font-bold text-white">{plan.name}</div>
            <div className="mt-3 text-lg text-cyan-300">{plan.monthlyLabel}</div>
            <div className="mt-2 text-sm text-slate-500">{plan.unitExample}</div>
            <p className="mt-4 text-sm leading-7 text-slate-400">{plan.description}</p>
            <ul className="mt-6 space-y-2 text-sm text-slate-300">
              {plan.features.map((feature) => <li key={feature}>- {feature}</li>)}
            </ul>
          </Card>
        ))}
      </div>
      <div className="mt-10 flex gap-3">
        <Button>Hablar con ventas</Button>
        <Button variant="secondary">Descargar deck</Button>
      </div>
    </main>
  );
}
