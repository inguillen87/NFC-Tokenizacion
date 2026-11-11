import { ConsumerProductLibrary } from "./product-library";
import { productFocus, publicProductScope } from "./product-library-model";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleAlert, History, MessageSquareText, Package, ScanLine, ShoppingBag } from "lucide-react";
import { buildConsumerNextPath, fetchConsumerPath, readConsumerSession, readConsumerTapHandoffPresence } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { buildHomeProductsSource, homeOwnershipLabel, homeProductExperienceHref, homeVerdictLabel } from "../_components/consumer-home-model";
import { ConsumerDataRetryButton, ConsumerProductImage } from "../_components/me-portal-interactive-client";
import { PortalShell } from "../_components/portal-shell";
import { tapAssociationContext } from "../_components/tap-association-model";
import { associationCopy } from "../_components/tap-association-copy";
import { getWebI18n } from "../../../lib/locale";
import associationStyles from "../_components/tap-association-banner.module.css";
import styles from "./products.module.css";

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const next = buildConsumerNextPath("/me/products", params);
  const session = await readConsumerSession(next);
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const context = tapAssociationContext(new URL(next, "https://nexid.invalid").searchParams);
  const [products, handoffPresent] = await Promise.all([
    fetchConsumerPath("products"),
    context?.preferred === "save" ? readConsumerTapHandoffPresence(context.eventId) : null,
  ]);
  const source = buildHomeProductsSource(products);
  const missingSaveEventId = handoffPresent === false ? context?.eventId : undefined;
  const matchingIndex = missingSaveEventId && source.status === "ready" ? productFocus(source.data, missingSaveEventId) : null;
  const matchingScope = matchingIndex !== null && source.status === "ready" ? publicProductScope(source.data[matchingIndex]) : null;
  const savedProductHref = missingSaveEventId && matchingScope && context && context.tenant === matchingScope.tenant
    && (!context.bid || context.bid === matchingScope.bid) ? `/me/products?focus=${missingSaveEventId}` : null;
  const copy = missingSaveEventId ? associationCopy[(await getWebI18n()).locale] : null;
  const tapSaveHandoffFallback = missingSaveEventId && copy ? {
    eventId: missingSaveEventId,
    content: <section className={associationStyles.panel} aria-labelledby="save-handoff-title" data-testid={savedProductHref ? "save-handoff-existing-product" : "save-handoff-required"}>
      <header><span className={associationStyles.eyebrow}>{copy.actions.save.label}</span>
        <h2 id="save-handoff-title">{savedProductHref ? copy.savedProductTitle : copy.titles.fresh_required}</h2>
        <p>{savedProductHref ? copy.savedProductHelp : copy.saveHandoffMissing}</p></header>
      <div className={associationStyles.confirmation}><Link className={associationStyles.primary} href={savedProductHref || "/me/products"} prefetch={false}>
        {savedProductHref ? copy.savedProductAction : copy.products}
      </Link></div>
    </section>,
  } : undefined;

  return (
    <PortalShell title="Tus productos guardados" subtitle="Volvé a su información, consultá una lectura o compartí tu experiencia con la marca." tapSaveHandoffFallback={tapSaveHandoffFallback}>
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
        </section> : <ConsumerProductLibrary products={source.data} focusEvent={typeof params.focus==='string'?params.focus:null}/>}
      </div>
    </PortalShell>
  );
}
