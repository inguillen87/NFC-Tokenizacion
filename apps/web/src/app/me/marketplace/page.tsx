import { asArray, fetchConsumerPath, fetchMarketplacePath } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Listing = { title?: string; brand?: string; points_price?: number; cash_price?: number; stock_status?: string };
type ConsumerProduct = { tenant_slug?: string | null };

export default async function MarketplacePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const tenantFromQuery = typeof params.tenant === "string" ? params.tenant : "";
  const consumerProductsPayload = await fetchConsumerPath("products");
  const consumerProducts = asArray<ConsumerProduct>(consumerProductsPayload);
  const contextualTenant = tenantFromQuery || String(consumerProducts[0]?.tenant_slug || "").trim();
  const payload = await fetchMarketplacePath(`products${contextualTenant ? `?tenant=${encodeURIComponent(contextualTenant)}` : ""}`);
  const items = asArray<Listing>(payload);

  return (
    <PortalShell
      title="Marketplace"
      subtitle={contextualTenant
        ? `Catálogo contextual del tenant ${contextualTenant}: canje, reserva y request-to-buy.`
        : "Catálogo curado para miembros NexID: canje, reserva y request-to-buy."}
    >
      {!items.length ? (
        <section className="rounded-xl border border-violet-300/30 bg-violet-500/10 p-5 text-sm text-violet-100">Sin catálogo publicado por ahora. Volvé pronto para nuevas experiencias premium.</section>
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {items.map((item, idx) => {
            const status = String(item.stock_status || "available");
            const cta = status === "out_of_stock" ? "Sin stock" : "Solicitar compra";
            return (
              <article key={`${item.title || idx}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-white">{item.title || "Item premium"}</p>
                <p className="mt-1 text-xs text-slate-400">{item.brand || "Brand"}</p>
                <p className="mt-2 text-xs text-slate-300">{item.points_price || 0} pts · ${item.cash_price || 0}</p>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="rounded-full border border-white/20 px-2 py-0.5 text-slate-200">{status.toUpperCase()}</span>
                  <button disabled={status === "out_of_stock"} className="rounded border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100 disabled:opacity-50">{cta}</button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </PortalShell>
  );
}
