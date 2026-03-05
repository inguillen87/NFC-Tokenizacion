import { pricingPlans } from "@product/config";
import { Badge, Card, SectionHeading } from "@product/ui";

export default function BillingPage() {
  return <main><SectionHeading eyebrow="Plans" title="Subscriptions" description="BASIC, SECURE and ENTERPRISE / RESELLER plan governance." /><div className="mt-8 grid gap-6 xl:grid-cols-3">{pricingPlans.map((p)=><Card key={p.slug} className="p-6"><Badge tone={p.slug==="enterprise"?"amber":"cyan"}>{p.badge}</Badge><h3 className="mt-3 text-xl text-white">{p.name}</h3><p className="mt-2 text-sm text-slate-400">{p.monthlyLabel}</p></Card>)}</div></main>;
}
