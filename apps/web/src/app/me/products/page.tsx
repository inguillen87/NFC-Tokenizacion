import { asArray, fetchConsumerPath } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Product = { name?: string; brand?: string; status?: string; scanned_at?: string };

export default async function ProductsPage() {
  const payload = await fetchConsumerPath("products");
  const products = asArray<Product>(payload);

  return (
    <PortalShell title="Productos guardados" subtitle="Biblioteca verificada de productos tocados o reclamados en tu Passport.">
      {!products.length ? (
        <section className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-5 text-sm text-cyan-50">Aún no tenés productos guardados. Tocá un producto NFC y elegí “Guardar este producto”.</section>
      ) : (
        <section className="space-y-3">
          {products.map((p, idx) => {
            const status = String(p.status || "available");
            const tone = status === "locked" ? "border-rose-300/30 bg-rose-500/10 text-rose-100" : status === "claimed" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-cyan-300/30 bg-cyan-500/10 text-cyan-100";
            return (
              <article key={`${p.name || "product"}-${idx}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{p.name || "Producto autenticado"}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>{status.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{p.brand || "Marca"} · Último tap {p.scanned_at || "N/A"}</p>
              </article>
            );
          })}
        </section>
      )}
    </PortalShell>
  );
}
