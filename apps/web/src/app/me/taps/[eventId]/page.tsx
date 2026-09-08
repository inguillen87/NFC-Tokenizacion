import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleAlert, Clock3, LockKeyhole, MapPin, Package, ScanLine } from "lucide-react";
import { fetchConsumerPath, requireConsumerSession } from "../../_components/consumer-api";
import { homeReadingHref } from "../../_components/consumer-home-model";
import { parseConsumerTap } from "../../_components/consumer-taps-model";
import { ConsumerDataRetryButton } from "../../_components/me-portal-interactive-client";
import { PortalShell } from "../../_components/portal-shell";
import styles from "./reading.module.css";

function reportedText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export default async function ConsumerReadingPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const nextPath = homeReadingHref(eventId);
  await requireConsumerSession(nextPath || "/me/taps");
  const payload = nextPath ? await fetchConsumerPath(`taps/${encodeURIComponent(eventId)}`) : null;
  const item = payload?.ok === true && payload.item && typeof payload.item === "object" && !Array.isArray(payload.item) ? payload.item : null;
  const parsed = parseConsumerTap(item);
  const reading = parsed?.id === eventId ? parsed : null;
  const product = reading ? reportedText(item?.product_name) : null;
  const brand = reading ? reportedText(item?.brand_name) || reading.tenantName || reading.tenantSlug : null;
  const batch = reading ? reportedText(item?.bid) : null;

  return <PortalShell title="Tu lectura guardada" subtitle="Consultá el registro que está vinculado a tu cuenta.">
    <div className={styles.reading}>
      <nav className={styles.toolbar} aria-label="Volver desde la lectura"><Link href="/me/taps"><ArrowLeft size={18} aria-hidden="true" />Volver al historial</Link><span><LockKeyhole size={16} aria-hidden="true" />Acceso privado</span></nav>
      {!reading ? <section className={styles.unavailable} role="status"><CircleAlert size={28} aria-hidden="true" /><div><h2>No pudimos abrir esta lectura.</h2><p>Puede no estar disponible para esta cuenta o haber un problema de conexión. No se muestran datos de otras personas.</p><ConsumerDataRetryButton /><Link href="/me/taps">Consultar mis lecturas<ArrowRight size={17} aria-hidden="true" /></Link></div></section>
        : <article className={styles.card}>
          <header className={styles.identity}><span className={styles.icon}><ScanLine size={30} aria-hidden="true" /></span><div><p className={styles.eyebrow}>{brand || "Marca no informada"}</p><h2>{product || `Lectura #${reading.id}`}</h2><p className={styles.muted}>{batch ? `Lote ${batch} · ` : ""}Referencia #{reading.id}</p></div></header>
          <section className={styles.result} data-state={reading.status} aria-label="Resultado de la lectura"><p className={styles.eyebrow}>Resultado reportado</p><h3>{reading.statusLabel}</h3><p className={styles.risk} data-risk={reading.risk.kind === "category" ? reading.risk.category : "unreported"}>{reading.risk.label}</p></section>
          <dl className={styles.facts}><div><dt><Clock3 size={18} aria-hidden="true" />Fecha y hora</dt><dd>{reading.dateTime ? <time dateTime={reading.dateTime}>{reading.date}</time> : reading.date}</dd></div><div><dt><MapPin size={18} aria-hidden="true" />Zona reportada</dt><dd>{reading.location || "No informada"}</dd></div></dl>
          <nav className={styles.actions} aria-label="Continuar desde esta lectura"><Link className={styles.primary} href="/me/products"><Package size={18} aria-hidden="true" />Ver mis productos<ArrowRight size={18} aria-hidden="true" /></Link>{reading.tenantSlug && <Link className={styles.secondary} href={`/me/marketplace?tenant=${encodeURIComponent(reading.tenantSlug)}`}>Ver catálogo de la marca<ArrowRight size={18} aria-hidden="true" /></Link>}</nav>
          <details className={styles.details}><summary>Ver datos y alcance del registro</summary><dl><div><dt>Resultado original</dt><dd>{reading.verdict || "No informado"}</dd></div><div><dt>Empresa del registro</dt><dd>{reading.tenantSlug || "No informada"}</dd></div><div><dt>Referencia</dt><dd>#{reading.id}</dd></div></dl><p>Esta es una lectura guardada, no un tap nuevo. La ubicación y el resultado corresponden al evento reportado; no certifican por sí solos el contenido o la custodia física del producto. Los horarios se muestran en UTC.</p></details>
        </article>}
    </div>
  </PortalShell>;
}
