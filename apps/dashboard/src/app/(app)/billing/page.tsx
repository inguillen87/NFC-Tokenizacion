import { Card } from "@product/ui";

export default function BillingPage() {
  return (
    <main>
      <Card className="p-8">
        <div className="text-2xl font-bold text-white">Billing</div>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Planes, suscripciones y futura integracion con Stripe.</p>
      </Card>
    </main>
  );
}
