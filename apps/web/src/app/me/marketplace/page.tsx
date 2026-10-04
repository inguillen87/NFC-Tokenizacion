import Link from "next/link";
import { asArray, buildConsumerNextPath, fetchConsumerPath, fetchMarketplacePath, requireConsumerSession } from "../_components/consumer-api";
import { resolveMarketplaceTenant } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";
import { MarketplaceGridClient } from "./marketplace-grid-client";
import styles from "./marketplace.module.css";

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
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/marketplace", params));
  const tenantFromQuery = typeof params.tenant === "string" ? params.tenant : "";
  const consumerProductsPayload = await fetchConsumerPath("products");
  const consumerProducts = asArray<ConsumerProduct>(consumerProductsPayload);
  const contextualTenant = resolveMarketplaceTenant({ tenantFromQuery, products: consumerProducts });
  const payload = await fetchMarketplacePath(`products${contextualTenant ? `?tenant=${encodeURIComponent(contextualTenant)}` : ""}`);
  const items = asArray<Listing>(payload);

  return (
    <PortalShell title="Catálogo de la marca" subtitle="Productos publicados y solicitudes de contacto. La marca confirma disponibilidad y condiciones.">
      {items.length ? <MarketplaceGridClient items={items} /> : (
        <section className={`${styles.intro} ${styles.empty}`}>
          Todavía no hay productos publicados para este contexto. Podés volver a consultar el catálogo más adelante.
        </section>
      )}
      <section className={styles.wallet}>
        <p>También podés consultar tu wallet y los registros disponibles en tu Passport.</p>
        <Link href="/me/wallet" className={styles.walletLink}>Ver mi wallet</Link>
      </section>
    </PortalShell>
  );
}
