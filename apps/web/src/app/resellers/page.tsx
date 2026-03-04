import Link from "next/link";
import { Button, Card, SectionHeading } from "@product/ui";

export default function ResellersPage() {
  return (
    <main className="container-shell py-16">
      <Link href="/" className="text-sm text-cyan-300">← Volver</Link>
      <div className="mt-6">
        <SectionHeading
          eyebrow="White label"
          title="Programa reseller y partner"
          description="La plataforma tiene que vender dos veces: al cliente final y al canal. Esta pagina existe para el canal."
        />
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <div className="text-lg font-bold text-white">1. Compras lote encodeado</div>
          <p className="mt-3 text-sm text-slate-400">Nosotros entregamos tags listos con la capa de seguridad ya operativa.</p>
        </Card>
        <Card className="p-6">
          <div className="text-lg font-bold text-white">2. Creas subclientes</div>
          <p className="mt-3 text-sm text-slate-400">Cada reseller puede crear tenants y administrar cuentas propias o white label.</p>
        </Card>
        <Card className="p-6">
          <div className="text-lg font-bold text-white">3. Cobras tu margen</div>
          <p className="mt-3 text-sm text-slate-400">El partner maneja pricing comercial. Nosotros mantenemos la autenticacion y la capa operativa.</p>
        </Card>
      </div>
      <div className="mt-10 flex gap-3">
        <Button>Quiero ser reseller</Button>
        <Button variant="secondary">Ver panel partner</Button>
      </div>
    </main>
  );
}
