import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";

export default function DemoSandboxPage() {
  return (
    <main className="space-y-6 p-4">
      <SectionHeading eyebrow="Public demo" title="Sandbox anónimo" description="Probá escenarios sin contexto técnico previo" />
      <Card className="p-4 text-sm text-slate-300">
        <p>Este modo está pensado para usuarios anónimos: elegís vertical, disparás escenario y ves resultado en mobile preview + mapa.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <Link className="rounded-lg border border-white/10 bg-slate-900 p-3 text-white" href="/demo-lab">Probar escenarios</Link>
          <Link className="rounded-lg border border-white/10 bg-slate-900 p-3 text-white" href="/demo-lab/encode">Encode Station</Link>
          <Link className="rounded-lg border border-white/10 bg-slate-900 p-3 text-white" href="/demo-lab/mobile/demobodega/demo-item-001">Vista mobile</Link>
        </div>
      </Card>
    </main>
  );
}
