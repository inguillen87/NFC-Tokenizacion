import Link from "next/link";
import { buildConsumerNextPath, fetchConsumerPath, fetchMarketplacePath, readConsumerSession } from "../_components/consumer-api";
import { hasConsumerProductIdentity, hasMarketplaceListingIdentity, readConsumerListSource } from "../_components/consumer-list-availability";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import recoveryStyles from "../_components/consumer-list-recovery.module.css";
import { resolveMarketplaceTenant } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";
import { MarketplaceGridClient } from "./marketplace-grid-client";
import styles from "./marketplace.module.css";
import { configurationEventId, readPublicTenantConfiguration } from "../../../lib/public-tenant-configuration";
import { resolveTenantActionAvailability } from "../../sun/tenant-action-availability";

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
  const session = await readConsumerSession(buildConsumerNextPath("/me/marketplace", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const hasTapContext = params.fromTap !== undefined || params.action !== undefined || params.eventId !== undefined;
  const postTapEventId = params.fromTap === "1" && params.action === "marketplace" && configurationEventId(params.eventId) ? params.eventId : undefined;
  const configuration = postTapEventId ? await readPublicTenantConfiguration(postTapEventId) : null;
  const canonicalTenant = configuration?.tenantSlug || "";
  const contextUnavailable = hasTapContext && (!postTapEventId || !canonicalTenant || !resolveTenantActionAvailability({ configuration, verifiedTenant: true }).marketplace);
  const tenantFromQuery = typeof params.tenant === "string" ? params.tenant : "";
  const consumerProductsPayload = contextUnavailable || hasTapContext ? null : await fetchConsumerPath("products");
  const productsSource = readConsumerListSource<ConsumerProduct>(consumerProductsPayload, hasConsumerProductIdentity);
  const consumerProducts = productsSource.data || [];
  const contextualTenant = hasTapContext ? canonicalTenant : resolveMarketplaceTenant({ tenantFromQuery, products: consumerProducts });
  const payload = contextUnavailable ? null : await fetchMarketplacePath(`products${contextualTenant ? `?tenant=${encodeURIComponent(contextualTenant)}` : ""}`);
  const catalog = readConsumerListSource<Listing>(payload, hasMarketplaceListingIdentity);

  return (
    <PortalShell title="Catálogo de la marca" subtitle="Productos publicados y solicitudes de contacto. La marca confirma disponibilidad y condiciones.">
      {!hasTapContext && !tenantFromQuery && productsSource.status === "unavailable" && <section className={recoveryStyles.notice} role="status" data-testid="consumer-catalog-partial">
        <p>No pudimos cargar tus productos para elegir una marca. Estás consultando el catálogo general.</p>
        <ConsumerDataRetryButton />
      </section>}
      {contextUnavailable ? <section className={`${styles.intro} ${styles.empty}`} role="status">
        <p>Las consultas desde esta lectura no están disponibles. La marca pudo cambiar sus opciones o la lectura requiere revisión.</p>
        <Link href="/me/marketplace" className={styles.button}>Consultar el catálogo general</Link>
      </section> : catalog.status === "unavailable" ? <section className={recoveryStyles.notice} role="status" data-testid="consumer-catalog-unavailable">
        <h2>No pudimos cargar el catálogo</h2>
        <p>Reintentá la consulta para ver los productos publicados y sus condiciones.</p>
        <ConsumerDataRetryButton />
      </section> : catalog.data.length ? <MarketplaceGridClient key={postTapEventId || "global"} items={catalog.data} {...(postTapEventId ? { postTapEventId } : {})} /> : (
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
