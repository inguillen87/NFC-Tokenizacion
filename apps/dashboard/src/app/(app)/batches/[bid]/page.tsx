import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { productUrls } from "@product/config";
import { BatchSunValidator } from "../../../../components/batch-sun-validator";

const API_BASE = productUrls.api;

async function getBatch(bid: string) {
  try {
    const response = await fetch(`${API_BASE}/admin/batches`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<Record<string, unknown>>;
    return rows.find((row) => String(row.bid || "") === bid) || null;
  } catch {
    return null;
  }
}

export default async function BatchDetailPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const batch = await getBatch(bid);
  const publicMobile = `${productUrls.web}/demo-lab/mobile/demobodega/demo-item-001?pack=wine-secure&demoMode=consumer_tap`;

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow="Batch detail" title={bid} description="Vista puntual para revisar el lote registrado y sus próximos pasos operativos." />
      {!batch ? (
        <Card className="p-6 text-sm text-rose-200">Batch no encontrado. Volvé a registrar el supplier batch o revisá el BID exacto.</Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white">Resumen</h2>
            <dl className="mt-4 space-y-3 text-sm text-slate-300">
              <div><dt className="text-slate-400">Tenant</dt><dd className="text-white">{String(batch.tenant_slug || "-")}</dd></div>
              <div><dt className="text-slate-400">Status</dt><dd className="text-white">{String(batch.status || "-")}</dd></div>
              <div><dt className="text-slate-400">Profile</dt><dd className="text-white">{String(batch.batch_profile || "custom")}</dd></div>
              <div><dt className="text-slate-400">Chip model</dt><dd className="text-white">{String(batch.chip_model || batch.type || "-")}</dd></div>
              <div><dt className="text-slate-400">SKU</dt><dd className="text-white">{String(batch.sku || "-")}</dd></div>
              <div><dt className="text-slate-400">Requested quantity</dt><dd className="text-white">{String(batch.requested_quantity || batch.qty || 0)}</dd></div>
              <div><dt className="text-slate-400">Imported tags</dt><dd className="text-white">{String(batch.imported_count || batch.tags_imported || "unknown")}</dd></div>
              <div><dt className="text-slate-400">Active tags</dt><dd className="text-white">{String(batch.active_count || batch.tags_active || "unknown")}</dd></div>
              <div><dt className="text-slate-400">Keys loaded</dt><dd className="text-white">{batch.k_meta_hex || batch.k_file_hex ? "yes" : "unknown"}</dd></div>
            </dl>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white">Ops next</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
              <li>Importar manifest con <code>batch_id</code> idéntico a <code>{bid}</code>.</li>
              <li>Activar tags importadas si ya llegaron programadas.</li>
              <li>Probar sample URL real del proveedor.</li>
              <li>Monitorear si devuelve VALID, NOT_REGISTERED, NOT_ACTIVE o INVALID.</li>
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/batches" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Volver a batches</Link>
              <Link href="/batches/supplier" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">Abrir supplier flow</Link>
              <Link href="/events" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Open events</Link>
              <Link href="/tags" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Open tags</Link>
              <Link href="/demo-lab" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Open demo lab</Link>
              <a href={publicMobile} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">Open public mobile preview</a>
              <Link href="/tenants" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Open tenant dashboard</Link>
            </div>
            <div className="mt-6">
              <BatchSunValidator bid={bid} />
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
