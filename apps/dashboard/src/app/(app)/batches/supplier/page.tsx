import Link from "next/link";
import { SectionHeading, Card } from "@product/ui";
import { SupplierOrderConsole } from "../../../../components/supplier-order-console";
import { SupplierBatchWizard } from "../../../../components/supplier-batch-wizard";
import { getDashboardI18n } from "../../../../lib/locale";

export default async function SupplierBatchPage() {
  const { locale } = await getDashboardI18n();

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow="Supplier batches"
        title="Registro profesional de lotes reales"
        description="Flujo seguro para crear tenants completos, registrar batches de proveedor, importar manifests auditables y validar URLs SUN antes de entregar el rollout."
      />
      <SupplierOrderConsole />
      <section className="grid gap-3 lg:grid-cols-4">
        {[
          {
            step: "01",
            title: "Crear tenant",
            body: "Nombre, rubro, origen, reglas de claim y marca white-label.",
            href: "#supplier-wizard",
          },
          {
            step: "02",
            title: "Pedido industrial",
            body: "Sub-batches, llaves cifradas, pack one-time y manifest esperado.",
            href: "#supplier-wizard",
          },
          {
            step: "03",
            title: "Validar tags",
            body: "Preflight de duplicados, carrier, llaves, SUN y tap de muestra.",
            href: "/tags",
          },
          {
            step: "04",
            title: "Publicar experiencia",
            body: "Portal, marketplace, club, garantia, reviews y NFT opcional.",
            href: "/superadmin-network",
          },
        ].map((item) => (
          <Link
            key={item.step}
            href={item.href}
            className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 transition hover:border-cyan-300/35 hover:bg-cyan-500/10"
          >
            <span className="grid h-9 w-9 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-500/10 text-xs font-black text-cyan-100">{item.step}</span>
            <h2 className="mt-4 text-lg font-black text-white">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p>
          </Link>
        ))}
      </section>
      <Card className="p-5 text-sm text-slate-300">
        <p className="font-semibold text-white">Uso recomendado</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Pedido industrial nuevo: usa Supplier Order. El sistema genera sub-batches, llaves por lote, fingerprints y evidencia batch_created.</li>
          <li>Export pack: solo superadmin, una respuesta con llaves plaintext para ZIP cifrado y password por canal separado.</li>
          <li>Manifest: se importa TXT/CSV por BID y se rechaza cantidad incorrecta, batch_id cruzado o UID duplicado.</li>
          <li>Activacion: queda bloqueada hasta manifest importado, cantidad esperada y QA aprobado.</li>
        </ul>
        <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          No se expone KMS. No se guardan llaves plaintext en frontend. No se ancla cada tap on-chain; la prueba externa se hace por hashes agregados.
        </p>
      </Card>
      <div id="supplier-wizard">
        <SupplierBatchWizard locale={locale} />
      </div>
    </main>
  );
}
