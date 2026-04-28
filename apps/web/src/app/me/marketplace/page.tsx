import { asArray, fetchConsumerPath, fetchMarketplacePath, requireConsumerSession } from "../_components/consumer-api";
import { resolveMarketplaceTenant } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";
import { MarketplaceGridClient } from "./marketplace-grid-client";

type Listing = {
  id: string;
  title?: string;
  brand?: string;
  brand_name?: string;
  points_price?: number;
  cash_price?: number;
  price_amount?: number;
  stock_status?: string;
  request_to_buy_enabled?: boolean;
  age_gate_required?: boolean;
};
type ConsumerProduct = { tenant_slug?: string | null; ownership_status?: string | null; ownership_record_status?: string | null };

export default async function MarketplacePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireConsumerSession("/me/marketplace");
  const params = (await searchParams) || {};
  const tenantFromQuery = typeof params.tenant === "string" ? params.tenant : "";
  const consumerProductsPayload = await fetchConsumerPath("products");
  const consumerProducts = asArray<ConsumerProduct>(consumerProductsPayload);
  const contextualTenant = resolveMarketplaceTenant({ tenantFromQuery, products: consumerProducts });
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
        <section className="rounded-xl border border-violet-300/30 bg-violet-500/10 p-5 text-sm text-violet-100">
          {contextualTenant
            ? `Sin catálogo publicado para ${contextualTenant} por ahora.`
            : "Sin contexto de tenant para abrir catálogo contextual. Este placeholder usa solo estado real y no inventa productos."}
        </section>
      ) : (
        <MarketplaceGridClient items={items} />
      )}
    </PortalShell>
  );
}
