import Link from "next/link";
import { Badge, Card, SectionHeading } from "@product/ui";

const snapshotCards = [
  { title: "Why it wins", body: "nexID une autenticación física, experiencia mobile, observabilidad y canal comercial en un solo SaaS.", tone: "cyan" as const },
  { title: "Proof", body: "Demo Lab, mobile preview, ops map y audience modes convierten la narrativa en evidencia visible para ventas e inversión.", tone: "green" as const },
  { title: "Scale", body: "Multi-tenant, reseller-ready, API-first y con packaging por plan para crecer por vertical, región o partner.", tone: "amber" as const },
];

const metrics = [
  { label: "Audience modes", value: "3", detail: "CEO · Operator · Buyer" },
  { label: "Demo surfaces", value: "4", detail: "Landing · Demo Lab · Mobile · Ops" },
  { label: "Growth motion", value: "B2B2B", detail: "Enterprise + reseller + end user" },
  { label: "Trust stack", value: "PHY + APP + API", detail: "Tag + mobile + backend" },
];

export default function InvestorSnapshotPage() {
  return (
    <main className="space-y-8">
      <SectionHeading eyebrow="Investor snapshot" title="Board-ready product snapshot" description="Resumen ejecutivo para mostrar valor, diferenciación y capacidad de escala en minutos." />

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
            <p className="mt-1 text-xs text-slate-400">{metric.detail}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {snapshotCards.map((card) => (
          <Card key={card.title} className="p-5">
            <Badge tone={card.tone}>{card.title}</Badge>
            <p className="mt-3 text-sm text-slate-300">{card.body}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">Suggested investor flow</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>Abrí Demo Lab y corré una historia por vertical.</li>
          <li>Mostrá mobile preview para traducir tecnología en experiencia de usuario.</li>
          <li>Cerrá con ops map y módulos del admin para probar observabilidad, integraciones y monetización.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/demo-lab" className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">Open Demo Lab</Link>
          <Link href="/demo-lab/mobile/demobodega/demo-item-001" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200">Open mobile preview</Link>
          <Link href="/analytics" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">Open analytics proof</Link>
        </div>
      </Card>
    </main>
  );
}
