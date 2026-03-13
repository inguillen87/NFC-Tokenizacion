import { Badge, Card, SectionHeading } from "@product/ui";

type Props = { params: Promise<{ tenant: string; itemId: string }> };

export default async function DemoMobileItemPage({ params }: Props) {
  const { tenant, itemId } = await params;
  const timeline = [
    "ISSUED · bodega emitió etiqueta",
    "ACTIVE · distribuido a canal",
    "AUTH_OK · verificación correcta",
    "OPENED_AUTHENTIC · consumo legítimo",
  ];

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <SectionHeading eyebrow="Mobile preview" title="Producto verificado" description="Vista realista de consumidor por tenant/item" />
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{itemId}</h2>
          <Badge tone="green">AUTH OK</Badge>
        </div>
        <p className="mt-2 text-sm text-slate-300">Tenant: {tenant}</p>
        <p className="text-sm text-slate-300">Origen: Mendoza, AR · Lote: DEMO-2026-02</p>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">How we know this</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-300">
          <li>Leído del tag: URL/NDEF + UID.</li>
          <li>Aportado por el teléfono: hora, idioma y geolocalización (con permiso).</li>
          <li>Resuelto por backend: autenticidad, riesgo y estado del item.</li>
        </ul>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">Timeline</h3>
        <div className="mt-2 space-y-2 text-xs text-slate-300">
          {timeline.map((event) => (
            <div key={event} className="rounded-lg border border-white/10 bg-slate-900 p-2">{event}</div>
          ))}
        </div>
      </Card>
    </main>
  );
}
