import Link from "next/link";
import { CalendarDays, MessageSquareText, ShieldCheck, Sparkles, Star, Store, TicketCheck, WalletCards } from "lucide-react";
import { asArray, buildConsumerNextPath, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";
import { VerifiedExperienceForm } from "./verified-experience-form";
import styles from "./experiences.module.css";

type VerifiedExperience = {
  id?: string;
  product_name?: string;
  tenant_slug?: string;
  rating?: number;
  title?: string | null;
  body?: string | null;
  city?: string | null;
  country?: string | null;
  trust_score?: number | null;
  trust_score_status?: string;
  moderation_status?: string;
  visibility?: string;
  verification_badges?: string[];
  created_at?: string;
};

function statusCopy(status?: string) {
  if (status === "approved") return "Aprobada por la marca";
  if (status === "needs_brand_response") return "Respuesta de marca";
  if (status === "rejected") return "No publicada";
  return "En revisión";
}

function badgeCopy(value: string) {
  const map: Record<string, string> = {
    tap_fisico_confirmado: "Evento NFC asociado",
    contacto_validado: "Contacto validado",
    dueno_verificado: "Titularidad digital registrada",
    producto_guardado: "Producto guardado",
    foto_de_uso_real: "Foto aportada",
    nfc_event_linked: "Lectura digital asociada",
    consumer_session_authenticated: "Cuenta autenticada",
    digital_ownership_record_claimed: "Titularidad digital registrada",
    digital_ownership_not_claimed: "Sin titularidad digital registrada",
    consumer_supplied_photo: "Foto aportada",
  };
  return map[value] || value.replace(/_/g, " ");
}

export default async function ConsumerExperiencesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/experiences", params));
  const tenant = typeof params.tenant === "string" ? params.tenant : "";
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const productName = typeof params.product === "string" ? params.product : "";
  const payload = (await fetchConsumerPath("experiences")) as { verifiedExperiences?: unknown } | null;
  const verifiedExperiences = asArray<VerifiedExperience>(payload?.verifiedExperiences);

  return (
    <PortalShell
      title="Mis experiencias y comentarios"
      subtitle="Consultá tus comentarios y la revisión de la marca. Los registros asociados no prueban uso, procedencia ni autenticidad física del producto."
    >
      <div className={styles.page}>
        
        {/* Review Form Container */}
        <VerifiedExperienceForm initialEventId={eventId} initialProductName={productName} tenant={tenant} />

        {/* Proof-of-Tap explanation card */}
        <section data-testid="experience-explainer" className={styles.explainer}>
          <div className={styles.explainerGrid}>
            <div>
              <p className={styles.eyebrow}>Comentarios asociados al producto</p>
              <h2 className={styles.heading}>Tu opinión queda ligada a una interacción registrada</h2>
              <p className={styles.description}>
                El comentario se asocia a tu cuenta y a una lectura digital o registro de titularidad en el Pasaporte. Esos registros no demuestran uso, procedencia ni condición física del producto.
              </p>
            </div>
            <div className={styles.proofGrid}>
              {[
                { title: "Registros asociados", detail: "Lectura digital, cuenta o titularidad registrada.", Icon: ShieldCheck },
                { title: "Revisión de la marca", detail: "La marca revisa el comentario antes de publicarlo.", Icon: Sparkles },
              ].map(({ title, detail, Icon }) => (
                <div key={title} className={styles.proofCard}>
                  <Icon className={styles.icon} aria-hidden="true" />
                  <p className={styles.cardTitle}>{title}</p>
                  <p className={styles.description}>{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* My reviews list */}
        <section>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>Tus comentarios y su estado</h3>
              <p className={styles.description}>Podés consultar cuáles siguen en revisión y la respuesta de la marca.</p>
            </div>
            <Link href={tenant ? `/me/products?tenant=${encodeURIComponent(tenant)}` : "/me/products"} className={styles.actionLink}>
              Elegir un producto para comentar
            </Link>
          </div>
          
          {verifiedExperiences.length ? (
            <div className={styles.reviewGrid}>
              {verifiedExperiences.map((experience) => {
                const hasTrustScore = experience.trust_score_status !== "not_computed"
                  && typeof experience.trust_score === "number"
                  && Number.isFinite(experience.trust_score);
                return (
                <article key={experience.id || `${experience.product_name}-${experience.created_at}`} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    <div>
                      <span className={styles.brand}>{experience.tenant_slug || "Marca"}</span>
                      <h4 className={styles.productTitle}>{experience.product_name || "Producto asociado"}</h4>
                      <p className={styles.description}>
                        {[experience.city, experience.country].filter(Boolean).join(", ") || "Ubicación privada"}
                      </p>
                    </div>
                    
                    {/* Star Rating */}
                    <div className={styles.rating}>
                      <Star className={styles.starIcon} aria-hidden="true" />
                      {Number(experience.rating || 0).toFixed(1)}
                    </div>
                  </div>
                  
                  <p className={styles.reviewTitle}>{experience.title || "Experiencia del producto"}</p>
                  <p className={styles.reviewBody}>{experience.body || "Comentario pendiente de completar."}</p>
                  
                  {/* Badges block */}
                  <div className={styles.badges}>
                    <span className={styles.badge}>
                      {hasTrustScore ? `Trust Score ${experience.trust_score}/100` : "Trust Score no calculado"}
                    </span>
                    <span className={styles.badge}>{statusCopy(experience.moderation_status)}</span>
                    {(experience.verification_badges || []).slice(0, 4).map((badge) => (
                      <span key={badge} className={styles.badge}>{badgeCopy(badge)}</span>
                    ))}
                  </div>
                </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <MessageSquareText className={styles.emptyIcon} aria-hidden="true" />
              <p className={styles.cardTitle}>No hay comentarios para mostrar</p>
              <p className={styles.description}>
                Elegí un producto de tu Pasaporte para compartir una experiencia con la marca.
              </p>
            </div>
          )}
        </section>

        {/* Bottom Quick Links Navigation */}
        <section className={styles.quickLinks}>
          {[
            { title: "Catálogo", detail: "Consultá productos y propuestas de la marca.", href: tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace", Icon: Store },
            { title: "Registros digitales", detail: "Consultá solicitudes y registros de titularidad.", href: tenant ? `/me/wallet?tenant=${encodeURIComponent(tenant)}` : "/me/wallet", Icon: WalletCards },
            { title: "Beneficios", detail: "Consultá los beneficios disponibles en tu Pasaporte.", href: tenant ? `/me/rewards?tenant=${encodeURIComponent(tenant)}` : "/me/rewards", Icon: TicketCheck },
          ].map(({ title, detail, href, Icon }) => (
            <Link key={title} href={href} className={styles.quickLink}>
              <div className={styles.quickLinkHeader}>
                <p className={styles.cardTitle}>{title}</p>
                <Icon className={styles.icon} aria-hidden="true" />
              </div>
              <p className={styles.description}>{detail}</p>
            </Link>
          ))}
        </section>

        {/* Upcoming Experiences Block */}
        <section>
          <h3 className={styles.sectionTitle}>Reservas y visitas</h3>
          <div className={styles.infoCard}>
            <CalendarDays className={styles.icon} aria-hidden="true" />
            <p className={styles.cardTitle}>Información de reservas no disponible en esta pantalla.</p>
            <p className={styles.description}>
              Consultá con la marca para confirmar una visita o reserva.
            </p>
          </div>
        </section>

        {/* Check-ins History block */}
        <section>
          <h3 className={styles.sectionTitle}>Historial de visitas</h3>
          <div className={styles.infoCard}>
            <p className={styles.description}>El historial de visitas no está disponible en esta pantalla. Consultá a la marca si necesitás revisar una asistencia.</p>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
