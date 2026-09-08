import Link from "next/link";
import {
  ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Clock3, HelpCircle, MapPin, Package, ScanLine,
} from "lucide-react";
import { buildConsumerNextPath, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { buildConsumerTapsSource, CONSUMER_TAPS_LIMIT } from "../_components/consumer-taps-model";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import { PortalShell } from "../_components/portal-shell";
import styles from "./taps.module.css";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TapsTimelinePage({
  searchParams,
}: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/taps", params));
  const source = buildConsumerTapsSource(await fetchConsumerPath("taps"));

  return (
    <PortalShell
      title="Historial de lecturas"
      subtitle="Volvé a una lectura y consultá el resultado y los datos que quedaron registrados en tu cuenta."
    >
      <div className={styles.history}>
        <nav className={styles.toolbar} aria-label="Navegación del historial">
          <Link href="/me"><ArrowLeft size={16} aria-hidden="true" /> Volver al inicio</Link>
          <Link href="/me/products"><Package size={16} aria-hidden="true" /> Mis productos</Link>
        </nav>

        {source.status === "unavailable" ? (
          <section className={styles.loadError} role="status">
            <CircleAlert size={24} aria-hidden="true" />
            <div>
              <h2>No pudimos cargar tus lecturas.</h2>
              <p>El historial no respondió. Esto no significa que tu cuenta no tenga lecturas guardadas.</p>
              <ConsumerDataRetryButton />
            </div>
          </section>
        ) : source.data.length === 0 ? (
          <section className={styles.empty}>
            <span className={styles.emptyIcon}><ScanLine size={28} aria-hidden="true" /></span>
            <h2>Todavía no hay lecturas asociadas.</h2>
            <p>Acercá el teléfono a una etiqueta NFC o escaneá el QR de un producto. Desde su pasaporte podés guardar la lectura en tu cuenta.</p>
            <Link href="/me/products" className={styles.secondaryAction}>
              Ver mis productos <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <p className={styles.emptyNote}>Aquí aparecen las lecturas vinculadas a tu cuenta, no todas las lecturas de una empresa.</p>
          </section>
        ) : (
          <section aria-labelledby="recent-readings-title">
            <header className={styles.listHeading}>
              <div>
                <h2 id="recent-readings-title">Tus lecturas recientes</h2>
                <p>Hasta {CONSUMER_TAPS_LIMIT} lecturas asociadas · Horarios en UTC</p>
              </div>
              <span className={styles.count}>
                {source.data.length} {source.data.length === 1 ? "lectura" : "lecturas"} en esta lista
              </span>
            </header>

            <ol className={styles.list} aria-label="Lecturas asociadas a tu cuenta">
              {source.data.map((tap, index) => {
                const Icon = tap.status === "validated" ? CheckCircle2 : tap.status === "attention" ? CircleAlert : HelpCircle;
                const brand = tap.brandName || tap.tenantName || tap.tenantSlug;
                return (
                  <li key={`${tap.id || "unreferenced"}-${index}`}>
                    <article className={styles.reading} data-status={tap.status}>
                      <div className={styles.readingMain}>
                        <span className={styles.readingIcon}><Icon size={23} aria-hidden="true" /></span>
                        <div className={styles.readingContent}>
                          <div className={styles.badges}>
                            <span className={styles.status}>{tap.statusLabel}</span>
                            {tap.risk.kind !== "unreported" ? (
                              <span className={styles.risk} data-risk={tap.risk.kind === "category" ? tap.risk.category : "score"}>
                                {tap.risk.label}
                              </span>
                            ) : null}
                          </div>
                          <h3>{tap.productName || brand || "Lectura guardada"}</h3>
                          {tap.productName && brand ? <p className={styles.brand}>{brand}</p> : null}
                          <div className={styles.metadata}>
                            <span>
                              <Clock3 size={15} aria-hidden="true" />
                              {tap.dateTime ? <time dateTime={tap.dateTime}>{tap.date}</time> : tap.date}
                            </span>
                            <span><MapPin size={15} aria-hidden="true" /> {tap.location ? `Zona reportada: ${tap.location}` : "Zona no reportada"}</span>
                          </div>
                        </div>
                        <div className={styles.actions}>
                          {tap.href ? (
                            <Link href={tap.href} prefetch={false} className={styles.primaryAction} aria-label={`Abrir lectura ${tap.id}`}>
                              Abrir lectura <ArrowRight size={17} aria-hidden="true" />
                            </Link>
                          ) : (
                            <p className={styles.noReference}>Detalle no disponible: falta la referencia.</p>
                          )}
                        </div>
                      </div>

                      <details className={styles.details}>
                        <summary>Datos del registro {tap.id ? <span>#{tap.id}</span> : null}</summary>
                        <dl>
                          <div><dt>Referencia de lectura</dt><dd>{tap.id || "No informada"}</dd></div>
                          <div><dt>Empresa</dt><dd>{tap.tenantName || tap.tenantSlug || "No informada"}</dd></div>
                          <div><dt>Resultado registrado</dt><dd>{tap.verdict || "No informado"}</dd></div>
                          <div><dt>Riesgo reportado</dt><dd>{tap.risk.label}</dd></div>
                          {tap.batch ? <div><dt>Lote</dt><dd>{tap.batch}</dd></div> : null}
                        </dl>
                      </details>
                    </article>
                  </li>
                );
              })}
            </ol>
            <p className={styles.sampleNote}>
              Esta lista muestra hasta {CONSUMER_TAPS_LIMIT} lecturas recientes; no es un total histórico. Abrir una lectura permite consultar su registro, no realizar un nuevo tap.
            </p>
          </section>
        )}

        <details className={styles.help}>
          <summary>Cómo leer los resultados</summary>
          <p>Un mensaje NFC validado indica que pasó los controles digitales. El estado del sello y la zona son datos reportados por esa lectura; no confirman el estado físico actual del producto ni un recorrido.</p>
          <p>Un resultado no confirmado no se cuenta como una alerta ni como una validación. Los beneficios, la vinculación de productos y los permisos de contacto se revisan por separado.</p>
        </details>
      </div>
    </PortalShell>
  );
}
