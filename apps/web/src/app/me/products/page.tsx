import { asArray, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { ownershipTone } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";

type Product = {
  product_name?: string;
  brand_name?: string;
  tenant_slug?: string;
  ownership_status?: string;
  ownership_record_status?: string;
  first_tap_event_id?: number;
  latest_tap_event_id?: number;
  created_at?: string;
  bid?: string;
};

export default async function ProductsPage() {
  await requireConsumerSession("/me/products");
  const payload = await fetchConsumerPath("products");
  const products = asArray<Product>(payload);

  return (
    <PortalShell title="Productos guardados" subtitle="Biblioteca verificada de productos tocados o reclamados en tu Passport.">
      {!products.length ? (
        <section className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-5 text-sm text-cyan-50">Aún no tenés productos guardados. Tocá un producto NFC y elegí “Guardar este producto”.</section>
      ) : (
        <section className="space-y-3">
          {products.map((p, idx) => {
            const status = String(p.ownership_record_status || p.ownership_status || "viewed").toLowerCase();
            const tone = ownershipTone(status);
            const toneClass = tone === "success"
              ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
              : tone === "danger"
                ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
                : "border-cyan-300/30 bg-cyan-500/10 text-cyan-100";
            return (
              <article key={`${p.product_name || "product"}-${idx}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{p.product_name || "Producto autenticado"}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${toneClass}`}>{status.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{p.brand_name || "Marca"} · tenant {p.tenant_slug || "n/a"} · BID {p.bid || "n/a"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Primer tap #{p.first_tap_event_id || "n/a"} · Último tap #{p.latest_tap_event_id || "n/a"} · guardado {p.created_at ? new Date(p.created_at).toLocaleString() : "n/a"}
                </p>
              </article>
            );
          })}
        </section>
      )}
    </PortalShell>
  );
}
