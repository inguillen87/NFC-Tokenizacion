import Link from "next/link";
import { SectionHeading, Card } from "@product/ui";
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
            title: "Subir batch",
            body: "CSV/TXT con UID, carrier, lote, SKU, fotos y etiqueta.",
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
          <li>Usa esta pantalla cuando el proveedor ya entrego o va a programar K_META_BATCH y K_FILE_BATCH concretas.</li>
          <li>Completa primero el passport del tenant: vertical, producto, origen, politica de ownership y politica de manifest.</li>
          <li>Importa TXT/CSV con preflight antes de activar: UID, batch, SKU, producto, lote y serial quedan auditados.</li>
          <li>Valida una URL SUN real de muestra antes de habilitar portal, marketplace, tokenizacion u ownership claim.</li>
        </ul>
        <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Supplier mode: <b>K_META_BATCH</b> y <b>K_FILE_BATCH</b> son obligatorias. No se autogeneran llaves para batches de proveedor.
        </p>
      </Card>
      <div id="supplier-wizard">
        <SupplierBatchWizard locale={locale} />
      </div>
    </main>
  );
}
