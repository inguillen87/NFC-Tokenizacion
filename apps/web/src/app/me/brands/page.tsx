import Link from "next/link";
import { buildConsumerNextPath, fetchConsumerPath, fetchMarketplacePath, readConsumerSession } from "../_components/consumer-api";
import { hasConsumerBrandIdentity, hasConsumerProductIdentity, hasConsumerTapIdentity, hasMarketplaceListingIdentity, readConsumerListSource } from "../_components/consumer-list-availability";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import recoveryStyles from "../_components/consumer-list-recovery.module.css";
import type { ConsumerBrand, ConsumerPortalProduct, ConsumerTap, MarketplaceListing } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";
import { brandActivityText, brandDateLabel, brandTapStatus, buildConsumerBrands, filterConsumerBrands } from "./brands-model";
import styles from "./brands.module.css";

export default async function BrandsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const session = await readConsumerSession(buildConsumerNextPath("/me/brands", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const [brandsPayload, productsPayload, tapsPayload, listingsPayload] = await Promise.all([
    fetchConsumerPath("brands"), fetchConsumerPath("products"), fetchConsumerPath("taps"), fetchMarketplacePath("products"),
  ]);
  const brands = readConsumerListSource<ConsumerBrand>(brandsPayload, hasConsumerBrandIdentity);
  const products = readConsumerListSource<ConsumerPortalProduct>(productsPayload, hasConsumerProductIdentity);
  const taps = readConsumerListSource<ConsumerTap>(tapsPayload, hasConsumerTapIdentity);
  const listings = readConsumerListSource<MarketplaceListing>(listingsPayload, hasMarketplaceListingIdentity);
  const model = buildConsumerBrands({ brands, products, taps, listings });
  const selected = filterConsumerBrands(model.items, params.tenant);
  const unavailable = [products.status === "unavailable" && "productos guardados", taps.status === "unavailable" && "lecturas", listings.status === "unavailable" && "catálogo"].filter(Boolean);
  return (
    <PortalShell title="Mis marcas y clubes" subtitle="Consultá tu membresía y los puntos reportados por cada marca, con acceso a su catálogo y a tus lecturas.">
      {model.status === "unavailable" ? (
        <section data-testid="consumer-brands-unavailable" className={recoveryStyles.notice} role="status">
          <h2>No pudimos cargar tus membresías</h2><p>Reintentá la consulta para ver las marcas vinculadas a tu cuenta.</p><ConsumerDataRetryButton />
        </section>
      ) : model.items.length === 0 ? (
        <section data-testid="consumer-brands-empty" className={styles.empty}>
          <h2>No hay membresías registradas en esta cuenta</h2><p>Podés consultar tus productos y lecturas guardadas. Una lectura no implica una membresía ni un beneficio nuevo.</p>
          <Link className={`${styles.link} ${styles.primary}`} href="/me/products">Ver mis productos</Link>
        </section>
      ) : (
        <>
          <section className={styles.intro} aria-labelledby="brands-intro-title">
            <h2 id="brands-intro-title">Tu relación con cada marca</h2>
            <p>Cada marca tiene su propio saldo y condiciones. El catálogo muestra productos publicados; consultar un beneficio no confirma que puedas canjearlo.</p>
            <nav className={styles.filters} aria-label="Filtrar mis marcas">
              <Link className={styles.link} href="/me/brands" aria-current={selected.state === "all" ? "page" : undefined}>Todas mis marcas</Link>
              {model.items.filter(item => item.slug).map(item => <Link key={item.key} className={styles.link} href={`/me/brands?${new URLSearchParams({ tenant: item.slug! })}`} aria-current={selected.slug === item.slug ? "page" : undefined}>{item.name}</Link>)}
            </nav>
          </section>
          {unavailable.length > 0 && <section data-testid="consumer-brands-partial" className={recoveryStyles.notice} role="status"><h2>Consulta incompleta</h2><p>No pudimos cargar {unavailable.join(", ")}. Las membresías y los datos disponibles siguen visibles.</p><ConsumerDataRetryButton /></section>}
          {(selected.state === "invalid" || selected.state === "missing") && <section data-testid="consumer-brands-filter-unavailable" className={styles.empty} role="status"><h2>No encontramos esa marca en tus membresías</h2><p>Elegí una de tus marcas o volvé a la vista completa.</p><Link className={`${styles.link} ${styles.primary}`} href="/me/brands">Ver todas mis marcas</Link></section>}
          <div className={styles.cards} data-testid="consumer-brand-cards">
            {selected.items.map(card => (
              <article key={card.key} className={styles.card} data-testid="consumer-brand-card" data-brand-tenant={card.slug || undefined} aria-labelledby={`${card.key}-title`}>
                <header className={styles.heading}>
                  <div className={styles.identity}><h2 id={`${card.key}-title`}>{card.name}</h2><span className={styles.status}>{card.status}</span>{card.joined && <p>Membresía registrada el {card.joined}</p>}</div>
                  <div className={styles.balanceBlock}><span>Puntos reportados</span><p className={styles.balance}>{card.balance === null ? "No informado" : card.balance}</p><span>Saldo de esta marca</span></div>
                </header>
                {!card.links && <p role="status">No se informó una identidad única para consultar los datos de esta marca.</p>}
                <div><p>En esta consulta</p><dl className={styles.stats}>
                  <div><dt>Productos guardados</dt><dd>{card.products.status === "ready" ? card.products.data.length : "N/D"}</dd></div>
                  <div><dt>Lecturas guardadas</dt><dd>{card.taps.status === "ready" ? card.taps.data.length : "N/D"}</dd></div>
                  <div><dt>Productos del catálogo</dt><dd>{card.catalog.status === "ready" ? card.catalog.data.length : "N/D"}</dd></div>
                </dl></div>
                {card.links && <nav className={styles.actions} aria-label={`Consultar ${card.name}`}>
                  <Link className={`${styles.link} ${styles.primary}`} href={card.links.catalog}>Ver catálogo de la marca</Link>
                  {card.links.rewards && <Link className={styles.link} href={card.links.rewards}>Ver puntos y beneficios</Link>}
                  <Link className={styles.link} href={card.links.history}>Ver lecturas de la marca</Link>
                </nav>}
                {card.links && !card.links.rewards && <p>La consulta de beneficios no está disponible para esta identidad de marca.</p>}
                <p>{card.catalog.status === "unavailable" ? "Catálogo no disponible para consulta." : card.catalog.data.length === 0 ? "No hay productos publicados de esta marca en el catálogo consultado." : "El catálogo y las condiciones se consultan en la página de la marca."}</p>
                <div className={styles.activity}>
                  <section aria-labelledby={`${card.key}-products`}><h3 id={`${card.key}-products`}>Tus productos de esta marca</h3>
                    {card.products.status === "unavailable" ? <p>Productos no disponibles para consulta.</p> : card.products.data.length === 0 ? <p>No hay productos guardados de esta marca.</p> : <ul className={styles.list}>{card.products.data.slice(0, 3).map((product, index) => <li key={index}><strong>{brandActivityText(product.product_name) || "Producto sin nombre informado"}</strong>{brandActivityText(product.bid) && <span>Lote reportado: {brandActivityText(product.bid)}</span>}</li>)}</ul>}
                  </section>
                  <section aria-labelledby={`${card.key}-taps`}><h3 id={`${card.key}-taps`}>Tus lecturas de esta marca</h3>
                    {card.taps.status === "unavailable" ? <p>Lecturas no disponibles para consulta.</p> : card.taps.data.length === 0 ? <p>No hay lecturas guardadas de esta marca.</p> : <ul className={styles.list}>{card.taps.data.slice(0, 3).map((tap, index) => <li key={index}><strong>{brandTapStatus(tap)}</strong><span>{brandDateLabel(tap.created_at) || "Fecha no informada"}</span></li>)}</ul>}
                  </section>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </PortalShell>
  );
}
