import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleAlert, History, MessageSquareText, Package, ScanLine, ShoppingBag } from "lucide-react";
import { buildConsumerNextPath, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { buildHomeProductsSource, homeOwnershipLabel, homeProductExperienceHref, homeVerdictLabel } from "../_components/consumer-home-model";
import { ConsumerDataRetryButton, ConsumerProductImage } from "../_components/me-portal-interactive-client";
import { PortalShell } from "../_components/portal-shell";
import styles from "./products.module.css";

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/products", params));
  const source = buildHomeProductsSource(await fetchConsumerPath("products"));

  return (
    <PortalShell title="Tus productos guardados" subtitle="Volvé a su información, consultá una lectura o compartí tu experiencia con la marca.">
      <div className={styles.gallery}>
        <nav className={styles.toolbar} aria-label="Navegación de productos">
          <Link href="/me"><ArrowLeft size={18} aria-hidden="true" />Volver al inicio</Link>
          <Link href="/me/taps"><History size={18} aria-hidden="true" />Historial de lecturas<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </nav>

        {source.status === "unavailable" ? <section className={styles.loadError} role="status">
          <CircleAlert size={26} aria-hidden="true" /><div><h2>No pudimos cargar tus productos.</h2><p>Reintentá la consulta. Un problema de conexión no significa que tu colección esté vacía.</p><ConsumerDataRetryButton /></div>
        </section> : source.data.length === 0 ? <section className={styles.empty}>
          <span className={styles.emptyIcon}><Package size={32} aria-hidden="true" /></span><span className={styles.eyebrow}>Tu colección empieza acá</span>
          <h2>Todavía no hay productos guardados.</h2><p>Acercá el teléfono a una etiqueta NFC o escaneá el QR de un producto nexID. Desde su pasaporte podés asociar la lectura a tu cuenta y volver a consultarla después.</p>
          <Link className={styles.primaryAction} href="/me/taps">Revisar mis lecturas<ArrowRight size={18} aria-hidden="true" /></Link>
          <p className={styles.note}>Guardar una referencia no registra automáticamente la titularidad del producto.</p>
        </section> : <>
          <div className={styles.collectionHeading}><h2>En tu cuenta</h2><span>{source.data.length} {source.data.length === 1 ? "producto en esta lista" : "productos en esta lista"}</span></div>
          <div className={styles.productGrid}>{source.data.map((product, index) => {
            const certificateHref = product.readingHref;
            const experienceHref = homeProductExperienceHref(product);
            return <article className={styles.productCard} key={`${product.eventId || product.batch || product.name}-${index}`}>
              <div className={styles.productIdentity}>
                <ConsumerProductImage product={product} className={styles.productPhoto} />
                <div className={styles.productCopy}><span className={styles.eyebrow}>{product.brand || "Marca no informada"}</span><h3>{product.name}</h3><p className={styles.metadata}>{product.batch ? `Lote ${product.batch}` : "Lote no informado"}</p><span className={styles.status}>{homeOwnershipLabel(product.ownershipStatus)}</span></div>
              </div>

              <div className={styles.readingSummary}><ScanLine size={20} aria-hidden="true" /><div><span className={styles.eyebrow}>Última lectura reportada</span><p>{homeVerdictLabel(product.latestVerdict)}</p><span className={styles.metadata}>{product.latestLocation || "Zona no reportada"}</span></div></div>

              <nav className={styles.actions} aria-label={`Acciones de ${product.name}`}>
                {certificateHref ? <Link className={styles.primaryAction} href={certificateHref}>Abrir lectura<ArrowUpRight size={17} aria-hidden="true" /></Link> : <Link className={styles.secondaryAction} href="/me/taps">Consultar historial<History size={17} aria-hidden="true" /></Link>}
                {experienceHref && <Link className={styles.secondaryAction} href={experienceHref}><MessageSquareText size={17} aria-hidden="true" />Compartir experiencia</Link>}
                {product.tenantSlug && <Link className={styles.secondaryAction} href={`/me/marketplace?tenant=${encodeURIComponent(product.tenantSlug)}`}><ShoppingBag size={17} aria-hidden="true" />Ver catálogo de la marca</Link>}
              </nav>

              <details className={styles.details}><summary>Datos del registro</summary>
                <dl><div><dt>Guardado en tu cuenta</dt><dd>{product.savedAt.dateTime ? <time dateTime={product.savedAt.dateTime}>{product.savedAt.date} UTC</time> : product.savedAt.date}</dd></div>
                  <div><dt>Horario de la última lectura</dt><dd>{product.latestAt.dateTime ? <time dateTime={product.latestAt.dateTime}>{product.latestAt.date} UTC</time> : product.latestAt.date}</dd></div>
                  <div><dt>Referencia de lectura disponible</dt><dd>{product.eventId ? `#${product.eventId}` : "No informada"}</dd></div></dl>
                <p>El registro digital y la lectura no certifican por sí solos el contenido, la procedencia o la custodia física. Los horarios se muestran en UTC.</p>
              </details>
            </article>;
          })}</div>
        </>}
      </div>
    </PortalShell>
  );
}
