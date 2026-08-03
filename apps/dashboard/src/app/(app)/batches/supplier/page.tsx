import Link from "next/link";
import { SectionHeading, Card } from "@product/ui";
import { SupplierOrderConsole } from "../../../../components/supplier-order-console";
import { SupplierLegacyIntakeBlocked } from "../../../../components/supplier-legacy-intake-blocked";
import { requireDashboardSession } from "../../../../lib/session";

export default async function SupplierBatchPage() {
  const session = await requireDashboardSession("batches:*");

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow="Supplier batches"
        title="Registro profesional de lotes reales"
        description="Flujo seguro para crear pedidos industriales, registrar sub-batches de proveedor, importar manifiestos auditables y validar URLs SUN antes de activar el rollout."
      />

      <div id="supplier-order-console" className="scroll-mt-52 md:scroll-mt-24">
        <SupplierOrderConsole
          currentRole={session.role}
          currentPermissions={session.permissions}
          currentDeniedPermissions={session.deniedPermissions}
          tenantSlug={session.tenantSlug}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-cyan-300/20 bg-slate-950/75 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Factory Trust Room</p>
              <h2 className="mt-2 text-2xl font-black text-white">De orden industrial a tags activos sin exponer secretos</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Esta consola separa producción física, seguridad de llaves, recepción de manifiesto, QA y activación comercial. El proveedor recibe solo lo necesario para codificar; nexID cifra las claves de lote con una clave maestra de aplicación guardada como secreto de Vercel. No es Google Cloud KMS ni HSM.
              </p>
            </div>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
              Pilot controls · staging pending
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ["Superadmin", "Crea pedidos, genera llaves batch, exporta ZIP cifrado y ve auditoría completa."],
              ["Tenant admin", "Importa manifiesto, ejecuta QA con evidencia, activa lotes y opera CRM/marketplace."],
              ["Proveedor", "Recibe BATCH_ID, pack cifrado de un solo uso, URL template y formato manifest. Nunca recibe la clave maestra de aplicación ni secretos fuera del pack autorizado."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-slate-900/55 p-4">
                <h3 className="text-sm font-black text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-emerald-300/20 bg-emerald-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Gates obligatorios</p>
          <div className="mt-4 space-y-3">
            {[
              ["Pack cifrado", "ZIP .enc con TXT/JSON/PDF/checksums. Password por canal separado."],
              ["Manifiesto único", "Rechaza BID cruzado, UID duplicado global y cantidad distinta al sub-batch."],
              ["QA con evidencia", "URL SUN real, replay probado y TTStatus solo si el carrier es TagTamper."],
              ["Activación bloqueada", "Ningún supplier batch entra a mercado sin manifiesto importado, cantidad correcta y QA aprobado."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-emerald-300/15 bg-slate-950/55 p-3">
                <h3 className="text-sm font-black text-white">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-emerald-50/80">{body}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-violet-300/20 bg-violet-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-100">Polygon ownership</p>
          <h2 className="mt-2 text-xl font-black text-white">Certificados, claims y NFTs transferibles</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Polygon queda para propiedad digital: ownership_claimed, certificate_issued, nft_minted, garantía transferible y compraventa futura.
          </p>
        </Card>
        <Card className="border-cyan-300/20 bg-cyan-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">IOTA audit opcional</p>
          <h2 className="mt-2 text-xl font-black text-white">Evidencia, DPP y logística por hashes</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            IOTA se presenta como Proof Layer opcional para hashes agregados: manifest_imported, qa_passed, batch_activated, shipment y reportes DPP. No subimos cada tap on-chain.
          </p>
        </Card>
        <Card className="border-amber-300/20 bg-amber-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100">nexID operational DB</p>
          <h2 className="mt-2 text-xl font-black text-white">Fuente viva del CRM y antifraude</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Taps, riesgo, GPS, leads, campañas y logística quedan en la base operativa. La blockchain recibe pruebas agregadas cuando aporta auditoría real.
          </p>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        {[
          {
            step: "01",
            title: "Crear pedido",
            body: "Tenant, rubro, chip, carrier, cantidad, origen y reglas de fabricación.",
            href: "#supplier-order-console",
          },
          {
            step: "02",
            title: "Pack industrial",
            body: "Sub-batches, llaves cifradas, pack one-time y manifiesto esperado.",
            href: "#supplier-order-console",
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
            body: "Portal, marketplace, club, garantía, experiencias verificadas y NFT opcional.",
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
          <li>Export pack: solo superadmin/security operator, una entrega cifrada de un solo uso y clave por canal separado.</li>
          <li>Manifiesto: se importa TXT/CSV por BID y se rechaza cantidad incorrecta, batch_id cruzado o UID duplicado.</li>
          <li>Activación: queda bloqueada hasta manifiesto importado, cantidad esperada y QA aprobado.</li>
        </ul>
        <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          No se expone la clave maestra de aplicación. No se guardan llaves en claro en frontend. El flujo NFC actual usa cifrado server-side con secreto Vercel; Google Cloud KMS SOFTWARE queda reservado a custodia blockchain. No se ancla cada tap on-chain.
        </p>
      </Card>

      <div id="supplier-wizard">
        <SupplierLegacyIntakeBlocked />
      </div>
    </main>
  );
}
