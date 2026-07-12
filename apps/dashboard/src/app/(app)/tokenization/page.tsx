import { Boxes, DatabaseZap, Fingerprint, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@product/ui";
import { ProductAssetBankPanel } from "../../../components/product-asset-bank-panel";
import { TokenizationQueuePanel } from "../../../components/tokenization-queue-panel";
import { dashboardPermissionMatches } from "../../../lib/permission-policy";
import { requireDashboardSession } from "../../../lib/session";

export default async function TokenizationPage() {
  const session = await requireDashboardSession("tokenization:read");
  const canWrite = session.role === "super-admin" || dashboardPermissionMatches(session.permissions, "tokenization:write");

  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Ownership ledger operations"
        title="Tokenization, custody and digital twins"
        description="Controla la transición entre un evento físico verificado, una prueba hash-only y un activo transferible. La consola distingue simulación, evidencia IOTA y ownership Polygon sin presentar una demo como blockchain real."
      />

      <section className="grid gap-3 lg:grid-cols-3" aria-label="Capas de confianza y ownership">
        <LayerSummary
          icon={Fingerprint}
          eyebrow="1. Fuente de verdad"
          title="nexID valida el producto"
          body="UID, lote, política, tap fresco, canal y estado físico viven en el dominio nexID. Ninguna blockchain reemplaza esta validación."
          tone="cyan"
        />
        <LayerSummary
          icon={ShieldCheck}
          eyebrow="2. Evidencia hash-only"
          title="IOTA prueba inclusión"
          body="Trust Operations puede publicar Merkle roots y recibos de hitos sin exponer clientes, rutas, documentos ni secretos NFC."
          tone="emerald"
        />
        <LayerSummary
          icon={Boxes}
          eyebrow="3. Ownership opcional"
          title="Polygon registra el gemelo"
          body="El NFT se emite o transfiere solo cuando la política comercial lo exige y existe recibo confirmado en Amoy. Simulación no crea token."
          tone="violet"
        />
      </section>

      <TokenizationQueuePanel canWrite={canWrite} tenantSlug={session.tenantSlug || ""} />

      <section className="border-t border-white/10 pt-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
            <DatabaseZap className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">Product asset registry</p>
            <h2 className="mt-1 text-xl font-black text-white">Medios y metadata del gemelo digital</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">La imagen, etiqueta, modelo y galería pertenecen al tenant y al UID. No son la prueba criptográfica, pero hacen legible el certificado, la wallet y el marketplace.</p>
          </div>
        </div>
        <ProductAssetBankPanel canWrite={canWrite} tenantSlug={session.tenantSlug || ""} />
      </section>
    </main>
  );
}

function LayerSummary({
  icon: Icon,
  eyebrow,
  title,
  body,
  tone,
}: {
  icon: typeof Fingerprint;
  eyebrow: string;
  title: string;
  body: string;
  tone: "cyan" | "emerald" | "violet";
}) {
  const toneClass = tone === "emerald"
    ? "border-emerald-300/20 bg-emerald-500/[0.07] text-emerald-100"
    : tone === "violet"
      ? "border-violet-300/20 bg-violet-500/[0.07] text-violet-100"
      : "border-cyan-300/20 bg-cyan-500/[0.07] text-cyan-100";

  return (
    <article className={`min-w-0 rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-75">{eyebrow}</p>
          <h2 className="mt-1 text-base font-black text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
        </div>
      </div>
    </article>
  );
}
