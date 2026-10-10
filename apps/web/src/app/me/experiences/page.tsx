import Link from "next/link";
import { ArrowRight, MessageSquareText, Sparkles, Star, Store, TicketCheck } from "lucide-react";
import { buildConsumerNextPath, fetchConsumerPath, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import { PortalShell } from "../_components/portal-shell";
import { VerifiedExperienceForm } from "./verified-experience-form";
import { buildExperienceModel, experienceEventId, experienceTenant } from "./experience-model";
import { parseConsumerTap } from "../_components/consumer-taps-model";
import { consumerFeedbackAvailability, CONSUMER_FEEDBACK_UNAVAILABLE } from "../_components/consumer-feedback-policy";
import { readPublicTenantConfiguration } from "../../../lib/public-tenant-configuration";
import styles from "./experiences.module.css";

export default async function ConsumerExperiencesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const session = await readConsumerSession(buildConsumerNextPath("/me/experiences", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const eventId = experienceEventId(params.eventId);
  const [experiencesPayload, readingPayload] = await Promise.all([
    fetchConsumerPath("experiences"), eventId ? fetchConsumerPath(`taps/${encodeURIComponent(eventId)}`) : null,
  ]);
  const reading = readingPayload?.ok === true ? parseConsumerTap(readingPayload.item) : null;
  const ownedReading = reading?.id === eventId ? reading : null;
  const tenant = experienceTenant(eventId ? ownedReading?.tenantSlug : params.tenant);
  const configuration = ownedReading?.tenantSlug ? await readPublicTenantConfiguration(eventId) : null;
  const feedback = consumerFeedbackAvailability(configuration, ownedReading?.tenantSlug);
  const productName = ownedReading?.productName || "Producto guardado";
  const model = buildExperienceModel(experiencesPayload);
  return <PortalShell title="Tus experiencias" subtitle="Compartí tu opinión, leé la respuesta de la marca y descubrí sus propuestas.">
    <div className={styles.page} data-testid="consumer-experiences">
      {eventId ? feedback === "available" ? <VerifiedExperienceForm initialEventId={eventId} initialProductName={productName} tenant={ownedReading?.tenantSlug || ""} />
        : <section className={styles.unavailable} role="status" data-testid="consumer-experience-disabled"><h2>No está disponible enviar una opinión</h2><p className={styles.description}>{CONSUMER_FEEDBACK_UNAVAILABLE[feedback]}</p><Link className={styles.actionLink} href="/me/products" prefetch={false}>Volver a mis productos<ArrowRight className={styles.icon} aria-hidden="true" /></Link></section>
        : <section className={styles.startCard} aria-labelledby="experience-start-title">
          <span className={styles.startIcon}><MessageSquareText aria-hidden="true" /></span>
          <div><h2 id="experience-start-title" className={styles.heading}>¿Cómo fue tu experiencia?</h2><p className={styles.description}>Elegí un producto guardado para contarle a la marca qué te gustó o qué puede mejorar.</p></div>
          <Link className={styles.actionLink} href="/me/products" prefetch={false}>Elegir un producto<ArrowRight className={styles.icon} aria-hidden="true" /></Link>
        </section>}

      <section aria-labelledby="experience-reviews-title">
        <div className={styles.sectionHeader}><div><h2 id="experience-reviews-title" className={styles.sectionTitle}>Tus opiniones y respuestas</h2><p className={styles.description}>El estado de cada comentario, sin perder de vista el producto.</p></div></div>
        {model.reviews.status === "unavailable" ? <section className={styles.unavailable} role="status"><h3>No pudimos cargar tus comentarios</h3><p className={styles.description}>Reintentá para consultar sus estados y las respuestas de la marca.</p><ConsumerDataRetryButton /></section>
          : model.reviews.items.length === 0 ? <div className={styles.empty}><MessageSquareText className={styles.emptyIcon} aria-hidden="true" /><p className={styles.cardTitle}>Todavía no hay comentarios en tu cuenta</p><p className={styles.description}>Tu primera opinión empieza desde la ficha de un producto.</p></div>
            : <div className={styles.reviewGrid}>{model.reviews.items.map(review => <article key={review.id} className={styles.reviewCard}>
              <header className={styles.reviewHeader}><div><span className={styles.brand}>{review.tenant || "Marca no informada"}</span><h3 className={styles.productTitle}>{review.product}</h3></div>
                {review.rating !== null ? <span className={styles.rating} aria-label={`${review.rating} de 5 estrellas`}><Star className={styles.starIcon} aria-hidden="true" />{review.rating}/5</span> : <span className={styles.badge}>Puntaje no informado</span>}</header>
              {review.title && <p className={styles.reviewTitle}>{review.title}</p>}<p className={styles.reviewBody}>{review.body || "Comentario no informado"}</p>
              <div className={styles.badges}><span className={styles.badge}>{review.moderation}</span><span className={styles.badge}>{review.visibility}</span></div>
              {review.response && <section className={styles.brandResponse} aria-label="Respuesta de la marca"><h4>Respuesta de la marca</h4><p>{review.response}</p></section>}
              {(review.badges.length > 0 || review.trust !== null) && <details className={styles.recordDetails}><summary>Ver registros asociados</summary><div className={styles.badges}>{review.badges.map((badge, index) => <span key={`${badge}-${index}`} className={styles.badge}>{badge}</span>)}{review.trust !== null && <span className={styles.badge}>Puntaje de confianza reportado: {review.trust}/100</span>}</div></details>}
            </article>)}</div>}
      </section>

      <section aria-labelledby="experience-offers-title">
        <div className={styles.sectionHeader}><div><h2 id="experience-offers-title" className={styles.sectionTitle}>Propuestas de tus marcas</h2><p className={styles.description}>Revisá sus condiciones en Beneficios antes de planificar una visita o un canje.</p></div></div>
        {model.offers.status === "unavailable" ? <section className={styles.unavailable} role="status"><h3>No pudimos consultar las propuestas</h3><p className={styles.description}>La disponibilidad está pendiente de consulta.</p><ConsumerDataRetryButton /></section>
          : model.offers.items.length === 0 ? <div className={styles.empty}><Sparkles className={styles.emptyIcon} aria-hidden="true" /><p className={styles.cardTitle}>No hay propuestas para mostrar en esta cuenta</p><p className={styles.description}>Las experiencias que publiquen tus marcas aparecerán acá.</p></div>
            : <div className={styles.reviewGrid}>{model.offers.items.map(offer => <article className={styles.infoCard} key={offer.id}><span className={styles.brand}>{offer.tenant || "Marca no informada"}</span><h3 className={styles.productTitle}>{offer.title}</h3>{offer.href && <Link className={styles.actionLink} href={offer.href} prefetch={false}>Consultar beneficios<ArrowRight className={styles.icon} aria-hidden="true" /></Link>}</article>)}</div>}
      </section>

      <section data-testid="experience-explainer" className={styles.explainer}><h2 className={styles.heading}>Tu opinión, con contexto</h2><p className={styles.description}>El comentario se asocia a tu cuenta y a un registro del producto. La marca lo revisa antes de publicarlo. Esos registros no demuestran uso, procedencia ni condición física del producto.</p></section>
      <nav className={styles.quickLinks} aria-label="Seguir explorando">
        {[{ title: "Catálogo", detail: "Productos y propuestas de la marca.", href: tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace", Icon: Store }, { title: "Beneficios", detail: "Condiciones, puntos y vouchers de tus marcas.", href: tenant ? `/me/rewards?tenant=${encodeURIComponent(tenant)}` : "/me/rewards", Icon: TicketCheck }].map(({ title, detail, href, Icon }) => <Link key={title} href={href} className={styles.quickLink}><div className={styles.quickLinkHeader}><span className={styles.cardTitle}>{title}</span><Icon className={styles.icon} aria-hidden="true" /></div><p className={styles.description}>{detail}</p></Link>)}
      </nav>
    </div>
  </PortalShell>;
}
